# GitHub Pages 배포 가이드

## 문제 해결

이전에 발생한 오류 (`Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded main.jsx:1 with a MIME type of "text/jsx"`)는 소스 파일(`src/main.jsx`)이 빌드되지 않은 채로 브라우저에서 로드되려고 해서 발생했습니다.

## 해결 방법

GitHub Actions를 사용하여 자동으로 빌드하고 배포하도록 설정했습니다.

## 배포 방법

### 방법 1: 자동 배포 (권장)

1. **GitHub 저장소 설정**
   - GitHub 저장소로 이동
   - `Settings` > `Pages` 메뉴로 이동
   - `Source`를 `GitHub Actions`로 선택

2. **자동 배포 시작**
   - `main` 또는 `master` 브랜치에 코드를 푸시하면 자동으로 빌드 및 배포가 시작됩니다
   - `.github/workflows/deploy.yml` 파일이 워크플로우를 실행합니다

3. **배포 확인**
   - `Actions` 탭에서 배포 진행 상황 확인
   - 배포 완료 후 `Settings` > `Pages`에서 사이트 URL 확인

### 방법 2: 수동 배포

1. **로컬에서 빌드**
   ```bash
   npm run build
   ```

2. **빌드된 파일 확인**
   - `dist/` 폴더에 빌드된 파일이 생성됩니다

3. **GitHub Pages에 배포**
   - `Settings` > `Pages` 메뉴로 이동
   - `Source`를 `Deploy from a branch`로 선택
   - `Branch`를 선택하고 `/dist` 폴더를 선택 (또는 `dist` 폴더 내용을 `docs` 폴더로 복사 후 `docs` 선택)

## 주의사항

- **`.gitignore`에 `dist/` 포함**: 빌드된 파일은 GitHub Actions가 자동 생성하므로 커밋하지 않아도 됩니다
- **환경 변수**: Firebase 설정 등 민감한 정보는 GitHub Secrets에 저장하고 워크플로우에서 사용하세요
- **빌드 오류**: 빌드가 실패하면 `Actions` 탭에서 오류 로그를 확인하세요

## 커스텀 도메인 사용 시

만약 커스텀 도메인(`yourdomain.com`)을 사용한다면:

1. `vite.config.js`의 `base` 설정을 확인하세요
2. GitHub Pages 설정에서 커스텀 도메인을 추가하세요
3. DNS 설정을 완료하세요

## 트러블슈팅

### 빌드 오류
- `Actions` 탭에서 오류 로그 확인
- 로컬에서 `npm run build` 실행하여 오류 재현

### 페이지가 로드되지 않음
- `dist/index.html`이 올바르게 생성되었는지 확인
- 브라우저 콘솔에서 오류 확인
- GitHub Pages 설정에서 올바른 폴더를 선택했는지 확인

### 자산 파일(이미지, CSS)이 로드되지 않음
- `vite.config.js`의 `base` 설정 확인
- 상대 경로 대신 절대 경로 사용 여부 확인

