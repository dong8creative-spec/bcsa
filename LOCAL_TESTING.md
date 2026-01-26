# 로컬 테스트 가이드

## Firebase Functions 로컬 테스트

### 1. Firebase Emulator 시작

```bash
cd /Users/donghnc/Documents/bcsa
firebase emulators:start --only functions
```

Emulator가 시작되면 다음 URL에서 접근 가능합니다:
- **Functions Emulator**: `http://localhost:5001`
- **Emulator UI**: `http://localhost:4000` (firebase.json에 UI 설정이 있는 경우)

### 2. 로컬 API 엔드포인트

Firebase Functions v2는 Emulator에서 다음 형식으로 접근합니다:

```
http://localhost:5001/{PROJECT_ID}/{REGION}/{FUNCTION_NAME}/{PATH}
```

예시:
- Health Check: `http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/health`
- API 검색: `http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid-search?keyword=소프트웨어&pageNo=1&numOfRows=5`

### 3. 로컬 테스트 명령어

#### Health Check
```bash
curl http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/health
```

#### 한글 키워드 검색
```bash
curl -G "http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid-search" \
  --data-urlencode "keyword=소프트웨어" \
  --data-urlencode "pageNo=1" \
  --data-urlencode "numOfRows=5"
```

#### 영어 키워드 검색
```bash
curl "http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid-search?keyword=software&pageNo=1&numOfRows=5"
```

### 4. Frontend에서 로컬 Emulator 사용

Frontend는 자동으로 로컬 환경을 감지합니다:
- `localhost:5001` 포트에서 실행 중이면 Emulator URL 사용
- 그 외 localhost는 `http://localhost:3001` (로컬 Express 서버) 사용

### 5. Firestore Emulator (선택사항)

Firestore도 함께 테스트하려면:

```bash
firebase emulators:start
```

이렇게 하면 Functions와 Firestore가 모두 시작됩니다.

### 6. 로컬 테스트 체크리스트

- [ ] Firebase Emulator 시작 성공
- [ ] Health Check 응답 확인
- [ ] 한글 키워드 검색 정상 작동
- [ ] 영어 키워드 검색 정상 작동
- [ ] Firestore 캐싱 기능 작동 (데이터가 있을 경우)
- [ ] Frontend에서 로컬 API 호출 성공

### 7. 문제 해결

#### Emulator가 시작되지 않는 경우
```bash
# Java 설치 확인 (필수)
java -version

# Firebase CLI 업데이트
npm install -g firebase-tools@latest

# Emulator 재설정
firebase init emulators
```

#### 포트 충돌
`firebase.json`에서 포트를 변경할 수 있습니다:
```json
"emulators": {
  "functions": {
    "port": 5002  // 다른 포트 사용
  }
}
```

#### CORS 오류
로컬 개발 시 CORS 설정이 `functions/index.js`에 이미 포함되어 있습니다:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:5173`

### 8. 로컬 개발 워크플로우

1. **터미널 1**: Firebase Emulator 시작
   ```bash
   firebase emulators:start --only functions
   ```

2. **터미널 2**: Frontend 개발 서버 시작
   ```bash
   npm run dev
   ```

3. **브라우저**: `http://localhost:3000` 또는 `http://localhost:5173` 접속

4. Frontend에서 조달청 검색 기능 테스트

### 9. 주의사항

- 로컬 Emulator는 실제 Firestore와 연결되지 않습니다
- 로컬에서 캐싱 기능을 테스트하려면 Firestore Emulator도 함께 실행해야 합니다
- 실제 조달청 API는 여전히 외부 네트워크를 통해 호출됩니다
