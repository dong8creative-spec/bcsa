# CORS 프록시 구현 완료

## 구현 일시
2025년 12월 29일

## 구현 내용

호스팅케이알에서 PHP를 사용할 수 없어, 무료 CORS 프록시 서비스를 사용하여 조달청 API를 호출하도록 변경했습니다.

---

## 사용된 CORS 프록시 서비스

**서비스**: `https://api.allorigins.win/raw?url=`

**특징**:
- 무료
- 안정적
- CORS 문제 해결
- 원본 응답 그대로 반환

---

## 주요 변경사항

### 1. 프록시 URL 설정 변경

**변경 전**: 호스팅케이알 도메인일 때 PHP 프록시 사용
```javascript
if (hostname === 'bcsa.co.kr' || hostname === 'www.bcsa.co.kr') {
    return window.location.origin; // PHP 프록시
}
```

**변경 후**: CORS 프록시 서비스 사용
```javascript
if (hostname === 'bcsa.co.kr' || hostname === 'www.bcsa.co.kr') {
    return 'https://api.allorigins.win/raw?url='; // CORS 프록시
}
```

### 2. API 호출 방식 변경

**변경 전**: 프록시 서버에 파라미터 전달
```javascript
apiEndpoint = `${cleanProxyUrl}/api-proxy.php`;
params.append('keyword', searchKeyword);
params.append('type', endpointPath);
```

**변경 후**: 조달청 API URL을 직접 구성하고 CORS 프록시로 감싸기
```javascript
const g2bUrl = new URL(`${g2bBaseUrl}/${g2bApiPath}`);
g2bUrl.searchParams.append('ServiceKey', g2bApiKey);
g2bUrl.searchParams.append('pageNo', page.toString());
// ... 기타 파라미터
apiEndpoint = `${cleanProxyUrl}${encodeURIComponent(g2bUrl.toString())}`;
```

### 3. 응답 처리 로직 변경

**변경 전**: 프록시 서버의 표준화된 응답 형식
```javascript
if (data.success && data.data) {
    items = data.data.items;
}
```

**변경 후**: 조달청 API 원본 응답 형식 처리
```javascript
if (isCorsProxy) {
    // 조달청 API 원본 응답: { response: { header: {...}, body: {...} } }
    if (data.response && data.response.body) {
        items = data.response.body.items;
    }
} else {
    // 기존 프록시 서버 응답 형식
    if (data.success && data.data) {
        items = data.data.items;
    }
}
```

---

## 작동 방식

### API 호출 흐름

```
클라이언트 (브라우저)
    ↓
CORS 프록시 서비스 (api.allorigins.win)
    ↓
조달청 API (apis.data.go.kr)
    ↓
CORS 프록시 서비스 (응답 반환)
    ↓
클라이언트에서 결과 표시
```

### 예시 URL

**최종 요청 URL**:
```
https://api.allorigins.win/raw?url=https%3A%2F%2Fapis.data.go.kr%2F1230000%2Fad%2FBidPublicInfoService%2FgetBidPblancListInfoThngPPSSrch%3FServiceKey%3D...%26pageNo%3D1%26...
```

---

## 장점

1. ✅ 서버 구축 불필요
2. ✅ 빠른 구현
3. ✅ 무료 사용 가능
4. ✅ 즉시 사용 가능

## 단점

1. ⚠️ API 키가 클라이언트에 노출됨 (보안 취약)
2. ⚠️ CORS 프록시 서비스 의존성
3. ⚠️ 속도 지연 가능성
4. ⚠️ 무료 서비스 제한 가능

---

## 보안 주의사항

### API 키 노출

- ⚠️ API 키가 클라이언트 코드에 포함됨
- ⚠️ 브라우저 개발자 도구에서 확인 가능
- ⚠️ API 키 유출 시 악용 가능

### 대응 방안

1. **단기**: 현재 방식 유지 (공개 API 키이므로 상대적으로 안전)
2. **장기**: Firebase Functions 또는 다른 서버리스 플랫폼으로 전환 권장

---

## 테스트 방법

### 1. 로컬 테스트

로컬 개발 환경에서는 기존 Express 서버(`server.js`)를 사용합니다.

### 2. 프로덕션 테스트

1. 웹사이트 배포
2. 입찰공고 검색 기능 테스트
3. 브라우저 콘솔에서 네트워크 요청 확인
4. CORS 프록시를 통한 요청 확인

---

## 문제 해결

### CORS 프록시가 응답하지 않는 경우

1. 네트워크 연결 확인
2. CORS 프록시 서비스 상태 확인
3. 브라우저 콘솔에서 정확한 에러 확인
4. 다른 CORS 프록시 서비스로 변경 고려

### 대체 CORS 프록시 서비스

필요시 다음 서비스로 변경 가능:
- `https://cors-anywhere.herokuapp.com/` (제한적)
- `https://corsproxy.io/?` (대안)

코드에서 `allorigins.win` 부분을 변경하면 됩니다.

---

## 향후 개선 방안

1. **Firebase Functions 배포** (권장)
   - API 키 보안 유지
   - 안정성 향상
   - 자체 서버 제어

2. **다른 서버리스 플랫폼 사용**
   - Vercel
   - Netlify
   - AWS Lambda

---

## 참고

- CORS 프록시는 임시 해결책입니다
- 장기적으로는 서버 사이드 프록시 사용을 권장합니다
- API 키 보안이 중요한 경우 Firebase Functions 사용을 고려하세요

---

## 완료 체크리스트

- [x] 프록시 URL 설정 변경
- [x] API 호출 로직 수정
- [x] 응답 처리 로직 수정
- [x] 에러 메시지 업데이트
- [x] 프록시 서버 상태 확인 함수 수정
- [ ] 프로덕션 환경 테스트
- [ ] 성능 확인



