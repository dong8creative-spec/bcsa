# Firebase Functions 빠른 설정 가이드

## 📋 개요

이 가이드는 Firebase Functions를 처음부터 설정하고 배포하는 전체 과정을 단계별로 안내합니다.

## ✅ 완료된 작업

- ✅ `.firebaserc` 파일 생성 (프로젝트 연결 설정)
- ✅ `firebase.json` 확인 (Functions 설정 확인됨)
- ✅ 상세 가이드 문서 작성

## 🚀 다음 단계 (사용자가 직접 실행)

### 1. Firebase CLI 설치 및 로그인

터미널에서 실행:

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 또는 macOS의 경우
brew install firebase-cli

# 설치 확인
firebase --version

# Firebase 로그인
firebase login

# 프로젝트 연결
cd /Users/donghnc/Documents/bcsa
firebase use bcsa-b190f
```

### 2. Functions 의존성 설치

```bash
cd functions
npm install
cd ..
```

### 3. 환경 변수 설정

**Firebase Console에서 설정:**
1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 `bcsa-b190f` 선택
3. Functions > 환경 변수 탭
4. 다음 변수 추가:
   - `G2B_API_KEY`: `05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b`
   - `ALLOWED_ORIGINS`: `https://bcsa.co.kr,https://www.bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com`

**상세 가이드:** `FIREBASE_ENV_SETUP.md` 참조

### 4. Functions 배포

```bash
firebase deploy --only functions
```

배포 완료 시 다음 URL이 표시됩니다:
```
https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid
```

### 5. Firestore 인덱스 생성

**Firebase Console에서 생성:**
1. Firestore Database > 인덱스 탭
2. 다음 3개의 인덱스 생성:
   - `bookmarks`: userId, bidNtceNo, bidNtceOrd (오름차순)
   - `bookmarks`: userId (오름차순), bookmarkedAt (내림차순)
   - `searchLogs`: searchedAt (내림차순)

**상세 가이드:** `FIRESTORE_INDEXES_GUIDE.md` 참조

### 6. 배포 확인

```bash
# Health check
curl https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/health

# API 테스트
curl "https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/api/bid-search?keyword=소프트웨어&pageNo=1&numOfRows=10"
```

## 📚 상세 가이드 문서

- **전체 설정 가이드**: `FIREBASE_FUNCTIONS_SETUP.md`
- **환경 변수 설정**: `FIREBASE_ENV_SETUP.md`
- **Firestore 인덱스**: `FIRESTORE_INDEXES_GUIDE.md`

## ⚠️ 주의사항

1. **환경 변수 설정 후 반드시 Functions 재배포 필요**
2. **인덱스 생성 완료까지 1-2분 소요**
3. **CORS 오류 발생 시 ALLOWED_ORIGINS 확인**

## 🔍 문제 해결

### npm 권한 오류
```bash
npm cache clean --force
# 또는
sudo npm install -g firebase-tools
```

### Firebase CLI 설치 실패
```bash
# npx 사용 (전역 설치 없이)
npx firebase-tools login
npx firebase-tools deploy --only functions
```

### CORS 오류
1. Firebase Console > Functions > 환경 변수에서 `ALLOWED_ORIGINS` 확인
2. Functions 재배포: `firebase deploy --only functions`

## ✅ 체크리스트

배포 완료 확인:
- [ ] Firebase CLI 설치 및 로그인 완료
- [ ] Functions 의존성 설치 완료
- [ ] 환경 변수 설정 완료 (G2B_API_KEY, ALLOWED_ORIGINS)
- [ ] Functions 배포 완료
- [ ] Firestore 인덱스 생성 완료 (3개)
- [ ] Health check 테스트 통과
- [ ] API 테스트 통과
- [ ] 브라우저에서 실제 검색 테스트 통과

## 📞 다음 단계

모든 단계를 완료한 후:
1. 웹사이트(`https://bcsa.co.kr`)에서 입찰공고 검색 기능 테스트
2. Functions 로그 모니터링: `firebase functions:log --only apiBid`
3. 문제 발생 시 각 가이드 문서의 "문제 해결" 섹션 참조


