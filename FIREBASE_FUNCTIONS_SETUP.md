# Firebase Functions 설정 가이드 - 실행 명령어

## 현재 상태
- ✅ Node.js v24.12.0 설치됨
- ✅ `.firebaserc` 파일 생성됨
- ✅ `firebase.json` 설정 확인됨
- ⚠️ Firebase CLI 설치 필요
- ⚠️ Functions 의존성 설치 필요

## 단계별 실행 명령어

### 1단계: Firebase CLI 설치

터미널에서 다음 명령어를 실행하세요:

```bash
# 방법 1: npm으로 전역 설치 (권장)
npm install -g firebase-tools

# 또는 방법 2: macOS의 경우 Homebrew 사용
brew install firebase-cli
```

설치 확인:
```bash
firebase --version
```

### 2단계: Firebase 로그인

```bash
firebase login
```

- 브라우저가 자동으로 열립니다
- Google 계정으로 로그인 (Firebase 프로젝트 소유자 계정)
- 터미널에 "Success! Logged in as [이메일]" 메시지 확인

프로젝트 목록 확인:
```bash
firebase projects:list
```

### 3단계: Firebase 프로젝트 연결

프로젝트 디렉토리로 이동:
```bash
cd /Users/donghnc/Documents/bcsa
```

프로젝트 연결:
```bash
firebase use bcsa-b190f
```

### 4단계: Functions 의존성 설치

```bash
cd functions
npm install
cd ..
```

설치 확인:
```bash
ls functions/node_modules
```

### 5단계: 환경 변수 설정 (Firebase Console)

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택: `bcsa-b190f`
3. 왼쪽 메뉴에서 **Functions** 클릭
4. 상단 **환경 변수** 탭 클릭
5. **환경 변수 추가** 버튼 클릭

**추가할 환경 변수:**

**변수 1: G2B_API_KEY**
- 이름: `G2B_API_KEY`
- 값: `05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b`
- 설명: 조달청 API 서비스 키

**변수 2: ALLOWED_ORIGINS**
- 이름: `ALLOWED_ORIGINS`
- 값: `https://bcsa.co.kr,https://www.bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com`
- 설명: CORS 허용 도메인 목록

### 6단계: Functions 배포

```bash
# 프로젝트 루트에서 실행
cd /Users/donghnc/Documents/bcsa
firebase deploy --only functions
```

배포 완료 시 다음 메시지가 표시됩니다:
```
✔  functions[apiBid(asia-northeast3)] Successful create operation.
Function URL (apiBid): https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid
```

### 7단계: Firestore 인덱스 생성

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택: `bcsa-b190f`
3. 왼쪽 메뉴에서 **Firestore Database** 클릭
4. 상단 **인덱스** 탭 클릭
5. **인덱스 만들기** 버튼 클릭

**인덱스 1: 북마크 조회**
- 컬렉션 ID: `bookmarks`
- 필드: `userId` (오름차순), `bidNtceNo` (오름차순), `bidNtceOrd` (오름차순)
- 쿼리 범위: 컬렉션

**인덱스 2: 사용자 북마크 목록**
- 컬렉션 ID: `bookmarks`
- 필드: `userId` (오름차순), `bookmarkedAt` (내림차순)
- 쿼리 범위: 컬렉션

**인덱스 3: 검색 로그**
- 컬렉션 ID: `searchLogs`
- 필드: `searchedAt` (내림차순)
- 쿼리 범위: 컬렉션

### 8단계: 배포 확인 및 테스트

**Health Check 테스트:**
```bash
curl https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/health
```

**API 테스트:**
```bash
curl "https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/api/bid-search?keyword=소프트웨어&pageNo=1&numOfRows=10"
```

**Functions 로그 확인:**
```bash
firebase functions:log --only apiBid
```

## 문제 해결

### npm 권한 오류가 발생하는 경우

```bash
# npm 캐시 정리
npm cache clean --force

# 또는 sudo 사용 (권장하지 않음)
sudo npm install -g firebase-tools
```

### Firebase CLI 설치가 안 되는 경우

```bash
# npx를 사용하여 직접 실행 (전역 설치 없이)
npx firebase-tools login
npx firebase-tools deploy --only functions
```

## 체크리스트

- [ ] Firebase CLI 설치 완료
- [ ] Firebase 로그인 완료
- [ ] 프로젝트 연결 완료
- [ ] Functions 의존성 설치 완료
- [ ] 환경 변수 설정 완료
- [ ] Functions 배포 완료
- [ ] Firestore 인덱스 생성 완료
- [ ] Health check 테스트 통과
- [ ] API 테스트 통과


