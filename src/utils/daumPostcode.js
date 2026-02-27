const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

let loadPromise = null;

/**
 * Daum 우편번호 스크립트를 동적으로 로드. 이미 로드되었거나 로딩 중이면 기존 Promise 반환.
 * @returns {Promise<void>}
 */
function loadPostcodeScript() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('window is undefined'));
    }
    if (window.daum && window.daum.Postcode) {
        return Promise.resolve();
    }
    if (loadPromise) {
        return loadPromise;
    }
    loadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src*="postcode.v2.js"]');
        if (existing) {
            if (window.daum && window.daum.Postcode) {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Postcode script load failed')));
            return;
        }
        const script = document.createElement('script');
        script.src = POSTCODE_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            if (window.daum && window.daum.Postcode) {
                resolve();
            } else {
                reject(new Error('Postcode API not available after load'));
            }
        };
        script.onerror = () => reject(new Error('Postcode script load failed'));
        document.head.appendChild(script);
    });
    return loadPromise;
}

/**
 * 다음(카카오) 우편번호 검색 공용 헬퍼
 * 스크립트가 없으면 동적 로드 후 팝업 오픈.
 * @param {function} onComplete - 콜백(data: { roadAddress, jibunAddress, zipCode, buildingName })
 */
export function openDaumPostcode(onComplete) {
    if (typeof window === 'undefined') return;
    if (window.location?.protocol === 'file:') {
        alert('⚠️ 주소 검색 기능은 HTTP 서버에서만 작동합니다.\n\n로컬 서버를 실행하려면:\nnpm run http\n\n그 후 브라우저에서 http://localhost:3000/index.html 을 열어주세요.');
        return;
    }

    loadPostcodeScript()
        .then(() => {
            if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
                alert('주소 검색 서비스가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
                return;
            }
            new window.daum.Postcode({
                oncomplete: function (data) {
                    try {
                        let fullRoadAddr = '';
                        let extraRoadAddr = '';
                        if (data.userSelectedType === 'R') {
                            fullRoadAddr = data.roadAddress;
                            if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) extraRoadAddr += data.bname;
                            if (data.buildingName !== '' && data.apartment === 'Y') extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
                            if (extraRoadAddr !== '') extraRoadAddr = ' (' + extraRoadAddr + ')';
                            fullRoadAddr += extraRoadAddr;
                        } else {
                            fullRoadAddr = data.jibunAddress || data.autoJibunAddress || data.roadAddress;
                        }
                        const zonecode = data.zonecode;
                        const jibunAddress = data.jibunAddress || data.autoJibunAddress;
                        if (onComplete && typeof onComplete === 'function') {
                            onComplete({
                                roadAddress: fullRoadAddr || data.roadAddress || '',
                                jibunAddress: jibunAddress || '',
                                zipCode: zonecode || '',
                                buildingName: data.buildingName || ''
                            });
                        }
                    } catch (err) {
                        alert('주소 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
                    }
                }
            }).open();
        })
        .catch(() => {
            alert('주소 검색 서비스가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        });
}
