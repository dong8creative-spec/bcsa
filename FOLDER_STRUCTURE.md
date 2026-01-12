# 폴더 구조 문서

## 개요

이 프로젝트는 Firebase 호스팅을 사용하여 배포되며, Vite를 사용하여 React 애플리케이션을 빌드합니다.

## 주요 폴더 구조

```
프로젝트 루트/
├── assets/              # 메인 페이지(index.html)용 정적 리소스
│   ├── css/
│   ├── images/
│   └── js/
├── public/              # Firebase 호스팅용 정적 파일
│   ├── admin.html       # 관리자 페이지
│   └── assets/         # 관리자 페이지용 정적 리소스
│       ├── css/
│       ├── images/
│       └── js/          # config.js, firebase-config.js 포함
├── src/                 # React 소스 코드 (Vite 개발용)
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   ├── services/
│   └── ...
├── functions/           # Firebase Functions
├── del/                 # 레거시/백업 파일
└── ...
```

## 폴더별 상세 설명

### 1. `assets/` (루트)

**용도**: 메인 페이지(`index.html`)에서 사용하는 정적 리소스

**참조 경로**: `/assets/` (절대 경로)

**포함 파일**:
- `css/styles.css` - 스타일시트
- `images/` - 파비콘, 로고 등 이미지 파일
- `js/` - JavaScript 유틸리티 파일들

**사용 위치**:
- `index.html`에서 `/assets/images/favicon.svg` 등으로 참조

**빌드/배포**:
- Vite 빌드 시 `dist/assets/`로 복사됨
- Firebase 호스팅에서도 루트의 `assets/`가 직접 호스팅됨 (firebase.json의 `public: "."` 설정)

### 2. `public/assets/` 

**용도**: 관리자 페이지(`public/admin.html`)에서 사용하는 정적 리소스

**참조 경로**: `./assets/` (상대 경로, `public/admin.html` 기준)

**포함 파일**:
- `css/styles.css` - 스타일시트
- `images/` - 이미지 파일
- `js/` - JavaScript 파일들
  - `config.js` ⚠️ (민감 정보 포함, .gitignore에 등록됨)
  - `firebase-config.js` ⚠️ (민감 정보 포함, .gitignore에 등록됨)
  - 기타 유틸리티 파일들

**사용 위치**:
- `public/admin.html`에서 `./assets/js/firebase-config.js` 등으로 참조

**빌드/배포**:
- Firebase 호스팅에서 `public/` 폴더의 내용이 루트로 호스팅됨
- 따라서 `public/assets/`는 배포 시 루트의 `assets/`와 별도로 존재

### 3. `src/`

**용도**: React 애플리케이션 소스 코드 (Vite 개발용)

**포함 파일**:
- `App.jsx` - 메인 React 컴포넌트
- `main.jsx` - React 진입점
- `components/` - React 컴포넌트들
- `services/` - 서비스 레이어 (Firebase, 인증 등)
- `config.js`, `firebase.js` - 설정 파일들

**사용 위치**:
- `index.html`에서 `/src/main.jsx`로 참조 (Vite 개발 서버)
- 빌드 후에는 번들링되어 `dist/`에 생성됨

**빌드/배포**:
- Vite 빌드 시 `dist/`로 번들링됨
- Firebase 호스팅에서는 `src/` 폴더 자체는 무시됨 (firebase.json의 `ignore` 설정)

### 4. `public/`

**용도**: Firebase 호스팅용 정적 파일

**포함 파일**:
- `admin.html` - 관리자 페이지
- `assets/` - 관리자 페이지용 리소스

**빌드/배포**:
- Firebase 호스팅에서 `public: "."`로 설정되어 있어 루트의 모든 파일이 호스팅 대상
- `public/` 폴더의 내용은 루트 레벨로 호스팅됨

### 5. `functions/`

**용도**: Firebase Functions (서버리스 함수)

**포함 파일**:
- `index.js` - Functions 코드
- `package.json` - Functions 의존성

**배포**:
- `firebase deploy --only functions`로 별도 배포

## 중복 폴더에 대한 설명

### `assets/` vs `public/assets/`

두 폴더가 비슷한 구조를 가지고 있지만, **서로 다른 목적으로 사용**됩니다:

1. **루트 `assets/`**: 
   - 메인 페이지(`index.html`)용
   - Vite 빌드 산출물과 함께 사용
   - 절대 경로(`/assets/`)로 참조

2. **`public/assets/`**: 
   - 관리자 페이지(`public/admin.html`)용
   - Firebase 호스팅에서 직접 호스팅
   - 상대 경로(`./assets/`)로 참조
   - `config.js`, `firebase-config.js` 등 민감한 파일 포함

**정리 필요성**: 현재 두 폴더 모두 사용 중이므로 삭제하면 안 됩니다. 다만, 공통 파일(이미지 등)은 중복될 수 있으므로 필요시 하나로 통합을 고려할 수 있습니다.

## Firebase 호스팅 설정

`firebase.json`의 설정:
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "src/**",
      "functions/**",
      ...
    ]
  }
}
```

이 설정으로 인해:
- 루트의 모든 파일이 호스팅 대상
- `src/` 폴더는 무시됨 (개발용)
- `functions/` 폴더는 무시됨 (별도 배포)

## 민감한 파일

다음 파일들은 `.gitignore`에 등록되어 있어 Git에 커밋되지 않습니다:

- `assets/js/config.js` (루트)
- `assets/js/firebase-config.js` (루트)
- `public/assets/js/config.js`
- `public/assets/js/firebase-config.js`

**배포 시 주의사항**:
- 이 파일들은 배포 환경에 수동으로 업로드해야 합니다
- 예제 파일(`config.example.js` 등)을 참고하여 생성할 수 있습니다

## 빌드 및 배포 프로세스

### 개발 환경
```bash
npm run dev          # Vite 개발 서버 (포트 3000)
```

### 빌드
```bash
npm run build        # Vite 빌드 (dist/ 폴더 생성)
```

### 배포
```bash
firebase deploy --only hosting    # Firebase 호스팅 배포
firebase deploy --only functions  # Firebase Functions 배포
firebase deploy                   # 전체 배포
```

## 참고 사항

- Vite는 `publicDir: 'public'`로 설정되어 있어 빌드 시 `public/` 폴더의 내용이 `dist/`로 복사됩니다
- Firebase 호스팅은 루트를 `public: "."`로 설정하여 루트의 모든 파일을 호스팅합니다
- 따라서 `public/` 폴더와 루트의 파일들이 모두 호스팅 대상이 됩니다
