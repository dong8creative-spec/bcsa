/**
 * 다음(카카오) 우편번호 검색 공용 헬퍼
 * @param {function} onComplete - 콜백(data: { roadAddress, jibunAddress, zipCode, buildingName })
 */
export function openDaumPostcode(onComplete) {
    if (typeof window === 'undefined') return;
    if (window.location?.protocol === 'file:') {
        alert('⚠️ 주소 검색 기능은 HTTP 서버에서만 작동합니다.\n\n로컬 서버를 실행하려면:\nnpm run http\n\n그 후 브라우저에서 http://localhost:3000/index.html 을 열어주세요.');
        return;
    }
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
}
