# 조달청 기능 수정 가이드

## 문제 요약
조달청 입찰공고 검색 기능이 작동하지 않는 이유는 **Firebase Functions가 배포되지 않았기 때문**입니다.

## 즉시 조치 사항

### 1단계: Firebase Functions 배포

터미널에서 다음 명령어를 실행하세요:

```bash
# 프로젝트 루트 디렉토리에서
cd /Users/donghnc/Documents/bcsa

# Firebase 로그인 (처음이거나 인증이 만료된 경우)
firebase login

# Functions 배포
firebase deploy --only functions
```

### 2단계: 배포 확인

배포가 완료되면 다음 URL로 접속하여 확인:

**Health Check**:
```
https://asia-northeast3-bcsa-b190f.cloudfunctions.net/apiBid/health
```

예상 응답:
```json
{"status":"ok","message":"API Proxy is running"}
```

### 3단계: 실제 기능 테스트

1. 웹사이트 접속: https://bcsa.co.kr (또는 배포된 도메인)
2. 조달청 입찰공고 검색 메뉴로 이동
3. 검색어 입력 (예: "부산")
4. 검색 버튼 클릭
5. 결과가 표시되는지 확인

## 문제 해결 체크리스트

- [ ] Firebase CLI 설치 확인: `firebase --version`
- [ ] Firebase 로그인 확인: `firebase login`
- [ ] Functions 배포 완료: `firebase deploy --only functions`
- [ ] Health Check 성공: 위 URL 접속 시 JSON 응답 확인
- [ ] 실제 검색 기능 테스트 성공

## 추가 확인 사항

### 환경 변수 설정 (선택사항)

Firebase Console에서 환경 변수 설정:
1. Firebase Console > Functions > 환경 변수
2. `G2B_API_KEY` 추가 (현재는 코드에 하드코딩된 값 사용 중)

### 조달청 API 상태 확인

조달청 API가 502 에러를 반환하는 경우:
- 공공데이터포털 (https://www.data.go.kr) 접속
- API 상태 확인
- 필요시 API 키 재발급

## 예상 소요 시간
- 배포: 약 2-5분
- 테스트: 약 1-2분

## 문제가 지속되는 경우

1. Firebase Console에서 Functions 로그 확인
2. 브라우저 개발자 도구에서 네트워크 탭 확인
3. 에러 메시지 확인 및 보고
