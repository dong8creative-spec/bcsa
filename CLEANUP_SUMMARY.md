# 파일 정리 완료 요약

## 정리 일시
2025년 12월 29일

## 정리 내용

운영에 불필요한 파일들을 `del/` 폴더로 이동했습니다.

### 이동된 파일 (총 18개)

#### 가이드 문서 (14개)
- `DEPLOYMENT_GUIDE.md`
- `FIREBASE_DEPLOY.md`
- `FIREBASE_ENV_SETUP.md`
- `FIREBASE_FUNCTIONS_SETUP.md`
- `FIRESTORE_INDEXES_GUIDE.md`
- `GITHUB_PAGES_DEPLOY.md`
- `HOSTING_INFO_REQUIRED.md`
- `HOSTING_PROXY_SETUP.md`
- `PHP_PROXY_IMPLEMENTATION_SUMMARY.md`
- `QUICK_FIREBASE_SETUP.md`
- `QUICK_START.md`
- `README_업로드가이드.md`
- `REMOVE_TEST_ACCOUNTS.md`
- `TESTING_GUIDE.md`

#### 예제 파일 (2개)
- `assets/js/config.example.js` → `del/config.example.js`
- `assets/js/firebase-config.example.js` → `del/firebase-config.example.js`

#### 개발 서버 파일 (2개)
- `server.js` → `del/server.js`
- `http-server.js` → `del/http-server.js`

### 수정된 파일

- `firebase.json`: `del/**` 폴더를 ignore 목록에 추가

---

## 운영에 필요한 파일 (유지)

### 핵심 파일
- `index.html` - 메인 페이지
- `admin.html` - 관리자 페이지
- `api-proxy.php` - PHP 프록시 (호스팅케이알용)

### 설정 파일
- `firebase.json` - Firebase 설정
- `package.json` - 프로젝트 설정
- `vite.config.js` - Vite 빌드 설정
- `tailwind.config.js` - Tailwind CSS 설정
- `postcss.config.js` - PostCSS 설정
- `.firebaserc` - Firebase 프로젝트 연결

### 소스 코드
- `src/` - React 소스 코드
- `assets/` - 정적 자산 (CSS, JS, 이미지)
- `public/` - 공개 자산
- `functions/` - Firebase Functions

### 기타
- `CNAME` - 커스텀 도메인 설정

---

## 주의사항

### package.json 스크립트

`package.json`에 다음 스크립트가 있습니다:
- `"server": "node server.js"` - server.js가 del 폴더로 이동됨
- `"http": "node http-server.js"` - http-server.js가 del 폴더로 이동됨

**로컬 개발 시 필요하면:**
1. `del/server.js`와 `del/http-server.js`를 루트로 다시 복사
2. 또는 스크립트를 수정하여 `del/server.js` 경로 사용

**또는 스크립트 수정:**
```json
"server": "node del/server.js",
"http": "node del/http-server.js"
```

---

## del 폴더 내용

- 총 19개 파일 (README.md 포함)
- 자세한 목록: `del/FILES_MOVED.md` 참조

---

## 다음 단계

1. ✅ 파일 정리 완료
2. 필요시 `del/` 폴더에서 파일 참조
3. 완전히 삭제하려면 `del/` 폴더 전체 삭제 가능 (운영에는 영향 없음)

---

## 참고

- `del/` 폴더는 `.gitignore`에 포함되지 않음 (필요시 추가 가능)
- Firebase Hosting 배포 시 `del/**` 폴더는 자동으로 제외됨 (`firebase.json` 설정)










