import React, { useState, useEffect, useRef } from 'react';
import { useKakaoMap } from '../../../hooks/useKakaoMap';
import { waitForKakaoMapsServicesReady } from '../../../utils/kakaoMapReady';
import { Icons } from '../../../components/Icons';
import ModalPortal from '../../../components/ModalPortal';

/**
 * 카카오맵 장소 선택 모달 컴포넌트
 * @param {Object} props
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} props.onSelectLocation - 장소 선택 완료 핸들러
 * @param {Object} props.initialLocation - 초기 위치 {lat, lng, name, address}
 */
export const KakaoMapModal = ({ onClose, onSelectLocation, initialLocation }) => {
  const { kakao, isLoaded, isError, error, searchPlaces } = useKakaoMap();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const mapClickHandlerRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  const initialLat = initialLocation?.lat;
  const initialLng = initialLocation?.lng;
  const initialName = initialLocation?.name ?? '';
  const initialAddr = initialLocation?.address ?? '';

  useEffect(() => {
    if (!isLoaded || !kakao || !mapContainerRef.current) return;
    if (typeof kakao.maps?.LatLng !== 'function' || typeof kakao.maps?.Map !== 'function') return;

    const container = mapContainerRef.current;
    const K = kakao;
    let cancelled = false;

    (async () => {
      try {
        await waitForKakaoMapsServicesReady();
      } catch (err) {
        console.error('카카오맵 services 로드 실패:', err);
        if (!cancelled) {
          alert(err?.message || '주소 검색 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        }
        return;
      }
      if (cancelled || !mapContainerRef.current) return;

      const center = initialLat != null && initialLng != null
        ? new K.maps.LatLng(initialLat, initialLng)
        : new K.maps.LatLng(35.1796, 129.0756);

      const mapOption = { center, level: 3 };

      mapRef.current = new K.maps.Map(mapContainerRef.current, mapOption);
      geocoderRef.current = new K.maps.services.Geocoder();

      const zoomControl = new K.maps.ZoomControl();
      mapRef.current.addControl(zoomControl, K.maps.ControlPosition.RIGHT);

      if (initialLat != null && initialLng != null) {
        markerRef.current = new K.maps.Marker({
          position: center,
          map: mapRef.current
        });
        setSelectedPlace({
          name: initialName,
          address: initialAddr,
          lat: initialLat,
          lng: initialLng
        });
      }

      const handleMapClick = (mouseEvent) => {
        const latlng = mouseEvent.latLng;

        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        markerRef.current = new K.maps.Marker({
          position: latlng,
          map: mapRef.current
        });

        geocoderRef.current.coord2Address(latlng.getLng(), latlng.getLat(), (result, status) => {
          if (status === K.maps.services.Status.OK && result?.[0]) {
            const first = result[0];
            const roadAddr = first.road_address;
            const jibunAddr = first.address;

            const addrText = (roadAddr ? roadAddr.address_name : jibunAddr?.address_name) || '';
            setSelectedPlace({
              name: '',
              address: addrText || `위도: ${latlng.getLat().toFixed(6)}, 경도: ${latlng.getLng().toFixed(6)}`,
              lat: latlng.getLat(),
              lng: latlng.getLng()
            });
          } else {
            setSelectedPlace({
              name: '',
              address: `위도: ${latlng.getLat().toFixed(6)}, 경도: ${latlng.getLng().toFixed(6)}`,
              lat: latlng.getLat(),
              lng: latlng.getLng()
            });
          }
        });
      };
      mapClickHandlerRef.current = handleMapClick;
      K.maps.event.addListener(mapRef.current, 'click', handleMapClick);

      if (!cancelled) {
        setMapLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (mapRef.current) {
        if (mapClickHandlerRef.current && typeof K.maps.event?.removeListener === 'function') {
          K.maps.event.removeListener(mapRef.current, 'click', mapClickHandlerRef.current);
        }
        mapClickHandlerRef.current = null;
        mapRef.current = null;
      }
      geocoderRef.current = null;
      setMapLoaded(false);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [isLoaded, kakao, initialLat, initialLng, initialName, initialAddr]);

  // 장소 검색
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    if (!mapLoaded) {
      alert('지도가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      const results = await searchPlaces(searchKeyword);
      setSearchResults(results);

      if (results.length === 0) {
        // 주소 검색 시도
        if (geocoderRef.current) {
          geocoderRef.current.addressSearch(searchKeyword, (result, status) => {
            if (status === kakao.maps.services.Status.OK) {
              const addressResults = result.map(item => ({
                name: '',
                address: item.road_address ? item.road_address.address_name : item.address_name,
                lat: parseFloat(item.y),
                lng: parseFloat(item.x),
                roadAddress: item.road_address?.address_name,
                phone: '',
                category: ''
              }));
              setSearchResults(addressResults);
            } else {
              alert('검색 결과가 없습니다.');
              setSearchResults([]);
            }
          });
        } else {
          alert('검색 결과가 없습니다.');
        }
      }
    } catch (error) {
      console.error('검색 오류:', error);
      alert('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 검색 결과 선택
  const handleSelectResult = (result) => {
    if (!mapRef.current || !kakao || typeof kakao.maps?.LatLng !== 'function') return;

    const latlng = new kakao.maps.LatLng(result.lat, result.lng);

    mapRef.current.setCenter(latlng);
    mapRef.current.setLevel(3);

    // 기존 마커 제거
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // 새 마커 추가
    markerRef.current = new kakao.maps.Marker({
      position: latlng,
      map: mapRef.current
    });

    setSelectedPlace({
      name: result.name || '',
      address: result.address,
      lat: result.lat,
      lng: result.lng
    });

    setSearchResults([]);
  };

  // 장소 확정 — 건물명이 있으면 건물명 우선, 그 뒤에 도로명 주소 표기
  const handleConfirm = () => {
    if (!selectedPlace) {
      alert('지도에서 장소를 선택해주세요.');
      return;
    }
    const displayAddress = selectedPlace.name
      ? `${selectedPlace.name}, ${(selectedPlace.address || '').trim()}`.trim()
      : (selectedPlace.address || '');
    onSelectLocation({ ...selectedPlace, displayAddress });
    onClose();
  };

  if (isError) {
    return (
      <ModalPortal>
      <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50">
        <div className="max-w-md rounded-[18px] bg-white p-8">
          <div className="text-center">
            <Icons.AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="mb-2 text-[20px] font-bold text-ink">카카오맵 로드 오류</h3>
            <p className="mb-5 text-[15px] text-sub">{error?.message || '카카오맵을 로드할 수 없습니다.'}</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0c0c0e] px-6 text-[15px] font-bold text-white hover:bg-black"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.target === e.currentTarget && onClose()}>
<div className="bg-white rounded-[18px] max-w-4xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
          <h3 className="mb-5 text-[20px] font-bold text-ink">장소 선택 (카카오 맵)</h3>

        {/* 검색 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="주소 또는 장소명 검색"
            aria-label="주소 또는 장소명 검색"
            className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!mapLoaded}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-[#0c0c0e] px-5 text-[15px] font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            검색
          </button>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto border-t border-ink">
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectResult(result)}
                className="flex min-h-[52px] cursor-pointer flex-col justify-center border-b border-line px-3 py-2.5 hover:bg-card"
              >
                {result.name && <p className="truncate text-[15px] font-semibold text-ink" title={result.name}>{result.name}</p>}
                <p className="truncate text-[14px] text-sub" title={result.address}>{result.address}</p>
              </div>
            ))}
          </div>
        )}

        {/* 지도 */}
        {!isLoaded ? (
          <div className="flex flex-1 min-h-[400px] items-center justify-center border border-line bg-card">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
              <p className="text-[15px] text-sub">지도 로딩 중...</p>
            </div>
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className="flex-1 min-h-[400px] overflow-hidden border border-line"
          />
        )}

        {/* 선택된 장소 정보 */}
        {selectedPlace && (
          <div className="mt-4 rounded-xl bg-sky p-4">
            <p className="mb-1 text-[14px] font-semibold text-royal">선택된 장소</p>
            {selectedPlace.name && <p className="text-[15px] font-semibold text-ink">{selectedPlace.name}</p>}
            <p className="text-[15px] text-ink">{selectedPlace.address}</p>
            <p className="mt-1 text-[13px] text-sub">
              좌표: {selectedPlace.lat?.toFixed(6)}, {selectedPlace.lng?.toFixed(6)}
            </p>
          </div>
        )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPlace}
            className={`mt-6 h-12 w-full rounded-lg text-[16px] font-bold transition-colors ${selectedPlace
              ? 'bg-[#0c0c0e] text-white hover:bg-black'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            선택 완료
          </button>
        </div>
        <div className="shrink-0 border-t border-line p-4 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-lg border border-line2 bg-white px-6 text-[15px] font-semibold text-ink hover:border-ink">
            닫기
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
