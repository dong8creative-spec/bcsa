import React, { useState, useMemo, useEffect, useRef } from 'react';
import PageTitle from './PageTitle';
import { Icons } from './Icons';
import { waitForKakaoMapsServicesReady } from '../utils/kakaoMapReady';

/** 주소로 좌표 조회 (카카오 지오코딩) */
const geocodeAddress = (address) => {
    if (!address || !window.kakao?.maps?.services?.Geocoder) return Promise.resolve(null);
    return new Promise((resolve) => {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(address, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK && result && result[0]) {
                resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
            } else {
                resolve(null);
            }
        });
    });
};

/** 본문·카드 레이아웃이 먼저 그려지도록 지도/지오코딩 시작을 다음 idle 프레임으로 미룸 */
const runAfterIdle = (callback) => {
    if (typeof requestIdleCallback !== 'undefined') {
        const id = requestIdleCallback(() => callback(), { timeout: 120 });
        return () => typeof cancelIdleCallback !== 'undefined' && cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => callback(), 32);
    return () => window.clearTimeout(t);
};

/** 말풍선 테두리색 (tailwind brand와 동일 — SVG·인라인 스타일용) */
const BUBBLE_BORDER = '#0045a5';

/** 말풍선 DOM 생성 (업체명) — textContent로 XSS 방지, 꼬리는 SVG로 고정(클리핑·Tailwind 누락 방지) */
const buildNameBubbleContent = (title) => {
    const wrap = document.createElement('div');
    wrap.className = 'relative flex flex-col items-center pointer-events-none';
    const bubble = document.createElement('div');
    /* 하단 테두리 없음 → 꼬리와 겹치는 가로선 제거, 좌·상·우만 1px (rounded-lg로 하단 모서리는 본체 배경으로 유지) */
    bubble.className =
        'max-w-[min(200px,85vw)] px-2.5 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-bold shadow-md border border-brand border-b-0 text-center leading-tight line-clamp-2';
    bubble.textContent = title || '이름 없음';
    /* 꼬리: 채움 polygon + 양쪽 경사선만 polyline(상단 가로선 스트로크 없음 → 본체와 이음새 끊김 방지) */
    const tailSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tailSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    tailSvg.setAttribute('width', '16');
    tailSvg.setAttribute('height', '10');
    tailSvg.setAttribute('viewBox', '0 0 16 10');
    tailSvg.style.display = 'block';
    tailSvg.style.flexShrink = '0';
    tailSvg.style.marginTop = '-1px';
    const tailFill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    tailFill.setAttribute('points', '0,0 16,0 8,10');
    tailFill.setAttribute('fill', '#ffffff');
    tailFill.setAttribute('stroke', 'none');
    const tailEdge = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    tailEdge.setAttribute('points', '0,0 8,10 16,0');
    tailEdge.setAttribute('fill', 'none');
    tailEdge.setAttribute('stroke', BUBBLE_BORDER);
    tailEdge.setAttribute('stroke-width', '1');
    tailEdge.setAttribute('stroke-linecap', 'butt');
    tailEdge.setAttribute('stroke-linejoin', 'miter');
    tailSvg.appendChild(tailFill);
    tailSvg.appendChild(tailEdge);
    wrap.appendChild(bubble);
    wrap.appendChild(tailSvg);
    return wrap;
};

const RestaurantMapPreview = ({ restaurant, waitForKakaoMap }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const overlayRef = useRef(null);
    const hasCoords = restaurant?.location?.lat != null && restaurant?.location?.lng != null;
    const address = restaurant?.location?.address?.trim();

    const [resolvedCoords, setResolvedCoords] = useState(() =>
        hasCoords ? { lat: restaurant.location.lat, lng: restaurant.location.lng } : null
    );
    const [geocodeFailed, setGeocodeFailed] = useState(false);

    // 초기 좌표 또는 주소 → 좌표 확정
    useEffect(() => {
        if (hasCoords) {
            setResolvedCoords({ lat: restaurant.location.lat, lng: restaurant.location.lng });
            setGeocodeFailed(false);
            return undefined;
        }
        if (!address || !waitForKakaoMap) {
            setResolvedCoords(null);
            return undefined;
        }
        let mounted = true;
        const cancelIdle = runAfterIdle(() => {
            if (!mounted) return;
            (async () => {
                try {
                    await waitForKakaoMap();
                    if (!mounted) return;
                    await waitForKakaoMapsServicesReady();
                    if (!mounted) return;
                    const coords = await geocodeAddress(address);
                    if (mounted && coords) setResolvedCoords(coords);
                    else if (mounted) setGeocodeFailed(true);
                } catch (e) {
                    if (mounted) setGeocodeFailed(true);
                }
            })();
        });
        return () => {
            mounted = false;
            cancelIdle();
        };
    }, [hasCoords, restaurant?.location?.lat, restaurant?.location?.lng, address, waitForKakaoMap]);

    // 확정된 좌표로 지도 렌더 + 업체명 말풍선(CustomOverlay)
    useEffect(() => {
        if (!resolvedCoords || !mapContainerRef.current || !waitForKakaoMap) return undefined;
        let mounted = true;
        const cancelIdle = runAfterIdle(() => {
            if (!mounted) return;
            const init = async () => {
                try {
                    await waitForKakaoMap();
                    if (!mounted || !mapContainerRef.current || !window.kakao?.maps) return;
                    const kakao = window.kakao;
                    const position = new kakao.maps.LatLng(resolvedCoords.lat, resolvedCoords.lng);
                    mapRef.current = new kakao.maps.Map(mapContainerRef.current, {
                        center: position,
                        level: 4
                    });
                    const content = buildNameBubbleContent(restaurant?.title);
                    const overlay = new kakao.maps.CustomOverlay({
                        position,
                        content,
                        yAnchor: 1,
                        xAnchor: 0.5,
                        zIndex: 2
                    });
                    overlay.setMap(mapRef.current);
                    overlayRef.current = overlay;
                } catch (e) {
                    console.error('맵 미리보기 초기화 실패:', e);
                }
            };
            void init();
        });
        return () => {
            mounted = false;
            cancelIdle();
            if (overlayRef.current) {
                overlayRef.current.setMap(null);
                overlayRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current = null;
            }
            if (mapContainerRef.current) {
                mapContainerRef.current.innerHTML = '';
            }
        };
    }, [resolvedCoords, waitForKakaoMap, restaurant?.title]);

    if (!address && !hasCoords) return null;
    if (geocodeFailed && !resolvedCoords) return null;

    /* 주소만 있는 경우 지오코딩/SDK 대기 — 카드와 동일 4:3 비율로 스켈레톤 */
    if (!resolvedCoords && !geocodeFailed) {
        return (
            <div
                className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center gap-2 text-xs text-gray-500"
                aria-hidden
            >
                <span className="inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
                지도 불러오는 중…
            </div>
        );
    }

    return (
        <div className="w-full min-h-0">
            <div
                className="w-full aspect-[4/3] overflow-visible bg-gray-100"
                ref={mapContainerRef}
            />
        </div>
    );
};

/** 스크롤로 화면에 가까워진 카드만 임베드 지도를 마운트해 초기 진입 부담을 줄임 */
const LazyRestaurantMapPreview = ({ restaurant, waitForKakaoMap }) => {
    const wrapRef = useRef(null);
    const [activate, setActivate] = useState(false);

    useEffect(() => {
        if (activate) return undefined;
        const el = wrapRef.current;
        if (!el) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setActivate(true);
            return undefined;
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setActivate(true);
                    io.disconnect();
                }
            },
            { root: null, rootMargin: '800px 0px', threshold: 0 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [activate]);

    return (
        <div ref={wrapRef} className="w-full min-h-0">
            {!activate ? (
                <div
                    className="w-full aspect-[4/3] bg-gradient-to-b from-gray-50 to-gray-100/90 border-t border-blue-100/80 flex flex-col items-center justify-center gap-1.5 text-[11px] text-gray-400"
                    aria-hidden
                >
                    <Icons.MapPin className="w-7 h-7 text-brand/30 shrink-0" />
                    <span>지도 미리보기</span>
                </div>
            ) : (
                <RestaurantMapPreview restaurant={restaurant} waitForKakaoMap={waitForKakaoMap} />
            )}
        </div>
    );
};

/** 주소 문자열에서 "○○구" 추출 (해운대구, 부산진구 등) */
const getDistrictFromAddress = (addressStr) => {
    if (!addressStr || typeof addressStr !== 'string') return '';
    const tight = addressStr.match(/([가-힣]+구)/);
    if (tight) return tight[1];
    const withSpace = addressStr.match(/([가-힣]+)\s*구\b/);
    if (withSpace) return withSpace[1].trim() + '구';
    const gun = addressStr.match(/([가-힣]+군)/);
    if (gun) return gun[1];
    return '';
};

/** 지역구 옵션 순서 (부산 구·군) */
const DISTRICT_ORDER = ['해운대구', '부산진구', '동래구', '남구', '북구', '중구', '영도구', '동구', '서구', '사하구', '금정구', '연제구', '수영구', '사상구', '기장군'];

/** 카카오맵 미리보기 링크 (좌표 또는 주소) */
const getKakaoMapLink = (restaurant) => {
    const loc = restaurant?.location;
    const title = restaurant?.title || '맛집';
    if (loc?.lat != null && loc?.lng != null) {
        return `https://map.kakao.com/link/map/${encodeURIComponent(title)},${loc.lat},${loc.lng}`;
    }
    if (loc?.address) {
        return `https://map.kakao.com/?q=${encodeURIComponent(loc.address)}`;
    }
    return null;
};

const RestaurantsListView = ({ onBack, restaurants, currentUser, isFoodBusinessOwner, onRestaurantClick, onCreateClick, menuNames, pageTitles, waitForKakaoMap }) => {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('전체');
    
    const baseFiltered = useMemo(() => restaurants.filter(restaurant => {
        const isApproved = restaurant.approvalStatus === 'approved' || !restaurant.approvalStatus;
        const isVisible = restaurant.isVisible !== false;
        if (!isApproved || !isVisible) return false;
        const matchKeyword = !searchKeyword ||
            restaurant.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            restaurant.location?.address?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            restaurant.ownerName?.toLowerCase().includes(searchKeyword.toLowerCase());
        return matchKeyword;
    }), [restaurants, searchKeyword]);

    const districts = useMemo(() => {
        const set = new Set(baseFiltered.map(r => getDistrictFromAddress(r.location?.address || '')).filter(Boolean));
        const ordered = DISTRICT_ORDER.filter(d => set.has(d));
        const rest = [...set].filter(d => !DISTRICT_ORDER.includes(d)).sort((a, b) => a.localeCompare(b, 'ko'));
        return ['전체', ...ordered, ...rest];
    }, [baseFiltered]);

    const filteredRestaurants = useMemo(() => {
        if (selectedDistrictFilter === '전체') return baseFiltered;
        return baseFiltered.filter(r => getDistrictFromAddress(r.location?.address || '') === selectedDistrictFilter);
    }, [baseFiltered, selectedDistrictFilter]);

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="w-full text-center md:text-left">
                        <PageTitle pageKey="restaurants" pageTitles={pageTitles} defaultText={menuNames?.['부산맛집'] || '맛집'} />
                        <p className="text-gray-500 text-sm">부산 지역 맛집 정보</p>
                    </div>
                    <div className="w-full flex justify-end md:justify-start items-center gap-4">
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateClick(); }} 
                                className="flex items-center gap-2 bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Icons.Plus size={20} /> 맛집 등록
                            </button>
                        ) : null}
                        <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} 
                            className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors"
                        >
                            <Icons.ArrowLeft size={20} /> 메인으로
                        </button>
                    </div>
                </div>

                {/* 검색·지역구 필터 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-600 mb-2">검색</label>
                            <div className="relative">
                                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="맛집명, 주소, 등록자명 검색" 
                                    className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none text-sm" 
                                    value={searchKeyword} 
                                    onChange={(e) => setSearchKeyword(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-44">
                            <label className="block text-xs font-bold text-gray-600 mb-2">지역구</label>
                            <select 
                                className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none text-sm bg-white cursor-pointer" 
                                value={selectedDistrictFilter} 
                                onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                            >
                                {districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                        검색 결과: <span className="font-bold text-brand">{filteredRestaurants.length}</span>개
                    </div>
                </div>

                {/* 맛집 리스트: 한 줄 3곳, 윗줄 1:1 사진+업장정보, 아래 고정 높이 지도 미리보기 */}
                {filteredRestaurants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRestaurants.map((restaurant, index) => {
                            const mapLink = getKakaoMapLink(restaurant);
                            const canShowMap = (restaurant?.location?.lat != null && restaurant?.location?.lng != null) || (restaurant?.location?.address?.trim());
                            const prioritizeImage = index < 9;
                            return (
                                <div 
                                    key={restaurant.id} 
                                    className="bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md transition-all hover:border-brand/20 overflow-visible flex flex-col cursor-pointer" 
                                    onClick={() => onRestaurantClick(restaurant)}
                                >
                                    {/* 윗줄: 1:1 주요사진 | 오른쪽 업장 정보 — 여기만 overflow로 모서리 클립 (지도 말풍선은 아래에서 overflow-visible) */}
                                    <div className="flex flex-row gap-0 min-h-0 rounded-t-2xl overflow-hidden">
                                        {/* 1:1 주요사진 */}
                                        <div className="w-1/2 flex-shrink-0" style={{ aspectRatio: '1/1' }}>
                                            {restaurant.images && restaurant.images.length > 0 ? (
                                                <img 
                                                    src={restaurant.images[0]} 
                                                    alt={restaurant.title} 
                                                    className="w-full h-full object-cover" 
                                                    loading={prioritizeImage ? 'eager' : 'lazy'}
                                                    fetchPriority={prioritizeImage ? 'high' : 'low'}
                                                    decoding="async"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">사진 없음</div>
                                            )}
                                        </div>
                                        {/* 오른쪽 업장 정보 */}
                                        <div className="w-1/2 flex flex-col justify-center p-4 min-w-0">
                                            <h3 className="text-[1.2rem] font-bold text-dark mb-1.5 line-clamp-2 hover:text-brand transition-colors leading-snug">
                                                {restaurant.title || '제목 없음'}
                                            </h3>
                                            {restaurant.menuItems && restaurant.menuItems.length > 0 && (
                                                <p className="text-xs text-gray-700 mb-1 line-clamp-1">
                                                    <span className="font-semibold text-brand">대표메뉴</span> {restaurant.menuItems[0].name}{restaurant.menuItems[0].price ? ` · ${restaurant.menuItems[0].price}` : ''}
                                                </p>
                                            )}
                                            {restaurant.description && (
                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                    {restaurant.description}
                                                </p>
                                            )}
                                            {restaurant.location?.address && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex items-start gap-1">
                                                    <Icons.MapPin size={12} className="shrink-0 mt-0.5" />
                                                    <span>{restaurant.location.address}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* 아래: 4:3 카카오맵 풀너비, 링크만 좌우 여백 — 말풍선 꼬리가 잘리지 않도록 overflow-visible */}
                                    <div className="w-full rounded-b-2xl overflow-visible">
                                        {canShowMap && waitForKakaoMap ? (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <LazyRestaurantMapPreview restaurant={restaurant} waitForKakaoMap={waitForKakaoMap} />
                                            </div>
                                        ) : null}
                                        {mapLink && (
                                            <div className="px-4 pb-3 pt-2">
                                                <a 
                                                    href={mapLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="inline-flex items-center justify-center gap-1.5 w-full text-xs font-bold text-brand hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Icons.MapPin size={12} />
                                                    카카오맵에서 길찾기
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>등록된 맛집이 없습니다.</p>
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button"
                                onClick={onCreateClick}
                                className="mt-4 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                맛집 등록하기
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestaurantsListView;
