# Firebase Hosting 배포 가이드

## 사전 준비

### 1. Firebase CLI 설치
```bash
npm install -g firebase-tools
```

### 2. Firebase 로그인
```bash
firebase login
```

### 3. 프로젝트 확인
```bash
firebase projects:list
```

## Functions 설정

### 1. Functions 의존성 설치
```bash
cd functions
npm install
cd ..
```

## 로컬 개발 (에뮬레이터)

### Functions 에뮬레이터 실행
```bash
npm run emulators:functions
```

또는 전체 에뮬레이터:
```bash
npm run emulators
```

에뮬레이터 실행 후:
- Functions: http://localhost:5001
- API 엔드포인트: http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid/api/bid

## 배포

### 전체 배포 (Hosting + Functions)
```bash
npm run deploy:all
```

또는:
```bash
firebase deploy
```

### Hosting만 배포
```bash
npm run deploy:hosting
```

### Functions만 배포
```bash
npm run deploy:functions
```

## 배포 후 URL

### Hosting URL
- 기본: https://bcsa-b190f.web.app
- 커스텀 도메인: 설정한 도메인

### Functions URL
- API 엔드포인트: https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/api/bid

## 환경 변수 설정 (필요시)

```bash
firebase functions:config:set g2b.api_key="YOUR_API_KEY"
```

## 로그 확인

```bash
firebase functions:log
```

## 문제 해결

### Functions 배포 오류
1. `functions/package.json` 확인
2. Node.js 버전 확인 (18 필요)
3. 의존성 재설치: `cd functions && npm install`

### Hosting 배포 오류
1. `firebase.json` 설정 확인
2. 파일 크기 제한 확인 (50MB)
3. 무시 파일 목록 확인

## 비용 참고

- Firebase Hosting: 무료 (Spark 플랜)
- Firebase Functions: 무료 (월 200만 호출, 400,000GB-초)
- 대부분의 경우 무료 플랜으로 충분합니다.

