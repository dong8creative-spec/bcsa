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

// 조달청 입찰공고 검색 API 프록시 엔드포인트
app.get('/api/bid-search', async (req, res) => {
  const keyword = req.query.keyword || '';
  const pageNo = parseInt(req.query.pageNo) || 1;
  const numOfRows = parseInt(req.query.numOfRows) || 10;
  const userId = req.query.userId || '';
  const userEmail = req.query.userEmail || '';
  const userName = req.query.userName || '';

  // ServiceKey는 환경 변수에서 가져오기 (로컬 개발용 기본값 포함)
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

      // 검색 로그 저장은 로컬 개발 환경에서는 선택사항
      // Firebase 연결이 필요하므로 생략 (필요시 추후 추가 가능)
      if (userId && keyword.trim()) {
        console.log(`[Bid Search] Search log (local dev): userId=${userId}, keyword="${keyword}", results=${resultCount}`);
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

// G2B API 프록시 엔드포인트 (기존)
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
