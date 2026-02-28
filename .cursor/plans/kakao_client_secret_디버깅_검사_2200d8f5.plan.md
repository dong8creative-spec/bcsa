---
name: Kakao Client Secret 디버깅 검사
overview: 카카오 로그인 콜백 핸들러에 KAKAO_CLIENT_SECRET 환경 변수의 존재 여부와 길이(32자) 검증 로직을 추가하고, 실패 시 throw하며 마스킹된 로그만 출력한다.
todos: []
isProject: false
---

# Kakao Client Secret 환경 변수 디버깅 검사 추가

## 대상 파일

- [functions/index.js](functions/index.js) — 카카오 콜백 라우트 `GET /api/auth/kakao/callback` (114행~193행)

## 현재 구조

- `getKakaoEnv()`(107~111행)에서 `process.env.KAKAO_CLIENT_SECRET`을 읽어 `clientSecret`으로 반환.
- 콜백 핸들러(114행~)에서 `getKakaoEnv()` 결과를 사용하며, `KAKAO_CLIENT_SECRET`이 있을 때만 토큰 요청에 `auth`를 붙임.
- REST API 키 검사 후(120~~124행), baseUrl 구성 후(125~~136행), 이미 `hasClientSecret` 로그(137행)가 있음.

## 구현 내용

### 1. 검사 시점

- **위치**: `getKakaoEnv()`로 env를 읽은 직후, `code` 검사 다음, **REST API 키 검사와 동일한 블록 안** (즉 115행 `clientSecret: KAKAO_CLIENT_SECRET` 사용 직후).
- REST API 키 검사(120~124행) 다음에, **KAKAO_CLIENT_SECRET 전용 검사**를 추가.

### 2. 검사 로직

- `KAKAO_CLIENT_SECRET`(이미 trim된 값)에 대해:
  - **존재**: 값이 없거나 빈 문자열이면 → 즉시 `throw new Error(...)` (예: `'KAKAO_CLIENT_SECRET is not set or empty'`).
  - **길이**: 길이가 32가 아니면 → 즉시 `throw new Error(...)` (예: `'KAKAO_CLIENT_SECRET length is invalid (expected 32)'`).
- **정상인 경우에만** 마스킹 로그 출력:
  - `console.log("Secret key is set, length:", secret.length);`
  - 실제 키 값은 절대 로그에 넣지 않음.

### 3. 예외 처리

- 현재 콜백 핸들러는 **try/catch가 axios 호출부에만** 있음(138~191행).  
검사에서 `throw`하면 그 위에서 던져지므로 **핸들러 전체를 try로 감싸거나**, 검사 실패 시 `throw` 대신 `res.redirect(FRONTEND_URL + '/?auth=kakao&error=server_config')` 후 `return`으로 처리할 수 있음.
- 요청에서 **“즉시 에러를 throw 하라”**고 하셨으므로, **throw를 유지**하고, **핸들러 상단을 try로 감싸서** 이 검사/axios 등에서 나온 에러를 catch한 뒤:
  - `console.error('[Kakao Auth]', err.message);`
  - `res.redirect(\`${FRONTEND_URL}/?auth=kakao&error=server_config);`
  - `return;`
  으로 클라이언트에는 기존과 동일한 리다이렉트로 응답.

### 4. 구체적 수정 위치

- **114행~137행 구간**:
  1. `app.get('/api/auth/kakao/callback', async (req, res) => {` 다음에 **try {** 추가.
  2. `getKakaoEnv()` 호출 및 `code` 검사, REST 키 검사는 그대로 두고, **REST 키 검사 바로 다음**에:
    - `KAKAO_CLIENT_SECRET`이 없거나 빈 문자열 → `throw new Error('KAKAO_CLIENT_SECRET is not set or empty');`
    - `KAKAO_CLIENT_SECRET.length !== 32` → `throw new Error('KAKAO_CLIENT_SECRET length is invalid (expected 32)');`
    - 그 외(정상) → `console.log("Secret key is set, length:", KAKAO_CLIENT_SECRET.length);`
  3. 기존 `try {` (axios 블록, 138행) ~ `} catch (err) {` ~ `}` (191행) 는 그대로 두고, **핸들러 맨 끝**(193행 `});` 직전)에 **catch 블록** 추가:
    - `} catch (err) { console.error('[Kakao Auth]', err.message); res.redirect(\`${FRONTEND_URL}/?auth=kakao&error=server_config); return; }`
    - 단, `FRONTEND_URL`은 이 블록에서 접근 가능해야 하므로, try 바깥에서 `const { frontendUrl: FRONTEND_URL } = getKakaoEnv();`를 한 번 더 호출하거나, catch에서 `getKakaoEnv().frontendUrl`을 사용.

### 5. 정리

- **추가**: 존재 여부 + 길이 32 검사, 실패 시 throw.
- **추가**: 정상 시 `console.log("Secret key is set, length:", secret.length);` (값은 출력하지 않음).
- **추가**: 라우트 전체 try/catch로 throw 시 `server_config` 리다이렉트 및 로그 출력.

