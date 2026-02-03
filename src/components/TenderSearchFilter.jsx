import React, { useMemo, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { getApiBaseUrl, apiGet } from '../utils/api';
import { firebaseService } from '../services/firebaseService';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import TenderDetail from './TenderDetail';

const mapSearchParamsToApiParams = (params) => {
  // 날짜 포맷 변환: YYYYMMDDHHMM (12자리) 형식으로 변환
  const formatDateParam = (dateStr, isStartDate = true) => {
    if (!dateStr) return '';
    const cleaned = dateStr.replace(/-/g, '').replace(/\s/g, '');
    if (/^\d{8}$/.test(cleaned)) {
      const timePart = isStartDate ? '0000' : '2359';
      return cleaned + timePart;
    }
    console.warn(`[Date Format] Invalid date format: ${dateStr}, expected YYYYMMDD`);
    return '';
  };

  const result = {
    bidNtceNo: params.bidNtceNo?.trim() || '',
    bidNtceNm: params.bidNtceNm?.trim() || '',
    inqryDiv: params.inqryDiv || '1',
    fromBidDt: formatDateParam(params.fromBidDt, true),
    toBidDt: formatDateParam(params.toBidDt, false),
    bidNtceDtlClsfCd: params.bidNtceDtlClsfCd || '',
    excludeDeadline: params.excludeDeadline !== false ? 'true' : 'false'
  };

  // ====== 데이터 클렌징: 빈 값, null, undefined, '전체' 완전 제거 ======
  Object.keys(result).forEach((key) => {
    const value = result[key];
    
    // inqryDiv, excludeDeadline는 항상 유지
    if (key === 'inqryDiv' || key === 'excludeDeadline') {
      return;
    }
    
    // 1. null, undefined 제거
    if (value === null || value === undefined) {
      delete result[key];
      return;
    }
    
    // 2. 문자열 처리: 빈 문자열, '전체', 공백만 있는 경우 제거
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '전체') {
        delete result[key];
        return;
      }
    }
    
    // 3. 배열 처리: '전체', 빈 문자열, null, undefined 제거
    if (Array.isArray(value)) {
      const filtered = value.filter(v => {
        if (v === null || v === undefined) return false;
        const str = String(v).trim();
        return str !== '전체' && str !== '';
      });
      
      // 필터링 후 빈 배열이면 해당 키 자체 삭제
      if (filtered.length === 0) {
        delete result[key];
      } else {
        result[key] = filtered;
      }
    }
  });

  console.log('✅ [mapSearchParamsToApiParams] 클렌징 완료:', result);
  return result;
};

const normalizeItems = (payload) => {
  console.log('🔍 [normalizeItems] 입력 payload:', payload);
  console.log('🔍 [normalizeItems] payload.data:', payload?.data);
  console.log('🔍 [normalizeItems] payload.data.items:', payload?.data?.items);
  console.log('🔍 [normalizeItems] payload.data.totalCount:', payload?.data?.totalCount);
  console.log('🔍 [normalizeItems] payload.data의 모든 키:', payload?.data ? Object.keys(payload.data) : 'data 없음');
  
  // 1. 최신 API 응답 형식: { success: true, data: { items: [...], totalCount: ... } }
  if (payload?.data?.items && Array.isArray(payload.data.items)) {
    console.log('✅ [normalizeItems] 최신 형식으로 파싱 성공:', payload.data.items.length, '개');
    return payload.data.items;
  }
  
  // 2. data 객체가 비어있거나 items가 없는 경우
  if (payload?.data && typeof payload.data === 'object') {
    // data가 빈 객체 {}인 경우 또는 items가 없는 경우
    if (!payload.data.items || (Array.isArray(payload.data.items) && payload.data.items.length === 0)) {
      console.log('⚠️ [normalizeItems] data.items가 없거나 빈 배열');
      return [];
    }
  }
  
  // 3. 레거시 응답 형식: { response: { body: { items: { item: [...] } } } }
  const items = payload?.response?.body?.items?.item
    ?? payload?.response?.body?.items
    ?? [];

  if (Array.isArray(items)) {
    console.log('✅ [normalizeItems] 레거시 형식으로 파싱 성공:', items.length, '개');
    return items;
  }

  if (items && typeof items === 'object') {
    console.log('✅ [normalizeItems] 단일 객체를 배열로 변환');
    return [items];
  }

  console.log('❌ [normalizeItems] 파싱 실패 - 빈 배열 반환');
  return [];
};

export const TenderSearchFilter = ({ apiBaseUrl, onSearchResult }) => {
  const resolvedApiBaseUrl = apiBaseUrl || getApiBaseUrl();
  
  // 최근 30일 날짜 (나라장터와 비교 시 일치율 확보용 기본값, 마운트 시 1회만 계산)
  const defaultDates = useMemo(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { fromBidDt: fmt(from), toBidDt: fmt(today) };
  }, []);

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
    fromBidDt: defaultDates.fromBidDt,
    toBidDt: defaultDates.toBidDt,
    excludeDeadline: true,
    bidNtceDtlClsfCd: '전체'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  // 검증용: 마지막 응답 메타·요청 파라미터 (나라장터 검색결과 검증 가이드용)
  const [lastResponseMeta, setLastResponseMeta] = useState(null);
  const [lastRequestParams, setLastRequestParams] = useState(null);
  const [verificationPanelOpen, setVerificationPanelOpen] = useState(false);
  
  // 즐겨찾기 관련 상태
  const [currentUser, setCurrentUser] = useState(null);
  const [bookmarks, setBookmarks] = useState([]); // bidNtceNo 배열
  // 상세 보기 모달: 선택한 공고 (item | null)
  const [selectedDetailBid, setSelectedDetailBid] = useState(null);
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
  
  // 나라장터 공고번호 표시 형식: R26BK01270659-000 (차수 3자리)
  const formatBidNoWithOrd = (item) => {
    if (!item?.bidNtceNo) return '-';
    const ord = item.bidNtceOrd != null && item.bidNtceOrd !== ''
      ? String(item.bidNtceOrd).padStart(3, '0')
      : '000';
    return `${item.bidNtceNo}-${ord}`;
  };

  // 나라장터 입찰공고 검색(결과) 페이지 URL — 공고번호 클릭 시 해당 공고를 검색결과에서 볼 수 있도록
  const getBidSearchResultUrl = (item) => {
    const base = 'https://www.g2b.go.kr/ep/invitation/publish/publishInvitation.do';
    if (!item?.bidNtceNo) return base;
    const params = new URLSearchParams({ bidNtceNo: item.bidNtceNo });
    return `${base}?${params.toString()}`;
  };

  const handleInputChange = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSearchParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    const paramsWithDates = {
      ...searchParams,
      fromBidDt: searchParams.fromBidDt || defaultDates.fromBidDt,
      toBidDt: searchParams.toBidDt || defaultDates.toBidDt
    };
    const mappedParams = mapSearchParamsToApiParams(paramsWithDates);

    try {
      if (!resolvedApiBaseUrl) {
        throw new Error('API URL이 설정되지 않았습니다.');
      }

      // ====== 1. 정밀 로깅 시스템: API 전송 직전 최종 파라미터 출력 ======
      console.log('═══════════════════════════════════════════════');
      console.log('🔍 [DEBUG_G2B_PARAMS] API 최종 쿼리 파라미터');
      console.log('═══════════════════════════════════════════════');
      console.log('📋 원본 searchParams:', JSON.stringify(searchParams, null, 2));
      console.log('───────────────────────────────────────────────');
      console.log('📋 클렌징 후 mappedParams:', JSON.stringify(mappedParams, null, 2));
      console.log('───────────────────────────────────────────────');
      console.log('📋 전송될 파라미터 키 목록:', Object.keys(mappedParams));
      console.log('📋 전송될 파라미터 개수:', Object.keys(mappedParams).length);
      
      // '전체' 값 필터링 검증 로그
      const filteredKeys = Object.keys(mappedParams);
      const originalKeys = Object.keys(searchParams);
      const removedKeys = originalKeys.filter(k => !filteredKeys.includes(k));
      if (removedKeys.length > 0) {
        console.log('⚠️ 제외된 파라미터 (전체/빈값/null):', removedKeys);
      }
      
      // 날짜 포맷 검증
      if (mappedParams.fromBidDt) {
        console.log(`📅 시작일 (fromBidDt): ${mappedParams.fromBidDt} (길이: ${mappedParams.fromBidDt.length}자리)`);
      }
      if (mappedParams.toBidDt) {
        console.log(`📅 종료일 (toBidDt): ${mappedParams.toBidDt} (길이: ${mappedParams.toBidDt.length}자리)`);
      }
      
      // 쿼리 스트링 미리보기 (axios가 변환할 형태)
      const queryString = new URLSearchParams(
        Object.entries(mappedParams)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .flatMap(([k, v]) => 
            Array.isArray(v) ? v.map(item => [k, item]) : [[k, v]]
          )
      ).toString();
      console.log('🔗 최종 쿼리 스트링:', queryString);
      console.log('═══════════════════════════════════════════════');
      
      console.log('📤 [TenderSearchFilter] API 요청 시작');

      // axios의 apiGet을 사용하여 요청 (params가 자동으로 쿼리 스트링으로 변환됨)
      const response = await apiGet('/api/bid-search', mappedParams);

      console.log('✅ [TenderSearchFilter] 검색 성공');
      console.log('✅ [TenderSearchFilter] 응답 상태:', response.status);
      console.log('✅ [TenderSearchFilter] 전체 응답 객체:', response);
      console.log('✅ [TenderSearchFilter] response.data:', response.data);
      console.log('✅ [TenderSearchFilter] response.data 타입:', typeof response.data);
      console.log('✅ [TenderSearchFilter] response.data 구조:', {
        hasSuccess: 'success' in (response.data || {}),
        hasData: 'data' in (response.data || {}),
        dataType: typeof response.data?.data,
        hasItems: 'items' in (response.data?.data || {}),
        itemsType: Array.isArray(response.data?.data?.items),
        itemsLength: response.data?.data?.items?.length
      });

      const data = response.data;
      if (!data) {
        throw new Error('API 응답 데이터가 비어있습니다.');
      }

      // success가 false인 경우 에러 처리
      if (data.success === false) {
        const errorMsg = data.error || data.message || '검색에 실패했습니다.';
        setError(errorMsg);
        setResults([]);
        return;
      }

      const items = normalizeItems(data);
      console.log('✅ [TenderSearchFilter] normalizeItems 결과:', items);
      console.log('✅ [TenderSearchFilter] 결과 아이템 수:', items.length);
      
      if (items.length === 0 && data.success === true) {
        console.log('⚠️ [TenderSearchFilter] 검색은 성공했지만 결과가 없습니다.');
      }
      
      setResults(items);
      setLastResponseMeta({
        cached: data.cached,
        totalCount: data.data?.totalCount,
        meta: data.meta,
        warnings: data.warnings,
        searchParams: data.data?.searchParams
      });
      setLastRequestParams(mappedParams);
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
          // 백엔드에서 반환한 에러 메시지 사용 (message가 있으면 함께 표시)
          const errorMsg = responseData?.error || responseData?.message || '프록시 서버 연결 확인 필요';
          const detailMsg = responseData?.message && responseData?.message !== errorMsg ? responseData.message : '';
          setError(detailMsg ? `${errorMsg}\n\n${detailMsg}` : errorMsg);
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

  return (
    <div className="bg-white rounded-2xl shadow-card border border-blue-200 p-6">
      {selectedDetailBid ? (
        <TenderDetail
          bidNtceNo={selectedDetailBid.bidNtceNo}
          bidNtceOrd={selectedDetailBid.bidNtceOrd}
          onClose={() => setSelectedDetailBid(null)}
          fallbackItem={selectedDetailBid}
        />
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">입찰공고번호</label>
          <input
            type="text"
            value={searchParams.bidNtceNo}
            onChange={handleInputChange('bidNtceNo')}
            placeholder="입찰공고번호 입력"
            className="w-full px-3 py-2 rounded-lg border border-blue-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">공고명</label>
          <input
            type="text"
            value={searchParams.bidNtceNm}
            onChange={handleInputChange('bidNtceNm')}
            placeholder="공고명 입력"
            className="w-full px-3 py-2 rounded-lg border border-blue-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">공고종류</label>
          <select
            value={searchParams.bidNtceDtlClsfCd}
            onChange={handleInputChange('bidNtceDtlClsfCd')}
            className="w-full px-3 py-2 rounded-lg border border-blue-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
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
              className="flex-1 px-3 py-2 rounded-lg border border-blue-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
            />
            <input
              type="date"
              value={searchParams.toBidDt}
              onChange={handleInputChange('toBidDt')}
              className="flex-1 px-3 py-2 rounded-lg border border-blue-200 ring-1 ring-transparent focus:ring-brand focus:border-brand"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap" title="체크 시 마감된 공고 제외">
              <input
                type="checkbox"
                checked={searchParams.excludeDeadline !== false}
                onChange={(e) => setSearchParams((prev) => ({ ...prev, excludeDeadline: e.target.checked }))}
                className="w-4 h-4 text-brand rounded"
              />
              입찰마감제외
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          <div className="flex items-start gap-2">
            <Icons.AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-700 mb-1 whitespace-pre-line">{error}</p>
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
              fromBidDt: defaultDates.fromBidDt,
              toBidDt: defaultDates.toBidDt
            }))
          }
          className="px-4 py-2 rounded-lg border border-blue-200 text-gray-600 hover:text-brand hover:border-brand"
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
        <div className="mt-6 bg-white rounded-2xl border border-blue-200 overflow-hidden">
          <p className="px-4 py-2 text-sm text-gray-600 bg-blue-50/80 border-b border-blue-200">
            검색결과는 나라장터(공공데이터포털)와 동일한 데이터를 사용합니다. 공고번호를 클릭하면 나라장터 입찰공고 검색결과에서 확인할 수 있습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-brand text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">No</th>
                  <th className="px-4 py-3 text-left font-bold">즐겨찾기</th>
                  <th className="px-4 py-3 text-left font-bold">공고번호</th>
                  <th className="px-4 py-3 text-left font-bold">상세</th>
                  <th className="px-4 py-3 text-left font-bold">공고명</th>
                  <th className="px-4 py-3 text-left font-bold">공고기관</th>
                  <th className="px-4 py-3 text-left font-bold">수요기관</th>
                  <th className="px-4 py-3 text-left font-bold">게시일시</th>
                  <th className="px-4 py-3 text-left font-bold">마감일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {results.map((item, index) => (
                  <tr
                    key={`${item?.bidNtceNo || 'item'}-${index}`}
                    className="hover:bg-gray-50 transition-colors"
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
                    <td className="px-4 py-3">
                      <a
                        href={getBidSearchResultUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-brand transition-colors underline decoration-brand/50 hover:decoration-brand"
                        title="나라장터 입찰공고 검색결과에서 보기"
                      >
                        {formatBidNoWithOrd(item)}
                        <Icons.ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedDetailBid(item); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium text-brand border border-brand/50 hover:bg-brand/10"
                        title="상세 내역 보기"
                      >
                        상세 보기
                      </button>
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
          {/* 나라장터 검색결과 검증용: 응답 메타·요청 파라미터 표시 */}
          {lastResponseMeta != null || lastRequestParams != null ? (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setVerificationPanelOpen((v) => !v)}
                className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
              >
                <span>검증 정보 (나라장터 결과 비교용)</span>
                <Icons.ChevronDown size={16} className={`transition-transform ${verificationPanelOpen ? 'rotate-180' : ''}`} />
              </button>
              {verificationPanelOpen ? (
                <div className="p-4 bg-gray-50/80 text-xs font-mono space-y-3 border-t border-gray-200">
                  {lastResponseMeta ? (
                    <>
                      <div>
                        <span className="font-bold text-gray-700">응답 메타</span>
                        <ul className="mt-1 text-gray-600 list-none space-y-0.5">
                          <li>cached: {String(lastResponseMeta.cached)}</li>
                          <li>totalCount: {lastResponseMeta.totalCount ?? '-'}</li>
                          {lastResponseMeta.meta ? (
                            <>
                              <li>meta.timestamp: {lastResponseMeta.meta.timestamp ?? '-'}</li>
                              <li>meta.apiCallCount: {lastResponseMeta.meta.apiCallCount ?? '-'}</li>
                              <li>meta.successfulCalls: {lastResponseMeta.meta.successfulCalls ?? '-'}</li>
                              <li>meta.partialFailure: {String(lastResponseMeta.meta.partialFailure ?? false)}</li>
                              <li>meta.deduplicatedFrom: {lastResponseMeta.meta.deduplicatedFrom ?? '-'}</li>
                            </>
                          ) : null}
                          {Array.isArray(lastResponseMeta.warnings) && lastResponseMeta.warnings.length > 0 ? (
                            <li className="text-amber-700">warnings: {lastResponseMeta.warnings.join('; ')}</li>
                          ) : null}
                        </ul>
                      </div>
                      {lastResponseMeta.searchParams ? (
                        <div>
                          <span className="font-bold text-gray-700">응답 searchParams (날짜 등)</span>
                          <pre className="mt-1 text-gray-600 whitespace-pre-wrap break-all">
                            {JSON.stringify(lastResponseMeta.searchParams, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {lastRequestParams ? (
                    <div>
                      <span className="font-bold text-gray-700">전송 요청 파라미터</span>
                      <pre className="mt-1 text-gray-600 whitespace-pre-wrap break-all">
                        {JSON.stringify(lastRequestParams, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
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
            <p>• 날짜 범위를 넓혀보세요</p>
            <p>• 필터 조건을 완화해보세요</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
