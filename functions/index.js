import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import admin from 'firebase-admin';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import sharp from 'sharp';
import { buildPasswordResetEmailHtml, buildPasswordResetEmailText } from './email/passwordResetTemplate.js';
import { isSmtpConfigured, sendMail } from './email/mailer.js';

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

/** seminars 문서 필드: true면 참가 인원은 applications 건수만 쓰고 currentParticipants는 갱신하지 않음 (클라이언트와 동일 상수명) */
const USE_APPLICATIONS_PARTICIPANT_COUNT = 'useApplicationsParticipantCount';

async function incrementSeminarParticipantsIfLegacy(seminarRef) {
  const seminarSnap = await seminarRef.get();
  if (!seminarSnap.exists) return;
  const data = seminarSnap.data() || {};
  if (data[USE_APPLICATIONS_PARTICIPANT_COUNT] === true) return;
  const current = (Number(data.currentParticipants) || 0) + 1;
  await seminarRef.update({ currentParticipants: current });
}

async function decrementSeminarParticipantsIfLegacy(seminarRef, delta = 1) {
  const seminarSnap = await seminarRef.get();
  if (!seminarSnap.exists) return;
  const data = seminarSnap.data() || {};
  if (data[USE_APPLICATIONS_PARTICIPANT_COUNT] === true) return;
  const prev = Math.max(0, Number(data.currentParticipants) || 0);
  const d = Math.max(0, Math.floor(Number(delta) || 0));
  if (d === 0) return;
  await seminarRef.update({ currentParticipants: Math.max(0, prev - d) });
}

// CORS 허용 오리진 (bcsa.co.kr 프로덕션 + Firebase Hosting + 로컬 개발)
const ALLOWED_ORIGINS = [
  'https://bcsa.co.kr',
  'https://www.bcsa.co.kr',
  'https://bcsa-b190f.web.app',
  'https://bcsa-b190f.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// CORS 설정 - 허용 오리진만 통과, 미허용 오리진은 CORS 헤더 없이 차단
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, origin || ALLOWED_ORIGINS[0]);
    } else {
      cb(null, false);
    }
  },
  credentials: true
}));
// 이미지 base64(encode-webp)용 큰 JSON 허용
// verify 옵션으로 rawBody 캡처 (웹훅 서명 검증에 사용)
app.use(express.json({
  limit: '15mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' })); // URL 인코딩 파라미터 처리

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

// ==========================================
// PortOne 결제 보안 상수 (서명 검증 + 실결제 조회)
// ==========================================
const PORTONE_WEBHOOK_SECRET = process.env.PORTONE_WEBHOOK_SECRET || '';
const PORTONE_V2_SECRET = process.env.PORTONE_V2_SECRET || '';

/**
 * PortOne V2 웹훅 서명 검증
 * portone-signature 헤더: t=<timestamp>,v1=<hex_hmac>
 * HMAC-SHA256("<timestamp>.<rawBody>", PORTONE_WEBHOOK_SECRET)
 */
const verifyPortOneWebhookSignature = (req) => {
  if (!PORTONE_WEBHOOK_SECRET) {
    console.warn('[Payment Webhook] PORTONE_WEBHOOK_SECRET 미설정 — 서명 검증 생략 (보안 위험)');
    return true;
  }
  const sigHeader = (req.headers['portone-signature'] || '').toString();
  if (!sigHeader) return false;
  const parts = {};
  sigHeader.split(',').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) parts[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  const timestamp = parts['t'];
  const receivedSig = parts['v1'];
  if (!timestamp || !receivedSig) return false;
  const rawBody = req.rawBody || '';
  const expected = crypto
    .createHmac('sha256', PORTONE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  try {
    const a = Buffer.from(receivedSig.toLowerCase(), 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/**
 * PortOne 실결제 조회 및 금액 검증
 * V2: PORTONE_V2_SECRET 사용 (GET api.portone.io/payments/{paymentId})
 * V1: PORTONE_API_KEY/SECRET 사용 (GET api.iamport.kr/payments/{imp_uid})
 */
const verifyPortOnePayment = async ({ isV2, paymentId, impUid, expectedAmount }) => {
  if (isV2) {
    if (!PORTONE_V2_SECRET) {
      console.warn('[Payment Verify] PORTONE_V2_SECRET 미설정 — 금액 검증 생략');
      return { verified: true, skipped: true };
    }
    const res = await axios.get(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `PortOne ${PORTONE_V2_SECRET}` } }
    );
    const p = res.data;
    if (p.status !== 'PAID') {
      return { verified: false, reason: 'not_paid', status: p.status };
    }
    const actualAmount = p.amount?.total ?? p.totalAmount ?? p.amount ?? null;
    if (expectedAmount != null && actualAmount != null && Number(actualAmount) !== Number(expectedAmount)) {
      console.error('[Payment Verify] V2 금액 불일치', { expected: expectedAmount, actual: actualAmount, paymentId });
      return { verified: false, reason: 'amount_mismatch', expected: expectedAmount, actual: actualAmount };
    }
    return { verified: true, payment: p };
  } else {
    // V1
    const apiKey = process.env.PORTONE_API_KEY;
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.warn('[Payment Verify] V1 키 미설정 — 금액 검증 생략');
      return { verified: true, skipped: true };
    }
    if (!impUid) return { verified: true, skipped: true };
    const tokenRes = await axios.post('https://api.iamport.kr/users/getToken', {
      imp_key: apiKey, imp_secret: apiSecret
    });
    const accessToken = tokenRes.data?.response?.access_token;
    if (!accessToken) return { verified: false, reason: 'token_failed' };
    const payRes = await axios.get(`https://api.iamport.kr/payments/${impUid}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const p = payRes.data?.response;
    if (!p || p.status !== 'paid') {
      return { verified: false, reason: 'not_paid', status: p?.status };
    }
    if (expectedAmount != null && p.amount != null && Number(p.amount) !== Number(expectedAmount)) {
      console.error('[Payment Verify] V1 금액 불일치', { expected: expectedAmount, actual: p.amount, impUid });
      return { verified: false, reason: 'amount_mismatch', expected: expectedAmount, actual: p.amount };
    }
    return { verified: true, payment: p };
  }
};

/**
 * 환불 금액 계산 (소비자분쟁해결기준)
 * 세미나 3일+ 전: 100%, 2일 전: 90%, 1일 전: 80%, 당일 이후: 0%
 */
const calculateRefundAmount = (paidAmount, seminarDateStr) => {
  const amount = Number(paidAmount) || 0;
  if (!seminarDateStr) return amount;
  let s = String(seminarDateStr).trim().split(/[\sT]/)[0];
  s = s.replace(/-/g, '.').replace(/\//g, '.');
  const parts = s.split('.');
  if (parts.length < 3) return amount;
  const semDate = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
  if (isNaN(semDate.getTime())) return amount;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  semDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((semDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays >= 3) return amount;
  if (diffDays === 2) return Math.floor(amount * 0.9);
  if (diffDays === 1) return Math.floor(amount * 0.8);
  return 0;
};

/**
 * 관리자 전용 API 미들웨어: Firebase ID 토큰 검증 + Firestore role=admin 확인
 */
const requireAdminAuth = async (req, res, next) => {
  const authHeader = (req.headers.authorization || '').toString();
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    let callerDoc = await db.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists) {
      const byUid = await db.collection('users').where('uid', '==', decoded.uid).limit(1).get();
      if (!byUid.empty) callerDoc = byUid.docs[0];
    }
    if (!callerDoc || !callerDoc.exists || callerDoc.data()?.role !== 'admin') {
      res.status(403).json({ success: false, error: 'forbidden' });
      return;
    }
    req.adminUid = decoded.uid;
    next();
  } catch (err) {
    console.error('[Admin Auth] 토큰 검증 실패', err.code || err.message);
    res.status(401).json({ success: false, error: 'invalid_token' });
  }
};

/**
 * 사용자 인증 미들웨어: Firebase ID 토큰 검증 후 req.authUid 설정
 */
const requireUserAuth = async (req, res, next) => {
  const authHeader = (req.headers.authorization || '').toString();
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.authUid = decoded.uid;
    next();
  } catch (err) {
    console.error('[User Auth] 토큰 검증 실패', err.code || err.message);
    res.status(401).json({ success: false, error: 'invalid_token' });
  }
};

// ==========================================
// 결제 식별자/상태 정규화 (PortOne V1 imp + V2 paymentId 호환)
// ==========================================

/**
 * 웹훅/요청 body에서 내부 결제 식별자(우리 시스템의 merchant_uid == PortOne paymentId)를 추출.
 * V1: merchant_uid / merchantUid
 * V2: payment_id / paymentId, 또는 data.paymentId / data.payment_id (Transaction.* 이벤트)
 */
const extractPaymentId = (body) => {
  if (!body || typeof body !== 'object') return '';
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const candidate =
    body.merchant_uid ||
    body.merchantUid ||
    body.payment_id ||
    body.paymentId ||
    data.paymentId ||
    data.payment_id ||
    '';
  return String(candidate || '').trim();
};

/** 웹훅 body가 "결제 승인(paid)"을 의미하는지 판정 (V1 'paid' + V2 'Paid'/'PAID'/'Transaction.Paid') */
const isPaidWebhook = (body) => {
  if (!body || typeof body !== 'object') return false;
  const status = String(body.status || '').toLowerCase();
  if (status === 'paid') return true;
  const type = String(body.type || '');
  if (type === 'Transaction.Paid') return true;
  return false;
};

/**
 * pendingPayments 문서로 applications 신청을 생성. 중복(merchant_uid 동일) 방지 포함.
 * @returns {Promise<{ created: boolean, applicationId: string|null }>}
 */
async function createApplicationFromPending(paymentId, pending) {
  const id = String(paymentId);
  // 중복 방지: 이미 같은 merchant_uid로 신청이 있으면 생성하지 않음
  const existing = await db.collection('applications').where('merchant_uid', '==', id).limit(1).get();
  if (!existing.empty) {
    return { created: false, applicationId: existing.docs[0].id };
  }

  const seminarId = pending.seminar_id || pending.seminarId;
  const appData = pending.application_data || pending.applicationData || {};
  const reason = [appData.participationPath, appData.applyReason].filter(Boolean).join(' / ') || '';
  const questions = Array.isArray(appData.preQuestions)
    ? appData.preQuestions
    : (appData.preQuestions ? [appData.preQuestions] : []);

  const appRef = await db.collection('applications').add({
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
    merchant_uid: id,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (seminarId) {
    const seminarRef = db.collection('seminars').doc(seminarId);
    await incrementSeminarParticipantsIfLegacy(seminarRef);
  }

  return { created: true, applicationId: appRef.id };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API Proxy is running' });
});

// ==========================================
// 카카오 로그인 (OAuth → Firebase Custom Token)
// ==========================================
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY || '';
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || '';
const KAKAO_DEFAULT_FRONTEND = process.env.FRONTEND_URL || 'https://bcsa.co.kr';
// 카카오에 요청할 동의항목(미동의 시 콜백에서 빈 값 → 가입 폼에서 수동 입력 유도)
const KAKAO_SCOPE = process.env.KAKAO_SCOPE || 'account_email,phone_number';
// OAuth state 서명용 비밀키 (전용 키 없으면 client secret → rest key 순으로 폴백)
const KAKAO_STATE_SECRET = process.env.KAKAO_STATE_SECRET || KAKAO_CLIENT_SECRET || KAKAO_REST_KEY || 'kakao-state';
const KAKAO_STATE_TTL_MS = 10 * 60 * 1000; // 10분
const KAKAO_CODE_TTL_MS = 5 * 60 * 1000; // 1회용 교환 코드 5분

const base64UrlEncode = (obj) =>
  Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base64UrlDecode = (str) => {
  const base64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

/** state 서명 생성: payload(base64url).signature(base64url) */
const signKakaoState = (payloadObj) => {
  const payload = base64UrlEncode(payloadObj);
  const sig = crypto.createHmac('sha256', KAKAO_STATE_SECRET).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${sig}`;
};

/** state 검증: 서명 일치 + 만료 확인. 유효하면 payload 객체, 아니면 null */
const verifyKakaoState = (state) => {
  try {
    const [payload, sig] = String(state || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', KAKAO_STATE_SECRET).update(payload).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const obj = base64UrlDecode(payload);
    if (obj.exp && Date.now() > Number(obj.exp)) return null;
    return obj;
  } catch (_) {
    return null;
  }
};

/** 카카오 phone_number(+82 10-1234-5678) → 01012345678 정규화 */
const normalizeKakaoPhone = (raw) => {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('82')) digits = '0' + digits.slice(2);
  digits = digits.slice(0, 11);
  return (digits.length === 10 || digits.length === 11) ? digits : '';
};

const getKakaoRedirectUri = (req) => {
  const baseUrl = (process.env.KAKAO_REDIRECT_BASE_URL || process.env.FUNCTION_URL || `https://${req.get('host') || ''}`).replace(/\/$/, '');
  return `${baseUrl}/api/auth/kakao/callback`;
};

/**
 * 카카오 기존 회원 매칭: kakaoId → 검증된 email(단일 후보) → phone(단일 후보) 순.
 * 자동 오연결 방지를 위해 후보가 2명 이상이면 연결하지 않고 conflict로 반환한다.
 * 반환: { uid, docId, alreadyLinked } | { conflict: true, reason } | null
 */
async function matchExistingUserForKakao({ kakaoId, email, phone, isEmailVerified }) {
  const kakaoIdStr = String(kakaoId);

  // 1) 이미 연결된 kakaoId가 최우선
  let snap = await db.collection('users').where('kakaoId', '==', kakaoIdStr).limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { uid: (d.data().uid || d.id), docId: d.id, alreadyLinked: true };
  }

  let matched = null;

  // 2) 이메일 매칭: 카카오에서 "검증된" 이메일이고 후보가 정확히 1명일 때만 자동 연결
  if (email && isEmailVerified === true) {
    const emailSnap = await db.collection('users').where('email', '==', email).limit(2).get();
    if (emailSnap.size > 1) {
      console.warn('[Kakao Auth] email match conflict (multiple users):', email);
      return { conflict: true, reason: 'email_multiple' };
    }
    if (emailSnap.size === 1) matched = emailSnap.docs[0];
  }

  // 3) 전화번호 매칭: phone / phoneNumber 필드 후보를 합쳐 정확히 1명일 때만 자동 연결
  if (!matched && phone) {
    const byPhone = await db.collection('users').where('phone', '==', phone).limit(2).get();
    const byPhoneNumber = await db.collection('users').where('phoneNumber', '==', phone).limit(2).get();
    const candidateMap = new Map();
    byPhone.docs.forEach((d) => candidateMap.set(d.id, d));
    byPhoneNumber.docs.forEach((d) => candidateMap.set(d.id, d));
    if (candidateMap.size > 1) {
      console.warn('[Kakao Auth] phone match conflict (multiple users):', phone);
      return { conflict: true, reason: 'phone_multiple' };
    }
    if (candidateMap.size === 1) matched = Array.from(candidateMap.values())[0];
  }

  if (!matched) return null;

  await matched.ref.update({
    kakaoId: kakaoIdStr,
    providers: admin.firestore.FieldValue.arrayUnion('kakao'),
    lastLoginProvider: 'kakao',
    kakaoLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('[Kakao Auth] linked kakaoId to existing user doc:', matched.id);
  return { uid: (matched.data().uid || matched.id), docId: matched.id, alreadyLinked: false };
}

/** 카카오 전화번호(01012345678) → E.164(+821012345678) */
const toE164Kr = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  if (digits.startsWith('82')) return `+${digits}`;
  return '';
};

/**
 * createCustomToken 전에 Firebase Auth 사용자 레코드를 보장한다.
 * 이메일/전화 충돌(다른 uid가 선점)은 무시하고 uid 기준 레코드만 보강한다.
 */
async function ensureFirebaseAuthUser(uid, { email, displayName, phone } = {}) {
  try {
    await admin.auth().getUser(uid);
    return;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      console.warn('[Kakao Auth] getUser failed (non-fatal):', err.code || err.message);
      return;
    }
  }
  const e164 = toE164Kr(phone);
  const baseProps = { uid };
  if (displayName) baseProps.displayName = displayName;
  // 1차: email/phone 포함 시도 → 충돌 시 점진적으로 제거하며 재시도
  const attempts = [
    { ...baseProps, ...(email ? { email } : {}), ...(e164 ? { phoneNumber: e164 } : {}) },
    { ...baseProps, ...(email ? { email } : {}) },
    { ...baseProps },
  ];
  for (const props of attempts) {
    try {
      await admin.auth().createUser(props);
      return;
    } catch (e) {
      // email-already-exists / phone-number-already-exists 등은 다음 후보로 폴백
      if (e.code === 'auth/uid-already-exists') return;
    }
  }
  console.warn('[Kakao Auth] ensureFirebaseAuthUser: could not create auth record for', uid);
}

// 카카오 로그인 시작: 프론트 origin을 state로 보존한 채 카카오 인가 페이지로 이동
app.get('/api/auth/kakao/start', (req, res) => {
  if (!KAKAO_REST_KEY) {
    res.redirect(`${KAKAO_DEFAULT_FRONTEND}/?auth=kakao&error=server_config`);
    return;
  }
  const origin = (req.query.origin || '').toString();
  const frontendUrl = ALLOWED_ORIGINS.includes(origin) ? origin : KAKAO_DEFAULT_FRONTEND;
  const signup = req.query.signup === '1' ? '1' : '0';
  // link 모드: 이미 로그인된 uid에 카카오 계정을 연결
  const linkUid = (req.query.link_uid || '').toString().trim();
  // CSRF 방지를 위한 서명·만료 포함 state
  const state = signKakaoState({
    o: frontendUrl,
    s: signup,
    ...(linkUid ? { link_uid: linkUid } : {}),
    n: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + KAKAO_STATE_TTL_MS,
  });
  const params = new URLSearchParams({
    client_id: KAKAO_REST_KEY,
    redirect_uri: getKakaoRedirectUri(req),
    response_type: 'code',
    state,
  });
  if (KAKAO_SCOPE) params.set('scope', KAKAO_SCOPE);
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
});

// 카카오 콜백: 코드 → 토큰 → 프로필 → 기존 회원 매칭/연결 → Firebase Custom Token → 프론트 리다이렉트
app.get('/api/auth/kakao/callback', async (req, res) => {
  let frontendUrl = KAKAO_DEFAULT_FRONTEND;
  let isSignup = false;
  let linkUid = ''; // link 모드: 이 uid의 계정에 카카오 연결
  const parsedState = verifyKakaoState(req.query.state || '');
  if (parsedState) {
    if (parsedState.o && ALLOWED_ORIGINS.includes(parsedState.o)) frontendUrl = parsedState.o;
    isSignup = parsedState.s === '1';
    linkUid = (parsedState.link_uid || '').toString().trim();
  } else {
    // 서명/만료 검증 실패 → CSRF 의심으로 차단
    console.warn('[Kakao Auth] invalid or expired state');
    res.redirect(`${frontendUrl}/?auth=kakao&error=invalid_state`);
    return;
  }

  const code = req.query.code;
  if (!code) {
    res.redirect(`${frontendUrl}/?auth=kakao&error=no_code`);
    return;
  }
  if (!KAKAO_REST_KEY) {
    console.error('[Kakao Auth] KAKAO_REST_API_KEY not set');
    res.redirect(`${frontendUrl}/?auth=kakao&error=server_config`);
    return;
  }
  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_REST_KEY,
      redirect_uri: getKakaoRedirectUri(req),
      code,
    });
    if (KAKAO_CLIENT_SECRET) tokenParams.set('client_secret', KAKAO_CLIENT_SECRET);
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      res.redirect(`${frontendUrl}/?auth=kakao&error=no_token`);
      return;
    }

    const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const kakaoId = meRes.data?.id;
    if (!kakaoId) {
      res.redirect(`${frontendUrl}/?auth=kakao&error=no_user`);
      return;
    }
    const kakaoAccount = meRes.data?.kakao_account || {};
    const profile = kakaoAccount.profile || {};
    const email = (kakaoAccount.email || '').toString().trim().toLowerCase();
    const isEmailVerified = kakaoAccount.is_email_verified;
    const nickname = (profile.nickname || meRes.data?.properties?.nickname || '').toString();
    const legalName = (kakaoAccount.legal_name || kakaoAccount.name || '').toString();
    const phone = normalizeKakaoPhone(kakaoAccount.phone_number);
    const name = legalName || nickname || '';
    const kakaoIdStr = String(kakaoId);

    // ── link 모드: 이미 로그인된 사용자가 카카오 계정 연결 요청 ──
    if (linkUid) {
      // 다른 계정에 이미 연결된 kakaoId인지 확인
      const alreadySnap = await db.collection('users').where('kakaoId', '==', kakaoIdStr).limit(1).get();
      if (!alreadySnap.empty && (alreadySnap.docs[0].data().uid || alreadySnap.docs[0].id) !== linkUid) {
        res.redirect(`${frontendUrl}/?auth=kakao&error=kakao_already_linked`);
        return;
      }
      // linkUid 사용자 문서 조회
      let userDocRef = null;
      const directSnap = await db.collection('users').doc(linkUid).get();
      if (directSnap.exists) {
        userDocRef = directSnap.ref;
      } else {
        const byUid = await db.collection('users').where('uid', '==', linkUid).limit(1).get();
        if (!byUid.empty) userDocRef = byUid.docs[0].ref;
      }
      if (!userDocRef) {
        res.redirect(`${frontendUrl}/?auth=kakao&error=user_not_found`);
        return;
      }
      await userDocRef.update({
        kakaoId: kakaoIdStr,
        providers: admin.firestore.FieldValue.arrayUnion('kakao'),
        kakaoLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('[Kakao Link] linked kakaoId', kakaoIdStr, 'to uid', linkUid);
      const params = new URLSearchParams({ auth: 'kakao', result: 'linked' });
      res.redirect(`${frontendUrl}/#${params.toString()}`);
      return;
    }

    // ── 일반 로그인 모드 ──
    // 기존 회원 매칭 (kakaoId → email → phone). 매칭되면 기존 uid로 로그인해 계정 동기화
    const matched = await matchExistingUserForKakao({ kakaoId, email, phone, isEmailVerified });
    if (matched && matched.conflict) {
      // 이메일/전화 후보가 여러 명 → 자동 연결 차단, 사용자에게 안내
      res.redirect(`${frontendUrl}/?auth=kakao&error=link_conflict`);
      return;
    }
    const firebaseUid = matched ? matched.uid : `kakao_${kakaoIdStr}`;

    // Auth 사용자 레코드 보장 후 Custom Token 발급
    await ensureFirebaseAuthUser(firebaseUid, { email, displayName: name, phone });
    const customToken = await admin.auth().createCustomToken(firebaseUid, { provider: 'kakao' });

    // Custom Token을 URL에 직접 노출하지 않기 위해 1회용 교환 코드 발급
    const profilePayload = { name, phone, email, kakaoId: kakaoIdStr };
    const exchangeCode = crypto.randomBytes(24).toString('hex');
    await db.collection('kakaoOAuthCodes').doc(exchangeCode).set({
      token: customToken,
      profile: profilePayload,
      isNew: !matched,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      exp: Date.now() + KAKAO_CODE_TTL_MS,
    });

    const params = new URLSearchParams({
      auth: 'kakao',
      code: exchangeCode,
      new: matched ? '0' : '1',
      signup: isSignup ? '1' : '0',
    });
    res.redirect(`${frontendUrl}/#${params.toString()}`);
  } catch (err) {
    console.error('[Kakao Auth]', err.response?.data || err.message);
    res.redirect(`${frontendUrl}/?auth=kakao&error=server_error`);
  }
});

// 1회용 코드 → Firebase Custom Token + 프로필 교환 (콜백에서 발급한 code로 호출)
app.post('/api/auth/kakao/exchange', async (req, res) => {
  try {
    const code = (req.body && (req.body.code || req.body.exchange_code)) || '';
    if (!code) {
      res.status(400).json({ ok: false, error: 'code required' });
      return;
    }
    const ref = db.collection('kakaoOAuthCodes').doc(String(code));
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: 'code_not_found' });
      return;
    }
    const data = snap.data() || {};
    // 1회용: 조회 즉시 삭제
    await ref.delete().catch(() => {});
    if (data.exp && Date.now() > Number(data.exp)) {
      res.status(410).json({ ok: false, error: 'code_expired' });
      return;
    }
    res.status(200).json({ ok: true, token: data.token, profile: data.profile || null, isNew: data.isNew === true });
  } catch (err) {
    console.error('[Kakao Exchange] error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// 카카오 계정 상태 변경 웹훅 (OAuth: user-linked 등) — Content-Type: application/secevent+jwt
app.post('/api/webhook/kakao', express.raw({ type: 'application/secevent+jwt' }), async (req, res) => {
  try {
    const raw = req.body;
    const jwtStr = Buffer.isBuffer(raw) ? raw.toString('utf8') : (typeof raw === 'string' ? raw : '');
    if (jwtStr) {
      const parts = jwtStr.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(
          Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        );
        const eventTypes = Object.keys(payload.events || {});
        console.log('[Kakao Webhook]', { sub: payload.sub, eventTypes });

        // 연결 해제(unlink) 이벤트: 해당 kakaoId 회원의 카카오 연결 정보 정리
        const isUnlink = eventTypes.some((t) => /unlink|unregister|withdraw/i.test(t));
        const kakaoId = payload.sub != null ? String(payload.sub) : '';
        if (isUnlink && kakaoId) {
          const snap = await db.collection('users').where('kakaoId', '==', kakaoId).get();
          for (const d of snap.docs) {
            await d.ref.update({
              providers: admin.firestore.FieldValue.arrayRemove('kakao'),
              kakaoId: admin.firestore.FieldValue.delete(),
              kakaoUnlinkedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          console.log('[Kakao Webhook] unlinked kakao for users:', snap.docs.map((d) => d.id).join(',') || '(none)');
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Kakao Webhook]', err);
    res.status(200).json({ received: true });
  }
});

/** WebP 품질: 본 사이트와 동일(클라 0~1 비율 또는 1~100) */
const DEFAULT_SERVER_WEBP_QUALITY = 85;
const MAX_IMAGE_INPUT_BYTES = 18 * 1024 * 1024;

const normalizeWebpQualityInput = (q) => {
  const n = Number(q);
  if (!Number.isFinite(n)) return DEFAULT_SERVER_WEBP_QUALITY;
  if (n > 0 && n <= 1) {
    return Math.min(100, Math.max(1, Math.round(n * 100)));
  }
  if (n >= 1 && n <= 100) return Math.round(n);
  return DEFAULT_SERVER_WEBP_QUALITY;
};

const parseImageToBuffer = (imageField) => {
  if (!imageField || typeof imageField !== 'string') return null;
  const s = imageField.trim();
  if (!s) return null;
  try {
    if (s.startsWith('data:')) {
      const comma = s.indexOf(',');
      if (comma === -1) return null;
      return Buffer.from(s.slice(comma + 1), 'base64');
    }
    return Buffer.from(s, 'base64');
  } catch {
    return null;
  }
};

/**
 * 클라이언트 업로드용: 원본의 1/2 픽셀 + WebP(기본 85%)
 * (sharp로 항상 WebP 인코딩, 브라우저 toBlob WebP 미지원 이슈 없음)
 */
app.post('/api/images/encode-webp', async (req, res) => {
  try {
    const buf = parseImageToBuffer(req.body?.image);
    if (!buf || buf.length === 0) {
      res.status(400).json({ error: 'image is required (data URL or base64 string)' });
      return;
    }
    if (buf.length > MAX_IMAGE_INPUT_BYTES) {
      res.status(413).json({ error: 'image too large' });
      return;
    }
    const webpQ = normalizeWebpQualityInput(req.body?.quality);
    const meta = await sharp(buf).metadata();
    const w = Math.max(1, Math.floor((meta.width || 1) / 2));
    const h = Math.max(1, Math.floor((meta.height || 1) / 2));
    const out = await sharp(buf)
      .rotate()
      .resize(w, h, { fit: 'fill' })
      .webp({ quality: webpQ })
      .toBuffer();
    const b64 = out.toString('base64');
    res.status(200).json({
      dataUrl: `data:image/webp;base64,${b64}`,
      mime: 'image/webp',
    });
  } catch (err) {
    console.error('[encode-webp]', err);
    res.status(400).json({ error: err?.message || 'encode failed' });
  }
});

// 결제 전 대기 저장 (리다이렉트 결제 직전 클라이언트 호출)
app.post('/api/payment/pending', async (req, res) => {
  try {
    const body = req.body || {};
    const merchantUid = extractPaymentId(body);
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

// 결제 결과 페이지에서 웹훅 처리 완료 여부 확인 (입금됐는데 오류 나는 경우 복구)
app.get('/api/payment/status', async (req, res) => {
  try {
    // V2(paymentId)와 V1(merchant_uid) 쿼리 모두 허용
    const merchantUid = String(
      req.query.merchant_uid || req.query.merchantUid || req.query.payment_id || req.query.paymentId || ''
    ).trim();
    if (!merchantUid) {
      res.status(200).json({ completed: false });
      return;
    }

    const webhookSnap = await db.collection('paymentWebhookEvents').doc(merchantUid).get();
    const webhookData = webhookSnap.exists ? webhookSnap.data() : {};
    if (webhookData.completed === true) {
      res.status(200).json({ completed: true });
      return;
    }

    // 이미 신청(applications)에 등록된 경우(웹훅은 됐는데 completed 미갱신 등) → 완료로 간주
    const appSnap = await db.collection('applications').where('merchant_uid', '==', merchantUid).limit(1).get();
    if (!appSnap.empty) {
      await db.collection('paymentWebhookEvents').doc(merchantUid).set({ completed: true }, { merge: true });
      res.status(200).json({ completed: true });
      return;
    }

    // 웹훅에서 paid 수신했는데 신청 처리만 실패한 경우: pendingPayments 기반으로 신청 생성 후 완료 처리
    // 저장된 webhook 문서가 paid(정규화된 boolean) 또는 V1 'paid' 문자열인 경우 모두 복구
    const webhookPaid = webhookData.paid === true || isPaidWebhook(webhookData);
    if (webhookPaid) {
      const pendingSnap = await db.collection('pendingPayments').doc(merchantUid).get();
      if (pendingSnap.exists) {
        const { created } = await createApplicationFromPending(merchantUid, pendingSnap.data());
        await db.collection('paymentWebhookEvents').doc(merchantUid).set({ completed: true }, { merge: true });
        await db.collection('pendingPayments').doc(merchantUid).delete();
        console.log('[Payment Status] recovered application from paid webhook', merchantUid, 'created:', created);
        res.status(200).json({ completed: true });
        return;
      }
    }

    res.status(200).json({ completed: false });
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

    // ① 웹훅 서명 검증 (V2: portone-signature 헤더)
    const isV2Webhook = !!(body.type || (body.data && body.data.paymentId));
    if (isV2Webhook && !verifyPortOneWebhookSignature(req)) {
      console.error('[Payment Webhook] 서명 검증 실패 — 요청 무시');
      res.status(200).json({ received: true, warning: 'signature_invalid' });
      return;
    }

    const impUid = body.imp_uid || body.impUid || (body.data && (body.data.transactionId || body.data.txId)) || '';
    // V1(merchant_uid)과 V2(payment_id / data.paymentId)를 동일 내부 식별자로 정규화
    const merchantUid = extractPaymentId(body);
    const paid = isPaidWebhook(body);

    if (!merchantUid) {
      console.warn('[Payment Webhook] missing payment id', truncateLog(body));
      res.status(200).json({ received: true, warning: 'missing payment id' });
      return;
    }

    const payload = {
      imp_uid: impUid,
      merchant_uid: merchantUid,
      status: body.status || body.type || '',
      paid,
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      raw: truncateLog(body, 1000)
    };
    await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set(payload, { merge: true });

    if (paid) {
      const pendingSnap = await db.collection('pendingPayments').doc(String(merchantUid)).get();

      if (pendingSnap.exists) {
        // ② PortOne API로 실결제 금액 조회 및 검증
        const pendingData = pendingSnap.data();
        const seminarSnap = pendingData.seminar_id
          ? await db.collection('seminars').doc(String(pendingData.seminar_id)).get()
          : null;
        const expectedAmount = seminarSnap?.exists
          ? Number(seminarSnap.data()?.applicationFee) || null
          : null;

        let paymentVerified = false;
        try {
          const vResult = await verifyPortOnePayment({
            isV2: isV2Webhook,
            paymentId: merchantUid,
            impUid,
            expectedAmount
          });
          paymentVerified = vResult.verified;
          if (!paymentVerified) {
            console.error('[Payment Webhook] 실결제 검증 실패', vResult.reason, merchantUid);
            await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set(
              { verify_failed: true, verify_reason: vResult.reason }, { merge: true }
            );
            res.status(200).json({ received: true, warning: 'payment_verify_failed' });
            return;
          }
        } catch (verifyErr) {
          console.warn('[Payment Webhook] 실결제 조회 오류 (처리 계속)', verifyErr.message);
          // API 조회 자체가 실패하면 서버 문제일 수 있으므로 일단 통과 (경고 로그)
          paymentVerified = true;
        }

        const { created, applicationId } = await createApplicationFromPending(merchantUid, pendingData);
        await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set({ completed: true }, { merge: true });
        await db.collection('pendingPayments').doc(String(merchantUid)).delete();
        console.log('[Payment Webhook] application completed', merchantUid, 'created:', created, 'appId:', applicationId);
      } else {
        // pending이 없지만 이미 신청이 있을 수 있음 → completed 보강
        const existing = await db.collection('applications').where('merchant_uid', '==', merchantUid).limit(1).get();
        if (!existing.empty) {
          await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set({ completed: true }, { merge: true });
          console.log('[Payment Webhook] application already exists, marked completed', merchantUid);
        } else {
          console.warn('[Payment Webhook] paid but no pending and no application', merchantUid);
        }
      }
    }

    res.status(200).json({ received: true, merchant_uid: merchantUid });
  } catch (err) {
    console.error('[Payment Webhook] error', err);
    res.status(200).json({ received: true, error: 'processing' });
  }
});

// 결제대기 → 신청자 편입 (관리자 수동 처리용). body: { merchant_uid: 'p_xxx' }
app.post('/api/admin/application-from-pending', requireAdminAuth, async (req, res) => {
  try {
    const merchantUid = extractPaymentId(req.body || {});
    if (!merchantUid) {
      res.status(400).json({ success: false, error: 'merchant_uid required' });
      return;
    }
    const pendingSnap = await db.collection('pendingPayments').doc(String(merchantUid)).get();
    if (!pendingSnap.exists) {
      res.status(404).json({ success: false, error: 'pending_not_found' });
      return;
    }

    const { created, applicationId } = await createApplicationFromPending(merchantUid, pendingSnap.data());
    await db.collection('paymentWebhookEvents').doc(String(merchantUid)).set({ completed: true }, { merge: true });
    await db.collection('pendingPayments').doc(String(merchantUid)).delete();
    res.status(200).json({ success: true, applicationId, created });
  } catch (err) {
    console.error('[application-from-pending] error', err);
    res.status(500).json({ success: false, error: err.message || 'server_error' });
  }
});

// 결제대기(pendingPayments) 전체 삭제 — 클라이언트 Firestore 규칙상 쓰기 불가이므로 Admin SDK로만 처리
// body: { confirm: 'DELETE_ALL_PENDING' }
app.post('/api/admin/pending-payments-delete-all', requireAdminAuth, async (req, res) => {
  try {
    const confirm = (req.body && req.body.confirm) || '';
    if (confirm !== 'DELETE_ALL_PENDING') {
      res.status(400).json({ success: false, error: 'confirmation_required' });
      return;
    }
    const snap = await db.collection('pendingPayments').get();
    if (snap.empty) {
      res.status(200).json({ success: true, deleted: 0 });
      return;
    }
    const docs = snap.docs;
    const maxBatch = 500;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += maxBatch) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + maxBatch);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += chunk.length;
    }
    console.log('[admin] pending-payments-delete-all deleted', deleted);
    res.status(200).json({ success: true, deleted });
  } catch (err) {
    console.error('[pending-payments-delete-all] error', err);
    res.status(500).json({ success: false, error: err.message || 'server_error' });
  }
});

// 관리자: 신청(applications) 1건 삭제 + 해당 프로그램 currentParticipants 1 감소 (클라이언트 규칙과 무관하게 Admin SDK)
// body: { application_id: '...' } 또는 applicationId
app.post('/api/admin/delete-application', requireAdminAuth, async (req, res) => {
  try {
    const applicationId = (req.body && (req.body.application_id || req.body.applicationId)) || '';
    if (!applicationId) {
      res.status(400).json({ success: false, error: 'application_id required' });
      return;
    }
    const appRef = db.collection('applications').doc(String(applicationId));
    const docSnap = await appRef.get();
    if (!docSnap.exists) {
      res.status(404).json({ success: false, error: 'application_not_found' });
      return;
    }
    const row = docSnap.data();
    const pickSeminarId = (v) => {
      if (v == null || v === '') return '';
      if (typeof v === 'object' && v.path && typeof v.path === 'string') {
        const parts = v.path.split('/');
        return (parts[parts.length - 1] || '').trim();
      }
      return String(v).trim();
    };
    const seminarId =
      pickSeminarId(row.seminarId) || pickSeminarId(row.programId) || pickSeminarId(row.seminar_id);
    await appRef.delete();
    if (seminarId) {
      const seminarRef = db.collection('seminars').doc(seminarId);
      await decrementSeminarParticipantsIfLegacy(seminarRef, 1);
    }
    console.log('[admin] delete-application', applicationId, seminarId || '(no seminar id)');
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[delete-application] error', err);
    res.status(500).json({ success: false, error: err.message || 'server_error' });
  }
});

/** 신청 문서 삭제 + 세미나 currentParticipants 감소 (matched: { id, ...data }[]) */
const removeMatchedApplicationsAndDecrementSeminar = async (matched, seminarIdStr) => {
  for (const row of matched) {
    await db.collection('applications').doc(row.id).delete();
  }
  const seminarRef = db.collection('seminars').doc(String(seminarIdStr));
  await decrementSeminarParticipantsIfLegacy(seminarRef, matched.length);
};

// 결제 취소(환불) API: 유료는 PortOne 취소 후 삭제. 무료·withdraw_only는 DB만 정리.
// body.withdraw_only === true 이면 PG 호출 없이 본인 신청 문서만 삭제 (이미 PG에서 취소한 경우 등)
app.post('/api/payment/cancel', requireUserAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const seminarId = body.seminar_id || body.seminarId;
    const withdrawOnly = body.withdraw_only === true || body.withdrawOnly === true;

    // 인증된 uid로 userId 고정 (클라이언트 전달값 무시하여 타인 신청 취소 방지)
    const authUid = req.authUid;
    // Firestore users 컬렉션에서 authUid에 해당하는 문서 id 조회 (userId 필드 통일)
    let userId = authUid;
    const userDocDirect = await db.collection('users').doc(authUid).get();
    if (!userDocDirect.exists) {
      const byUid = await db.collection('users').where('uid', '==', authUid).limit(1).get();
      if (!byUid.empty) userId = byUid.docs[0].id;
    }

    if (!seminarId) {
      res.status(400).json({ cancelled: false, error: 'seminar_id required' });
      return;
    }

    const sid = String(seminarId);
    // userId(doc id) 또는 authUid 둘 다 검색
    const appSnap1 = await db.collection('applications').where('userId', '==', userId).get();
    const appSnap2 = userId !== authUid
      ? await db.collection('applications').where('userId', '==', authUid).get()
      : { docs: [] };
    const seminarMatches = (data) => {
      const s1 = data.seminarId != null ? String(data.seminarId) : '';
      const s2 = data.programId != null ? String(data.programId) : '';
      const s3 = data.seminar_id != null ? String(data.seminar_id) : '';
      return s1 === sid || s2 === sid || s3 === sid;
    };
    const seenIds = new Set();
    const matched = [...appSnap1.docs, ...appSnap2.docs]
      .filter((d) => {
        if (seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return seminarMatches(d.data());
      })
      .map((d) => ({ id: d.id, ...d.data() }));
    const byCreated = (a, b) => {
      const at = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
      const bt = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
      return bt - at;
    };
    matched.sort(byCreated);
    if (matched.length === 0) {
      res.status(404).json({ cancelled: false, error: 'application_not_found' });
      return;
    }

    if (withdrawOnly) {
      await removeMatchedApplicationsAndDecrementSeminar(matched, sid);
      console.log('[Payment Cancel] withdraw_only (DB only)', matched.map((m) => m.id).join(','));
      res.status(200).json({ cancelled: true, withdraw_only: true });
      return;
    }

    const applicationWithMerchant = matched.find((a) => a.merchant_uid || a.merchantUid);
    const merchantUid = applicationWithMerchant?.merchant_uid || applicationWithMerchant?.merchantUid;

    if (!merchantUid) {
      await removeMatchedApplicationsAndDecrementSeminar(matched, sid);
      console.log('[Payment Cancel] free / no merchant_uid', matched.map((m) => m.id).join(','));
      res.status(200).json({ cancelled: true, free: true });
      return;
    }

    const apiKey = process.env.PORTONE_API_KEY;
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error('[Payment Cancel] PORTONE_API_KEY or PORTONE_API_SECRET not set');
      res.status(500).json({ cancelled: false, error: 'payment_config_missing' });
      return;
    }

    // 환불 금액: 세미나 날짜 기준 소비자분쟁해결기준 적용
    const seminarSnap = await db.collection('seminars').doc(sid).get();
    const seminarDate = seminarSnap.exists ? seminarSnap.data()?.date : null;
    const paidAmount = seminarSnap.exists ? Number(seminarSnap.data()?.applicationFee) || 0 : 0;
    const refundAmount = calculateRefundAmount(paidAmount, seminarDate);

    if (refundAmount <= 0 && paidAmount > 0) {
      res.status(400).json({
        cancelled: false,
        error: 'refund_not_allowed',
        message: '세미나 당일 이후에는 환불이 불가능합니다.',
      });
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

    const cancelPayload = {
      merchant_uid: merchantUid,
      reason: body.reason || '세미나 신청 취소'
    };
    // 부분 환불: 위약금 공제된 금액만 환불
    if (paidAmount > 0 && refundAmount < paidAmount) {
      cancelPayload.amount = refundAmount;
      cancelPayload.checksum = paidAmount;
    }

    const cancelRes = await axios({
      url: 'https://api.iamport.kr/payments/cancel',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      data: cancelPayload
    });
    const cancelBody = cancelRes.data;
    if (cancelBody?.code !== 0) {
      console.warn('[Payment Cancel] PortOne cancel failed', truncateLog(cancelBody));
      res.status(400).json({
        cancelled: false,
        error: 'cancel_failed',
        message: cancelBody?.message || '결제 취소 실패',
        allow_withdraw_only: true
      });
      return;
    }

    await removeMatchedApplicationsAndDecrementSeminar(matched, sid);
    const refundMessage = paidAmount > 0 && refundAmount < paidAmount
      ? `환불 금액: ${refundAmount.toLocaleString()}원 (위약금 ${paidAmount - refundAmount}원 공제)`
      : undefined;
    console.log('[Payment Cancel] applications cancelled', matched.map((m) => m.id).join(','), merchantUid, refundMessage || '');
    res.status(200).json({ cancelled: true, merchant_uid: merchantUid, refund_amount: refundAmount, refund_message: refundMessage });
  } catch (err) {
    console.error('[Payment Cancel] error', err);
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 404 || data?.code === -1) {
      res.status(404).json({
        cancelled: false,
        error: 'payment_not_found',
        message: data?.message || err.message,
        allow_withdraw_only: true
      });
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

// 관리자 강제 탈퇴 시 1년간 재가입 차단 목록에 등록 (document id = uid)
const BLOCKED_REGISTRATIONS = 'blockedRegistrations';
const BLOCK_YEARS = 1;

const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '') || '';
const normalizePhone = (v) => (typeof v === 'string' ? v.replace(/\D/g, '').slice(0, 11) : '') || '';

const PASSWORD_RESET_PAGE_URL = process.env.PASSWORD_RESET_PAGE_URL || 'https://bcsa.co.kr/auth/reset-password';
const SITE_CONTINUE_URL = process.env.SITE_CONTINUE_URL || 'https://bcsa.co.kr';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyA9aeP_SeSCJIgzST45tPj7FFZZcEfEaec';

/** 비밀번호 재설정 링크 생성 (사이트 전용 재설정 페이지로 연결) */
async function buildCustomResetLink(email) {
  const firebaseLink = await admin.auth().generatePasswordResetLink(email, {
    url: SITE_CONTINUE_URL,
    handleCodeInApp: false,
  });
  const parsed = new URL(firebaseLink);
  const oobCode = parsed.searchParams.get('oobCode');
  const apiKey = parsed.searchParams.get('apiKey') || '';
  if (!oobCode) {
    return firebaseLink.includes('lang=')
      ? firebaseLink.replace(/lang=[^&]*/, 'lang=ko')
      : `${firebaseLink}${firebaseLink.includes('?') ? '&' : '?'}lang=ko`;
  }
  const params = new URLSearchParams({
    mode: 'resetPassword',
    oobCode,
    apiKey,
    lang: 'ko',
  });
  return `${PASSWORD_RESET_PAGE_URL}?${params.toString()}`;
}

/** SMTP 미설정 시 Firebase 기본 메일(한국어) 폴백 */
async function sendFirebaseKoFallback(email) {
  await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
    {
      requestType: 'PASSWORD_RESET',
      email,
      continueUrl: SITE_CONTINUE_URL,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-Locale': 'ko',
      },
    }
  );
}

/** 관리자만 호출: 강제 탈퇴한 회원을 1년간 재가입 차단 목록에 등록 */
export const addBlockedRegistration = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const callerUid = request.auth.uid;
    const uid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : null;
    if (!uid) {
      throw new HttpsError('invalid-argument', 'uid is required');
    }

    let callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      const byUid = await db.collection('users').where('uid', '==', callerUid).limit(1).get();
      if (!byUid.empty) callerDoc = byUid.docs[0];
    }
    if (!callerDoc || !callerDoc.exists) {
      throw new HttpsError('permission-denied', '권한이 없습니다.');
    }
    if (callerDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
    }

    const email = normalizeEmail(request.data?.email || '');
    const phone = normalizePhone(request.data?.phone || '');
    const now = new Date();
    const blockedUntil = new Date(now);
    blockedUntil.setFullYear(blockedUntil.getFullYear() + BLOCK_YEARS);

    await db.collection(BLOCKED_REGISTRATIONS).doc(uid).set({
      uid,
      email,
      phone,
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
      blockedUntil: admin.firestore.Timestamp.fromDate(blockedUntil),
      reason: 'admin_forced'
    });
    console.log('[addBlockedRegistration] uid=', uid, 'blockedUntil=', blockedUntil.toISOString());
    return { success: true, blockedUntil: blockedUntil.toISOString() };
  }
);

/** 회원가입 전 호출: uid/email/phone 기준 1년 차단 여부 조회 (비인증 호출 가능) */
export const checkBlockedRegistration = onCall(
  { region: 'asia-northeast3', invoker: 'public' },
  async (request) => {
    const uid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : null;
    const email = normalizeEmail(request.data?.email || '');
    const phone = normalizePhone(request.data?.phone || '');
    const now = new Date();

    const checkDoc = (snap) => {
      if (!snap || !snap.exists) return null;
      const d = snap.data();
      let until = d?.blockedUntil;
      if (until && typeof until.toDate === 'function') until = until.toDate();
      if (!until || (until instanceof Date && until.getTime() <= now.getTime())) return null;
      return until instanceof Date ? until.toISOString() : (typeof until === 'string' ? until : null);
    };

    if (uid) {
      const byUid = await db.collection(BLOCKED_REGISTRATIONS).doc(uid).get();
      const until = checkDoc(byUid);
      if (until) return { blocked: true, blockedUntil: until };
    }
    if (email) {
      const byEmail = await db.collection(BLOCKED_REGISTRATIONS).where('email', '==', email).limit(1).get();
      if (!byEmail.empty) {
        const until = checkDoc(byEmail.docs[0]);
        if (until) return { blocked: true, blockedUntil: until };
      }
    }
    if (phone) {
      const byPhone = await db.collection(BLOCKED_REGISTRATIONS).where('phone', '==', phone).limit(1).get();
      if (!byPhone.empty) {
        const until = checkDoc(byPhone.docs[0]);
        if (until) return { blocked: true, blockedUntil: until };
      }
    }
    return { blocked: false };
  }
);

/** 아이디 찾기용 이메일 마스킹: 로컬 파트 첫 글자만 노출 (예: i***@devhounds.com) */
const maskEmail = (email) => {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return '';
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
};

/**
 * 아이디(이메일) 찾기: 이름+휴대폰 일치 시 마스킹된 이메일만 반환 (비인증 호출 가능)
 * 전체 이메일·uid 등 민감 정보는 절대 반환하지 않음
 */
export const lookupAccountByIdentity = onCall(
  { region: 'asia-northeast3', invoker: 'public' },
  async (request) => {
    const name = typeof request.data?.name === 'string' ? request.data.name.trim() : '';
    const phone = normalizePhone(request.data?.phone || '');
    if (!name || phone.length < 10) {
      throw new HttpsError('invalid-argument', '이름과 휴대폰 번호를 정확히 입력해 주세요.');
    }

    // phone 필드 우선, 구버전 phoneNumber 필드 폴백
    let snap = await db.collection('users').where('phone', '==', phone).limit(5).get();
    if (snap.empty) {
      snap = await db.collection('users').where('phoneNumber', '==', phone).limit(5).get();
    }

    const matched = snap.docs.find((d) => {
      const u = d.data() || {};
      return String(u.name || '').trim() === name && String(u.email || '').includes('@');
    });

    if (!matched) {
      // 이름 불일치·미가입 모두 동일 응답 (계정 열거 방지)
      return { found: false };
    }

    const maskedEmail = maskEmail(matched.data().email);
    if (!maskedEmail) return { found: false };
    console.log('[lookupAccountByIdentity] matched doc:', matched.id);
    return { found: true, maskedEmail };
  }
);

/**
 * 비밀번호 재설정 메일 발송 (비인증 호출 가능)
 * SMTP 설정 시 한국어 HTML 메일 + 사이트 전용 재설정 페이지 링크
 * SMTP 미설정 시 Firebase 기본 메일(한국어)로 폴백
 */
export const requestPasswordReset = onCall(
  { region: 'asia-northeast3', invoker: 'public' },
  async (request) => {
    const email = normalizeEmail(request.data?.email || '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new HttpsError('invalid-argument', '올바른 이메일을 입력해 주세요.');
    }

    try {
      let userExists = false;
      try {
        await admin.auth().getUserByEmail(email);
        userExists = true;
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
      }
      if (!userExists) {
        console.log('[requestPasswordReset] auth user not found:', email);
        return { success: true };
      }

      let deliveryProvider = 'firebase-fallback';
      if (isSmtpConfigured()) {
        const resetLink = await buildCustomResetLink(email);
        await sendMail({
          to: email,
          subject: '[부산청년사업가들] 비밀번호 재설정 안내',
          html: buildPasswordResetEmailHtml({ resetLink, email }),
          text: buildPasswordResetEmailText({ resetLink, email }),
        });
        deliveryProvider = 'smtp';
      } else {
        await sendFirebaseKoFallback(email);
      }
      console.log('[requestPasswordReset] sent for', email, 'via', deliveryProvider);
      return { success: true };
    } catch (err) {
      if (err.message === 'SMTP_NOT_CONFIGURED') {
        try {
          await sendFirebaseKoFallback(email);
          console.log('[requestPasswordReset] sent for', email, 'via firebase-fallback-after-smtp-error');
          return { success: true };
        } catch (fallbackErr) {
          console.error('[requestPasswordReset] fallback failed', fallbackErr);
        }
      }
      console.error('[requestPasswordReset]', err);
      throw new HttpsError('internal', '비밀번호 재설정 메일 발송에 실패했습니다.');
    }
  }
);

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
  memory: '512MiB',   // sharp 이미지 디코딩/리사이즈
  timeoutSeconds: 120,
}, app);

