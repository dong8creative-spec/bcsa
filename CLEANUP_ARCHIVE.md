# 사이트 구동 불필요 파일 정리 아카이브

이 파일은 사이트 구동에 필요없는 파일들을 정리한 아카이브입니다.
실제 사이트 운영에는 이 파일들이 필요하지 않지만, 참고용으로 보관합니다.

---

## 📁 정리된 파일 목록

### 1. 문서 파일 (Documentation Files)

#### 개발 가이드 문서
- `CLEANUP_SUMMARY.md` - 이전 정리 작업 요약
- `FIREBASE_FUNCTIONS_500_ERROR_GUIDE.md` - Firebase Functions 500 에러 해결 가이드
- `KAKAO_MAP_TEST.md` - 카카오맵 테스트 가이드
- `LOCAL_TESTING.md` - 로컬 테스트 가이드
- `TESTING_GUIDE.md` - 테스트 가이드

#### 계획 파일 (Plans)
- `.cursor/plans/firebase_functions_500_에러_해결_가이드_471e3fdf.plan.md`
- `.cursor/plans/통합_버그_수정_계획_시각화.md`
- `.cursor/plans/통합_버그_수정_계획.md`

### 2. 로그 파일 (Log Files)

#### 디버그 로그
- `functions/firebase-debug.log` - Firebase Functions 디버그 로그
- `.cursor/debug.log` - Cursor IDE 디버그 로그

### 3. 기타 파일

#### 설정 파일 (오타/임시)
- `functions/.envcd` - 오타로 보이는 임시 파일 (환경 변수 포함, 삭제 전 확인 필요)

---

## 📝 파일 상세 정보

### 문서 파일 설명

#### CLEANUP_SUMMARY.md
- **목적**: 이전 정리 작업 요약
- **상태**: 보관 불필요 (이미 완료된 작업)

#### FIREBASE_FUNCTIONS_500_ERROR_GUIDE.md
- **목적**: Firebase Functions 500 에러 해결 가이드
- **상태**: 보관 불필요 (문제 해결 완료)

#### KAKAO_MAP_TEST.md
- **목적**: 카카오맵 테스트 가이드
- **상태**: 보관 불필요 (테스트 완료)

#### LOCAL_TESTING.md
- **목적**: 로컬 테스트 가이드
- **상태**: 보관 불필요 (개발 환경 설정 완료)

#### TESTING_GUIDE.md
- **목적**: 테스트 가이드
- **상태**: 보관 불필요 (테스트 프로세스 확립)

#### .cursor/plans/ 파일들
- **목적**: 개발 계획 및 수정 계획 문서
- **상태**: 보관 불필요 (작업 완료)

### 로그 파일 설명

#### functions/firebase-debug.log
- **목적**: Firebase Functions 디버그 로그
- **상태**: 자동 생성 파일, 삭제 가능

#### .cursor/debug.log
- **목적**: Cursor IDE 디버그 로그
- **상태**: 자동 생성 파일, 삭제 가능

### 기타 파일 설명

#### functions/.envcd
- **목적**: 불명확 (오타로 보이는 파일)
- **상태**: 삭제 가능

---

## 🗑️ 삭제 권장 파일 목록

다음 파일들은 사이트 구동에 전혀 필요하지 않으므로 삭제해도 됩니다:

```
CLEANUP_SUMMARY.md
FIREBASE_FUNCTIONS_500_ERROR_GUIDE.md
KAKAO_MAP_TEST.md
LOCAL_TESTING.md
TESTING_GUIDE.md
.cursor/plans/firebase_functions_500_에러_해결_가이드_471e3fdf.plan.md
.cursor/plans/통합_버그_수정_계획_시각화.md
.cursor/plans/통합_버그_수정_계획.md
functions/firebase-debug.log
.cursor/debug.log
functions/.envcd (환경 변수 포함, 삭제 전 확인 필요)
```

---

## ✅ 정리 후 프로젝트 구조

정리 후에도 다음 파일들은 유지됩니다 (사이트 구동에 필요):

- `README.md` (프로젝트 메인 문서)
- `.gitignore` (Git 무시 파일)
- `package.json` (의존성 관리)
- `vite.config.js` (빌드 설정)
- `firebase.json` (Firebase 설정)
- `tailwind.config.js` (스타일 설정)
- 모든 소스 코드 파일 (`src/` 폴더)
- 모든 설정 파일 (`.env.development`, `.env.production` 등)

---

## 📅 정리 일자

- **정리 일자**: 2026-01-29
- **정리 사유**: 사이트 구동에 불필요한 파일 정리
- **정리 방법**: 아카이브 파일로 통합 후 원본 파일 삭제 권장

---

## ⚠️ 주의사항

- 이 파일들은 참고용으로만 보관합니다.
- 실제 사이트 운영에는 이 파일들이 필요하지 않습니다.
- 필요시 이 아카이브 파일을 참고하여 정보를 확인할 수 있습니다.
