import { useState, useEffect, useCallback } from 'react';

/**
 * 카카오맵 SDK 로드 및 초기화 커스텀 훅
 * @returns {Object} { kakao, isLoaded, isError, error }
 */
export const useKakaoMap = () => {
  const [kakao, setKakao] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadKakaoMapScript = () => {
      return new Promise((resolve, reject) => {
        // 이미 로드되어 있는 경우
        if (window.kakao && window.kakao.maps) {
          resolve(window.kakao);
          return;
        }

        // 스크립트가 이미 존재하는지 확인
        const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
        
        if (existingScript) {
          // 스크립트가 있으면 로드 완료 대기
          const checkInterval = setInterval(() => {
            if (window.kakao && window.kakao.maps) {
              clearInterval(checkInterval);
              resolve(window.kakao);
            }
          }, 100);

          // 5초 타임아웃
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.kakao || !window.kakao.maps) {
              reject(new Error('카카오맵 SDK 로드 타임아웃'));
            }
          }, 5000);
          return;
        }

        // 스크립트 동적 생성
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=f35b8c9735d77cced1235c5775c7c3b1&libraries=services&autoload=false`;
        script.async = true;

        script.onload = () => {
          // 카카오맵 SDK 로드 완료 후 초기화
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(() => {
              resolve(window.kakao);
            });
          } else {
            reject(new Error('카카오맵 객체를 찾을 수 없습니다'));
          }
        };

        script.onerror = () => {
          reject(new Error('카카오맵 SDK 로드 실패'));
        };

        document.head.appendChild(script);
      });
    };

    (async () => {
      try {
        const kakaoObj = await loadKakaoMapScript();
        setKakao(kakaoObj);
        setIsLoaded(true);
        setIsError(false);
      } catch (err) {
        console.error('카카오맵 로드 오류:', err);
        setError(err);
        setIsError(true);
        setIsLoaded(false);
      }
    })();
  }, []);

  /**
   * 주소를 좌표로 변환
   * @param {string} address - 주소
   * @returns {Promise<{lat: number, lng: number}>}
   */
  const geocodeAddress = useCallback(async (address) => {
    if (!kakao || !kakao.maps) {
      throw new Error('카카오맵이 로드되지 않았습니다');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve({
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x)
          });
        } else {
          reject(new Error('주소를 찾을 수 없습니다'));
        }
      });
    });
  }, [kakao]);

  /**
   * 좌표를 주소로 변환
   * @param {number} lat - 위도
   * @param {number} lng - 경도
   * @returns {Promise<string>}
   */
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!kakao || !kakao.maps) {
      throw new Error('카카오맵이 로드되지 않았습니다');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          const roadAddress = result[0].road_address;
          const jibunAddress = result[0].address;
          resolve(roadAddress ? roadAddress.address_name : jibunAddress.address_name);
        } else {
          reject(new Error('주소를 찾을 수 없습니다'));
        }
      });
    });
  }, [kakao]);

  /**
   * 키워드로 장소 검색
   * @param {string} keyword - 검색 키워드
   * @returns {Promise<Array>}
   */
  const searchPlaces = useCallback(async (keyword) => {
    if (!kakao || !kakao.maps) {
      throw new Error('카카오맵이 로드되지 않았습니다');
    }

    return new Promise((resolve, reject) => {
      const places = new kakao.maps.services.Places();
      places.keywordSearch(keyword, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(result.map(place => ({
            id: place.id,
            name: place.place_name,
            address: place.address_name,
            roadAddress: place.road_address_name,
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            phone: place.phone,
            category: place.category_name
          })));
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          resolve([]);
        } else {
          reject(new Error('장소 검색에 실패했습니다'));
        }
      });
    });
  }, [kakao]);

  return {
    kakao,
    isLoaded,
    isError,
    error,
    geocodeAddress,
    reverseGeocode,
    searchPlaces
  };
};
