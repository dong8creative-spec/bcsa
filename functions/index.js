const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
// Node.js 20에는 내장 fetch가 있으므로 node-fetch 불필요
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
      'https://bcsa-b190f.firebaseapp.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
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
app.use(express.urlencoded({ extended: true })); // URL 인코딩 파라미터 처리

// 요청 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  console.log(`[Query]`, req.query);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API Proxy is running' });
});

// 조달청 입찰공고 검색 API 프록시 엔드포인트
app.get('/api/bid-search', async (req, res) => {
  // 한글 파라미터 명시적 디코딩 및 검증
  let keyword = '';
  try {
    keyword = req.query.keyword 
      ? decodeURIComponent(String(req.query.keyword)) 
      : '';
  } catch (decodeError) {
    console.warn('[Decode] Keyword decode error:', decodeError);
    keyword = req.query.keyword || '';
  }
  
  console.log(`[Bid Search] Decoded keyword: "${keyword}"`);
  
  const pageNo = parseInt(req.query.pageNo) || 1;
  const numOfRows = parseInt(req.query.numOfRows) || 10;
  const userId = req.query.userId || '';
  const userEmail = req.query.userEmail || '';
  const userName = req.query.userName || '';
  
  // 날짜 범위 파라미터 (사용자 선택)
  const fromBidDt = req.query.fromBidDt || ''; // YYYYMMDD 형식
  const toBidDt = req.query.toBidDt || ''; // YYYYMMDD 형식
  
  // 기타 필터 파라미터
  const bidNtceNo = req.query.bidNtceNo || '';
  const bidNtceDtlClsfCd = req.query.bidNtceDtlClsfCd || '';
  const insttNm = req.query.insttNm || '';
  const refNo = req.query.refNo || '';
  const area = req.query.area || '';
  const industry = req.query.industry || '';
  const fromEstPrice = req.query.fromEstPrice || '';
  const toEstPrice = req.query.toEstPrice || '';
  const detailItemNo = req.query.detailItemNo || '';
  const prNo = req.query.prNo || '';
  const shoppingMallYn = req.query.shoppingMallYn || '';
  const domesticYn = req.query.domesticYn || '';
  const contractType = req.query.contractType || '';
  const contractLawType = req.query.contractLawType || '';
  const contractMethod = req.query.contractMethod || '';
  const awardMethod = req.query.awardMethod || '';
  // inqryDiv: 조회구분 (1: 입찰공고, 2: 개찰결과, 3: 계약, 4: 변경계약 등)
  // 기본값은 '1' (입찰공고)
  const inqryDiv = req.query.inqryDiv || '1';

  // ServiceKey는 환경 변수에서 가져오기
  const serviceKey = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
  
  if (!serviceKey || serviceKey.trim() === '') {
    return res.status(500).json({ 
      error: 'API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' 
    });
  }

  // 업무구분 파라미터 확인 (물품, 용역, 공사 등)
  const businessTypes = req.query.businessTypes ? 
    (Array.isArray(req.query.businessTypes) ? req.query.businessTypes : [req.query.businessTypes]) : 
    ['전체'];
  
  const baseUrl = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
  
  // 업무구분에 따라 호출할 API 경로 결정
  // 조달청 API는 업무구분별로 별도 엔드포인트를 제공
  const apiPaths = [];
  const searchAll = businessTypes.includes('전체') || businessTypes.length === 0;
  
  if (searchAll || businessTypes.includes('물품')) {
    apiPaths.push('getBidPblancListInfoThngPPSSrch'); // 물품
  }
  if (searchAll || businessTypes.includes('일반용역') || businessTypes.includes('기술용역')) {
    apiPaths.push('getBidPblancListInfoSvcPPSSrch'); // 용역 (추정)
  }
  if (searchAll || businessTypes.includes('공사')) {
    apiPaths.push('getBidPblancListInfoCnstwkPPSSrch'); // 공사 (추정)
  }
  
  // 기본값: 모든 업무구분 검색
  if (apiPaths.length === 0) {
    apiPaths.push('getBidPblancListInfoThngPPSSrch'); // 물품 (기본값)
    apiPaths.push('getBidPblancListInfoSvcPPSSrch'); // 용역
    apiPaths.push('getBidPblancListInfoCnstwkPPSSrch'); // 공사
  }
  
  // 날짜 범위 설정 (사용자가 선택한 날짜가 있으면 사용, 없으면 최근 30일)
  const today = new Date();
  let startDate, endDate;
  
  if (fromBidDt && toBidDt) {
    // 사용자가 선택한 날짜 사용 (YYYYMMDD 형식으로 받음)
    const fromStr = fromBidDt.replace(/-/g, '');
    const toStr = toBidDt.replace(/-/g, '');
    
    // 날짜 유효성 검사
    if (fromStr.length === 8 && toStr.length === 8) {
      startDate = new Date(
        parseInt(fromStr.substring(0, 4)),
        parseInt(fromStr.substring(4, 6)) - 1,
        parseInt(fromStr.substring(6, 8))
      );
      endDate = new Date(
        parseInt(toStr.substring(0, 4)),
        parseInt(toStr.substring(4, 6)) - 1,
        parseInt(toStr.substring(6, 8))
      );
      
      // 날짜 유효성 검사 (Invalid Date 체크)
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        // 잘못된 날짜면 기본값 사용
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = today;
      }
    } else {
      // 형식이 맞지 않으면 기본값 사용
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      endDate = today;
    }
  } else {
    // 기본값: 최근 30일
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    endDate = today;
  }
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const inqryBgnDt = formatDate(startDate) + '0000';
  const inqryEndDt = formatDate(endDate) + '2359';

  // 공통 파라미터 구성 함수
  const buildApiUrl = (apiPath) => {
    const apiUrl = new URL(`${baseUrl}/${apiPath}`);
    apiUrl.searchParams.append('ServiceKey', serviceKey);
    apiUrl.searchParams.append('pageNo', pageNo.toString());
    apiUrl.searchParams.append('numOfRows', numOfRows.toString());
    apiUrl.searchParams.append('inqryDiv', inqryDiv);
    apiUrl.searchParams.append('inqryBgnDt', inqryBgnDt);
    apiUrl.searchParams.append('inqryEndDt', inqryEndDt);
    apiUrl.searchParams.append('type', 'json');
    
    // 검색어 파라미터
    if (keyword.trim()) {
      apiUrl.searchParams.append('bidNtceNm', keyword.trim());
    }
    if (bidNtceNo.trim()) {
      apiUrl.searchParams.append('bidNtceNo', bidNtceNo.trim());
    }
    if (bidNtceDtlClsfCd.trim()) {
      apiUrl.searchParams.append('bidNtceDtlClsfCd', bidNtceDtlClsfCd.trim());
    }
    if (insttNm.trim()) {
      apiUrl.searchParams.append('insttNm', insttNm.trim());
    }
    if (refNo.trim()) {
      apiUrl.searchParams.append('refNo', refNo.trim());
    }
    if (area.trim()) {
      apiUrl.searchParams.append('area', area.trim());
    }
    if (industry.trim()) {
      apiUrl.searchParams.append('industry', industry.trim());
    }
    if (fromEstPrice) {
      apiUrl.searchParams.append('fromEstPrice', fromEstPrice.toString());
    }
    if (toEstPrice) {
      apiUrl.searchParams.append('toEstPrice', toEstPrice.toString());
    }
    if (detailItemNo.trim()) {
      apiUrl.searchParams.append('detailItemNo', detailItemNo.trim());
    }
    if (prNo.trim()) {
      apiUrl.searchParams.append('prNo', prNo.trim());
    }
    if (shoppingMallYn.trim()) {
      apiUrl.searchParams.append('shoppingMallYn', shoppingMallYn.trim());
    }
    if (domesticYn.trim()) {
      apiUrl.searchParams.append('domesticYn', domesticYn.trim());
    }
    if (contractType.trim()) {
      apiUrl.searchParams.append('contractType', contractType.trim());
    }
    if (contractLawType.trim()) {
      apiUrl.searchParams.append('contractLawType', contractLawType.trim());
    }
    if (contractMethod.trim()) {
      apiUrl.searchParams.append('contractMethod', contractMethod.trim());
    }
    if (awardMethod.trim()) {
      apiUrl.searchParams.append('awardMethod', awardMethod.trim());
    }
    
    return apiUrl;
  };

  // 단일 API 호출 함수
  const callBidApi = async (apiPath) => {
    const apiUrl = buildApiUrl(apiPath);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    try {
      const apiResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error(`[Bid Search] API Error (${apiPath}): ${apiResponse.status} - ${errorText.substring(0, 200)}`);
        return { success: false, items: [], totalCount: 0, error: `HTTP ${apiResponse.status}` };
      }

      const responseText = await apiResponse.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error(`[Bid Search] JSON Parse Error (${apiPath}): ${parseErr.message}`);
        return { success: false, items: [], totalCount: 0, error: 'JSON 파싱 오류' };
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

        return { success: true, items: bidItems, totalCount: totalCnt };
      } else if (data.response && data.response.header) {
        const resultCode = data.response.header.resultCode;
        if (resultCode !== '00') {
          const resultMsg = data.response.header.resultMsg || '알 수 없는 오류';
          console.error(`[Bid Search] API Error (${apiPath}): ${resultCode} - ${resultMsg}`);
          return { success: false, items: [], totalCount: 0, error: `${resultCode}: ${resultMsg}` };
        }
        return { success: true, items: [], totalCount: 0 };
      } else {
        return { success: false, items: [], totalCount: 0, error: '예상하지 못한 응답 구조' };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return { success: false, items: [], totalCount: 0, error: '요청 시간 초과' };
      }
      console.error(`[Bid Search] Fetch Error (${apiPath}):`, fetchError.message);
      return { success: false, items: [], totalCount: 0, error: fetchError.message };
    }
  };

  console.log(`[Bid Search] Request: keyword="${keyword}", pageNo=${pageNo}, userId=${userId}, businessTypes=${JSON.stringify(businessTypes)}, apiPaths=${JSON.stringify(apiPaths)}`);

  try {
    // 캐시 확인 (키워드 검색 시에만)
    if (keyword.trim()) {
      const cachedResult = await getCachedBids(keyword, pageNo, numOfRows);
      if (cachedResult && cachedResult.items.length > 0) {
        console.log('[Cache] Returning cached data');
        return res.status(200).json({
          success: true,
          data: cachedResult,
          cached: true
        });
      }
    }
    
    // 캐시 미스 - API 호출
    // 여러 API를 병렬로 호출
    const apiResults = await Promise.all(
      apiPaths.map(apiPath => callBidApi(apiPath))
    );

    // 결과 통합
    let allItems = [];
    let totalCount = 0;
    const errors = [];

    apiResults.forEach((result, index) => {
      if (result.success) {
        allItems = allItems.concat(result.items);
        totalCount += result.totalCount;
      } else {
        errors.push(`${apiPaths[index]}: ${result.error}`);
      }
    });

    // 에러가 있으면 로그만 남기고 계속 진행 (일부 API 실패해도 다른 결과는 반환)
    if (errors.length > 0) {
      console.warn(`[Bid Search] Some APIs failed:`, errors);
    }

    // 중복 제거 (입찰공고번호 기준)
    const uniqueItems = [];
    const seenBids = new Set();
    
    allItems.forEach(item => {
      const bidKey = `${item.bidNtceNo || ''}-${item.bidNtceOrd || ''}`;
      if (!seenBids.has(bidKey)) {
        seenBids.add(bidKey);
        uniqueItems.push(item);
      }
    });

    // 정렬 (게시일시 기준 내림차순 - 최신순)
    uniqueItems.sort((a, b) => {
      const dateA = a.bidNtceDt ? new Date(a.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      const dateB = b.bidNtceDt ? new Date(b.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      return dateB - dateA;
    });
    
    // Firestore에 저장 (비동기, 응답과 독립적)
    if (uniqueItems.length > 0) {
      uniqueItems.forEach(item => {
        saveBidToFirestore(item).catch(err => 
          console.error('[Cache] Save error:', err)
        );
      });
    }

    // 페이지네이션 적용
    const startIndex = (pageNo - 1) * numOfRows;
    const endIndex = startIndex + numOfRows;
    const paginatedItems = uniqueItems.slice(startIndex, endIndex);

    const resultCount = paginatedItems.length;

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
        items: paginatedItems,
        totalCount: uniqueItems.length, // 중복 제거 후 실제 총 개수
        pageNo: pageNo,
        numOfRows: numOfRows,
        warnings: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('[Bid Search] Error:', error.message);
    res.status(500).json({ 
      error: `서버 오류: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Firestore 캐싱 함수 (1시간 TTL)
async function saveBidToFirestore(bidItem) {
  try {
    if (!bidItem.bidNtceNo) return;
    
    const docRef = db.collection('tenders').doc(bidItem.bidNtceNo);
    await docRef.set({
      ...bidItem,
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 60 * 60 * 1000) // 1시간 후
      )
    }, { merge: true });
  } catch (error) {
    console.error('[Cache] Failed to save bid:', error);
  }
}

// 캐시된 데이터 조회
async function getCachedBids(keyword, pageNo = 1, numOfRows = 10) {
  try {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection('tenders')
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .limit(100)
      .get();
    
    if (snapshot.empty) return null;
    
    const items = snapshot.docs.map(doc => doc.data());
    
    // 키워드 필터링
    const filtered = keyword 
      ? items.filter(item => 
          item.bidNtceNm && item.bidNtceNm.includes(keyword)
        )
      : items;
    
    // 페이지네이션
    const start = (pageNo - 1) * numOfRows;
    const end = start + numOfRows;
    
    return {
      items: filtered.slice(start, end),
      totalCount: filtered.length,
      fromCache: true
    };
  } catch (error) {
    console.error('[Cache] Failed to get cached bids:', error);
    return null;
  }
}

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

// 전역 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(500).json({ 
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Express 앱을 Firebase Functions로 내보내기
// asia-northeast3 (서울) 지역 사용
exports.apiBid = onRequest({ 
  region: 'asia-northeast3',
  invoker: 'public'  // 공개 접근 허용, cors는 Express에서 처리
}, app);

