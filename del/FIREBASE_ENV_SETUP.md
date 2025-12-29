# Firebase 환경 변수 설정 가이드

## Firebase Console에서 환경 변수 설정하기

### 1단계: Firebase Console 접속

1. 브라우저에서 [Firebase Console](https://console.firebase.google.com) 접속
2. Google 계정으로 로그인
3. 프로젝트 선택: **bcsa-b190f**

### 2단계: Functions 환경 변수 설정

1. 왼쪽 메뉴에서 **Functions** 클릭
2. 상단 탭에서 **환경 변수** 클릭
3. **환경 변수 추가** 버튼 클릭

### 3단계: 환경 변수 추가

#### 변수 1: G2B_API_KEY

**설정 값:**
- **이름**: `G2B_API_KEY`
- **값**: `05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b`
- **설명**: 조달청 API 서비스 키

**입력 방법:**
1. "환경 변수 추가" 클릭
2. 이름 필드에 `G2B_API_KEY` 입력
3. 값 필드에 `05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b` 입력
4. 저장 클릭

#### 변수 2: ALLOWED_ORIGINS

**설정 값:**
- **이름**: `ALLOWED_ORIGINS`
- **값**: `https://bcsa.co.kr,https://www.bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com`
- **설명**: CORS 허용 도메인 목록 (쉼표로 구분)

**입력 방법:**
1. "환경 변수 추가" 클릭
2. 이름 필드에 `ALLOWED_ORIGINS` 입력
3. 값 필드에 다음을 입력 (한 줄로):
   ```
   https://bcsa.co.kr,https://www.bcsa.co.kr,https://bcsa-b190f.web.app,https://bcsa-b190f.firebaseapp.com
   ```
4. 저장 클릭

### 4단계: 환경 변수 확인

설정한 환경 변수가 목록에 표시되는지 확인:
- ✅ G2B_API_KEY
- ✅ ALLOWED_ORIGINS

### 5단계: Functions 재배포 (환경 변수 적용)

환경 변수를 설정한 후 Functions를 재배포해야 합니다:

```bash
cd /Users/donghnc/Documents/bcsa
firebase deploy --only functions
```

## 주의사항

- 환경 변수는 Functions 배포 시에만 적용됩니다
- 환경 변수를 변경한 후에는 반드시 Functions를 재배포해야 합니다
- 환경 변수 값에 공백이 있으면 안 됩니다
- ALLOWED_ORIGINS는 쉼표로 구분하며 공백 없이 입력해야 합니다

## 문제 해결

### 환경 변수가 적용되지 않는 경우

1. Firebase Console에서 환경 변수가 올바르게 설정되었는지 확인
2. Functions 재배포: `firebase deploy --only functions`
3. Functions 로그 확인: `firebase functions:log --only apiBid`

### CORS 오류가 계속 발생하는 경우

1. ALLOWED_ORIGINS에 정확한 도메인이 포함되어 있는지 확인
2. `https://` 프로토콜 포함 여부 확인
3. 쉼표 뒤에 공백이 없는지 확인
4. Functions 재배포


