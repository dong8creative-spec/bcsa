# admin.html 배포 수정 완료

## 완료된 작업

### 1. admin.html 파일 이동
- ✅ `admin.html` → `public/admin.html`로 이동 완료
- Vite 빌드 시 `dist/admin.html`로 자동 복사됨

### 2. assets 폴더 복사
- ✅ `assets/js/` → `public/assets/js/` 복사 완료
- ✅ `assets/css/` → `public/assets/css/` 복사 완료
- ✅ `assets/images/`는 이미 `public/assets/images/`에 있음

### 3. 경로 확인
- ✅ `admin.html` 내부의 경로 참조 (`./assets/js/...`)는 그대로 유지
- 빌드 후 `dist/admin.html`과 `dist/assets/`가 같은 레벨에 있으므로 경로 수정 불필요

---

## 현재 파일 구조

### 빌드 전
```
프로젝트 루트/
├── public/
│   ├── admin.html ✅
│   └── assets/
│       ├── js/ ✅
│       ├── css/ ✅
│       └── images/ ✅
└── assets/ (원본, 빌드 시 사용 안 함)
```

### 빌드 후 (예상)
```
dist/
├── admin.html ✅
├── index.html
└── assets/
    ├── js/ ✅
    ├── css/ ✅
    └── images/ ✅
```

---

## ⚠️ 중요: 배포 시 추가 작업 필요

### 민감한 파일 처리

`admin.html`이 참조하는 다음 파일들은 `.gitignore`에 포함되어 있어 GitHub에 업로드되지 않습니다:

1. **`assets/js/firebase-config.js`** - Firebase 설정
2. **`assets/js/config.js`** - 애플리케이션 설정

### 해결 방법

#### 방법 1: 호스팅케이알 직접 업로드 시
FTP로 다음 파일들을 `public/assets/js/` (또는 배포된 `dist/assets/js/`)에 직접 업로드:
- `firebase-config.js`
- `config.js`

#### 방법 2: GitHub Pages 배포 시
1. GitHub Secrets에 설정 값 저장
2. GitHub Actions 워크플로우에서 파일 생성
3. 또는 배포 후 수동으로 파일 업로드

#### 방법 3: 예제 파일 사용 (개발용)
- `del/config.example.js`를 참고하여 `config.js` 생성
- `del/firebase-config.example.js`를 참고하여 `firebase-config.js` 생성

---

## 빌드 및 배포 확인

### 로컬 빌드 테스트
```bash
npm install  # node_modules 설치 (필요시)
npm run build
```

### 빌드 후 확인
```bash
ls -la dist/
# 다음 파일들이 있어야 함:
# - dist/admin.html
# - dist/assets/js/
# - dist/assets/css/
# - dist/assets/images/
```

### GitHub Pages 배포
1. 코드를 GitHub에 푸시
2. GitHub Actions가 자동으로 빌드 및 배포
3. 배포 완료 후 `https://bcsa.co.kr/admin.html` 접근 확인

---

## 다음 단계

1. ✅ 파일 이동 및 복사 완료
2. ⏳ 로컬 빌드 테스트 (node_modules 설치 필요)
3. ⏳ GitHub에 푸시 및 배포
4. ⏳ 배포 후 `admin.html` 접근 테스트
5. ⏳ `firebase-config.js`와 `config.js` 파일 배포 (필요시)

---

## 참고

- `admin.html`은 이제 `public` 폴더에 있으므로 Vite 빌드 시 자동으로 포함됩니다
- GitHub Pages는 `dist` 폴더만 배포하므로, 빌드 후 `dist/admin.html`이 존재하는지 확인하세요
- 민감한 파일(`config.js`, `firebase-config.js`)은 배포 시 별도로 처리해야 합니다

