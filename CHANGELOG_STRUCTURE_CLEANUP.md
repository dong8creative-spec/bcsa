# 프로젝트 구조 정리 변경 사항

## ✅ 완료된 작업

### 1. 중복 파일 제거
- ❌ `src/input.css` 삭제 (index.css와 동일한 내용)

### 2. Assets 폴더 구조 통일
- ❌ 루트 `assets/` 폴더 제거
- ✅ `public/assets/` 폴더로 통일
- ✅ Vite가 `public/` 폴더를 빌드 시 루트로 복사하므로 `/assets/` 경로로 접근 가능
- 📝 `package.json`의 Tailwind CSS 빌드 경로 수정: `./assets/css/` → `./public/assets/css/`

### 3. 빌드 설정 통일
- ✅ Firebase Hosting `public` 디렉토리를 `.` → `dist`로 변경
- ✅ Firebase Hosting `ignore` 목록 간소화 (dist 폴더에는 빌드 결과만 있으므로)
- ✅ `.gitignore` 업데이트: `assets/js/config.js` → `public/assets/js/config.js`

### 4. Tailwind CSS 빌드 자동화
- ❌ `build:css` 스크립트 제거 (Vite가 PostCSS로 자동 처리)
- ❌ `watch:css` 스크립트 제거
- ✅ React 앱: Vite가 자동으로 Tailwind CSS 처리
- ✅ admin.html: CDN Tailwind 사용 (변경 없음)

### 5. Package.json 스크립트 최적화
- ❌ `deploy:all` 스크립트 제거 (중복)
- ✅ `deploy` 스크립트에 빌드 자동 실행 추가: `npm run build && firebase deploy`
- ✅ `deploy:hosting` 스크립트에 빌드 자동 실행 추가

## 📋 새로운 빌드/배포 프로세스

### 개발
```bash
npm run dev              # Vite 개발 서버 (포트 3000)
```

### 빌드
```bash
npm run build            # Vite 빌드 → dist/
```

### 배포
```bash
npm run deploy           # 빌드 + 전체 배포 (Hosting + Functions)
npm run deploy:hosting   # 빌드 + Hosting만 배포
npm run deploy:functions # Functions만 배포
```

## 🔄 변경 전후 비교

### 변경 전
```
bcsa/
├── assets/              # ❌ 중복
│   ├── css/
│   ├── images/
│   └── js/
├── public/
│   └── assets/          # 중복
└── src/
    ├── index.css
    └── input.css        # ❌ 중복
```

### 변경 후
```
bcsa/
├── public/
│   └── assets/          # ✅ 단일 소스
│       ├── css/
│       ├── images/
│       └── js/
└── src/
    └── index.css        # ✅ 단일 파일
```

## ⚠️ 주의사항

1. **빌드 필수**: 배포 전에 반드시 `npm run build` 실행 (또는 `npm run deploy` 사용)
2. **Firebase Hosting**: 이제 `dist/` 폴더를 배포합니다
3. **Assets 경로**: 모든 assets 참조는 `/assets/`로 통일 (Vite가 public을 루트로 복사)

## 🎯 다음 단계 제안

1. **코드 구조 개선**
   - `src/App.jsx` (11,000+ 줄)를 컴포넌트 단위로 분리
   - 페이지별로 구조화 (`src/pages/`, `src/components/`)

2. **Firebase 버전 통일**
   - admin.html도 Firebase v9+로 마이그레이션 고려

3. **테스트**
   - 빌드 테스트: `npm run build`
   - 배포 테스트: `npm run deploy:hosting`
