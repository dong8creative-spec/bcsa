import { onRequest } from 'firebase-functions/v2/https';
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

// CORS 설정 - 모든 오리진 허용
app.use(cors({
  origin: true,
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

// 조달청 입찰공고 검색 API 프록시 엔드포인트
app.get('/api/bid-search', async (req, res) => {
  // 한글 파라미터 명시적 디코딩 및 검증
  let keyword = '';
  try {
    // keyword 또는 bidNtceNm 둘 다 확인 (프론트엔드 호환성)
    keyword = req.query.keyword || req.query.bidNtceNm || '';
    if (keyword) {
      keyword = decodeURIComponent(String(keyword));
    }
  } catch (decodeError) {
    console.warn('[Decode] Keyword decode error:', decodeError);
    keyword = req.query.keyword || req.query.bidNtceNm || '';
  }
  
  console.log(`[Bid Search] Decoded keyword: "${keyword}"`);
  
  const pageNo = parseInt(req.query.pageNo) || 1;
  const numOfRows = parseInt(req.query.numOfRows) || 10;
  const userId = req.query.userId || '';
  const userEmail = req.query.userEmail || '';
  const userName = req.query.userName || '';
  
  // type 파라미터 (api-proxy.php 호환성): bid-search, bid-openg-result, bid-award
  const type = req.query.type || 'bid-search';
  
  // 날짜 범위 파라미터 (사용자 선택)
  let fromBidDt = req.query.fromBidDt || ''; // YYYYMMDD 형식
  let toBidDt = req.query.toBidDt || ''; // YYYYMMDD 형식
  
  // YYYYMMDD 형식 검증 (8자리 숫자)
  const validateDateFormat = (dateStr) => {
    if (!dateStr) return '';
    const cleaned = String(dateStr).replace(/-/g, '').replace(/\s/g, '');
    return /^\d{8}$/.test(cleaned) ? cleaned : '';
  };
  
  fromBidDt = validateDateFormat(fromBidDt);
  toBidDt = validateDateFormat(toBidDt);
  
  // 🔍 수신 파라미터 로깅
  console.log('🔍 [Bid Search] === 수신 파라미터 ===');
  console.log('📥 req.query 전체:', JSON.stringify(req.query, null, 2));
  console.log('📥 검증 후 날짜:', { fromBidDt, toBidDt });
  
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
  
  // inqryDiv: 조회 방식 기준 (조달청 공식 문서 기준)
  // - 1: 등록일시 기준 조회 (inqryBgnDt, inqryEndDt 필수)
  // - 2: 입찰공고번호 기준 조회 (bidNtceNo 필수)
  // - 3: 변경일시 기준 조회 (inqryBgnDt, inqryEndDt 필수)
  let inqryDiv = req.query.inqryDiv;
  if (!inqryDiv) {
    // bidNtceNo가 있으면 입찰공고번호 기준 조회
    if (bidNtceNo && bidNtceNo.trim()) {
      inqryDiv = '2';
    } else {
      // 기본값: 등록일시 기준 조회
      inqryDiv = '1';
    }
  }
  
  // 조건부 필수 파라미터 검증
  if (inqryDiv === '2') {
    // 입찰공고번호 기준 조회: bidNtceNo 필수
    if (!bidNtceNo || !bidNtceNo.trim()) {
      return res.status(400).json({
        success: false,
        error: '입찰공고번호 기준 조회 시 bidNtceNo는 필수 파라미터입니다.',
        errorCode: 'MISSING_REQUIRED_PARAM'
      });
    }
  }

  // ServiceKey는 환경 변수에서 가져오기
  const serviceKey = process.env.G2B_API_KEY || process.env.G2B_SERVICE_KEY;
  
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
  
  // type 파라미터에 따라 호출할 API 경로 결정
  const apiPaths = [];
  
  if (type === 'bid-openg-result') {
    // 개찰결과
    apiPaths.push('getOpengResultListInfoThngPPSSrch');
  } else {
    // 입찰공고 또는 최종낙찰자
    // 업무구분에 따라 호출할 API 경로 결정
    // 조달청 API는 업무구분별로 별도 엔드포인트를 제공
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
    // 기본값: 최근 30일 (더 넓은 범위로 검색하여 결과 확보)
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999); // 오늘 23:59:59까지 포함
  }
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const inqryBgnDt = formatDate(startDate) + '0000';
  const inqryEndDt = formatDate(endDate) + '2359';
  
  console.log('📥 inqryBgnDt/inqryEndDt:', { inqryBgnDt, inqryEndDt });

  // 파라미터 검증 및 정제 함수
  const validateAndSanitizeParam = (value, maxLength = 200) => {
    if (!value || value === '전체') return ''; // '전체' 값 필터링
    const sanitized = String(value).trim();
    if (sanitized === '전체') return ''; // trim 후에도 '전체' 체크
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
  };

  // 공통 파라미터 구성 함수 (개선된 버전)
  const buildApiUrl = (apiPath) => {
    try {
      // ServiceKey 인코딩 감지 및 처리
      // Encoding 키: %, =, + 등 특수문자 포함 (이미 URL 인코딩됨)
      // Decoding 키: 원본 키 값
      const isEncodedKey = /[%=\+]/g.test(serviceKey);
      
      // Encoding 키는 수동으로 URL 구성, Decoding 키는 URLSearchParams 사용
      let baseUrlWithKey;
      if (isEncodedKey) {
        // Encoding 키: 그대로 사용 (재인코딩 방지)
        baseUrlWithKey = `${baseUrl}/${apiPath}?ServiceKey=${serviceKey}`;
      } else {
        // Decoding 키: URL 인코딩 필요
        baseUrlWithKey = `${baseUrl}/${apiPath}?ServiceKey=${encodeURIComponent(serviceKey)}`;
      }
      
      const apiUrl = new URL(baseUrlWithKey);
      
      // 필수 파라미터
      apiUrl.searchParams.append('pageNo', Math.max(1, pageNo).toString());
      apiUrl.searchParams.append('numOfRows', Math.min(Math.max(1, numOfRows), 100).toString()); // 1-100 범위
      apiUrl.searchParams.append('inqryDiv', inqryDiv);
      
      // 조건부 필수 파라미터: inqryDiv에 따라 날짜 또는 공고번호 추가
      if (inqryDiv === '1' || inqryDiv === '3') {
        // 등록일시 또는 변경일시 기준: 날짜 필수
        apiUrl.searchParams.append('inqryBgnDt', inqryBgnDt);
        apiUrl.searchParams.append('inqryEndDt', inqryEndDt);
      } else if (inqryDiv === '2') {
        // 입찰공고번호 기준: bidNtceNo 필수 (이미 검증됨)
        apiUrl.searchParams.append('bidNtceNo', bidNtceNo);
      }
      
      // JSON 응답 요청 (조달청 공식 문서 권장)
      apiUrl.searchParams.append('type', 'json');
      
      // 선택적 검색 파라미터 (검증 및 정제 후 추가)
      const optionalParams = {
        bidNtceNm: validateAndSanitizeParam(keyword, 100),
        // bidNtceNo는 inqryDiv='2'일 때 이미 필수로 추가되므로 조건부 처리
        ...(inqryDiv !== '2' && bidNtceNo ? { bidNtceNo: validateAndSanitizeParam(bidNtceNo, 50) } : {}),
        bidNtceDtlClsfCd: validateAndSanitizeParam(bidNtceDtlClsfCd, 20),
        insttNm: validateAndSanitizeParam(insttNm, 100),
        refNo: validateAndSanitizeParam(refNo, 50),
        area: validateAndSanitizeParam(area, 50),
        industry: validateAndSanitizeParam(industry, 50),
        detailItemNo: validateAndSanitizeParam(detailItemNo, 50),
        prNo: validateAndSanitizeParam(prNo, 50),
        shoppingMallYn: validateAndSanitizeParam(shoppingMallYn, 1),
        domesticYn: validateAndSanitizeParam(domesticYn, 1),
        contractType: validateAndSanitizeParam(contractType, 50),
        contractLawType: validateAndSanitizeParam(contractLawType, 50),
        contractMethod: validateAndSanitizeParam(contractMethod, 50),
        awardMethod: validateAndSanitizeParam(awardMethod, 50)
      };
      
      // 금액 파라미터 검증 및 정제 (콤마 등 제거)
      const sanitizePriceParam = (priceStr) => {
        if (!priceStr) return null;
        // 콤마, 공백 제거
        const cleaned = String(priceStr).replace(/[,\s]/g, '');
        const num = Number(cleaned);
        // 유효한 양수인지 확인
        if (!isNaN(num) && num >= 0 && isFinite(num)) {
          return Math.floor(num); // 정수로 변환
        }
        return null;
      };
      
      const fromEstPriceNum = sanitizePriceParam(fromEstPrice);
      const toEstPriceNum = sanitizePriceParam(toEstPrice);
      
      if (fromEstPriceNum !== null) {
        apiUrl.searchParams.append('fromEstPrice', fromEstPriceNum.toString());
      }
      if (toEstPriceNum !== null) {
        apiUrl.searchParams.append('toEstPrice', toEstPriceNum.toString());
      }
      
      // 비어있지 않은 선택적 파라미터만 추가
      Object.entries(optionalParams).forEach(([key, value]) => {
        // '전체' 값과 빈 값 필터링
        if (value && value.length > 0 && value !== '전체') {
          apiUrl.searchParams.append(key, value);
        }
      });
      
      return apiUrl;
    } catch (error) {
      console.error('[Bid Search] Failed to build API URL:', error.message);
      throw new Error(`API URL 생성 실패: ${error.message}`);
    }
  };

  // 단일 API 호출 함수 (재시도 로직 포함)
  const callBidApi = async (apiPath, retryCount = 0) => {
    const maxRetries = 2;
    const apiUrl = buildApiUrl(apiPath);

    try {
      console.log(`[Bid Search] Calling API: ${apiPath} (attempt ${retryCount + 1})`);

      const apiResponse = await axios.get(apiUrl.toString(), {
        timeout: 30000,
        responseType: 'text',
        headers: {
          'Accept': 'application/xml, text/xml, application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; BCSABot/1.0)'
        },
        validateStatus: () => true
      });

      // HTTP 에러 처리
      if (apiResponse.status < 200 || apiResponse.status >= 300) {
        const errorMsg = `HTTP ${apiResponse.status}: ${apiResponse.statusText}`;
        console.error(
          `[Bid Search] API Error (${apiPath}): ${errorMsg} - ${truncateLog(apiResponse.data)}`
        );

        // 5xx 에러는 재시도 가능
        if (apiResponse.status >= 500 && retryCount < maxRetries) {
          console.log(`[Bid Search] Retrying ${apiPath} due to server error...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return await callBidApi(apiPath, retryCount + 1);
        }

        return {
          success: false,
          items: [],
          totalCount: 0,
          error: errorMsg,
          errorType: 'HTTP_ERROR'
        };
      }

      const { parsed, rawText, parseError } = await parseApiResponse(
        apiResponse.data,
        apiResponse.headers['content-type']
      );

      if (parseError || !parsed) {
        console.error(`[Bid Search] Parse Error (${apiPath}):`, parseError?.message || 'Unknown');
        console.error(`[Bid Search] Response (first 500 chars): ${truncateLog(rawText, 500)}`);
        return {
          success: false,
          items: [],
          totalCount: 0,
          error: 'XML/JSON 파싱 실패 - API 응답이 올바르지 않습니다',
          errorType: 'PARSE_ERROR'
        };
      }

      const data = parsed;

      // 응답 구조 검증 및 파싱
      if (!data || typeof data !== 'object') {
        console.error(`[Bid Search] Invalid response structure (${apiPath}): response is not an object`);
        return {
          success: false,
          items: [],
          totalCount: 0,
          error: '잘못된 응답 형식',
          errorType: 'INVALID_RESPONSE'
        };
      }

      // response.header 확인 (조달청 API 표준)
      if (data.response && data.response.header) {
        const header = data.response.header;
        const resultCode = header.resultCode || header.code;
        const resultMsg = header.resultMsg || header.message || '알 수 없는 오류';

        // 성공 코드 체크
        if (resultCode === '00') {
          // 정상 처리 계속
        } else if (resultCode === '03') {
          // 에러 03: No Data - 정상 케이스 (데이터 없음)
          console.log(`[Bid Search] API Success (${apiPath}): No data available (resultCode: 03)`);
          return {
            success: true,
            items: [],
            totalCount: 0,
            noData: true
          };
        } else {
          // 에러 발생
          console.error(`[Bid Search] API Error (${apiPath}): ${resultCode} - ${resultMsg}`);

          // 재시도 가능한 에러 코드
          const retryableErrors = ['01']; // 제공기관 서비스 불안정
          
          if (retryableErrors.includes(resultCode) && retryCount < maxRetries) {
            console.log(`[Bid Search] Retrying ${apiPath} due to error ${resultCode}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return await callBidApi(apiPath, retryCount + 1);
          }

          // 에러 코드별 사용자 친화적 메시지
          const errorMessages = {
            '01': '제공기관 서비스가 불안정합니다. 잠시 후 다시 시도해주세요.',
            '06': '날짜 형식이 올바르지 않습니다. (YYYYMMDDHHMM 형식 필요)',
            '08': '필수 파라미터가 누락되었습니다.',
            '12': 'API URL이 잘못되었습니다.',
            '20': 'API 활용 승인이 완료되지 않았습니다.',
            '22': '일일 트래픽 제한을 초과했습니다.',
            '30': 'API 키가 등록되지 않았거나 URL 인코딩 문제가 있습니다.',
            '31': 'API 키의 사용 기한이 만료되었습니다.',
            '32': '등록되지 않은 도메인 또는 IP에서 호출했습니다.'
          };

          const userFriendlyMsg = errorMessages[resultCode] || resultMsg;

          return {
            success: false,
            items: [],
            totalCount: 0,
            error: userFriendlyMsg,
            errorCode: resultCode,
            errorType: 'API_ERROR',
            originalMsg: resultMsg
          };
        }
      }

      // response.body에서 데이터 추출
      if (data.response && data.response.body) {
        const body = data.response.body;
        const items = body.items || [];
        const totalCnt = parseInt(body.totalCount || body.total || 0);

        // items 배열 정규화
        let bidItems = [];
        if (Array.isArray(items)) {
          bidItems = items;
        } else if (items && items.item) {
          bidItems = Array.isArray(items.item) ? items.item : [items.item];
        } else if (items && typeof items === 'object') {
          bidItems = [items];
        }

        console.log(`[Bid Search] API Success (${apiPath}): ${bidItems.length} items retrieved`);
        return {
          success: true,
          items: bidItems,
          totalCount: totalCnt || bidItems.length
        };
      }

      // body가 없지만 header는 성공인 경우 (결과 없음)
      if (data.response && data.response.header) {
        console.log(`[Bid Search] API Success (${apiPath}): No items (empty result)`);
        return { success: true, items: [], totalCount: 0 };
      }

      // 예상하지 못한 응답 구조
      console.error(
        `[Bid Search] Unexpected response structure (${apiPath}):`,
        truncateLog(data, 500)
      );
      return {
        success: false,
        items: [],
        totalCount: 0,
        error: '예상하지 못한 API 응답 구조',
        errorType: 'UNEXPECTED_STRUCTURE'
      };
    } catch (fetchError) {
      // 타임아웃 에러
      if (fetchError.code === 'ECONNABORTED') {
        console.error(`[Bid Search] Timeout (${apiPath})`);

        if (retryCount < maxRetries) {
          console.log(`[Bid Search] Retrying ${apiPath} after timeout...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return await callBidApi(apiPath, retryCount + 1);
        }

        return {
          success: false,
          items: [],
          totalCount: 0,
          error: '요청 시간 초과 (30초) - 조달청 API 응답이 느립니다',
          errorType: 'TIMEOUT'
        };
      }

      const responseData = fetchError.response?.data;
      console.error(
        `[Bid Search] Network Error (${apiPath}):`,
        fetchError.message,
        responseData ? `- ${truncateLog(responseData)}` : ''
      );

      if (retryCount < maxRetries) {
        console.log(`[Bid Search] Retrying ${apiPath} after network error...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return await callBidApi(apiPath, retryCount + 1);
      }

      return {
        success: false,
        items: [],
        totalCount: 0,
        error: `네트워크 오류: ${fetchError.message}`,
        errorType: 'NETWORK_ERROR'
      };
    }
  };

  console.log(`[Bid Search] Request: keyword="${keyword}", pageNo=${pageNo}, userId=${userId}`);
  console.log(`[Bid Search] Filters: area="${area}", insttNm="${insttNm}", bidNtceDtlClsfCd="${bidNtceDtlClsfCd}", contractType="${contractType}", contractMethod="${contractMethod}"`);
  console.log(`[Bid Search] BusinessTypes: ${JSON.stringify(businessTypes)}, apiPaths=${JSON.stringify(apiPaths)}`);

  try {
    // 캐시 확인 (키워드 검색 시에만)
    if (keyword.trim()) {
      const cachedResult = await getCachedBids(keyword.trim(), pageNo, numOfRows, type);
      if (cachedResult && cachedResult.items.length > 0) {
        console.log(`[Cache] Returning cached data for keyword="${keyword}", type=${type}`);
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

    // 에러 분류 및 로깅
    const errorsByType = {};
    errors.forEach(error => {
      const [apiPath, errorMsg] = error.split(': ');
      if (!errorsByType[apiPath]) {
        errorsByType[apiPath] = [];
      }
      errorsByType[apiPath].push(errorMsg);
    });
    
    if (errors.length > 0) {
      console.warn(`[Bid Search] Some APIs failed (${errors.length}/${apiPaths.length}):`, errorsByType);
    }

    // 필드명 정규화 (나라장터 API 필드명 -> 표준 필드명)
    const normalizeFieldNames = (item) => {
      if (!item) return item;
      
      // 나라장터 API는 ntceInsttNm, dminsttNm을 사용하지만
      // 프론트엔드는 insttNm, dmandInsttNm을 기대함
      const normalized = { ...item };
      
      // 공고기관명 매핑
      if (normalized.ntceInsttNm && !normalized.insttNm) {
        normalized.insttNm = normalized.ntceInsttNm;
      }
      
      // 수요기관명 매핑
      if (normalized.dminsttNm && !normalized.dmandInsttNm) {
        normalized.dmandInsttNm = normalized.dminsttNm;
      }
      
      return normalized;
    };

    // 중복 제거 (입찰공고번호 + 차수 기준)
    const uniqueItems = [];
    const seenBids = new Set();
    
    allItems.forEach(item => {
      if (!item || !item.bidNtceNo) {
        console.warn('[Bid Search] Skipping invalid item (no bidNtceNo)');
        return;
      }
      
      // 필드명 정규화
      const normalizedItem = normalizeFieldNames(item);
      
      const bidKey = `${normalizedItem.bidNtceNo}-${normalizedItem.bidNtceOrd || '1'}`;
      if (!seenBids.has(bidKey)) {
        seenBids.add(bidKey);
        uniqueItems.push(normalizedItem);
      }
    });
    
    console.log(`[Bid Search] Deduplication: ${allItems.length} -> ${uniqueItems.length} items`);

    // 최종낙찰자 필터링 (bid-award 타입인 경우)
    let filteredItems = uniqueItems;
    if (type === 'bid-award') {
      filteredItems = uniqueItems.filter(item => {
        return item.sucsfbidAmt && item.sucsfbidAmt !== '';
      });
      console.log(`[Bid Search] Award filtering: ${uniqueItems.length} -> ${filteredItems.length} items`);
    }

    // 정렬 (게시일시 기준 내림차순 - 최신순)
    filteredItems.sort((a, b) => {
      const dateA = a.bidNtceDt ? new Date(a.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      const dateB = b.bidNtceDt ? new Date(b.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      return dateB - dateA;
    });
    
    // Firestore에 저장 (비동기, 응답과 독립적)
    // 검색어가 있고 결과가 있을 때만 캐싱
    if (filteredItems.length > 0 && keyword.trim()) {
      console.log(`[Cache] Saving ${filteredItems.length} items to cache...`);
      filteredItems.forEach(item => {
        saveBidToFirestore(item, keyword.trim(), type).catch(err => 
          console.error('[Cache] Save error:', err.message)
        );
      });
    }

    // 모든 API가 실패하고 결과가 없는 경우 명확한 에러 반환
    if (filteredItems.length === 0 && errors.length === apiPaths.length) {
      console.error('[Bid Search] All APIs failed, no results available');
      return res.status(502).json({
        success: false,
        error: '조달청 API 호출 실패',
        message: '모든 API 요청이 실패했습니다. 잠시 후 다시 시도해주세요.',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // 일부 API 실패했지만 결과가 있는 경우 경고와 함께 반환
    if (filteredItems.length === 0 && errors.length > 0) {
      console.warn('[Bid Search] No results found, but some APIs failed');
    }

    // 페이지네이션 적용
    const startIndex = (pageNo - 1) * numOfRows;
    const endIndex = startIndex + numOfRows;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    const resultCount = paginatedItems.length;

    // 검색 로그 저장 (비동기 처리, API 응답과 독립적으로 실행)
    if (userId && keyword.trim()) {
      saveSearchLog(userId, userEmail, userName, keyword, resultCount).catch(err => {
        console.error('[Bid Search] Search log save error:', err);
        // 로그 저장 실패는 API 응답에 영향을 주지 않음
      });
    }

    // 성공 응답 (개선된 형식)
    const response = {
      success: true,
      data: {
        items: paginatedItems,
        totalCount: filteredItems.length,
        pageNo: pageNo,
        numOfRows: numOfRows,
        hasMore: endIndex < filteredItems.length,
        searchParams: {
          keyword: keyword || undefined,
          type: type,
          dateRange: {
            from: formatDate(startDate),
            to: formatDate(endDate)
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        apiCallCount: apiPaths.length,
        successfulCalls: apiPaths.length - errors.length,
        deduplicatedFrom: allItems.length
      }
    };
    
    // 에러가 있으면 경고 추가
    if (errors.length > 0) {
      response.warnings = errors;
      response.meta.partialFailure = true;
    }
    
    console.log(`[Bid Search] Success: ${paginatedItems.length} items returned (page ${pageNo}/${Math.ceil(filteredItems.length / numOfRows)})`);
    
    res.status(200).json(response);

  } catch (error) {
    error.context = {
      endpoint: 'bid-search',
      keyword,
      pageNo,
      numOfRows,
      type
    };
    next(error);
  }
});

// 캐시 키 생성 함수
function generateCacheKey(bidNtceNo, keyword = '', type = 'bid-search') {
  if (!bidNtceNo) return null;
  
  // 검색어를 포함한 고유 키 생성
  const keyParts = [bidNtceNo];
  
  if (keyword && keyword.trim()) {
    // 검색어를 안전한 문자열로 변환 (Firestore 문서 ID 규칙 준수)
    const safeKeyword = keyword.trim()
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .substring(0, 50); // 최대 길이 제한
    keyParts.push(safeKeyword);
  }
  
  if (type) {
    keyParts.push(type);
  }
  
  return keyParts.join('_');
}

// Firestore 캐싱 함수 (30분 TTL, 검색어 기반 캐싱)
async function saveBidToFirestore(bidItem, keyword = '', type = 'bid-search') {
  try {
    if (!bidItem || !bidItem.bidNtceNo) {
      console.warn('[Cache] Cannot save bid: missing bidNtceNo');
      return;
    }
    
    // 캐시 키 생성
    const cacheKey = generateCacheKey(bidItem.bidNtceNo, keyword, type);
    if (!cacheKey) {
      console.warn('[Cache] Cannot generate cache key');
      return;
    }
    
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000); // 30분 후
    
    const docRef = db.collection('tenders').doc(cacheKey);
    await docRef.set({
      ...bidItem,
      _metadata: {
        keyword: keyword.trim() || '',
        type: type,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        ttl: 1800 // 30분 (초)
      }
    }, { merge: true });
    
    console.log(`[Cache] Saved bid: ${cacheKey} (expires at ${expiresAt.toISOString()})`);
  } catch (error) {
    console.error('[Cache] Failed to save bid:', error.message);
  }
}

// 캐시된 데이터 조회 (검색어 기반)
async function getCachedBids(keyword, pageNo = 1, numOfRows = 10, type = 'bid-search') {
  try {
    if (!keyword || !keyword.trim()) {
      console.log('[Cache] No keyword provided, skipping cache');
      return null;
    }
    
    const now = admin.firestore.Timestamp.now();
    const trimmedKeyword = keyword.trim();
    
    console.log(`[Cache] Checking cache for keyword="${trimmedKeyword}", type=${type}`);
    
    // 검색어와 타입으로 필터링, 만료되지 않은 항목만
    const snapshot = await db.collection('tenders')
      .where('_metadata.keyword', '==', trimmedKeyword)
      .where('_metadata.type', '==', type)
      .where('_metadata.expiresAt', '>', now)
      .limit(1000) // 충분한 데이터 가져오기
      .get();
    
    if (snapshot.empty) {
      console.log('[Cache] Cache miss - no cached data found');
      return null;
    }
    
    console.log(`[Cache] Cache hit - found ${snapshot.size} cached items`);
    
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      // _metadata 필드 제거 (원본 데이터만 반환)
      const { _metadata, ...item } = data;
      return item;
    });
    
    // 정렬 (게시일시 기준 내림차순 - 최신순)
    items.sort((a, b) => {
      const dateA = a.bidNtceDt ? new Date(a.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      const dateB = b.bidNtceDt ? new Date(b.bidNtceDt.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
      return dateB - dateA;
    });
    
    // 페이지네이션 적용
    const start = (pageNo - 1) * numOfRows;
    const end = start + numOfRows;
    
    const paginatedItems = items.slice(start, end);
    
    console.log(`[Cache] Returning ${paginatedItems.length} items (page ${pageNo}, total ${items.length})`);
    
    return {
      items: paginatedItems,
      totalCount: items.length,
      fromCache: true
    };
  } catch (error) {
    console.error('[Cache] Failed to get cached bids:', error.message);
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

// 전역 에러 응답 미들웨어
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Express 앱을 Firebase Functions로 내보내기
// asia-northeast3 (서울) 지역 사용
// 1,000명 동시 접속 대비: memory 256MiB 설정으로 과금 방지
export const apiBid = onRequest({ 
  region: 'asia-northeast3',
  invoker: 'public',  // 공개 접근 허용, cors는 Express에서 처리
  memory: '256MiB'    // 동시 접속 대비 최소 메모리 설정
}, app);

