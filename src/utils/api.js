import axios from 'axios';

/**
 * API 기본 URL을 가져옵니다.
 * 환경 변수 VITE_API_URL을 사용합니다.
 * @returns {string} API 기본 URL
 */
export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || '';
};

/**
 * API 요청을 수행하는 통합 함수
 * @param {string} endpoint - API 엔드포인트 경로 (예: '/api/bid-search')
 * @param {Object} options - 요청 옵션
 * @param {string} options.method - HTTP 메서드 (기본값: 'GET')
 * @param {Object} options.params - URL 쿼리 파라미터 (axios가 자동으로 쿼리 스트링으로 변환)
 * @param {Object} options.data - 요청 바디 데이터 (POST, PUT 등)
 * @param {Object} options.headers - 추가 HTTP 헤더
 * @returns {Promise<AxiosResponse>} axios 응답 객체
 */
export const apiRequest = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const { method = 'GET', params, data, headers = {}, ...restOptions } = options;

  if (!baseUrl) {
    throw new Error('API URL이 설정되지 않았습니다. 환경 변수를 확인하세요.');
  }

  // URL 구성: 중복 슬래시 제거
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  console.log(`[API Request] ${method} ${url}`);
  if (params) {
    console.log('[API Request] Params:', params);
  }
  if (data) {
    console.log('[API Request] Data:', data);
  }

  try {
    const response = await axios({
      url,
      method,
      params, // axios가 자동으로 쿼리 스트링으로 변환
      data,
      headers: {
        'Accept': 'application/json',
        ...headers
      },
      ...restOptions
    });

    console.log('[API Response] Status:', response.status);
    console.log('[API Response] Data:', response.data);

    return response;
  } catch (error) {
    console.error('[API Error]', {
      message: error.message,
      url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
};

/**
 * GET 요청 헬퍼 함수
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {Object} params - URL 쿼리 파라미터
 * @param {Object} options - 추가 옵션
 * @returns {Promise<AxiosResponse>}
 */
export const apiGet = (endpoint, params = {}, options = {}) => {
  return apiRequest(endpoint, { method: 'GET', params, ...options });
};

/**
 * POST 요청 헬퍼 함수
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {Object} data - 요청 바디 데이터
 * @param {Object} options - 추가 옵션
 * @returns {Promise<AxiosResponse>}
 */
export const apiPost = (endpoint, data = {}, options = {}) => {
  return apiRequest(endpoint, { method: 'POST', data, ...options });
};

/**
 * PUT 요청 헬퍼 함수
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {Object} data - 요청 바디 데이터
 * @param {Object} options - 추가 옵션
 * @returns {Promise<AxiosResponse>}
 */
export const apiPut = (endpoint, data = {}, options = {}) => {
  return apiRequest(endpoint, { method: 'PUT', data, ...options });
};

/**
 * DELETE 요청 헬퍼 함수
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {Object} options - 추가 옵션
 * @returns {Promise<AxiosResponse>}
 */
export const apiDelete = (endpoint, options = {}) => {
  return apiRequest(endpoint, { method: 'DELETE', ...options });
};
