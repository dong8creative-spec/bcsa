# 추가 정리 작업 목록

이 문서는 `CHANGELOG_STRUCTURE_CLEANUP.md`에 기록된 작업 이후 추가로 정리할 사항들을 정리합니다.

## 🔍 발견된 추가 문제점

### 1. 중복된 설정 상수 ⚠️

#### 문제
- `src/config.js`의 `CONFIG.DEFAULT_CONTENT`와 `src/constants/content.js`의 `defaultContent`가 중복됨
- `src/constants/index.js`의 `CONFIG_SHEET_URL`, `MEMBER_SHEET_URL` 등이 `CONFIG.SHEET_URLS`와 중복됨

#### 현재 사용 현황
- ✅ `src/constants/content.js`의 `defaultContent`: **실제 사용 중** (App.jsx에서 import)
- ❌ `src/config.js`의 `CONFIG.DEFAULT_CONTENT`: **정의만 되어있고 사용 안 함**
- ⚠️ `src/constants/index.js`의 `MEMBER_SHEET_URL` 등: **fallback으로 사용 중** (App.jsx)

#### 해결 방안
```javascript
// src/config.js에서 DEFAULT_CONTENT 제거 (사용 안 함)
// 또는 src/constants/content.js를 제거하고 CONFIG.DEFAULT_CONTENT 사용
// ⚠️ App.jsx에서 defaultContent를 사용하므로 주의 필요
```

**권장**: `src/config.js`의 `DEFAULT_CONTENT` 제거하고 `src/constants/content.js`만 사용

---

### 2. Constants 폴더 구조 정리

#### 현재 구조
```
src/
├── config.js                    # CONFIG 객체 (설정)
├── constants/
│   ├── index.js                # PORTONE_IMP_CODE, SHEET_URLs (중복)
│   └── content.js              # defaultContent (실제 사용)
```

#### 문제점
1. `src/constants/index.js`의 `MEMBER_SHEET_URL` 등이 `CONFIG.SHEET_URLS`와 중복
2. App.jsx에서 fallback으로 사용: `CONFIG.SHEET_URLS?.MEMBER || MEMBER_SHEET_URL`
3. 불필요한 중복 코드

#### 해결 방안
```javascript
// Option 1: constants/index.js에서 SHEET_URL 제거하고 CONFIG만 사용
// Option 2: constants/index.js를 CONFIG의 재export로 통일
```

**권장**: `src/constants/index.js`에서 SHEET_URL 관련 상수 제거하고 `CONFIG.SHEET_URLS`만 사용

---

### 3. Icons 컴포넌트 구조 확인

#### 현재 파일
- ✅ `src/components/Icons.jsx`: **사용 중** (App.jsx에서 import)
- ✅ `src/components/CustomIcons.jsx`: **사용 중** (Icons.jsx에서 import)
- ✅ `public/assets/js/components/Icons.js`: **admin.html용** (유지 필요)

#### 상태
- 모든 파일이 실제로 사용되고 있어 정리 불필요

---

### 4. Config 파일 중복 (React 앱 vs Admin)

#### 현재 구조
- `src/config.js`: React 앱용 (ES6 모듈)
- `public/assets/js/config.js`: admin.html용 (전역 변수)

#### 상태
- 두 파일 모두 필요함 (용도가 다름)
- 하지만 동기화 필요 (API 키 등 공통 설정)

#### 권장사항
- 주요 설정(API 키, URL 등)을 한 곳에서 관리하고 빌드 시 동기화
- 또는 문서화로 관리

---

### 5. Utils 파일 구조

#### 현재 구조
```
src/
├── utils.js                    # calculateStatus, fetchSheetData 등 (일부 유틸)
└── utils/
    ├── authUtils.js            # 인증 관련 유틸
    ├── errorUtils.js           # 에러 처리 유틸
    └── imageUtils.js           # 이미지 처리 유틸
```

#### 문제점
- `src/utils.js`와 `src/utils/` 폴더가 혼재
- 일부 유틸은 `utils.js`에, 일부는 `utils/` 폴더에 있음

#### 해결 방안
**Option 1**: 모든 유틸을 `src/utils/` 폴더로 이동
```
src/utils/
├── index.js                   # calculateStatus, fetchSheetData 등
├── authUtils.js
├── errorUtils.js
└── imageUtils.js
```

**Option 2**: 현재 구조 유지 (작은 수정사항)

---

### 6. api-proxy.php 파일

#### 현재 상태
- 파일 존재: ✅ `api-proxy.php`
- 사용 여부: ⚠️ 코드베이스에서 직접 참조 없음
- .gitignore: ✅ 포함됨 (민감 정보 포함)

#### 용도
- 조달청 입찰공고 검색 API 프록시
- Firebase Functions 대신 PHP 서버에서 실행

#### 권장사항
- 사용 중이면 유지 (단, .gitignore에 포함되어 있어 관리 방식 확인 필요)
- 사용하지 않으면 제거 고려

---

### 7. Assets 경로 일관성

#### 현재 상태
- `index.html`: `/assets/images/...` ✅ (빌드 후 올바른 경로)
- `App.jsx`: `./assets/images/...` ⚠️ (상대 경로 혼재)
- `admin.html`: `./assets/js/...` ✅ (public 디렉토리 기준)

#### 해결 방안
- React 앱에서 assets 경로는 `/assets/`로 통일 (Vite가 public을 루트로 복사)
- 상대 경로(`./assets/`) 대신 절대 경로(`/assets/`) 사용 권장

---

## 📋 정리 작업 우선순위

### 우선순위 높음 🔴

1. **Config 중복 제거**
   - [ ] `src/config.js`의 `DEFAULT_CONTENT` 제거 (사용 안 함 확인 후)
   - [ ] `src/constants/index.js`의 SHEET_URL 상수 정리 (CONFIG.SHEET_URLS로 통일)

2. **Utils 구조 정리**
   - [ ] `src/utils.js`의 함수들을 `src/utils/index.js`로 이동 검토

### 우선순위 중간 🟡

3. **Assets 경로 통일**
   - [ ] `App.jsx`에서 `./assets/` → `/assets/`로 변경
   - [ ] 일관성 확인

4. **Config 동기화 문서화**
   - [ ] `src/config.js`와 `public/assets/js/config.js` 동기화 방법 문서화

### 우선순위 낮음 🟢

5. **api-proxy.php 확인**
   - [ ] 실제 사용 여부 확인
   - [ ] 사용 중이면 문서화, 사용 안 하면 제거

6. **불필요한 파일 제거**
   - [ ] 사용하지 않는 파일 정리
   - [ ] 레거시 파일 확인

---

## 🔧 구체적인 수정 가이드

### 1. DEFAULT_CONTENT 중복 제거

```javascript
// src/config.js에서 제거
export const CONFIG = {
    // ... 다른 설정
    // DEFAULT_CONTENT: { ... } ← 제거
};

// App.jsx는 그대로 사용 (변경 불필요)
import { defaultContent } from './constants/content';
```

### 2. Constants 정리

```javascript
// src/constants/index.js 수정
import { CONFIG } from '../config';

export const PORTONE_IMP_CODE = CONFIG.PORTONE?.IMP_CODE || 'imp00000000';

// SHEET_URL 상수 제거하고 CONFIG.SHEET_URLS만 사용
// export const MEMBER_SHEET_URL = ...; ← 제거

// App.jsx 수정
// const csvUrl = CONFIG.SHEET_URLS?.MEMBER || MEMBER_SHEET_URL;
// → const csvUrl = CONFIG.SHEET_URLS?.MEMBER || '';
```

### 3. Utils 구조 개선 (선택사항)

```javascript
// src/utils/index.js 생성
export { calculateStatus, fetchSheetData, ... } from './utils'; // utils.js 내용 이동

// src/utils.js 제거

// import 경로는 변경 불필요 (alias 사용 시)
```

---

## ✅ 완료 체크리스트

작업 완료 시 체크:

- [ ] `src/config.js`에서 `DEFAULT_CONTENT` 제거 확인
- [ ] `src/constants/index.js`에서 중복 SHEET_URL 상수 제거
- [ ] `App.jsx`에서 fallback 로직 수정 (필요 시)
- [ ] `src/utils.js` 정리 또는 이동 (선택사항)
- [ ] Assets 경로 통일 (선택사항)
- [ ] 빌드 테스트: `npm run build`
- [ ] 개발 서버 테스트: `npm run dev`

---

## 📝 참고사항

1. **Config 파일 동기화**
   - `src/config.js`와 `public/assets/js/config.js`는 용도가 다르므로 완전 통일은 어려움
   - 대신 주요 설정값(API 키 등)을 문서화로 관리 권장

2. **빌드 전 필수 확인**
   - 모든 import 경로가 올바른지 확인
   - 빌드 에러 없이 완료되는지 확인

3. **점진적 개선**
   - 한 번에 모든 것을 변경하지 말고 단계적으로 진행
   - 각 단계마다 테스트 수행
