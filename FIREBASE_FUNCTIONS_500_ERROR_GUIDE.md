# Firebase Functions 500 에러 해결 가이드

## 개요

이 가이드는 Firebase Functions에서 발생하는 500 Internal Server Error를 진단하고 해결하는 방법을 단계별로 설명합니다.

## 1단계: 에러 로그 확인

### 로컬 에뮬레이터 로그 확인

에뮬레이터를 실행한 터미널에서 직접 로그를 확인합니다:

```bash
cd functions
npm run serve
```

터미널에 다음과 같은 로그가 표시됩니다:
- `[Request] GET /api/bid-search`
- `[Query] { inqryDiv: '1', ... }`
- `[API Error]` 또는 `[Bid Search]` 관련 에러 메시지

### Firebase Functions 로그 확인 (배포 환경)

```bash
cd functions
npm run logs
```

또는 특정 함수의 최근 로그만 확인:

```bash
firebase functions:log --only apiBid
```

### 에러 로그에서 확인할 항목

1. **에러 메시지**: `[API Error]` 또는 `[Bid Search]`로 시작하는 메시지
2. **스택 트레이스**: 에러가 발생한 파일과 라인 번호
3. **컨텍스트 정보**: `error.context`에 포함된 요청 정보
4. **HTTP 상태 코드**: 500 외에 다른 코드도 있는지 확인

## 2단계: 일반적인 원인 및 해결 방법

### 원인 1: API 키 미설정

**증상:**
- 로그에 `API 키가 설정되지 않았습니다` 메시지
- `[Bid Search]` 로그 없이 바로 500 에러

**해결 방법:**

1. **로컬 에뮬레이터 환경 변수 설정**

`functions` 디렉토리에 `.env` 파일 생성 (또는 `.env.local`):

```bash
cd functions
echo "G2B_API_KEY=your-api-key-here" > .env
```

또는 `G2B_SERVICE_KEY` 사용:

```bash
echo "G2B_SERVICE_KEY=your-service-key-here" > .env
```

**주의**: `.env` 파일은 `.gitignore`에 추가되어 있어야 합니다.

2. **에뮬레이터 재시작**

```bash
# 에뮬레이터 중지 (Ctrl+C)
npm run serve
```

3. **배포 환경 환경 변수 설정**

Firebase Functions v2에서는 환경 변수를 다음과 같이 설정합니다:

```bash
firebase functions:secrets:set G2B_API_KEY
# 프롬프트에서 API 키 입력
```

또는 Firebase Console에서:
- Firebase Console > Functions > 설정 > 환경 변수
- `G2B_API_KEY` 또는 `G2B_SERVICE_KEY` 추가

### 원인 2: Firebase Admin 초기화 실패

**증상:**
- `Firebase Admin SDK` 관련 에러
- `admin.apps.length` 관련 에러

**해결 방법:**

1. **Firebase 프로젝트 확인**

```bash
firebase projects:list
firebase use <project-id>
```

2. **서비스 계정 키 확인**

로컬 에뮬레이터는 자동으로 인증되지만, 배포 환경에서는:
- Firebase Console > 프로젝트 설정 > 서비스 계정
- 새 비공개 키 생성 (필요한 경우)

3. **에뮬레이터 재시작**

```bash
cd functions
npm run serve
```

### 원인 3: Firestore 접근 권한 문제

**증상:**
- `[Cache] Failed to save bid` 또는 `[Cache] Failed to get cached bids` 에러
- `Permission denied` 메시지

**해결 방법:**

1. **Firestore 보안 규칙 확인**

Firebase Console > Firestore Database > 규칙:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tenders/{document=**} {
      allow read, write: if true; // 개발 중에는 허용, 프로덕션에서는 제한 필요
    }
    match /searchLogs/{document=**} {
      allow read, write: if true;
    }
  }
}
```

2. **에뮬레이터에서 Firestore 사용**

`firebase.json` 확인:

```json
{
  "emulators": {
    "firestore": {
      "port": 8080
    }
  }
}
```

에뮬레이터 시작 시 Firestore도 함께 시작:

```bash
firebase emulators:start
```

### 원인 4: 외부 API 호출 실패

**증상:**
- `[Bid Search] API Error` 또는 `[Bid Search] Network Error` 로그
- `HTTP 500` 또는 `ECONNABORTED` (타임아웃) 에러

**해결 방법:**

1. **API 키 유효성 확인**

조달청 API 키가 유효한지 확인:
- 공공데이터포털에서 API 키 상태 확인
- 일일 호출 제한 확인

2. **네트워크 연결 확인**

```bash
curl "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch?ServiceKey=YOUR_KEY&pageNo=1&numOfRows=10&inqryDiv=1&inqryBgnDt=202401010000&inqryEndDt=202401312359"
```

3. **타임아웃 설정 확인**

`functions/index.js`의 `callBidApi` 함수에서 타임아웃이 30초로 설정되어 있습니다. 필요시 조정:

```javascript
const apiResponse = await axios.get(apiUrl.toString(), {
  timeout: 30000, // 30초, 필요시 증가
  // ...
});
```

### 원인 5: 파라미터 파싱 에러

**증상:**
- `[Bid Search] Parse Error` 로그
- `XML/JSON 파싱 실패` 메시지

**해결 방법:**

1. **요청 파라미터 확인**

프론트엔드에서 전송하는 파라미터가 올바른지 확인:
- 한글 파라미터가 올바르게 URL 인코딩되었는지
- 필수 파라미터가 누락되지 않았는지

2. **API 응답 형식 확인**

조달청 API가 XML을 반환하는 경우 `xml2js`가 올바르게 파싱하는지 확인.

### 원인 6: 예외 처리되지 않은 에러

**증상:**
- 예상치 못한 에러 메시지
- 스택 트레이스에 `undefined` 또는 `null` 관련 에러

**해결 방법:**

1. **에러 로깅 미들웨어 확인**

`functions/index.js`의 에러 로깅 미들웨어가 올바르게 작동하는지 확인 (line 829-841).

2. **try-catch 블록 확인**

모든 비동기 작업이 try-catch로 감싸져 있는지 확인.

## 3단계: 디버깅 체크리스트

### 필수 확인 사항

- [ ] API 키가 환경 변수에 설정되어 있는가?
- [ ] 에뮬레이터가 정상적으로 실행 중인가?
- [ ] Firestore 에뮬레이터가 실행 중인가? (캐싱 기능 사용 시)
- [ ] 네트워크 연결이 정상적인가?
- [ ] 조달청 API 키가 유효한가?
- [ ] 요청 파라미터가 올바른 형식인가?

### 로그 확인 체크리스트

- [ ] `[Request]` 로그가 출력되는가?
- [ ] `[Query]` 로그에 파라미터가 올바르게 표시되는가?
- [ ] `[Bid Search]` 로그가 어디까지 진행되는가?
- [ ] `[API Error]` 로그에 어떤 메시지가 있는가?

## 4단계: 단계별 디버깅

### Step 1: Health Check 엔드포인트 테스트

```bash
curl http://127.0.0.1:5001/bcsa-b190f/asia-northeast3/apiBid/health
```

예상 응답:

```json
{"status":"ok","message":"API Proxy is running"}
```

### Step 2: Network Test 엔드포인트 테스트

```bash
curl http://127.0.0.1:5001/bcsa-b190f/asia-northeast3/apiBid/api/network-test
```

외부 네트워크 접속이 정상인지 확인.

### Step 3: 최소 파라미터로 API 테스트

```bash
curl "http://127.0.0.1:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid-search?inqryDiv=1"
```

최소한의 파라미터로 요청하여 기본 동작 확인.

### Step 4: 전체 파라미터로 API 테스트

프론트엔드에서 전송하는 것과 동일한 파라미터로 테스트:

```bash
curl "http://127.0.0.1:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid-search?inqryDiv=1&bidNtceDtlClsfCd=전체&area=전체&shoppingMallYn=전체&domesticYn=전체&contractType=전체&contractLawType=전체&contractMethod=전체&awardMethod=전체&businessTypes[]=전체&businessStatuses[]=전체"
```

## 5단계: 일반적인 해결 패턴

### 패턴 1: 환경 변수 누락

**문제:** API 키가 없어서 500 에러 발생

**해결:**

1. `.env` 파일 생성 및 API 키 추가
2. 에뮬레이터 재시작

### 패턴 2: Firestore 권한 문제

**문제:** 캐싱 기능에서 Firestore 접근 실패

**해결:**

1. Firestore 보안 규칙 확인
2. 에뮬레이터에서 Firestore 실행 확인

### 패턴 3: 외부 API 타임아웃

**문제:** 조달청 API 응답이 30초를 초과

**해결:**

1. 타임아웃 시간 증가 (30초 → 60초)
2. 재시도 로직 확인 (이미 구현됨)

### 패턴 4: 파라미터 인코딩 문제

**문제:** 한글 파라미터가 올바르게 전달되지 않음

**해결:**

1. 프론트엔드에서 URL 인코딩 확인
2. 백엔드에서 `decodeURIComponent` 확인 (이미 구현됨)

## 6단계: 에러 응답 개선 (선택사항)

현재 코드는 에러 발생 시 500 에러를 반환합니다. 더 자세한 정보를 제공하려면:

1. **에러 타입별 상태 코드 분리**

```javascript
// functions/index.js의 전역 에러 응답 미들웨어 수정
app.use((err, req, res, next) => {
  const status = err.status || err.response?.status || 500;
  
  // 에러 타입에 따라 상태 코드 결정
  let httpStatus = 500;
  if (err.errorType === 'API_KEY_MISSING') {
    httpStatus = 503; // Service Unavailable
  } else if (err.errorType === 'NETWORK_ERROR') {
    httpStatus = 502; // Bad Gateway
  } else if (err.errorType === 'PARSE_ERROR') {
    httpStatus = 502;
  }
  
  res.status(httpStatus).json({
    error: err.message || 'Internal Server Error',
    errorType: err.errorType || 'UNKNOWN',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
```

2. **에러 로깅 강화**

이미 구현된 에러 로깅 미들웨어를 활용하여 상세한 디버깅 정보 수집.

## 7단계: 모니터링 설정

### Firebase Console에서 모니터링

1. Firebase Console > Functions
2. `apiBid` 함수 선택
3. 로그 및 메트릭 확인

### 알림 설정

중요한 에러 발생 시 알림을 받으려면:
- Firebase Console > Functions > 알림 설정
- 에러율 임계값 설정

## 빠른 참조: 일반적인 에러 메시지와 해결책

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `API 키가 설정되지 않았습니다` | 환경 변수 미설정 | `.env` 파일에 `G2B_API_KEY` 추가 |
| `Permission denied` | Firestore 권한 문제 | Firestore 보안 규칙 확인 |
| `ECONNABORTED` | 타임아웃 | 타임아웃 시간 증가 또는 재시도 |
| `XML/JSON 파싱 실패` | API 응답 형식 문제 | API 응답 형식 확인 |
| `Firebase Admin SDK` 관련 에러 | Admin 초기화 실패 | Firebase 프로젝트 설정 확인 |

## 요약

500 에러 해결의 핵심은:

1. **로그 확인**: 에러가 발생한 정확한 위치 파악
2. **환경 변수 확인**: API 키 등 필수 설정 확인
3. **단계별 테스트**: Health check → Network test → API test 순서로 진행
4. **에러 타입 파악**: 네트워크, 파싱, 권한 등 원인 분류

가장 흔한 원인은 **API 키 미설정**이므로, 먼저 환경 변수를 확인하는 것이 중요합니다.

## 추가 리소스

- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [Firebase Emulator 문서](https://firebase.google.com/docs/emulator-suite)
- [공공데이터포털 API 가이드](https://www.data.go.kr/)
