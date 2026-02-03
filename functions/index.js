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

// 조달청 입찰공고 검색 API 프록시 엔드포인트 (용역: ServcPPSSrch)
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
  const nocache = req.query.nocache === 'true' || req.query.nocache === '1';
  const excludeDeadline = req.query.excludeDeadline === 'true' || req.query.excludeDeadline === '1';
  
  // type 파라미터 (api-proxy.php 호환성): bid-search, bid-openg-result, bid-award
  const type = req.query.type || 'bid-search';
  
  // 날짜 범위 파라미터 (사용자 선택)
  let fromBidDt = req.query.fromBidDt || ''; // YYYYMMDDHHMM (12자리) 또는 YYYYMMDD (8자리)
  let toBidDt = req.query.toBidDt || ''; // YYYYMMDDHHMM (12자리) 또는 YYYYMMDD (8자리)
  
  // 날짜 형식 검증 및 정규화: YYYYMMDDHHMM (12자리) 또는 YYYYMMDD (8자리) 허용
  const validateDateFormat = (dateStr) => {
    if (!dateStr) return '';
    const cleaned = String(dateStr).replace(/-/g, '').replace(/\s/g, '');
    
    // YYYYMMDDHHMM (12자리) 형식
    if (/^\d{12}$/.test(cleaned)) {
      return cleaned;
    }
    
    // YYYYMMDD (8자리) 형식 → YYYYMMDDHHMM (12자리)로 변환
    if (/^\d{8}$/.test(cleaned)) {
      // 시작일은 0000, 종료일은 2359 추가 (기본값)
      // 실제로는 buildApiUrl에서 처리하므로 일단 8자리 그대로 반환
      return cleaned;
    }
    
    return '';
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
      apiPaths.push('getBidPblancListInfoServcPPSSrch'); // 용역 (명세 확인 후 정확한 이름으로 교체 권장)
    }
    if (searchAll || businessTypes.includes('공사')) {
      apiPaths.push('getBidPblancListInfoCnstwkPPSSrch'); // 공사 (추정)
    }
    
    // 기본값: 모든 업무구분 검색
    if (apiPaths.length === 0) {
      apiPaths.push('getBidPblancListInfoThngPPSSrch'); // 물품 (기본값)
      apiPaths.push('getBidPblancListInfoServcPPSSrch'); // 용역 (명세 확인 후 정확한 이름으로 교체 권장)
      apiPaths.push('getBidPblancListInfoCnstwkPPSSrch'); // 공사
    }
  }
  
  // 날짜 범위 설정 (사용자가 선택한 날짜가 있으면 사용, 없으면 최근 30일 - 나라장터와 일치율 확보)
  const today = new Date();
  let inqryBgnDt, inqryEndDt;

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  if (fromBidDt && toBidDt) {
    // 사용자가 선택한 날짜 사용
    const fromStr = fromBidDt.replace(/-/g, '');
    const toStr = toBidDt.replace(/-/g, '');
    
    // YYYYMMDDHHMM (12자리) 형식이면 그대로 사용
    if (fromStr.length === 12 && toStr.length === 12) {
      inqryBgnDt = fromStr;
      inqryEndDt = toStr;
      console.log('✅ [Date] 12자리 날짜 형식 사용:', { inqryBgnDt, inqryEndDt });
    }
    // YYYYMMDD (8자리) 형식이면 시간 추가
    else if (fromStr.length === 8 && toStr.length === 8) {
      inqryBgnDt = fromStr + '0000';
      inqryEndDt = toStr + '2359';
      console.log('✅ [Date] 8자리 날짜에 시간 추가:', { inqryBgnDt, inqryEndDt });
    } else {
      // 형식이 맞지 않으면 기본값 사용 (최근 30일)
      console.warn('⚠️ [Date] 잘못된 날짜 형식, 기본값 사용:', { fromStr, toStr });
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      inqryBgnDt = formatDate(startDate) + '0000';
      inqryEndDt = formatDate(today) + '2359';
    }
  } else {
    // 기본값: 최근 30일 (나라장터 웹과 비교 시 일치율 확보용)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    inqryBgnDt = formatDate(startDate) + '0000';
    inqryEndDt = formatDate(endDate) + '2359';
    console.log('✅ [Date] 기본값 (최근 30일) 사용:', { inqryBgnDt, inqryEndDt });
  }
  
  console.log('📥 최종 inqryBgnDt/inqryEndDt:', { inqryBgnDt, inqryEndDt });

  // 파라미터 검증 및 정제 함수
  const validateAndSanitizeParam = (value, maxLength = 200) => {
    if (!value || value === '전체') return ''; // '전체' 값 필터링
    const sanitized = String(value).trim();
    if (sanitized === '전체') return ''; // trim 후에도 '전체' 체크
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
  };

  // 공통 파라미터 구성 함수 (개선된 버전)
  // searchOverrides: { bidNtceNm?, insttNm? } - 나라장터와 동일하게 공고명+기관명 검색 시 사용
  const buildApiUrl = (apiPath, searchOverrides = null) => {
    try {
      const useBidNtceNm = searchOverrides?.bidNtceNm !== undefined ? searchOverrides.bidNtceNm : keyword;
      const useInsttNm = searchOverrides?.insttNm !== undefined ? searchOverrides.insttNm : insttNm;

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
        bidNtceNm: validateAndSanitizeParam(useBidNtceNm, 100),
        // bidNtceNo는 inqryDiv='2'일 때 이미 필수로 추가되므로 조건부 처리
        ...(inqryDiv !== '2' && bidNtceNo ? { bidNtceNo: validateAndSanitizeParam(bidNtceNo, 50) } : {}),
        bidNtceDtlClsfCd: (() => {
          const v = validateAndSanitizeParam(bidNtceDtlClsfCd, 20);
          if (!v) return '';
          if (v === '실공고') return '02'; // API 코드 (참고문서 확인 권장)
          if (v === '사전공고') return '01';
          return v;
        })(),
        insttNm: validateAndSanitizeParam(useInsttNm, 100),
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
  // searchOverrides: buildApiUrl에 전달 (공고명/기관명 이중 검색 시 사용)
  const callBidApi = async (apiPath, searchOverrides = null, retryCount = 0) => {
    const maxRetries = 2;
    const apiUrl = buildApiUrl(apiPath, searchOverrides);

    try {
      console.log(`[Bid Search] Calling API: ${apiPath} (attempt ${retryCount + 1})`);
      const urlForLog = apiUrl.toString().replace(/ServiceKey=[^&]+/, 'ServiceKey=***');
      console.log('[G2B] Request URL:', urlForLog);

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
          return await callBidApi(apiPath, searchOverrides, retryCount + 1);
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
            return await callBidApi(apiPath, searchOverrides, retryCount + 1);
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

        console.log('[G2B] Raw response', apiPath, 'items:', bidItems.length, 'totalCount:', totalCnt);
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
          return await callBidApi(apiPath, searchOverrides, retryCount + 1);
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
        return await callBidApi(apiPath, searchOverrides, retryCount + 1);
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
    // 캐시 확인 (키워드 검색 시, 단일 검색일 때만, nocache·excludeDeadline이 아닐 때. 이중 검색/입찰마감제외 시 캐시 미사용)
    const useDualSearch = keyword.trim() && !(insttNm && String(insttNm).trim());
    if (keyword.trim() && !useDualSearch && !nocache && !excludeDeadline) {
      const cachedResult = await getCachedBids(keyword.trim(), pageNo, numOfRows, type, inqryBgnDt, inqryEndDt);
      if (cachedResult && cachedResult.items.length > 0) {
        console.log(`[Cache] Returning cached data for keyword="${keyword}", type=${type}`);
        const startIndex = (pageNo - 1) * numOfRows;
        const endIndex = startIndex + cachedResult.items.length;
        return res.status(200).json({
          success: true,
          data: {
            items: cachedResult.items,
            totalCount: cachedResult.totalCount,
            pageNo,
            numOfRows,
            hasMore: endIndex < cachedResult.totalCount,
            searchParams: {
              keyword: keyword || undefined,
              type,
              dateRange: {
                from: inqryBgnDt ? `${inqryBgnDt.slice(0,4)}-${inqryBgnDt.slice(4,6)}-${inqryBgnDt.slice(6,8)}` : undefined,
                to: inqryEndDt ? `${inqryEndDt.slice(0,4)}-${inqryEndDt.slice(4,6)}-${inqryEndDt.slice(6,8)}` : undefined
              }
            }
          },
          cached: true
        });
      }
    }

    // 나라장터와 동일: 키워드만 있고 상세조건 기관명이 비어 있으면 공고명+기관명 이중 검색 후 병합
    const callSpecs = [];
    if (useDualSearch) {
      apiPaths.forEach(apiPath => {
        callSpecs.push({ apiPath, searchOverrides: null }); // 공고명 검색 (keyword -> bidNtceNm)
        callSpecs.push({ apiPath, searchOverrides: { bidNtceNm: '', insttNm: keyword } }); // 기관명 검색
      });
      console.log(`[Bid Search] Dual search (공고명+기관명): ${callSpecs.length} API calls`);
    } else {
      callSpecs.push(...apiPaths.map(apiPath => ({ apiPath, searchOverrides: null })));
    }

    const apiResults = await Promise.all(
      callSpecs.map(({ apiPath, searchOverrides }) => callBidApi(apiPath, searchOverrides))
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
        errors.push(`${callSpecs[index].apiPath}: ${result.error}`);
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
      console.warn(`[Bid Search] Some APIs failed (${errors.length}/${callSpecs.length}):`, errorsByType);
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

    // 검색어 포함 여부 재필터: 단일 검색일 때만 적용 (이중 검색은 API가 이미 공고명/기관명으로 걸러줌)
    let filteredItems = uniqueItems;
    if (keyword.trim() && !useDualSearch) {
      const k = keyword.trim();
      filteredItems = uniqueItems.filter(item => {
        const title = String(item.bidNtceNm || '').trim();
        const agency = String(item.insttNm || item.ntceInsttNm || '').trim();
        const demand = String(item.dmandInsttNm || item.dminsttNm || '').trim();
        return title.includes(k) || agency.includes(k) || demand.includes(k);
      });
      console.log(`[Bid Search] Keyword re-filter: ${uniqueItems.length} -> ${filteredItems.length} items`);
    }

    // 최종낙찰자 필터링 (bid-award 타입인 경우)
    if (type === 'bid-award') {
      const beforeAward = filteredItems.length;
      filteredItems = filteredItems.filter(item => {
        return item.sucsfbidAmt && item.sucsfbidAmt !== '';
      });
      console.log(`[Bid Search] Award filtering: ${beforeAward} -> ${filteredItems.length} items`);
    }

    // 정렬 (게시일시 기준 내림차순 - 최신순). API 날짜 형식 다양 대응
    const parseBidDt = (dt) => {
      if (!dt) return new Date(0);
      const s = String(dt).trim().replace(/\s/g, ' ').replace(/-/g, '-');
      const m12 = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
      if (m12) return new Date(`${m12[1]}-${m12[2]}-${m12[3]}T${m12[4]}:${m12[5]}:00`);
      const m14 = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
      if (m14) return new Date(`${m14[1]}-${m14[2]}-${m14[3]}T${m14[4]}:${m14[5]}:${m14[6]}`);
      const d = new Date(s);
      return isNaN(d.getTime()) ? new Date(0) : d;
    };
    filteredItems.sort((a, b) => parseBidDt(b.bidNtceDt).getTime() - parseBidDt(a.bidNtceDt).getTime());

    // 입찰마감제외: 마감일이 지난 공고 제거 (나라장터 "입찰마감제외" 체크와 동일)
    if (excludeDeadline) {
      const now = new Date();
      const parseClsDt = (dt) => {
        if (dt === undefined || dt === null || dt === '') return null;
        const s = String(dt).trim().replace(/\s/g, '').replace(/-/g, '').replace(/:/g, '');
        const digitsOnly = s.replace(/\D/g, '');
        if (digitsOnly.length >= 14) {
          const y = digitsOnly.slice(0, 4), m = digitsOnly.slice(4, 6), d = digitsOnly.slice(6, 8);
          const h = digitsOnly.slice(8, 10), min = digitsOnly.slice(10, 12), sec = digitsOnly.slice(12, 14);
          const parsed = new Date(`${y}-${m}-${d}T${h}:${min}:${sec}`);
          return isNaN(parsed.getTime()) ? null : parsed;
        }
        if (digitsOnly.length === 12) {
          const y = digitsOnly.slice(0, 4), m = digitsOnly.slice(4, 6), d = digitsOnly.slice(6, 8);
          const h = digitsOnly.slice(8, 10), min = digitsOnly.slice(10, 12);
          const parsed = new Date(`${y}-${m}-${d}T${h}:${min}:00`);
          return isNaN(parsed.getTime()) ? null : parsed;
        }
        if (digitsOnly.length === 8) {
          const parsed = new Date(digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4, 6) + '-' + digitsOnly.slice(6, 8) + 'T23:59:59');
          return isNaN(parsed.getTime()) ? null : parsed;
        }
        const d = new Date(String(dt).trim());
        return isNaN(d.getTime()) ? null : d;
      };
      const beforeExcl = filteredItems.length;
      filteredItems = filteredItems.filter(item => {
        const clsDt = parseClsDt(item.bidClseDt || item.bidClsDt);
        if (!clsDt) return true; // 마감일 없으면 유지 (과도한 제외 방지)
        return clsDt > now;
      });
      console.log(`[Bid Search] Exclude closed (입찰마감제외): ${beforeExcl} -> ${filteredItems.length} items`);
    }

    // Firestore 캐시 저장 (단일 검색·입찰마감제외 미적용 결과만 저장. 이중 검색 시 저장 안 함)
    if (filteredItems.length > 0 && keyword.trim() && !useDualSearch && !nocache && !excludeDeadline && inqryBgnDt && inqryEndDt) {
      const BATCH_SIZE = 500;
      const expiresAtTs = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));
      const trimmedKw = keyword.trim();
      try {
        for (let i = 0; i < filteredItems.length; i += BATCH_SIZE) {
          const batch = db.batch();
          const chunk = filteredItems.slice(i, i + BATCH_SIZE);
          chunk.forEach(item => {
            if (!item || !item.bidNtceNo) return;
            const cacheKey = generateCacheKey(item.bidNtceNo, trimmedKw, type, inqryBgnDt, inqryEndDt);
            if (!cacheKey) return;
            const docRef = db.collection('tenders').doc(cacheKey);
            batch.set(docRef, {
              ...item,
              _metadata: {
                keyword: trimmedKw,
                type,
                inqryBgnDt: String(inqryBgnDt),
                inqryEndDt: String(inqryEndDt),
                cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiresAtTs,
                ttl: 300
              }
            }, { merge: true });
          });
          await batch.commit();
        }
        console.log(`[Cache] Saved ${filteredItems.length} items (keyword="${trimmedKw}", inqryBgnDt=${inqryBgnDt}, inqryEndDt=${inqryEndDt})`);
      } catch (err) {
        console.error('[Cache] Batch save error:', err.message);
      }
    }

    // 모든 API가 실패하고 결과가 없는 경우 명확한 에러 반환
    if (filteredItems.length === 0 && errors.length === callSpecs.length) {
      console.error('[Bid Search] All APIs failed, no results available', errors);
      const hasKey = !!(serviceKey && serviceKey.trim());
      return res.status(502).json({
        success: false,
        error: '조달청 API 호출 실패',
        message: hasKey
          ? '모든 API 요청이 실패했습니다. 잠시 후 다시 시도해 주세요. 계속되면 공공데이터포털 API 상태·트래픽 한도를 확인해 주세요.'
          : '조달청 API 키가 설정되지 않았습니다. Firebase Functions 환경 변수에 G2B_API_KEY(또는 G2B_SERVICE_KEY)를 설정한 뒤 다시 배포해 주세요.',
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
            from: inqryBgnDt ? `${inqryBgnDt.slice(0,4)}-${inqryBgnDt.slice(4,6)}-${inqryBgnDt.slice(6,8)}` : undefined,
            to: inqryEndDt ? `${inqryEndDt.slice(0,4)}-${inqryEndDt.slice(4,6)}-${inqryEndDt.slice(6,8)}` : undefined
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        apiCallCount: callSpecs.length,
        successfulCalls: callSpecs.length - errors.length,
        deduplicatedFrom: allItems.length,
        dualSearch: useDualSearch || undefined,
        nocacheUsed: nocache || undefined
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

// 상세 내역 캐시 TTL: 1시간 (초) / 신선도: 이 시간보다 오래된 캐시는 무시하고 조달청에서 새로 가져옴
const DETAIL_CACHE_TTL_SEC = 3600;
const DETAIL_MAX_AGE_MS = 30 * 60 * 1000; // 30분
const DETAIL_CACHE_COLLECTION = 'tenderDetails';

// 상세 내역 캐시 키 (공고번호 + 차수)
function generateDetailCacheKey(bidNtceNo, bidNtceOrd) {
  if (!bidNtceNo) return null;
  const ord = bidNtceOrd != null && String(bidNtceOrd).trim() !== ''
    ? String(bidNtceOrd).padStart(3, '0')
    : '000';
  return `detail_${String(bidNtceNo).trim()}_${ord}`;
}

// 응답 객체에서 첨부파일 URL 추출 (PDF, 한글 등) — 링크·세부 금액 누락 방지
const ATTACHMENT_KEY_PATTERN = /^(atchFile|pblancFile|fileUrl|fileLink|atchUrl|pblancUrl|filePath|atchFilePath|docUrl|specUrl|공고서|첨부)/i;
const FILE_EXT_PATTERN = /\.(pdf|hwp|hwpx|doc|docx)(\?|$)/i;
const FILE_URL_PATTERN = /^https?:\/\/[^\s"']+/i;

function extractAttachmentUrls(obj, collected = new Set()) {
  if (!obj) return collected;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.length < 10) return collected;
    if (FILE_EXT_PATTERN.test(trimmed) || /fileDown\.do|download|atchFile|pblancFile|fileUrl|\.go\.kr.*\.(pdf|hwp)/i.test(trimmed)) {
      if (FILE_URL_PATTERN.test(trimmed)) collected.add(trimmed);
    }
    return collected;
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (item && typeof item === 'object' && (item.fileUrl || item.url || item.atchFileUrl || item.fileLink)) {
        const url = item.fileUrl || item.url || item.atchFileUrl || item.fileLink;
        if (url && typeof url === 'string') collected.add(url.trim());
      }
      extractAttachmentUrls(item, collected);
    });
    return collected;
  }
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      if (ATTACHMENT_KEY_PATTERN.test(k) && typeof v === 'string' && v.trim().length > 10 && FILE_URL_PATTERN.test(v)) {
        collected.add(v.trim());
      }
      extractAttachmentUrls(v, collected);
    });
    return collected;
  }
  return collected;
}

/**
 * G2B detail response → standardized schema (readable keys for frontend).
 * Maps cryptic G2B field names to camelCase keys; normalizes typos (e.g. presmptPrce → presmtPrce).
 */
const G2B_DETAIL_FIELD_MAP = {
  basePrice: ['bsnsBdgtAmt', 'baseAmt', 'basePrce', 'presmtPrce', 'presmptPrce', 'estPrice', 'estmtAmt', 'presmtPrc'],
  estimatedPrice: ['presmtPrce', 'presmptPrce', 'estPrice', 'estmtAmt'],
  bidFloorPrice: ['sldngPrce', 'sldngLwstPrce', 'basePrc'],
  successfulBidAmount: ['sucsfbidAmt', 'sucsfbidAmt'],
  noticeDate: ['bidNtceDt'],
  deadlineDate: ['bidClseDt', 'bidClsDt'],
  openingDate: ['opengDt', 'opengDtTm', 'bidBegnDt'],
  participantQualifications: ['licnsReq', 'licnsReqNm', 'partcptLmt', 'partcptLmtNm', 'bsnsCond', 'bsnsCondNm'],
  noticeName: ['bidNtceNm'],
  noticeNo: ['bidNtceNo'],
  noticeOrd: ['bidNtceOrd'],
  announcingOrg: ['insttNm', 'ntceInsttNm'],
  demandingOrg: ['dmandInsttNm', 'dminsttNm']
};

function buildStandardizedDetail(raw, attachmentList) {
  const d = raw || {};
  const pickFirst = (keys) => {
    for (const k of keys) {
      const v = d[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  const arr = (keys) => {
    const out = [];
    for (const k of keys) {
      const v = d[k];
      if (v !== undefined && v !== null && v !== '') out.push(String(v).trim());
    }
    return out.length ? out : undefined;
  };
  const standardized = {
    basePrice: pickFirst(G2B_DETAIL_FIELD_MAP.basePrice),
    estimatedPrice: pickFirst(G2B_DETAIL_FIELD_MAP.estimatedPrice),
    bidFloorPrice: pickFirst(G2B_DETAIL_FIELD_MAP.bidFloorPrice),
    successfulBidAmount: pickFirst(G2B_DETAIL_FIELD_MAP.successfulBidAmount),
    noticeDate: pickFirst(G2B_DETAIL_FIELD_MAP.noticeDate),
    deadlineDate: pickFirst(G2B_DETAIL_FIELD_MAP.deadlineDate),
    openingDate: pickFirst(G2B_DETAIL_FIELD_MAP.openingDate),
    participantQualifications: arr(G2B_DETAIL_FIELD_MAP.participantQualifications),
    noticeName: pickFirst(G2B_DETAIL_FIELD_MAP.noticeName),
    noticeNo: pickFirst(G2B_DETAIL_FIELD_MAP.noticeNo),
    noticeOrd: pickFirst(G2B_DETAIL_FIELD_MAP.noticeOrd),
    announcingOrg: pickFirst(G2B_DETAIL_FIELD_MAP.announcingOrg),
    demandingOrg: pickFirst(G2B_DETAIL_FIELD_MAP.demandingOrg),
    attachmentFileUrls: Array.isArray(attachmentList) ? attachmentList.map(a => (typeof a === 'string' ? { url: a, label: '첨부파일' } : { url: a?.url, label: a?.label || '첨부파일' })).filter(x => x.url) : []
  };
  return standardized;
}

// 입찰공고 상세 API (공고번호 + 차수 → 용역/물품/공사별 세부내역)
app.get('/api/bid-detail', async (req, res, next) => {
  const bidNtceNo = (req.query.bidNtceNo || '').trim();
  const bidNtceOrd = req.query.bidNtceOrd != null ? String(req.query.bidNtceOrd).trim() : '';

  if (!bidNtceNo) {
    return res.status(400).json({
      success: false,
      error: 'bidNtceNo(입찰공고번호)는 필수입니다.',
      errorCode: 'MISSING_BID_NTCE_NO'
    });
  }

  const cacheKey = generateDetailCacheKey(bidNtceNo, bidNtceOrd || '000');
  const serviceKey = process.env.G2B_API_KEY || process.env.G2B_SERVICE_KEY;

  if (!serviceKey || serviceKey.trim() === '') {
    return res.status(500).json({
      success: false,
      error: 'API 키가 설정되지 않았습니다. 관리자에게 문의하세요.'
    });
  }

  try {
    // 1) Firestore 캐시 조회 (신선도: DETAIL_MAX_AGE_MS 초과 시 무시하고 조달청에서 새로 가져옴)
    const detailRef = db.collection(DETAIL_CACHE_COLLECTION).doc(cacheKey);
    const detailSnap = await detailRef.get();

    if (detailSnap.exists) {
      const data = detailSnap.data();
      const cachedAt = data._metadata?.cachedAt;
      const cachedAtMs = cachedAt?.toDate ? cachedAt.toDate().getTime() : 0;
      if (cachedAtMs && (Date.now() - cachedAtMs) <= DETAIL_MAX_AGE_MS) {
        const { _metadata, ...payload } = data;
        console.log(`[Bid Detail] Cache hit: ${cacheKey} (age ${Math.round((Date.now() - cachedAtMs) / 1000)}s)`);
        return res.status(200).json({
          success: true,
          data: payload,
          cached: true
        });
      }
      console.log(`[Bid Detail] Cache too old, refetching: ${cacheKey}`);
    }

    // 2) 캐시 미스 → 조달청 상세 API 호출 (물품/용역/공사 각각 시도)
    const baseUrl = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
    const bidseq = bidNtceOrd !== '' ? String(bidNtceOrd).padStart(3, '0') : '000';
    const isEncodedKey = /[%=\+]/g.test(serviceKey);
    const keyParam = isEncodedKey ? serviceKey : encodeURIComponent(serviceKey);

    const detailOps = [
      'getBidPblancListInfoDtl',               // 통합 입찰공고 상세 (공공데이터포털 명세)
      'getBidPblancListInfoThngPPSSrchDtl',   // 물품 상세
      'getBidPblancListInfoServcPPSSrchDtl',  // 용역 상세
      'getBidPblancListInfoCnstwkPPSSrchDtl'  // 공사 상세
    ];

    let detailData = null;
    let lastError = null;

    for (const op of detailOps) {
      const url = `${baseUrl}/${op}?ServiceKey=${keyParam}&bidNtceNo=${encodeURIComponent(bidNtceNo)}&bidNtceOrd=${encodeURIComponent(bidseq)}&type=json&numOfRows=1&pageNo=1`;
      try {
        const apiRes = await axios.get(url, {
          timeout: 15000,
          responseType: 'text',
          headers: { Accept: 'application/json, application/xml, text/xml' },
          validateStatus: () => true
        });

        if (apiRes.status !== 200) {
          lastError = `HTTP ${apiRes.status}`;
          continue;
        }

        const { parsed } = await parseApiResponse(apiRes.data, apiRes.headers['content-type']);
        const body = parsed?.response?.body;
        if (!body) {
          lastError = 'No body';
          continue;
        }

        let items = body.items ?? body.item;
        if (items && !Array.isArray(items) && items.item) {
          items = Array.isArray(items.item) ? items.item : [items.item];
        } else if (items && !Array.isArray(items)) {
          items = [items];
        }
        if (items && items.length > 0) {
          detailData = items[0];
          console.log(`[Bid Detail] API success: ${op}`);
          break;
        }
        lastError = 'No items in response';
      } catch (err) {
        lastError = err.message;
        console.warn(`[Bid Detail] ${op} failed:`, err.message);
      }
    }

    if (!detailData) {
      return res.status(404).json({
        success: false,
        error: '해당 공고의 상세 정보를 찾을 수 없습니다.',
        detail: lastError || 'No data from detail APIs'
      });
    }

    // 3) 첨부파일 URL 추출 (누락 방지, 공고서·첨부문서 포함)
    const attachmentUrls = [...extractAttachmentUrls(detailData)];
    const attachments = attachmentUrls.map(url => ({ url, label: decodeURIComponent((url.split('/').pop() || '').split('?')[0]) || '첨부파일' }));

    // 4) 표준 스키마 (G2B 필드명 → 읽기 쉬운 키)
    const standardized = buildStandardizedDetail(detailData, attachments);

    // 5) 원본 + attachments + standardized (하위 호환)
    const payload = {
      ...detailData,
      attachments,
      standardized
    };

    // 6) Firestore에 1시간 TTL로 저장
    const expiresAt = new Date(Date.now() + DETAIL_CACHE_TTL_SEC * 1000);
    await detailRef.set({
      ...payload,
      _metadata: {
        bidNtceNo,
        bidNtceOrd: bidseq,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        ttl: DETAIL_CACHE_TTL_SEC
      }
    }, { merge: true });

    console.log(`[Bid Detail] Cached: ${cacheKey}, attachments: ${payload.attachments?.length || 0}`);
    res.status(200).json({
      success: true,
      data: payload,
      cached: false
    });
  } catch (error) {
    error.context = { endpoint: 'bid-detail', bidNtceNo, bidNtceOrd };
    next(error);
  }
});

// 검색 캐시 신선도: 이 시간보다 오래된 캐시는 무시하고 조달청에서 새로 가져옴 (ms)
const SEARCH_CACHE_MAX_AGE_MS = 3 * 60 * 1000; // 3분 (결과 정확도·갱신 확보)

// 캐시 키 생성 함수 (검색어 + 날짜 범위 포함 → 데이터 겹침 방지)
function generateCacheKey(bidNtceNo, keyword = '', type = 'bid-search', inqryBgnDt = '', inqryEndDt = '') {
  if (!bidNtceNo) return null;
  
  const keyParts = [bidNtceNo];
  
  if (keyword && keyword.trim()) {
    const safeKeyword = keyword.trim()
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .substring(0, 50);
    keyParts.push(safeKeyword);
  }
  
  if (type) {
    keyParts.push(type);
  }
  
  // 날짜 범위 필수 포함 (검색 결과가 기간별로 겹치지 않도록)
  if (inqryBgnDt && String(inqryBgnDt).length <= 20) {
    keyParts.push(String(inqryBgnDt));
  }
  if (inqryEndDt && String(inqryEndDt).length <= 20) {
    keyParts.push(String(inqryEndDt));
  }
  
  return keyParts.join('_');
}

// Firestore 캐싱 함수 (5분 TTL, 검색어+조회기간 기반 캐싱, YYYYMMDDHHMM 문자열 저장)
async function saveBidToFirestore(bidItem, keyword = '', type = 'bid-search', inqryBgnDt = '', inqryEndDt = '') {
  try {
    if (!bidItem || !bidItem.bidNtceNo) {
      console.warn('[Cache] Cannot save bid: missing bidNtceNo');
      return;
    }
    
    const cacheKey = generateCacheKey(bidItem.bidNtceNo, keyword, type, inqryBgnDt, inqryEndDt);
    if (!cacheKey) {
      console.warn('[Cache] Cannot generate cache key');
      return;
    }
    
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000); // 5분 후
    
    const docRef = db.collection('tenders').doc(cacheKey);
    await docRef.set({
      ...bidItem,
      _metadata: {
        keyword: keyword.trim() || '',
        type: type,
        inqryBgnDt: inqryBgnDt ? String(inqryBgnDt) : '',
        inqryEndDt: inqryEndDt ? String(inqryEndDt) : '',
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        ttl: 300 // 5분 (초)
      }
    }, { merge: true });
    
    console.log(`[Cache] Saved bid: ${cacheKey} (expires at ${expiresAt.toISOString()})`);
  } catch (error) {
    console.error('[Cache] Failed to save bid:', error.message);
  }
}

// 캐시된 데이터 조회 (검색어 + 조회 기간 필수 → 날짜 범위별로 정교하게 관리)
async function getCachedBids(keyword, pageNo = 1, numOfRows = 10, type = 'bid-search', inqryBgnDt = '', inqryEndDt = '') {
  try {
    if (!keyword || !keyword.trim()) {
      console.log('[Cache] No keyword provided, skipping cache');
      return null;
    }
    // 날짜 범위 없으면 캐시 미사용 (데이터 겹침 방지)
    if (!inqryBgnDt || !inqryEndDt) {
      console.log('[Cache] No date range provided, skipping cache (keyword + date range required)');
      return null;
    }
    
    const now = admin.firestore.Timestamp.now();
    const minCachedAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() - SEARCH_CACHE_MAX_AGE_MS));
    const trimmedKeyword = keyword.trim();
    
    console.log(`[Cache] Checking cache for keyword="${trimmedKeyword}", type=${type}, inqryBgnDt=${inqryBgnDt}, inqryEndDt=${inqryEndDt} (maxAge=${SEARCH_CACHE_MAX_AGE_MS}ms)`);
    
    const query = db.collection('tenders')
      .where('_metadata.keyword', '==', trimmedKeyword)
      .where('_metadata.type', '==', type)
      .where('_metadata.inqryBgnDt', '==', String(inqryBgnDt))
      .where('_metadata.inqryEndDt', '==', String(inqryEndDt))
      .where('_metadata.cachedAt', '>', minCachedAt);
    
    const snapshot = await query
      .limit(1000)
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

