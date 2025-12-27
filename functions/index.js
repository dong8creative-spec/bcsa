const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

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

// G2B API 프록시 엔드포인트
app.get('/api/bid', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  console.log(`[Proxy] Request received for: ${targetUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[Proxy] API responded with HTTP ${apiResponse.status}: ${errorText.substring(0, 200)}`);
      return res.status(apiResponse.status).json({ 
        error: `API 요청 실패: HTTP ${apiResponse.status}`, 
        details: errorText.substring(0, 200) 
      });
    }

    let responseText = await apiResponse.text();
    console.log(`[Proxy] Raw API Response (first 200 chars): ${responseText.substring(0, 200)}`);

    // 응답이 JSON이 아닐 경우 처리 (Unexpected token 'U' 등)
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error(`[Proxy] JSON parsing failed: ${parseErr.message}`);
      console.error(`[Proxy] Non-JSON response: ${responseText.substring(0, 200)}`);
      
      // HTML 에러 페이지인지 확인
      if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
        return res.status(500).json({ 
          error: 'API 서버에서 HTML 응답을 받았습니다. API 엔드포인트를 확인해주세요.',
          details: responseText.substring(0, 200)
        });
      }
      
      // 텍스트 에러 메시지일 경우
      if (responseText.trim().length < 500 && !responseText.includes('{') && !responseText.includes('[')) {
        return res.status(500).json({ 
          error: 'API 서버에서 예상치 못한 텍스트 응답을 받았습니다.',
          details: responseText.substring(0, 200)
        });
      }

      return res.status(500).json({ 
        error: `API 응답을 파싱할 수 없습니다: ${parseErr.message}`,
        details: responseText.substring(0, 200)
      });
    }

    res.status(200).json(data);

  } catch (error) {
    console.error(`[Proxy] Error processing request: ${error.message}`);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'API 요청 시간이 초과되었습니다.' });
    }
    res.status(500).json({ error: `프록시 서버 내부 오류: ${error.message}` });
  }
});

// Express 앱을 Firebase Functions로 내보내기
// asia-northeast3 (서울) 지역 사용
exports.apiBid = functions.region('asia-northeast3').https.onRequest(app);

