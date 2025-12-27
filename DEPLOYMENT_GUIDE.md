# 호스팅케이알 배포 가이드

> **환경 구조**
> - **호스팅**: 호스팅케이알 (정적 파일)
> - **DB & Functions**: Firebase (Firestore + Cloud Functions)
> - **소스 관리**: GitHub

---

## 📋 배포 전 체크리스트

### ✅ 1단계: Firebase Functions 설정 및 배포

#### A. Firebase CLI 설치 및 로그인
```bash
# Firebase CLI 설치 (처음 한 번만)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 확인
firebase projects:list
# 프로젝트가 보이면 OK, 없으면 firebase use --add 실행
```

#### B. Functions 의존성 설치
```bash
cd functions
npm install
cd ..
```

#### C. 환경 변수 설정 (⚠️ 필수)

**방법 1: Firebase Console에서 설정 (권장)**

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택: `bcsa-b190f`
3. 왼쪽 메뉴에서 **Functions** 클릭
4. 상단 **설정** 탭 클릭
5. **환경 변수** 섹션에서 다음 변수 추가:

```
G2B_API_KEY = 05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b
```

**방법 2: CLI로 설정**

```bash
# 조달청 API 키 설정
firebase functions:config:set g2b.api_key="05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b"

# 설정 확인
firebase functions:config:get
```

#### D. CORS 허용 도메인 설정 (⚠️ 중요!)

Firebase Console > Functions > 설정 > 환경 변수에서:

```
ALLOWED_ORIGINS = https://호스팅케이알도메인.com,https://www.호스팅케이알도메인.com,https://bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com
```

**예시:**
```
ALLOWED_ORIGINS = https://bcsa.co.kr,https://www.bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com
```

**⚠️ 주의:** 도메인은 쉼표(,)로 구분하고, 공백 없이 입력하세요.

#### E. Functions 배포
```bash
# Functions만 배포
firebase deploy --only functions

# 배포 확인
# 출력되는 URL: https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid
```

**배포 성공 확인:**
- 터미널에 "✔  Deploy complete!" 메시지 확인
- Firebase Console > Functions에서 `apiBid` 함수 확인

---

### ✅ 2단계: Firestore 인덱스 생성 (⚠️ 필수)

#### A. 북마크 기능용 인덱스 생성

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택: `bcsa-b190f`
3. 왼쪽 메뉴에서 **Firestore Database** 클릭
4. 상단 **인덱스** 탭 클릭
5. **인덱스 만들기** 버튼 클릭

**인덱스 1: 북마크 조회 (getBookmarkByBidNo)**

```
컬렉션 ID: bookmarks
필드 추가:
  ✅ userId (오름차순)
  ✅ bidNtceNo (오름차순)  
  ✅ bidNtceOrd (오름차순)
쿼리 범위: 컬렉션
```

**인덱스 2: 사용자 북마크 목록 (getUserBookmarks)**

```
컬렉션 ID: bookmarks
필드 추가:
  ✅ userId (오름차순)
  ✅ bookmarkedAt (내림차순)
쿼리 범위: 컬렉션
```

**인덱스 생성 완료 확인:**
- 인덱스 상태가 "사용 가능"으로 변경될 때까지 대기 (보통 1-2분)
- 모든 인덱스가 "사용 가능" 상태여야 함

#### B. 검색 로그 인덱스 (이미 있을 수 있음)

다음 인덱스도 확인하세요:

```
컬렉션 ID: searchLogs
필드 추가:
  ✅ searchedAt (내림차순)
쿼리 범위: 컬렉션
```

**자동 인덱스 생성:**
- 만약 인덱스가 없고 오류가 발생하면, 브라우저 콘솔에 인덱스 생성 링크가 표시됩니다
- 해당 링크를 클릭하면 자동으로 인덱스가 생성됩니다

---

### ✅ 3단계: 코드 확인 및 수정

#### A. 민감한 파일 확인

다음 파일들이 `.gitignore`에 포함되어 있는지 확인:
- `assets/js/config.js` (PortOne 키 등)
- `assets/js/firebase-config.js` (Firebase 설정)

이 파일들은 GitHub에 업로드하면 안 됩니다!

#### B. 프록시 URL 로직 확인

`index.html`의 프록시 URL 감지 로직이 올바르게 수정되었는지 확인:
- 프로덕션 환경에서는 자동으로 Firebase Functions 사용
- 로컬 개발 환경에서는 `localhost` 감지

---

## 🚀 배포 프로세스

### A. GitHub에 푸시

```bash
# 변경사항 확인
git status

# 변경사항 추가
git add .

# 커밋 (의미있는 메시지 작성)
git commit -m "입찰공고 검색 기능 추가 및 배포 준비"

# GitHub에 푸시
git push origin main
# 또는
git push origin master
```

**⚠️ 주의사항:**
- `config.js`, `firebase-config.js`는 GitHub에 푸시되지 않도록 확인
- `.gitignore` 파일 확인

---

### B. 호스팅케이알에 파일 업로드

#### 1. 필요한 파일 목록

```
📁 업로드할 파일/폴더:
├── index.html
├── admin.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── auth-service.js
│   │   ├── components/
│   │   ├── config.js ⚠️ (FTP로 직접 업로드)
│   │   ├── data.js
│   │   ├── firebase-config.js ⚠️ (FTP로 직접 업로드)
│   │   ├── firebase-service.js
│   │   ├── sheets-api.js
│   │   └── utils.js
│   └── images/
│       ├── logo.png
│       ├── favicon.svg
│       └── ...
└── CNAME (커스텀 도메인 사용 시)
```

#### 2. 업로드 방법

**방법 1: FTP 클라이언트 사용 (FileZilla, WinSCP 등)**

1. 호스팅케이알에서 FTP 접속 정보 확인
   - 호스트: `ftp.호스팅케이알도메인.com` 또는 IP 주소
   - 포트: 21 (또는 제공된 포트)
   - 사용자명: FTP 계정명
   - 비밀번호: FTP 비밀번호

2. FTP 클라이언트로 접속

3. 파일 업로드
   - 로컬의 모든 파일을 호스팅케이알의 루트 디렉토리에 업로드
   - 기존 파일이 있다면 덮어쓰기 확인

4. 민감한 파일 업로드 (⚠️ 중요!)
   - `assets/js/config.js` - 로컬에서 FTP로 직접 업로드
   - `assets/js/firebase-config.js` - 로컬에서 FTP로 직접 업로드
   - 이 파일들은 GitHub에는 없지만 호스팅에는 있어야 함

**방법 2: cPanel 파일 관리자 사용**

1. 호스팅케이알 cPanel 접속
2. **파일 관리자** 클릭
3. `public_html` 또는 `www` 폴더로 이동
4. 파일 업로드
   - "업로드" 버튼 클릭
   - 파일 선택 후 업로드
5. 폴더 구조 확인

#### 3. 파일 권한 설정 (필요시)

- 일반 파일: 644
- 폴더: 755

---

### C. 호스팅케이알 도메인을 CORS에 추가

**⚠️ 중요: 파일 업로드 후 반드시 해야 할 작업**

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택: `bcsa-b190f`
3. **Functions** > **설정** > **환경 변수**
4. `ALLOWED_ORIGINS` 변수 수정:
   ```
   기존: https://bcsa.co.kr,https://bcsa-b190f.web.app
   수정: https://호스팅케이알도메인.com,https://www.호스팅케이알도메인.com,https://bcsa.co.kr,https://bcsa-b190f.web.app
   ```
5. Functions 재배포:
   ```bash
   firebase deploy --only functions
   ```

**⚠️ 주의:**
- 도메인 앞에 `https://` 포함
- `www` 버전도 별도로 추가 (예: `www.bcsa.co.kr`)
- 쉼표(,)로 구분하고 공백 없이 입력

---

## 🧪 배포 후 테스트

### 1. 기본 접속 테스트

1. 브라우저에서 호스팅케이알 도메인 접속
2. 사이트가 정상적으로 로드되는지 확인
3. 콘솔 오류 확인 (F12 > Console)

### 2. Firebase Functions 테스트

**Health Check:**
```bash
curl https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/health
```

예상 응답:
```json
{"status":"ok","message":"API Proxy is running"}
```

**API 엔드포인트 테스트:**
```bash
curl "https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/api/bid-search?keyword=부산&pageNo=1&numOfRows=10"
```

### 3. 입찰공고 검색 기능 테스트

1. 호스팅케이알 도메인에서 사이트 접속
2. 로그인 (필요시)
3. 상단 메뉴에서 **"입찰공고"** 클릭
4. 검색어 입력 (예: "부산")
5. **"검색하기"** 버튼 클릭
6. 검색 결과가 정상적으로 표시되는지 확인
7. 공고 클릭 시 상세 모달이 정상적으로 열리는지 확인

### 4. 북마크 기능 테스트

1. 입찰공고 검색 결과에서 북마크 아이콘 클릭
2. 북마크 추가/해제가 정상 작동하는지 확인
3. "북마크만 보기" 필터 테스트

### 5. 검색 로그 확인

1. [Firebase Console](https://console.firebase.google.com) 접속
2. **Firestore Database** > **searchLogs** 컬렉션 확인
3. 검색한 키워드와 사용자 정보가 저장되었는지 확인

---

## 🔍 문제 해결 가이드

### 문제 1: CORS 오류 발생

**증상:**
- 브라우저 콘솔에 "CORS policy: Origin not allowed" 오류
- 입찰공고 검색이 작동하지 않음

**해결 방법:**
1. 호스팅케이알 도메인이 `ALLOWED_ORIGINS`에 포함되어 있는지 확인
2. `www` 버전도 추가되어 있는지 확인
3. Functions 재배포:
   ```bash
   firebase deploy --only functions
   ```
4. 브라우저 캐시 삭제 후 재시도

---

### 문제 2: Firestore 인덱스 오류

**증상:**
- 브라우저 콘솔에 "The query requires an index" 오류
- 북마크 기능이 작동하지 않음

**해결 방법:**
1. 브라우저 콘솔의 오류 메시지에서 인덱스 생성 링크 확인
2. 링크를 클릭하여 자동으로 인덱스 생성
3. 또는 Firebase Console에서 수동으로 인덱스 생성 (2단계 참고)
4. 인덱스 생성 완료까지 1-2분 대기

---

### 문제 3: API 키 오류

**증상:**
- Firebase Functions 로그에 "API 키가 설정되지 않았습니다" 오류

**해결 방법:**
1. Firebase Console > Functions > 설정 > 환경 변수 확인
2. `G2B_API_KEY` 변수가 설정되어 있는지 확인
3. Functions 재배포:
   ```bash
   firebase deploy --only functions
   ```

---

### 문제 4: 프록시 서버 연결 오류

**증상:**
- "프록시 서버에 연결할 수 없습니다" 오류

**해결 방법:**
1. Firebase Functions가 정상 배포되었는지 확인:
   ```bash
   curl https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/health
   ```
2. Firebase Console > Functions에서 `apiBid` 함수 확인
3. Functions 로그 확인:
   ```bash
   firebase functions:log --only apiBid
   ```

---

### 문제 5: 파일이 로드되지 않음

**증상:**
- CSS, JS 파일이 404 오류
- 이미지가 표시되지 않음

**해결 방법:**
1. FTP로 파일 경로 확인
2. `assets/` 폴더 구조가 올바른지 확인
3. 파일 권한 확인 (644 권장)
4. 브라우저 개발자 도구 > Network 탭에서 실패한 파일 확인

---

## 📊 모니터링 및 유지보수

### Functions 로그 확인

```bash
# 전체 로그
firebase functions:log

# 특정 함수만
firebase functions:log --only apiBid

# 실시간 로그 스트리밍
firebase functions:log --only apiBid --follow
```

### Firestore 데이터 확인

1. [Firebase Console](https://console.firebase.google.com) 접속
2. **Firestore Database** 클릭
3. 컬렉션 확인:
   - `searchLogs`: 검색 로그
   - `bookmarks`: 북마크 데이터
   - `users`: 사용자 데이터

### 비용 모니터링

1. Firebase Console > 사용량 및 청구
2. Functions 호출 횟수 확인
3. Firestore 읽기/쓰기 횟수 확인

**예상 비용 (Spark 플랜 - 무료):**
- Functions: 월 200만 호출 무료
- Firestore: 일 5만 읽기, 2만 쓰기 무료
- 대부분의 경우 무료 플랜으로 충분합니다

---

## 🔄 업데이트 배포 프로세스

### 코드 변경 후 재배포

1. **로컬에서 테스트**
   ```bash
   npm run server
   # 브라우저에서 http://localhost:3000/index.html 테스트
   ```

2. **GitHub에 푸시**
   ```bash
   git add .
   git commit -m "변경 내용 설명"
   git push origin main
   ```

3. **호스팅케이알에 파일 업로드**
   - 변경된 파일만 FTP로 업로드
   - 또는 전체 파일 재업로드

4. **Functions 변경 시**
   ```bash
   cd functions
   npm install  # 의존성 추가된 경우
   cd ..
   firebase deploy --only functions
   ```

---

## 📞 지원 및 문의

### Firebase 관련
- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com)

### 호스팅케이알 관련
- 호스팅케이알 고객센터 문의
- FTP 접속 정보는 호스팅케이알 계정에서 확인

---

## ✅ 최종 체크리스트

배포 전:
- [ ] Firebase Functions 환경 변수 설정 (`G2B_API_KEY`)
- [ ] CORS 허용 도메인 설정 (`ALLOWED_ORIGINS`)
- [ ] Firebase Functions 배포 완료
- [ ] Firestore 인덱스 생성 완료 (북마크 2개)
- [ ] 코드 수정 완료 (프록시 URL 로직)

배포 시:
- [ ] GitHub에 푸시 (민감한 파일 제외)
- [ ] 호스팅케이알에 파일 업로드
- [ ] 민감한 파일 직접 업로드 (`config.js`, `firebase-config.js`)
- [ ] 호스팅케이알 도메인을 CORS에 추가
- [ ] Functions 재배포 (CORS 변경 후)

배포 후:
- [ ] 사이트 접속 테스트
- [ ] 입찰공고 검색 기능 테스트
- [ ] 북마크 기능 테스트
- [ ] 검색 로그 저장 확인
- [ ] Functions 로그 확인
- [ ] Firestore 데이터 확인

---

**배포 완료! 🎉**

이제 호스팅케이알에서 입찰공고 검색 기능이 정상적으로 작동합니다!

