/**
 * 카카오맵 SDK는 스크립트 onload 직후 `window.kakao.maps`만 있고
 * `LatLng`, `Map` 등 생성자가 아직 붙지 않은 순간이 있어
 * `new kakao.maps.LatLng(...)` 시 "LatLng is not a constructor" 가 발생할 수 있음.
 *
 * `libraries=services`(Geocoder, Places)는 코어보다 늦게 붙는 경우가 많아
 * 코어 대기와 서비스 대기를 분리한다.
 *
 * 동적 스크립트 삽입 시 SDK가 document.write를 쓰면
 * "Failed to execute write on Document" 경고·로드 실패가 날 수 있어
 * `autoload=false` + `kakao.maps.load(callback)` 패턴을 사용한다.
 */

/** 앱 전체에서 동일한 URL 사용 (중복 스크립트·옵션 불일치 방지) */
export const KAKAO_MAP_SDK_URL =
  'https://dapi.kakao.com/v2/maps/sdk.js?appkey=f35b8c9735d77cced1235c5775c7c3b1&libraries=services&autoload=false';

function getKakaoMaps() {
  return typeof window !== 'undefined' ? window.kakao?.maps : null;
}

/**
 * autoload=false 일 때 필수. 콜백 시점에 맵·services API가 준비된다.
 * 구버전(autoload 생략=true) 스크립트에는 load가 없을 수 있어 그때는 즉시 resolve.
 * @param {number} timeoutMs
 */
export function invokeKakaoMapsLoad(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    try {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error('kakao.maps 없음'));
        return;
      }
      if (typeof maps.load === 'function') {
        const t = setTimeout(() => {
          reject(new Error('kakao.maps.load() 응답 시간이 초과되었습니다.'));
        }, timeoutMs);
        maps.load(() => {
          clearTimeout(t);
          resolve(window.kakao);
        });
      } else {
        resolve(window.kakao);
      }
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 지도 표시에 필요한 코어 API (LatLng, Map) 준비까지 대기
 * @param {number} timeoutMs
 * @returns {Promise<typeof window.kakao>}
 */
export function waitForKakaoMapsCoreReady(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const K = typeof window !== 'undefined' ? window.kakao : null;
      const maps = K?.maps;
      if (maps && typeof maps.LatLng === 'function' && typeof maps.Map === 'function') {
        resolve(K);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('카카오맵 코어 API 준비 시간이 초과되었습니다.'));
        return;
      }
      setTimeout(tick, 30);
    };
    tick();
  });
}

/**
 * 주소/장소 검색 등 services 라이브러리 준비까지 대기
 * @param {number} timeoutMs
 * @returns {Promise<typeof window.kakao>}
 */
export function waitForKakaoMapsServicesReady(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const maps = getKakaoMaps();
      const svc = maps?.services;
      if (
        maps &&
        svc &&
        typeof svc.Geocoder === 'function' &&
        typeof svc.Places === 'function' &&
        svc.Status &&
        typeof svc.Status.OK !== 'undefined'
      ) {
        resolve(window.kakao);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('카카오맵 services(Geocoder/Places) 준비 시간이 초과되었습니다.'));
        return;
      }
      setTimeout(tick, 30);
    };
    tick();
  });
}
