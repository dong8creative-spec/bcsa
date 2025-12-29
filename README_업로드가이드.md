# GitHub 업로드 가이드

## 📁 이 폴더(1 폴더)의 내용

이 폴더에는 GitHub에 업로드해도 되는 모든 파일들이 포함되어 있습니다.

## ✅ 업로드 방법

### 방법 1: GitHub 웹 인터페이스로 직접 업로드
1. GitHub 저장소 생성 또는 기존 저장소 선택
2. 이 폴더(`1`)의 모든 내용을 저장소 루트에 업로드
3. `Settings` → `Pages` → `Source`를 `GitHub Actions`로 설정
4. 자동으로 빌드 및 배포가 진행됩니다

### 방법 2: Git 명령어 사용
```bash
cd 1
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

## ⚠️ 중요 사항

### 민감정보 확인
다음 파일들은 `.gitignore`에 포함되어 있으므로 업로드되지 않습니다:
- `assets/js/config.js` (민감정보 포함)
- `assets/js/firebase-config.js` (민감정보 포함)

대신 다음 예제 파일이 포함되어 있습니다:
- `assets/js/config.example.js`
- `assets/js/firebase-config.js.example`

### 빌드 및 배포
- GitHub Actions 워크플로우(`.github/workflows/deploy.yml`)가 포함되어 있습니다
- 푸시 시 자동으로 빌드되어 GitHub Pages에 배포됩니다
- `Settings` → `Pages`에서 `Source`를 `GitHub Actions`로 설정하세요

## 📋 포함된 파일 목록

- `src/` - 소스 코드
- `public/` - 정적 파일
- `.github/workflows/` - GitHub Actions 워크플로우
- `functions/` - Firebase Functions
- `assets/` - 리소스 파일 (민감정보 제외)
- 설정 파일들 (`package.json`, `vite.config.js` 등)
- 문서 파일들 (`*.md`)

