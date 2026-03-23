/**
 * 카카오맵 SDK는 스크립트 onload 직후 `window.kakao.maps`만 있고
 * `LatLng`, `Map` 등 생성자가 아직 붙지 않은 순간이 있어
 * `new kakao.maps.LatLng(...)` 시 "LatLng is not a constructor" 가 발생할 수 있음.
 * 생성자가 실제로 사용 가능할 때까지 대기한다.
 *
 * @param {number} timeoutMs
 * @returns {Promise<typeof window.kakao>}
 */
export function waitForKakaoMapsApiReady(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const K = typeof window !== 'undefined' ? window.kakao : null;
      const maps = K?.maps;
      if (
        maps &&
        typeof maps.LatLng === 'function' &&
        typeof maps.Map === 'function' &&
        maps.services &&
        typeof maps.services.Geocoder === 'function'
      ) {
        resolve(K);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('카카오맵 API 준비 시간이 초과되었습니다.'));
        return;
      }
      setTimeout(tick, 30);
    };
    tick();
  });
}
