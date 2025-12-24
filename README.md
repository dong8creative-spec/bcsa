# 부산청년사업가들 (BCSA) 웹사이트

부산 지역 청년 사업가들이 모여 아이디어를 공유하고, 네트워킹하며 함께 성장해나가는 커뮤니티 웹사이트입니다.

## 🚀 기술 스택

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication & Firestore)
- **External APIs**: 
  - PortOne (본인인증)
  - EmailJS (이메일 발송)
  - Daum Postcode (주소 검색)
  - ImgBB (이미지 업로드)
  - 나라장터 공공조달 API

## 📦 설치 및 실행

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 📁 프로젝트 구조

```
/
├── index.html              # Vite 엔트리 포인트
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx           # React 엔트리
│   ├── App.jsx            # 메인 앱 컴포넌트
│   ├── components/
│   │   ├── Icons.jsx
│   │   ├── MobileMenu.jsx
│   │   ├── modals/        # 모달 컴포넌트
│   │   │   ├── CalendarSelectModal.jsx
│   │   │   ├── SignUpModal.jsx
│   │   │   ├── InquiryModal.jsx
│   │   │   ├── LoginModal.jsx
│   │   │   └── FindAccountModal.jsx
│   │   └── views/         # 페이지 뷰 컴포넌트
│   │       ├── MyPageView.jsx
│   │       ├── BidSearchView.jsx
│   │       ├── NoticeView.jsx
│   │       ├── AllMembersView.jsx
│   │       ├── CommunityView.jsx
│   │       ├── AllSeminarsView.jsx
│   │       ├── AboutView.jsx
│   │       └── DonationView.jsx
│   ├── utils/
│   │   └── index.js       # 유틸리티 함수
│   ├── config/
│   │   └── index.js       # 설정 파일
│   ├── data/
│   │   └── index.js       # 기본 데이터
│   └── styles/
│       └── index.css      # Tailwind + 커스텀 CSS
├── public/
│   └── assets/            # 정적 파일 (이미지 등)
└── dist/                  # 빌드 결과물

```

## ⚙️ 설정 가이드

### 1. Firebase 설정
[`index.html`](index.html)의 `firebaseConfig` 객체에 Firebase 프로젝트 설정을 입력하세요.

### 2. PortOne 설정
[`src/config/index.js`](src/config/index.js)의 `PORTONE.IMP_CODE`를 실제 가맹점 식별코드로 교체하세요.

### 3. ImgBB API 키
[`src/config/index.js`](src/config/index.js)의 `IMGBB.API_KEY`를 확인하세요.

### 4. Google Sheets 연동
[`src/config/index.js`](src/config/index.js)의 `SHEET_URLS`에 CSV 공개 URL을 설정하세요.

## 🔧 주요 기능

- ✅ 회원가입 및 로그인 (Firebase Auth)
- ✅ 본인인증 (PortOne)
- ✅ 사업자등록번호 검증
- ✅ 세미나 신청 및 관리
- ✅ 커뮤니티 게시판
- ✅ 입찰공고 검색 (부청사 회원 전용)
- ✅ 후원 시스템
- ✅ 관리자 페이지 (admin.html)

## 📊 성능 최적화

### Before (Vite 마이그레이션 전)
- 단일 HTML 파일: 8,557줄
- Babel in-browser 변환
- **500KB 경고 발생**
- 느린 초기 로딩

### After (Vite 적용)
- 모듈화된 구조: 20개 파일
- 빌드 타임 최적화
- **Babel 경고 완전 제거** ✅
- 최적화된 번들 크기:
  - CSS: 47KB (gzip: 8.39KB)
  - JS: 163KB (gzip: 53.60KB)
- 빠른 HMR 개발 경험

## 🎯 배포

프로덕션 빌드 후 `dist/` 폴더를 웹 서버에 배포하세요.

```bash
npm run build
# dist/ 폴더를 서버에 업로드
```

## 📝 라이선스

© 2025 BCSA (부산청년사업가들). All rights reserved.

