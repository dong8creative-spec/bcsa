const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
const db = admin.firestore();

// CORS 설정
// Firebase Functions는 환경 변수로 허용 도메인 관리
// Firebase Console > Functions > 환경 변수에서 ALLOWED_ORIGINS 설정
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://bcsa.co.kr',
      'https://bcsa-b190f.web.app', 
      'https://bcsa-b190f.firebaseapp.com'
    ];

app.use(cors({
  origin: function (origin, callback) {
    // origin이 없는 경우 (같은 origin 요청) 허용
    if (!origin) return callback(null, true);
    
    // 허용된 origin인지 확인
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API Proxy is running' });
});

// 조달청 입찰공고 검색 API 프록시 엔드포인트
app.get('/api/bid-search', async (req, res) => {
  const keyword = req.query.keyword || '';
  const pageNo = parseInt(req.query.pageNo) || 1;
  const numOfRows = parseInt(req.query.numOfRows) || 10;
  const userId = req.query.userId || '';
  const userEmail = req.query.userEmail || '';
  const userName = req.query.userName || '';

  // ServiceKey는 환경 변수에서 가져오기
  const serviceKey = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
  
  if (!serviceKey || serviceKey.trim() === '') {
    return res.status(500).json({ 
      error: 'API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' 
    });
  }

  const baseUrl = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
  const apiPath = 'getBidPblancListInfoThngPPSSrch'; // 물품 입찰공고 조회
  
  // 오늘 날짜 기준으로 검색 기간 설정 (최근 30일)
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const inqryBgnDt = formatDate(startDate) + '0000';
  const inqryEndDt = formatDate(today) + '2359';

  // API URL 구성
  const apiUrl = new URL(`${baseUrl}/${apiPath}`);
  apiUrl.searchParams.append('ServiceKey', serviceKey);
  apiUrl.searchParams.append('pageNo', pageNo.toString());
  apiUrl.searchParams.append('numOfRows', numOfRows.toString());
  apiUrl.searchParams.append('inqryDiv', '1');
  apiUrl.searchParams.append('inqryBgnDt', inqryBgnDt);
  apiUrl.searchParams.append('inqryEndDt', inqryEndDt);
  apiUrl.searchParams.append('type', 'json');
  
  if (keyword.trim()) {
    apiUrl.searchParams.append('bidNtceNm', keyword.trim());
  }

  console.log(`[Bid Search] Request: keyword="${keyword}", pageNo=${pageNo}, userId=${userId}`);

  try {
    // 조달청 API 호출
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    let apiResponse;
    try {
      apiResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ error: 'API 요청 시간이 초과되었습니다.' });
      }
      throw fetchError;
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[Bid Search] API Error: ${apiResponse.status} - ${errorText.substring(0, 200)}`);
      return res.status(apiResponse.status).json({ 
        error: `API 요청 실패: HTTP ${apiResponse.status}`,
        details: errorText.substring(0, 200)
      });
    }

    let responseText = await apiResponse.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error(`[Bid Search] JSON Parse Error: ${parseErr.message}`);
      console.error(`[Bid Search] Response: ${responseText.substring(0, 500)}`);
      return res.status(500).json({ 
        error: 'API 응답을 파싱할 수 없습니다.',
        details: responseText.substring(0, 200)
      });
    }

    // 응답 처리
    if (data.response && data.response.body) {
      const body = data.response.body;
      const items = body.items || [];
      const totalCnt = body.totalCount || 0;
      
      let bidItems = [];
      if (Array.isArray(items)) {
        bidItems = items;
      } else if (items.item) {
        bidItems = Array.isArray(items.item) ? items.item : [items.item];
      }

      const resultCount = bidItems.length;

      // 검색 로그 저장 (비동기 처리, API 응답과 독립적으로 실행)
      if (userId && keyword.trim()) {
        saveSearchLog(userId, userEmail, userName, keyword, resultCount).catch(err => {
          console.error('[Bid Search] Search log save error:', err);
          // 로그 저장 실패는 API 응답에 영향을 주지 않음
        });
      }

      // 성공 응답
      res.status(200).json({
        success: true,
        data: {
          items: bidItems,
          totalCount: totalCnt,
          pageNo: pageNo,
          numOfRows: numOfRows
        }
      });
    } else if (data.response && data.response.header) {
      const resultCode = data.response.header.resultCode;
      const resultMsg = data.response.header.resultMsg || '알 수 없는 오류';
      
      if (resultCode !== '00') {
        console.error(`[Bid Search] API Error: ${resultCode} - ${resultMsg}`);
        return res.status(400).json({ 
          error: `API 에러 (${resultCode}): ${resultMsg}` 
        });
      }
      
      // resultCode가 '00'이지만 body가 없는 경우
      res.status(200).json({
        success: true,
        data: {
          items: [],
          totalCount: 0,
          pageNo: pageNo,
          numOfRows: numOfRows
        }
      });
    } else {
      console.error('[Bid Search] Unexpected response structure:', data);
      return res.status(500).json({ 
        error: '예상하지 못한 응답 구조입니다.' 
      });
    }

  } catch (error) {
    console.error('[Bid Search] Error:', error.message);
    res.status(500).json({ 
      error: `서버 오류: ${error.message}` 
    });
  }
});

// 검색 로그 저장 함수
async function saveSearchLog(userId, userEmail, userName, keyword, resultCount) {
  try {
    await db.collection('searchLogs').add({
      keyword: keyword,
      userId: userId,
      userEmail: userEmail,
      userName: userName,
      searchedAt: admin.firestore.FieldValue.serverTimestamp(),
      resultCount: resultCount || 0
    });
    console.log(`[Bid Search] Search log saved: userId=${userId}, keyword="${keyword}"`);
  } catch (error) {
    console.error('[Bid Search] Failed to save search log:', error);
    throw error;
  }
}

// Express 앱을 Firebase Functions로 내보내기
// asia-northeast3 (서울) 지역 사용
exports.apiBid = functions.region('asia-northeast3').https.onRequest(app);

