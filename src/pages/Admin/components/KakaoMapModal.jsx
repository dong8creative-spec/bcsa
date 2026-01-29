import React, { useState, useEffect, useRef } from 'react';
import { useKakaoMap } from '../../../hooks/useKakaoMap';
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

  useEffect(() => {
    if (!isLoaded || !kakao || !mapContainerRef.current) return;

    // 지도 초기화
    const center = initialLocation
      ? new kakao.maps.LatLng(initialLocation.lat, initialLocation.lng)
      : new kakao.maps.LatLng(35.1796, 129.0756); // 부산 중심

    const mapOption = {
      center: center,
      level: 3
    };

    mapRef.current = new kakao.maps.Map(mapContainerRef.current, mapOption);
    geocoderRef.current = new kakao.maps.services.Geocoder();

    // 지도 컨트롤 추가
    const zoomControl = new kakao.maps.ZoomControl();
    mapRef.current.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

    // 초기 위치에 마커 표시
    if (initialLocation) {
      markerRef.current = new kakao.maps.Marker({
        position: center,
        map: mapRef.current
      });
      setSelectedPlace({
        name: initialLocation.name || '',
        address: initialLocation.address || '',
        lat: initialLocation.lat,
        lng: initialLocation.lng
      });
    }

    // 지도 클릭 이벤트
    kakao.maps.event.addListener(mapRef.current, 'click', (mouseEvent) => {
      const latlng = mouseEvent.latLng;

      // 기존 마커 제거
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // 새 마커 추가
      markerRef.current = new kakao.maps.Marker({
        position: latlng,
        map: mapRef.current
      });

      // 역지오코딩으로 주소 가져오기
      geocoderRef.current.coord2Address(latlng.getLng(), latlng.getLat(), (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          const roadAddr = result[0].road_address;
          const jibunAddr = result[0].address;

          setSelectedPlace({
            name: '',
            address: roadAddr ? roadAddr.address_name : jibunAddr.address_name,
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
    });

    setMapLoaded(true);
  }, [isLoaded, kakao, initialLocation]);

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
    if (!mapRef.current || !kakao) return;

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

  // 장소 확정
  const handleConfirm = () => {
    if (!selectedPlace) {
      alert('지도에서 장소를 선택해주세요.');
      return;
    }
    onSelectLocation(selectedPlace);
    onClose();
  };

  if (isError) {
    return (
      <ModalPortal>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
        <div className="bg-white rounded-3xl p-8 max-w-md">
          <div className="text-center">
            <Icons.AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-dark mb-2">카카오맵 로드 오류</h3>
            <p className="text-gray-600 mb-4">{error?.message || '카카오맵을 로드할 수 없습니다.'}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
<div className="bg-white rounded-3xl max-w-4xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
          <h3 className="text-2xl font-bold text-dark mb-6">장소 선택 (카카오 맵)</h3>

        {/* 검색 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="주소 또는 장소명 검색"
            className="flex-1 p-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={!mapLoaded}
            className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            검색
          </button>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto border border-blue-200 rounded-xl">
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectResult(result)}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-blue-100 last:border-b-0"
              >
                {result.name && <p className="font-bold text-sm text-dark">{result.name}</p>}
                <p className="text-sm text-gray-600">{result.address}</p>
              </div>
            ))}
          </div>
        )}

        {/* 지도 */}
        {!isLoaded ? (
          <div className="flex-1 min-h-[400px] rounded-xl border-2 border-blue-200 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
              <p className="text-gray-600">지도 로딩 중...</p>
            </div>
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className="flex-1 min-h-[400px] rounded-xl border-2 border-blue-200 overflow-hidden"
          />
        )}

        {/* 선택된 장소 정보 */}
        {selectedPlace && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
            <p className="text-sm font-bold text-yellow-700 mb-1">선택된 장소</p>
            {selectedPlace.name && <p className="font-bold text-sm text-dark">{selectedPlace.name}</p>}
            <p className="text-sm text-gray-700">{selectedPlace.address}</p>
            <p className="text-xs text-gray-500 mt-1">
              좌표: {selectedPlace.lat?.toFixed(6)}, {selectedPlace.lng?.toFixed(6)}
            </p>
          </div>
        )}

          <button
            onClick={handleConfirm}
            disabled={!selectedPlace}
            className={`w-full py-4 rounded-xl font-bold transition-colors mt-6 ${selectedPlace
              ? 'bg-brand text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            선택 완료
          </button>
        </div>
        <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
          <button type="button" onClick={onClose} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
            닫기
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
