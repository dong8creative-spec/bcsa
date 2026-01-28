import React, { useMemo, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { getApiBaseUrl, apiGet } from '../utils/api';
import { firebaseService } from '../services/firebaseService';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const BUSINESS_TYPE_OPTIONS = ['전체', '물품', '일반용역', '기술용역', '공사', '기타', '민간'];
const BUSINESS_STATUS_OPTIONS = ['전체', '외자', '비축', '리스'];

const mapSearchParamsToApiParams = (params) => {
  // 날짜 포맷 강제화: YYYYMMDD 형식으로 정제
  const formatDateParam = (dateStr) => {
    if (!dateStr) return '';
    // 하이픈 제거
    const cleaned = dateStr.replace(/-/g, '').replace(/\s/g, '');
    // YYYYMMDD 형식 검증 (8자리 숫자)
    if (/^\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    // 형식이 맞지 않으면 빈 문자열 반환 (파라미터에서 제외됨)
    console.warn(`[Date Format] Invalid date format: ${dateStr}, expected YYYYMMDD`);
    return '';
  };

  // 금액 필터 검증: 숫자만 허용 (콤마 등 제거)
  const sanitizePrice = (priceStr) => {
    if (!priceStr) return '';
    // 콤마, 공백, 기타 문자 제거 후 숫자만 추출
    const cleaned = String(priceStr).replace(/[,\s]/g, '');
    // 숫자 검증
    const num = Number(cleaned);
    if (!isNaN(num) && num >= 0 && isFinite(num)) {
      return Math.floor(num).toString(); // 정수로 변환
    }
    // 유효하지 않은 값은 빈 문자열 반환
    console.warn(`[Price] Invalid price format: ${priceStr}`);
    return '';
  };

  const result = {
    bidNtceNo: params.bidNtceNo?.trim() || '',
    bidNtceNm: params.bidNtceNm?.trim() || '',
    inqryDiv: params.inqryDiv || '',
    fromBidDt: formatDateParam(params.fromBidDt),
    toBidDt: formatDateParam(params.toBidDt),
    bidNtceDtlClsfCd: params.bidNtceDtlClsfCd || '',
    insttNm: params.insttNm?.trim() || '',
    refNo: params.refNo?.trim() || '',
    area: params.area || '',
    industry: params.industry?.trim() || '',
    fromEstPrice: sanitizePrice(params.fromEstPrice),
    toEstPrice: sanitizePrice(params.toEstPrice),
    detailItemNo: params.detailItemNo?.trim() || '',
    prNo: params.prNo?.trim() || '',
    shoppingMallYn: params.shoppingMallYn || '',
    domesticYn: params.domesticYn || '',
    contractType: params.contractType || '',
    contractLawType: params.contractLawType || '',
    contractMethod: params.contractMethod || '',
    awardMethod: params.awardMethod || '',
    businessTypes: params.businessTypes || [],
    businessStatuses: params.businessStatuses || []
  };

  Object.keys(result).forEach((key) => {
    const value = result[key];
    
    // 빈 값 및 '전체' 값 필터링 (더 엄격한 검증)
    if (value === '' || value === null || value === undefined || value === '전체' || String(value).trim() === '') {
      delete result[key];
      return;
    }
    
    // 배열 처리: '전체' 제거 및 빈 배열 체크
    if (Array.isArray(value)) {
      const filtered = value.filter(v => {
        const str = String(v).trim();
        return str !== '전체' && str !== '' && v != null && v !== undefined;
      });
      if (filtered.length === 0) {
        delete result[key];
      } else {
        result[key] = filtered;
      }
    }
    
    // 문자열 값의 trim 처리 (공백만 있는 경우 제거)
    if (typeof value === 'string' && value.trim() === '') {
      delete result[key];
    }
  });

  return result;
};

const normalizeItems = (payload) => {
  // 1. 최신 API 응답 형식: { success: true, data: { items: [...], totalCount: ... } }
  if (payload?.data?.items && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }
  
  // 2. data 객체가 비어있거나 items가 없는 경우
  if (payload?.data && typeof payload.data === 'object') {
    // data가 빈 객체 {}인 경우 또는 items가 없는 경우
    if (!payload.data.items || (Array.isArray(payload.data.items) && payload.data.items.length === 0)) {
      return [];
    }
  }
  
  // 3. 레거시 응답 형식: { response: { body: { items: { item: [...] } } } }
  const items = payload?.response?.body?.items?.item
    ?? payload?.response?.body?.items
    ?? [];

  if (Array.isArray(items)) {
    return items;
  }

  if (items && typeof items === 'object') {
    return [items];
  }

  return [];
};

export const TenderSearchFilter = ({ apiBaseUrl, onSearchResult }) => {
  const resolvedApiBaseUrl = apiBaseUrl || getApiBaseUrl();
  
  // 디버깅: 환경 변수 확인 (항상 출력)
  console.log('🔍 [TenderSearchFilter] API URL:', resolvedApiBaseUrl);
  console.log('🔍 [TenderSearchFilter] 환경 변수:', {
    apiUrl: import.meta.env.VITE_API_URL,
    mode: import.meta.env.MODE
  });
  const [searchParams, setSearchParams] = useState({
    bidNtceNo: '',
    bidNtceNm: '',
    inqryDiv: '1',
    fromBidDt: '',
    toBidDt: '',
    bidNtceDtlClsfCd: '전체',
    insttNm: '',
    refNo: '',
    area: '전체',
    industry: '',
    fromEstPrice: '',
    toEstPrice: '',
    detailItemNo: '',
    prNo: '',
    shoppingMallYn: '전체',
    domesticYn: '전체',
    contractType: '전체',
    contractLawType: '전체',
    contractMethod: '전체',
    awardMethod: '전체',
    excludeDeadline: false,
    businessTypes: ['전체'],
    businessStatuses: ['전체'],
    isAnnouncingInstitution: true,
    isDemandingInstitution: false,
    isDetailedOpen: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  
  // 즐겨찾기 관련 상태
  const [currentUser, setCurrentUser] = useState(null);
  const [bookmarks, setBookmarks] = useState([]); // bidNtceNo 배열
  
  // Firebase Auth 체크
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        loadBookmarks(user.uid);
      } else {
        setBookmarks([]);
      }
    });
    return () => unsubscribe();
  }, []);
  
  // 즐겨찾기 로드 함수
  const loadBookmarks = async (userId) => {
    try {
      const bookmarkList = await firebaseService.getBookmarks(userId);
      const bidNtceNos = bookmarkList.map(bookmark => bookmark.bidNtceNo);
      setBookmarks(bidNtceNos);
      console.log('✅ [TenderSearchFilter] 즐겨찾기 로드:', bidNtceNos.length, '개');
    } catch (error) {
      console.error('❌ [TenderSearchFilter] 즐겨찾기 로드 실패:', error);
      // 에러 발생 시 빈 배열로 초기화
      setBookmarks([]);
    }
  };
  
  // 즐겨찾기 여부 확인
  const isBookmarked = (bidNtceNo) => {
    return bookmarks.includes(bidNtceNo);
  };
  
  // 즐겨찾기 토글 함수
  const handleToggleBookmark = async (item, e) => {
    // 이벤트 전파 중지 (행 클릭 이벤트와 충돌 방지)
    if (e) {
      e.stopPropagation();
    }
    
    if (!currentUser) {
      alert('로그인이 필요한 기능입니다.');
      return;
    }
    
    const bidNtceNo = item.bidNtceNo;
    if (!bidNtceNo) {
      console.warn('⚠️ [TenderSearchFilter] bidNtceNo가 없습니다.');
      alert('공고번호가 없어 즐겨찾기를 추가할 수 없습니다.');
      return;
    }
    
    try {
      const isCurrentlyBookmarked = isBookmarked(bidNtceNo);
      
      if (isCurrentlyBookmarked) {
        // 삭제
        await firebaseService.removeBookmark(currentUser.uid, bidNtceNo);
        setBookmarks(prev => prev.filter(no => no !== bidNtceNo));
        console.log('☆ [TenderSearchFilter] 즐겨찾기 제거:', bidNtceNo);
      } else {
        // 추가
        await firebaseService.addBookmark(currentUser.uid, bidNtceNo);
        setBookmarks(prev => [...prev, bidNtceNo]);
        console.log('⭐ [TenderSearchFilter] 즐겨찾기 추가:', bidNtceNo);
      }
    } catch (error) {
      console.error('❌ [TenderSearchFilter] 즐겨찾기 토글 실패:', error);
      const errorMessage = error.message || '즐겨찾기 처리에 실패했습니다.';
      alert(errorMessage);
    }
  };
  
  // 나라장터 공식 사이트로 이동하는 함수
  const handleRowClick = (item) => {
    if (!item?.bidNtceNo) {
      console.warn('⚠️ [TenderSearchFilter] 공고번호가 없어 링크를 열 수 없습니다.');
      return;
    }
    
    // 나라장터 공고 상세 페이지 URL (일반적인 형식)
    // 실제 URL 형식은 나라장터 사이트 구조에 따라 다를 수 있음
    const g2bUrl = `https://www.g2b.go.kr/ep/co/coDetail.do?bidNo=${item.bidNtceNo}`;
    window.open(g2bUrl, '_blank', 'noopener,noreferrer');
  };

  const handleInputChange = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSearchParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleBusinessTypeToggle = (type) => {
    setSearchParams((prev) => {
      if (type === '전체') {
        const next = prev.businessTypes.includes('전체') ? [] : ['전체'];
        return { ...prev, businessTypes: next.length ? next : ['전체'] };
      }

      const filtered = prev.businessTypes.filter((item) => item !== '전체');
      const exists = filtered.includes(type);
      const nextTypes = exists ? filtered.filter((item) => item !== type) : [...filtered, type];

      return {
        ...prev,
        businessTypes: nextTypes.length ? nextTypes : ['전체']
      };
    });
  };

  const handleBusinessStatusToggle = (status) => {
    setSearchParams((prev) => {
      if (status === '전체') {
        const next = prev.businessStatuses.includes('전체') ? [] : ['전체'];
        return { ...prev, businessStatuses: next.length ? next : ['전체'] };
      }

      const filtered = prev.businessStatuses.filter((item) => item !== '전체');
      const exists = filtered.includes(status);
      const nextStatuses = exists ? filtered.filter((item) => item !== status) : [...filtered, status];

      return {
        ...prev,
        businessStatuses: nextStatuses.length ? nextStatuses : ['전체']
      };
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    const mappedParams = mapSearchParamsToApiParams(searchParams);

    try {
      if (!resolvedApiBaseUrl) {
        throw new Error('API URL이 설정되지 않았습니다.');
      }

      console.log('🔍 [TenderSearchFilter] === API 요청 파라미터 상세 ===');
      console.log('📋 원본 searchParams:', JSON.stringify(searchParams, null, 2));
      console.log('📋 변환된 mappedParams:', JSON.stringify(mappedParams, null, 2));
      console.log('📋 필터링된 파라미터 (API 전송용):', Object.keys(mappedParams));
      
      // '전체' 값 필터링 검증 로그
      const filteredKeys = Object.keys(mappedParams);
      const originalKeys = Object.keys(searchParams);
      const removedKeys = originalKeys.filter(k => !filteredKeys.includes(k));
      if (removedKeys.length > 0) {
        console.log('⚠️ [TenderSearchFilter] 제외된 파라미터 (전체/빈값):', removedKeys);
      }
      
      console.log('📤 [TenderSearchFilter] API 요청 시작');

      // axios의 apiGet을 사용하여 요청 (params가 자동으로 쿼리 스트링으로 변환됨)
      const response = await apiGet('/api/bid-search', mappedParams);

      console.log('✅ [TenderSearchFilter] 검색 성공');
      console.log('✅ [TenderSearchFilter] 응답 상태:', response.status);

      const data = response.data;
      if (!data) {
        throw new Error('API 응답 데이터가 비어있습니다.');
      }

      const items = normalizeItems(data);
      console.log('✅ [TenderSearchFilter] 결과 아이템 수:', items.length);
      console.log('✅ [TenderSearchFilter] 전체 응답 데이터:', data);
      
      setResults(items);
      onSearchResult?.(data);
    } catch (err) {
      // axios 에러 처리
      console.error('[TenderSearchFilter] API 호출 오류:', err);

      if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
        setError('프록시 서버 연결 확인 필요 (네트워크 오류)');
      } else if (err.response) {
        // 서버 응답이 있는 경우
        const status = err.response.status;
        const responseData = err.response.data;
        
        if (status === 404 || status >= 500) {
          // 백엔드에서 반환한 에러 메시지 사용
          const errorMsg = responseData?.error || responseData?.message || '프록시 서버 연결 확인 필요';
          setError(errorMsg);
        } else if (status === 400) {
          // 잘못된 요청 (파라미터 오류 등)
          const errorMsg = responseData?.error || '요청 파라미터가 올바르지 않습니다.';
          setError(errorMsg);
        } else {
          // 기타 에러
          const errorMsg = responseData?.error || responseData?.message || `HTTP ${status} 오류`;
          setError(errorMsg);
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('검색 요청에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const businessTypeButtons = useMemo(
    () =>
      BUSINESS_TYPE_OPTIONS.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => handleBusinessTypeToggle(type)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
            searchParams.businessTypes.includes(type)
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-200 hover:text-brand hover:border-brand'
          }`}
        >
          {type}
        </button>
      )),
    [searchParams.businessTypes]
  );

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">입찰공고번호</label>
          <input
            type="text"
            value={searchParams.bidNtceNo}
            onChange={handleInputChange('bidNtceNo')}
            placeholder="입찰공고번호 입력"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">공고명</label>
          <input
            type="text"
            value={searchParams.bidNtceNm}
            onChange={handleInputChange('bidNtceNm')}
            placeholder="공고명 입력"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">공고종류</label>
          <select
            value={searchParams.bidNtceDtlClsfCd}
            onChange={handleInputChange('bidNtceDtlClsfCd')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          >
            <option value="전체">전체</option>
            <option value="실공고">실공고</option>
            <option value="가공고">가공고</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">공고/개찰일자</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={searchParams.fromBidDt}
              onChange={handleInputChange('fromBidDt')}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
            />
            <input
              type="date"
              value={searchParams.toBidDt}
              onChange={handleInputChange('toBidDt')}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={searchParams.excludeDeadline}
                onChange={handleInputChange('excludeDeadline')}
                className="w-4 h-4 text-brand rounded"
              />
              입찰마감제외
            </label>
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-bold text-gray-700 mb-2">업무구분</label>
          <div className="flex flex-wrap gap-2">{businessTypeButtons}</div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">업무여부</label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleBusinessStatusToggle(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                  searchParams.businessStatuses.includes(status)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-200 hover:text-brand hover:border-brand'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">기관명</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchParams.insttNm}
              onChange={handleInputChange('insttNm')}
              placeholder="기관명 입력"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
            />
            <div className="flex items-center gap-3 text-xs text-gray-600 whitespace-nowrap">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={searchParams.isAnnouncingInstitution}
                  onChange={handleInputChange('isAnnouncingInstitution')}
                  className="w-4 h-4 text-brand rounded"
                />
                공고기관
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={searchParams.isDemandingInstitution}
                  onChange={handleInputChange('isDemandingInstitution')}
                  className="w-4 h-4 text-brand rounded"
                />
                수요기관
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">참조번호</label>
          <input
            type="text"
            value={searchParams.refNo}
            onChange={handleInputChange('refNo')}
            placeholder="참조번호 입력"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">참가제한지역</label>
          <select
            value={searchParams.area}
            onChange={handleInputChange('area')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          >
            <option value="전체">전체</option>
            <option value="부산">부산</option>
            <option value="서울">서울</option>
            <option value="경기">경기</option>
          </select>
        </div>

        <div className="lg:col-span-3">
          <button
            type="button"
            onClick={() =>
              setSearchParams((prev) => ({ ...prev, isDetailedOpen: !prev.isDetailedOpen }))
            }
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand"
          >
            <Icons.ChevronDown size={16} className={searchParams.isDetailedOpen ? 'rotate-180' : ''} />
            상세조건 {searchParams.isDetailedOpen ? '접기' : '펼치기'}
          </button>
        </div>

        {searchParams.isDetailedOpen ? (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">업종</label>
              <input
                type="text"
                value={searchParams.industry}
                onChange={handleInputChange('industry')}
                placeholder="업종 입력"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">추정가격</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={searchParams.fromEstPrice}
                  onChange={handleInputChange('fromEstPrice')}
                  placeholder="최소"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
                />
                <input
                  type="number"
                  value={searchParams.toEstPrice}
                  onChange={handleInputChange('toEstPrice')}
                  placeholder="최대"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">세부품명번호</label>
              <input
                type="text"
                value={searchParams.detailItemNo}
                onChange={handleInputChange('detailItemNo')}
                placeholder="세부품명번호 입력"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">조달요청번호/PRNO</label>
              <input
                type="text"
                value={searchParams.prNo}
                onChange={handleInputChange('prNo')}
                placeholder="조달요청번호 입력"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">쇼핑몰공고</label>
              <select
                value={searchParams.shoppingMallYn}
                onChange={handleInputChange('shoppingMallYn')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              >
                <option value="전체">전체</option>
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">국내/국제</label>
              <select
                value={searchParams.domesticYn}
                onChange={handleInputChange('domesticYn')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              >
                <option value="전체">전체</option>
                <option value="국내">국내</option>
                <option value="국제">국제</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">계약유형</label>
              <select
                value={searchParams.contractType}
                onChange={handleInputChange('contractType')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              >
                <option value="전체">전체</option>
                <option value="일반">일반</option>
                <option value="수의">수의</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">계약법구분</label>
              <div className="flex gap-2">
                {['전체', '국가계약법', '지방계약법'].map((law) => (
                  <button
                    key={law}
                    type="button"
                    onClick={() => setSearchParams((prev) => ({ ...prev, contractLawType: law }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold border ${
                      searchParams.contractLawType === law
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-600 border-gray-200 hover:text-brand hover:border-brand'
                    }`}
                  >
                    {law}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">계약방법</label>
              <select
                value={searchParams.contractMethod}
                onChange={handleInputChange('contractMethod')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              >
                <option value="전체">전체</option>
                <option value="일괄계약">일괄계약</option>
                <option value="수의계약">수의계약</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">낙찰방법</label>
              <select
                value={searchParams.awardMethod}
                onChange={handleInputChange('awardMethod')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
              >
                <option value="전체">전체</option>
                <option value="최저가">최저가</option>
                <option value="적격심사">적격심사</option>
              </select>
            </div>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          <div className="flex items-start gap-2">
            <Icons.AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-700 mb-1">{error}</p>
              {import.meta.env.MODE === 'development' && (
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  <p>• 현재 API URL: {resolvedApiBaseUrl || '(설정되지 않음)'}</p>
                  <p>• 환경: {import.meta.env.MODE}</p>
                  <p className="mt-2 text-gray-600">
                    <strong>해결 방법:</strong><br/>
                    1. Functions 에뮬레이터 실행: <code className="bg-gray-100 px-1 rounded">cd functions && npm run serve</code><br/>
                    2. 개발 서버가 실행 중인지 확인<br/>
                    3. .env.development 파일의 VITE_API_URL 확인
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() =>
            setSearchParams((prev) => ({
              ...prev,
              bidNtceNo: '',
              bidNtceNm: '',
              insttNm: '',
              refNo: '',
              industry: '',
              fromEstPrice: '',
              toEstPrice: '',
              detailItemNo: '',
              prNo: ''
            }))
          }
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:text-brand hover:border-brand"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-brand text-white font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
              검색 중...
            </span>
          ) : (
            '검색'
          )}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-brand text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">No</th>
                  <th className="px-4 py-3 text-left font-bold">즐겨찾기</th>
                  <th className="px-4 py-3 text-left font-bold">공고번호</th>
                  <th className="px-4 py-3 text-left font-bold">공고명</th>
                  <th className="px-4 py-3 text-left font-bold">공고기관</th>
                  <th className="px-4 py-3 text-left font-bold">수요기관</th>
                  <th className="px-4 py-3 text-left font-bold">게시일시</th>
                  <th className="px-4 py-3 text-left font-bold">마감일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((item, index) => (
                  <tr 
                    key={`${item?.bidNtceNo || 'item'}-${index}`} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => handleToggleBookmark(item, e)}
                        className="p-1 hover:bg-gray-100 rounded"
                        disabled={!currentUser}
                        title={currentUser ? '즐겨찾기 추가/제거' : '로그인 필요'}
                      >
                        <Icons.Star 
                          className={`w-5 h-5 ${isBookmarked(item.bidNtceNo) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-700 hover:text-brand transition-colors">
                      <span className="flex items-center gap-1">
                        {item?.bidNtceNo || '-'}
                        <Icons.ExternalLink className="w-3 h-3 opacity-50" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 hover:text-brand transition-colors font-medium">
                      {item?.bidNtceNm || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item?.ntceInsttNm || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item?.dminsttNm || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item?.bidNtceDt || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item?.bidClseDt || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : results.length === 0 && !loading && !error ? (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Icons.Info className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <p className="font-bold text-blue-700 mb-2">검색 결과가 없습니다</p>
          <p className="text-sm text-blue-600 mb-4">
            다른 검색 조건을 시도해보시거나 날짜 범위를 넓혀보세요.
          </p>
          <div className="text-xs text-blue-500 space-y-1">
            <p>• 검색어를 변경하거나 제거해보세요</p>
            <p>• 날짜 범위를 넓혀보세요 (상세조건에서 설정 가능)</p>
            <p>• 필터 조건을 완화해보세요</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
