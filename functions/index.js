import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import admin from 'firebase-admin';
import http from 'http';
import https from 'https';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

// axios가 Node.js http/https 어댑터를 사용하도록 설정
// Firebase Functions v2 (Node.js 20) 환경에서 fetch 대신 http/https 사용
// 수정일: 2026-01-29 - fetch is not a function 오류 해결
axios.defaults.httpAgent = new http.Agent({ keepAlive: true });
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });

const app = express();
const db = admin.firestore();

// CORS 허용 오리진 (bcsa.co.kr 프로덕션 + 로컬 개발)
const ALLOWED_ORIGINS = [
  'https://bcsa.co.kr',
  'https://www.bcsa.co.kr',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// CORS 설정 - 명시된 오리진만 허용 (Cloud Run에서 안정적 동작)
app.use(cors({
  origin: (origin, cb) => {
    const allow = !origin || ALLOWED_ORIGINS.includes(origin) ? (origin || ALLOWED_ORIGINS[0]) : ALLOWED_ORIGINS[0];
    cb(null, allow);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // URL 인코딩 파라미터 처리

// 요청 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  console.log(`[Query]`, req.query);
  next();
});

const truncateLog = (value, maxLength = 2000) => {
  if (value === null || value === undefined) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const parseApiResponse = async (rawData, contentType) => {
  if (rawData === null || rawData === undefined) {
    return { parsed: null, rawText: '' };
  }

  if (typeof rawData === 'object') {
    return { parsed: rawData, rawText: '' };
  }

  const rawText = String(rawData).trim();
  if (!rawText) {
    return { parsed: null, rawText: '' };
  }

  const isXml = contentType?.includes('xml') || rawText.startsWith('<');
  const isJson = contentType?.includes('json');

  const tryJson = () => JSON.parse(rawText);
  const tryXml = () =>
    parseStringPromise(rawText, {
      explicitArray: false,
      trim: true,
      mergeAttrs: true
    });

  try {
    if (isJson && !isXml) {
      return { parsed: tryJson(), rawText };
    }
    if (isXml && !isJson) {
      return { parsed: await tryXml(), rawText };
    }
    try {
      return { parsed: tryJson(), rawText };
    } catch (jsonErr) {
      return { parsed: await tryXml(), rawText };
    }
  } catch (parseError) {
    return { parsed: null, rawText, parseError };
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API Proxy is running' });
});

// 카카오 로그인: 인증 코드 → 액세스 토큰 → 사용자 정보 → Firebase 커스텀 토큰 → 프론트 리다이렉트
// 환경 변수는 요청 시점에 읽음 (Cloud Run 등에서 런타임에 주입되는 경우 대비)
function getKakaoEnv() {
  const restKey = process.env.KAKAO_REST_API_KEY || process.env.KAKAO_JS_KEY || process.env.KAKAO_REST_KEY || '';
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || '';
  const frontendUrl = (process.env.FRONTEND_URL || 'https://bcsa.co.kr').replace(/\/$/, '');
  return { restKey: restKey.trim(), clientSecret: clientSecret.trim(), frontendUrl };
}

app.get('/api/auth/kakao/callback', async (req, res) => {
  const { restKey: KAKAO_REST_KEY, clientSecret: KAKAO_CLIENT_SECRET, frontendUrl: FRONTEND_URL } = getKakaoEnv();
  const code = req.query.code;
  if (!code) {
    res.redirect(`${FRONTEND_URL}/?auth=kakao&error=no_code`);
    return;
  }
  if (!KAKAO_REST_KEY) {
    console.error('[Kakao Auth] REST API key not set. Check KAKAO_REST_API_KEY or KAKAO_JS_KEY in Cloud Run env.');
    res.redirect(`${FRONTEND_URL}/?auth=kakao&error=server_config`);
    return;
  }
  const host = req.get('host') || '';
  const baseUrl = (
    process.env.KAKAO_REDIRECT_BASE_URL ||
    process.env.FUNCTION_URL ||
    process.env.VITE_API_URL ||
    (host ? `https://${host}` : '')
  ).replace(/\/$/, '');
  if (!baseUrl) {
    console.error('[Kakao Auth] Could not determine base URL. Set KAKAO_REDIRECT_BASE_URL or FUNCTION_URL in Cloud Run.');
    res.redirect(`${FRONTEND_URL}/?auth=kakao&error=server_config`);
    return;
  }
  const redirectUri = `${baseUrl}/api/auth/kakao/callback`;
  console.log('[Kakao Auth] redirectUri=', redirectUri, 'hasClientSecret=', !!KAKAO_CLIENT_SECRET);
  try {
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_KEY,
        redirect_uri: redirectUri,
        code
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        ...(KAKAO_CLIENT_SECRET ? {
          auth: { username: KAKAO_REST_KEY, password: KAKAO_CLIENT_SECRET }
        } : {})
      }
    );
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      res.redirect(`${FRONTEND_URL}/?auth=kakao&error=no_token`);
      return;
    }
    const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const kakaoId = meRes.data?.id;
    const kakaoAccount = meRes.data?.kakao_account || {};
    const profile = kakaoAccount.profile || {};
    const email = (kakaoAccount.email || '').toString();
    const nickname = (profile.nickname || '').toString();
    const legalName = (kakaoAccount.legal_name || kakaoAccount.name || '').toString();
    const phoneNumber = (kakaoAccount.phone_number || '').toString();
    const name = legalName || nickname || '카카오 사용자';
    if (!kakaoId) {
      res.redirect(`${FRONTEND_URL}/?auth=kakao&error=no_user`);
      return;
    }
    const firebaseUid = `kakao_${kakaoId}`;
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    const tokenParam = encodeURIComponent(customToken);
    const profilePayload = { name, phone: phoneNumber, email };
    const base64url = Buffer.from(JSON.stringify(profilePayload), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const pParam = encodeURIComponent(base64url);
    res.redirect(`${FRONTEND_URL}/#auth=kakao&token=${tokenParam}&p=${pParam}`);
  } catch (err) {
    const kakaoError = err.response?.data?.error;
    const kakaoDesc = err.response?.data?.error_description || '';
    console.error('[Kakao Auth]', err.response?.data || err.message);
    // KOE010: Bad client credentials → REST API 키 또는 Client Secret 불일치
    if (kakaoError === 'invalid_client' || (kakaoDesc && kakaoDesc.toLowerCase().includes('client credential'))) {
      res.redirect(`${FRONTEND_URL}/?auth=kakao&error=bad_credentials`);
      return;
    }
    res.redirect(`${FRONTEND_URL}/?auth=kakao&error=server_error`);
  }
});

// 카카오 계정 상태 변경 웹훅 (OAuth: user-linked 등) — Content-Type: application/secevent+jwt
// JWT payload만 디코딩해 이벤트 타입·sub(카카오 사용자 ID) 로깅 후 200 응답
app.post('/api/webhook/kakao', express.raw({ type: 'application/secevent+jwt' }), (req, res) => {
  try {
    const raw = req.body;
    const jwtStr = Buffer.isBuffer(raw) ? raw.toString('utf8') : (typeof raw === 'string' ? raw : '');
    if (jwtStr) {
      const parts = jwtStr.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(
          Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        );
        const sub = payload.sub;
        const events = payload.events || {};
        const eventTypes = Object.keys(events);
        console.log('[Kakao Webhook]', { sub, eventTypes, aud: payload.aud, iss: payload.iss });
      } else {
        console.log('[Kakao Webhook] raw length', jwtStr.length);
      }
    } else {
      console.log('[Kakao Webhook] no body');
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Kakao Webhook]', err);
    res.status(200).json({ received: true });
  }
});

// 결제 전 대기 저장 (리다이렉트 결제 직전 클라이언트 호출)
app.post('/api/payment/pending', async (req, res) => {
  try {
    const body = req.body || {};
    const merchantUid = body.merchant_uid || body.merchantUid;
    const seminarId = body.seminar_id || body.seminarId;
    const userId = body.user_id || body.userId;
    if (!merchantUid || !seminarId || !userId) {
      res.status(400).json({ saved: false, error: 'merchant_uid, seminar_id, user_id required' });
      return;
    }
    const data = {
      merchant_uid: merchantUid,
      seminar_id: seminarId,
      user_id: userId,
      user_name: body.user_name || body.userName || '',
      user_email: body.user_email || body.userEmail || '',
      user_phone: body.user_phone || body.userPhone || '',
      application_data: body.application_data || body.applicationData || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('pendingPayments').doc(String(merchantUid)).set(data, { merge: true });
    res.status(200).json({ saved: true });
  } catch (err) {
    console.error('[Payment Pending] error', err);
    res.status(500).json({ saved: false, error: 'server_error' });
  }
});

// 결제 결과 페이지에서 웹훅 처리 완료 여부 확인
app.get('/api/payment/status', async (req, res) => {
  try {
    const merchantUid = req.query.merchant_uid || req.query.merchantUid;
    if (!merchantUid) {
      res.status(200).json({ completed: false });
      return;
    }
    const snap = await db.collection('paymentWebhookEvents').doc(String(merchantUid)).get();
    const completed = snap.exists && snap.data()?.completed === true;
    res.status(200).json({ completed });
  } catch (err) {
    console.error('[Payment Status] error', err);
    res.status(200).json({ completed: false });
  }
});

// PortOne 결제 웹훅 (관리자 콘솔에서 Endpoint URL로 이 경로 등록)
// POST body: imp_uid, merchant_uid, status 등. 10초 내 200 응답 권장.
app.post('/api/payment/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const impUid = body.imp_uid || body.impUid;
    const merchantUid = body.merchant_uid || body.merchantUid;
    const status = body.status;

    if (!merchantUid) {
      console.warn('[Payment Webhook] missing merchant_uid', truncateLog(body));
      res.status(200).json({ received: true, warning: 'missing merchant_uid' });
      return;
    }

    const payload = {
      imp_uid: impUid,
      merchant_uid: merchantUid,
      status,
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      raw: truncateLog(body, 1000)
    };
    await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set(payload, { merge: true });

    if (status === 'paid') {
      const pendingSnap = await db.collection('pendingPayments').doc(String(merchantUid)).get();
      if (pendingSnap.exists) {
        const pending = pendingSnap.data();
        const seminarId = pending.seminar_id || pending.seminarId;
        const appData = pending.application_data || pending.applicationData || {};
        const reason = [appData.participationPath, appData.applyReason].filter(Boolean).join(' / ') || '';
        const questions = Array.isArray(appData.preQuestions) ? appData.preQuestions : (appData.preQuestions ? [appData.preQuestions] : []);

        await db.collection('applications').add({
          seminarId,
          userId: pending.user_id || pending.userId,
          userName: pending.user_name || pending.userName || '',
          userEmail: pending.user_email || pending.userEmail || '',
          userPhone: pending.user_phone || pending.userPhone || '',
          participationPath: appData.participationPath || '',
          applyReason: appData.applyReason || '',
          preQuestions: appData.preQuestions || '',
          mealAfter: appData.mealAfter || '',
          privacyAgreed: appData.privacyAgreed === true,
          reason,
          questions,
          appliedAt: new Date().toISOString(),
          merchant_uid: merchantUid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const seminarRef = db.collection('seminars').doc(seminarId);
        const seminarSnap = await seminarRef.get();
        if (seminarSnap.exists) {
          const current = (seminarSnap.data()?.currentParticipants || 0) + 1;
          await seminarRef.update({ currentParticipants: current });
        }

        await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set({ completed: true }, { merge: true });
        await db.collection('pendingPayments').doc(String(merchantUid)).delete();
        console.log('[Payment Webhook] application completed', merchantUid);
      }
    }

    res.status(200).json({ received: true, merchant_uid: merchantUid });
  } catch (err) {
    console.error('[Payment Webhook] error', err);
    res.status(200).json({ received: true, error: 'processing' });
  }
});

// 결제 취소(환불) API: 신청 취소 시 PortOne 전액 취소 후 application 삭제, 세미나 인원 감소
app.post('/api/payment/cancel', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.user_id || body.userId;
    const seminarId = body.seminar_id || body.seminarId;
    if (!userId || !seminarId) {
      res.status(400).json({ cancelled: false, error: 'user_id and seminar_id required' });
      return;
    }

    const appSnap = await db.collection('applications').where('userId', '==', userId).get();
    const matched = appSnap.docs
      .filter(d => String(d.data().seminarId) === String(seminarId))
      .map(d => ({ id: d.id, ...d.data() }));
    const byCreated = (a, b) => {
      const at = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
      return bt - at;
    };
    matched.sort(byCreated);
    const application = matched[0];
    if (!application) {
      res.status(404).json({ cancelled: false, error: 'application_not_found' });
        return;
      }
    const merchantUid = application.merchant_uid;
    if (!merchantUid) {
      res.status(400).json({ cancelled: false, error: 'no_merchant_uid' });
      return;
    }

    const apiKey = process.env.PORTONE_API_KEY;
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error('[Payment Cancel] PORTONE_API_KEY or PORTONE_API_SECRET not set');
      res.status(500).json({ cancelled: false, error: 'payment_config_missing' });
      return;
    }

    const tokenRes = await axios({
      url: 'https://api.iamport.kr/users/getToken',
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: { imp_key: apiKey, imp_secret: apiSecret }
    });
    const tokenData = tokenRes.data;
    const accessToken = tokenData?.response?.access_token;
    if (!accessToken) {
      console.error('[Payment Cancel] getToken failed', truncateLog(tokenData));
      res.status(500).json({ cancelled: false, error: 'token_failed' });
      return;
    }

    const cancelRes = await axios({
      url: 'https://api.iamport.kr/payments/cancel',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        merchant_uid: merchantUid,
        reason: body.reason || '세미나 신청 취소'
      }
    });
    const cancelBody = cancelRes.data;
    if (cancelBody?.code !== 0) {
      console.warn('[Payment Cancel] PortOne cancel failed', truncateLog(cancelBody));
      res.status(400).json({
        cancelled: false,
        error: 'cancel_failed',
        message: cancelBody?.message || '결제 취소 실패'
      });
      return;
    }

    await db.collection('applications').doc(application.id).delete();
    const seminarRef = db.collection('seminars').doc(String(seminarId));
    const seminarSnap = await seminarRef.get();
    if (seminarSnap.exists) {
      const current = Math.max(0, (seminarSnap.data()?.currentParticipants || 0) - 1);
      await seminarRef.update({ currentParticipants: current });
    }
    console.log('[Payment Cancel] application cancelled', application.id, merchantUid);
    res.status(200).json({ cancelled: true, merchant_uid: merchantUid });
  } catch (err) {
    console.error('[Payment Cancel] error', err);
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 404 || data?.code === -1) {
      res.status(404).json({ cancelled: false, error: 'payment_not_found', message: data?.message || err.message });
      return;
    }
    res.status(500).json({ cancelled: false, error: 'server_error', message: err.message });
  }
});

// Blaze 플랜 외부 네트워크 접속 테스트 엔드포인트
app.get('/api/network-test', async (req, res, next) => {
  const testUrl = 'https://www.google.com/generate_204';

  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
            responseType: 'text',
            validateStatus: () => true
          });

    res.status(200).json({
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      url: testUrl,
      contentType: response.headers['content-type'] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    error.context = { endpoint: 'network-test', url: testUrl };
    next(error);
  }
});

// 에러 로깅 미들웨어 (상세 디버깅용)
app.use((err, req, res, next) => {
  const status = err.status || err.response?.status || 500;
  const responseData = err.response?.data;
  console.error('[API Error]', {
    method: req.method,
    url: req.originalUrl,
    status,
    message: err.message,
    context: err.context || null,
    responseData: responseData ? truncateLog(responseData) : null
  });
  next(err);
});

// 전역 에러 응답 미들웨어 (5xx에도 CORS 헤더 보장)
app.use((err, req, res, next) => {
  const origin = req.get('Origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 관리자 강제 탈퇴 시 Firebase Auth 사용자 삭제 (재가입 가능하도록)
export const deleteAuthUser = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const callerUid = request.auth.uid;
    const targetUid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : null;
    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'uid is required');
    }

    // 관리자 확인: 문서 id가 uid인 경우 또는 users 컬렉션에서 uid 필드로 조회
    let callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      const byUid = await db.collection('users').where('uid', '==', callerUid).limit(1).get();
      if (!byUid.empty) callerDoc = byUid.docs[0];
    }
    if (!callerDoc || !callerDoc.exists) {
      throw new HttpsError('permission-denied', '권한이 없습니다.');
    }
    const role = callerDoc.data()?.role;
    if (role !== 'admin') {
      throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
    }

    try {
      await admin.auth().deleteUser(targetUid);
      console.log('[deleteAuthUser] deleted Auth uid:', targetUid);
      return { success: true };
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log('[deleteAuthUser] user not found (already deleted):', targetUid);
        return { success: true };
      }
      console.error('[deleteAuthUser]', err.code, err.message);
      throw new HttpsError('internal', err.message || 'Auth 사용자 삭제에 실패했습니다.');
    }
  }
);

// Express 앱을 Firebase Functions로 내보내기
// asia-northeast3 (서울) 지역 사용
// 1,000명 동시 접속 대비: memory 256MiB 설정으로 과금 방지
export const apiBid = onRequest({ 
  region: 'asia-northeast3',
  invoker: 'public',  // 공개 접근 허용, cors는 Express에서 처리
  memory: '256MiB'    // 동시 접속 대비 최소 메모리 설정
}, app);

