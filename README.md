# 부산청년사업가들 웹사이트 (BCSA)

부산청년사업가들을 위한 종합 정보 플랫폼

---

## 🚀 로컬 테스트 시작하기

### 방법 1: 스크립트 사용 (추천)
```bash
./start-test.sh
```

### 방법 2: npm 명령어
```bash
npm run test
```
또는
```bash
npm run dev
```

### 방법 3: 빠른 가이드 확인
```bash
npm run test:quick
```

---

## 📱 접속 주소

개발 서버가 시작되면 다음 주소로 접속하세요:

```
http://127.0.0.1:5173
```

브라우저가 자동으로 열리지 않으면 위 주소를 직접 입력하세요.

---

## 📖 문서

- **[빠른 시작 가이드](빠른_시작.md)** - 5분 안에 시작하기
- **[전체 테스트 가이드](로컬_테스트_가이드.md)** - 모든 기능 상세 테스트
- **[기존 입찰공고 가이드](LOCAL_TEST.md)** - 입찰공고 기능 특화

---

## 🎯 주요 기능

### 사용자 기능
- ✅ **입찰공고 검색**: 다양한 조건으로 입찰공고 조회
- ✅ **회원 관리**: 회원가입, 로그인, 마이페이지
- ✅ **커뮤니티**: 게시글 작성, 댓글, 검색
- ✅ **맛집 정보**: 카카오맵 연동 맛집 정보
- ✅ **세미나/행사**: 일정 관리 및 참가 신청
- ✅ **공지사항**: 중요 공지 확인
- ✅ **회원 명단**: 회원 정보 조회
- ✅ **문의하기**: 문의사항 접수
- ✅ **후원하기**: 후원 및 결제

### 관리자 기능
- 🔐 **관리자 대시보드**: `/admin` 경로로 접속
- 📝 **콘텐츠 관리**: 메인 페이지 콘텐츠 수정
- 👥 **사용자 관리**: 회원 정보 및 권한 관리
- 📋 **게시글 관리**: 공지사항, 커뮤니티 관리
- 🎓 **프로그램 관리**: 세미나, 행사 등록
- 🍽️ **메뉴 관리**: 맛집 정보 등록

---

## 🛠️ 기술 스택

### Frontend
- **React 18**: UI 라이브러리
- **Vite 5**: 빌드 도구 및 개발 서버
- **React Router v6**: 라우팅
- **Tailwind CSS**: 스타일링
- **Lucide React**: 아이콘

### Backend & Services
- **Firebase Auth**: 사용자 인증
- **Firebase Firestore**: 데이터베이스
- **Firebase Storage**: 파일 저장소
- **Cloud Functions**: 서버리스 함수

### External APIs
- **입찰공고 API**: 나라장터 입찰 정보
- **Kakao Map API**: 지도 서비스
- **Daum Postcode API**: 주소 검색
- **PortOne (아임포트)**: 결제 서비스

---

## 📂 프로젝트 구조

```
bcsa/
├── src/
│   ├── components/          # 재사용 가능한 컴포넌트
│   │   ├── AppLayout.jsx
│   │   ├── RestaurantsListView.jsx
│   │   ├── TenderSearchFilter.jsx
│   │   └── ...
│   ├── pages/               # 페이지 컴포넌트
│   │   ├── Admin/           # 관리자 페이지
│   │   ├── AboutView.jsx
│   │   ├── NoticeView.jsx
│   │   └── ...
│   ├── services/            # Firebase 서비스
│   │   ├── authService.js
│   │   └── firebaseService.js
│   ├── utils/               # 유틸리티 함수
│   │   ├── api.js
│   │   ├── authUtils.js
│   │   ├── imageUtils.js
│   │   └── ...
│   ├── constants/           # 상수 정의
│   │   ├── content.js
│   │   └── index.js
│   ├── hooks/               # 커스텀 훅
│   │   ├── useAdminAuth.js
│   │   └── useKakaoMap.js
│   ├── App.jsx              # 메인 앱 컴포넌트
│   ├── main.jsx             # 엔트리 포인트
│   ├── firebase.js          # Firebase 설정
│   └── config.js            # 앱 설정
├── public/
│   └── assets/              # 정적 파일
│       ├── images/
│       ├── css/
│       └── js/
├── functions/               # Firebase Functions
├── docs/                    # 문서
├── index.html               # HTML 템플릿
├── vite.config.js           # Vite 설정
├── tailwind.config.js       # Tailwind 설정
├── firebase.json            # Firebase 설정
├── package.json             # 의존성 관리
├── start-test.sh            # 테스트 서버 실행 스크립트
├── 빠른_시작.md             # 빠른 시작 가이드
└── 로컬_테스트_가이드.md    # 전체 테스트 가이드
```

---

## ⚙️ 환경 설정

### 환경 변수

개발 환경에서는 `.env.development` 파일이 자동으로 로드됩니다:

```env
VITE_API_URL=https://apibid-oytjv32jna-du.a.run.app
```

프로덕션 환경에서는 `.env.production` 파일을 사용합니다.

### Firebase 설정

`src/firebase.js` 파일에서 Firebase 프로젝트 설정을 확인할 수 있습니다.

---

## 🧪 테스트 체크리스트

### 기본 기능
- [ ] 페이지 로딩 및 렌더링
- [ ] 네비게이션 메뉴 동작
- [ ] 반응형 디자인 (모바일/태블릿/데스크톱)
- [ ] 로고 및 이미지 표시

### 입찰공고 (핵심 기능)
- [ ] 기본 검색 (공고명, 날짜, 공고종류)
- [ ] 상세조건 펼치기/접기
- [ ] 검색 결과 표시
- [ ] 초기화 버튼
- [ ] API 연동 확인 (콘솔 로그)

### 회원 기능
- [ ] 회원가입
- [ ] 로그인/로그아웃
- [ ] 마이페이지
- [ ] 회원 정보 수정
- [ ] 비밀번호 변경

### 커뮤니티
- [ ] 게시글 목록 조회
- [ ] 게시글 작성
- [ ] 게시글 수정/삭제
- [ ] 댓글 작성
- [ ] 검색 기능

### 정보 조회
- [ ] 공지사항 목록 및 상세
- [ ] 맛집 정보 및 지도
- [ ] 세미나/행사 일정
- [ ] 회원 명단
- [ ] About 페이지

### 관리자
- [ ] 관리자 로그인
- [ ] 콘텐츠 관리
- [ ] 사용자 관리
- [ ] 게시글 관리
- [ ] 프로그램 관리

---

## 🔧 개발 명령어

```bash
# 개발 서버 시작
npm run dev
npm run start
npm run test

# 빌드
npm run build

# 프리뷰 (빌드된 파일 확인)
npm run preview

# 배포
npm run deploy              # 전체 배포
npm run deploy:hosting      # 호스팅만 배포
npm run deploy:functions    # Functions만 배포

# Firebase Emulators
npm run emulators           # 전체 에뮬레이터
npm run emulators:functions # Functions 에뮬레이터만
```

---

## 🐛 문제 해결

### 포트 충돌
```bash
# 다른 포트 사용
npx vite --port 8080
```

### 캐시 문제
브라우저에서 `Ctrl + Shift + R` (Mac: `Cmd + Shift + R`)로 강제 새로고침

### Firebase 연결 오류
1. 인터넷 연결 확인
2. Firebase Console에서 프로젝트 상태 확인
3. `src/firebase.js` 설정 확인

### 빌드 오류
```bash
# 노드 모듈 재설치
rm -rf node_modules package-lock.json
npm install
```

### API 호출 오류
1. `.env.development` 파일 확인
2. 브라우저 콘솔(F12)에서 에러 메시지 확인
3. Network 탭에서 실패한 요청 확인

---

## 📊 개발자 도구 활용

브라우저에서 `F12` (Mac: `Cmd + Option + I`)를 눌러 개발자 도구를 열고:

### Console 탭
- 에러 메시지 확인
- 디버그 로그 확인
- `DEBUG_G2B_PARAMS`, `[TenderSearchFilter]` 등의 로그 확인

### Network 탭
- API 요청/응답 확인
- 로딩 시간 확인
- 실패한 요청 디버깅

### Application 탭
- LocalStorage 확인
- SessionStorage 확인
- Cookies 확인

### Elements 탭
- HTML 구조 확인
- CSS 스타일 확인
- 반응형 디자인 테스트 (Device Toolbar)

---

## 💡 개발 팁

### Hot Module Replacement (HMR)
코드를 수정하면 브라우저가 자동으로 새로고침됩니다. 빠른 개발을 위해 활용하세요.

### 콘솔 로그
디버깅을 위해 개발자 도구 콘솔을 항상 열어두는 것을 권장합니다.

### 반응형 테스트
개발자 도구의 Device Toolbar (Cmd+Shift+M / Ctrl+Shift+M)로 다양한 화면 크기를 테스트하세요.

### Git 커밋 전
```bash
npm run build  # 빌드 테스트
npm run preview  # 프리뷰로 최종 확인
```

---

## 📝 추가 참고 자료

- [React 공식 문서](https://react.dev/)
- [Vite 공식 문서](https://vitejs.dev/)
- [Tailwind CSS 문서](https://tailwindcss.com/)
- [Firebase 문서](https://firebase.google.com/docs)
- [React Router 문서](https://reactrouter.com/)

---

## 📞 지원

- **문의**: 관리자에게 문의
- **버그 제보**: GitHub Issues 또는 관리자
- **기능 제안**: 관리자에게 문의

---

## 📜 라이선스

© 2024 부산청년사업가들. All rights reserved.

---

**Happy Coding! 🎉**
