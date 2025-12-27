import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
// 환경 변수로 허용 도메인 관리 (개발: 모든 origin, 프로덕션: 특정 도메인만)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // origin이 없는 경우 (같은 origin 요청 또는 Postman 등) 허용
    if (!origin) return callback(null, true);
    
    // 허용된 origin인지 확인
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true
}));
app.use(express.json());

// 정적 파일 서빙 (index.html 등)
app.use(express.static('.'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Proxy server is running' });
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

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API proxy: http://localhost:${PORT}/api/bid?url=...`);
});
