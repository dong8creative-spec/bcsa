# 호스팅케이알 PHP 프록시 설정 가이드

## 개요

이 가이드는 호스팅케이알 서버에 PHP 프록시를 설정하여 Firebase Functions 없이 입찰공고 검색 기능을 사용할 수 있도록 하는 방법을 설명합니다.

---

## 사전 준비사항

### 1. 호스팅케이알 서버 환경 확인

다음 정보를 확인해야 합니다:

#### A. PHP 버전 확인

**방법 1: 호스팅케이알 관리자 페이지**
1. 호스팅케이알 관리자 페이지 로그인
2. PHP 설정 또는 서버 정보 메뉴 확인
3. PHP 버전이 **5.6 이상**인지 확인

**방법 2: PHP 정보 파일 생성 (권장)**

다음 내용으로 `phpinfo.php` 파일을 생성하고 서버에 업로드:

```php
<?php
phpinfo();
?>
```

브라우저에서 `https://bcsa.co.kr/phpinfo.php` 접속하여 PHP 버전 확인

**확인 후 삭제:** 보안을 위해 확인 후 반드시 삭제하세요!

#### B. 외부 API 호출 가능 여부 확인

PHP에서 외부 API를 호출하려면 다음 중 하나가 필요합니다:

1. **cURL 확장 모듈** (권장)
   - `phpinfo.php`에서 "curl" 검색
   - 또는 PHP 코드로 확인: `<?php echo function_exists('curl_init') ? 'cURL 사용 가능' : 'cURL 사용 불가'; ?>`

2. **allow_url_fopen 설정**
   - `phpinfo.php`에서 "allow_url_fopen" 검색
   - 값이 "On"이어야 함

#### C. 파일 업로드 경로 확인

- FTP 접속 정보 확인
- 루트 디렉토리 경로 확인 (보통 `public_html`, `www`, `htdocs` 등)

---

## 2단계: PHP 프록시 파일 업로드

### A. 파일 준비

프로젝트 루트에 `api-proxy.php` 파일이 생성되어 있습니다.

### B. FTP로 파일 업로드

**필요한 정보:**
- FTP 호스트: 호스팅케이알에서 제공
- FTP 포트: 보통 21
- FTP 사용자명: 호스팅케이알 계정명
- FTP 비밀번호: 호스팅케이알 비밀번호

**업로드 방법:**

1. **FTP 클라이언트 사용 (FileZilla, WinSCP 등)**
   - FTP 클라이언트 실행
   - 호스팅케이알 FTP 정보로 접속
   - `api-proxy.php` 파일을 **웹 루트 디렉토리**에 업로드
   - 파일 권한을 **644**로 설정

2. **cPanel 파일 관리자 사용**
   - 호스팅케이알 cPanel 접속
   - 파일 관리자 열기
   - `public_html` 또는 루트 디렉토리로 이동
   - `api-proxy.php` 파일 업로드
   - 파일 권한을 **644**로 설정

### C. 파일 권한 설정

**권장 권한:**
- 파일 소유자: 읽기/쓰기 (6)
- 그룹: 읽기 (4)
- 기타: 읽기 (4)
- **총합: 644**

**설정 방법:**
- FTP 클라이언트: 파일 우클릭 > 파일 권한 > 644 입력
- cPanel: 파일 관리자에서 파일 선택 > 권한 변경 > 644 입력

---

## 3단계: PHP 프록시 테스트

### A. 직접 테스트

브라우저에서 다음 URL로 접속:

```
https://bcsa.co.kr/api-proxy.php?keyword=소프트웨어&pageNo=1&numOfRows=10&type=bid-search
```

**예상 응답:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "totalCount": 100,
    "pageNo": 1,
    "numOfRows": 10
  }
}
```

### B. cURL로 테스트 (터미널)

```bash
curl "https://bcsa.co.kr/api-proxy.php?keyword=소프트웨어&pageNo=1&numOfRows=10&type=bid-search"
```

### C. 에러 확인

**에러가 발생하는 경우:**

1. **500 Internal Server Error**
   - PHP 에러 로그 확인
   - cURL 또는 allow_url_fopen 활성화 확인
   - 파일 권한 확인

2. **404 Not Found**
   - 파일 경로 확인
   - 파일명 확인 (대소문자 구분)

3. **빈 응답 또는 파싱 오류**
   - 조달청 API 응답 확인
   - PHP 에러 로그 확인

---

## 4단계: 클라이언트 코드 배포

PHP 프록시가 정상 작동하는 것을 확인한 후:

1. 수정된 클라이언트 코드를 배포
2. 웹사이트에서 입찰공고 검색 기능 테스트

---

## 문제 해결

### 문제 1: PHP 프록시가 응답하지 않음

**해결 방법:**
1. PHP 버전 확인 (5.6 이상 필요)
2. cURL 확장 모듈 확인
3. 파일 권한 확인 (644)
4. PHP 에러 로그 확인

**에러 로그 확인 방법:**
- 호스팅케이알 관리자 페이지 > 에러 로그
- 또는 `.htaccess`에 에러 로깅 설정

### 문제 2: CORS 오류

**증상:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**해결 방법:**
1. `api-proxy.php` 파일에서 CORS 헤더가 올바르게 설정되었는지 확인
2. 브라우저 콘솔에서 정확한 에러 메시지 확인
3. PHP 파일이 올바르게 실행되는지 확인 (직접 URL 접속 테스트)

### 문제 3: 조달청 API 호출 실패

**해결 방법:**
1. `api-proxy.php`에서 API 키가 올바른지 확인
2. cURL 에러 메시지 확인
3. 조달청 API 서비스 상태 확인
4. 네트워크 연결 확인

### 문제 4: JSON 파싱 오류

**해결 방법:**
1. 조달청 API 응답 형식 확인
2. PHP 버전 확인 (JSON 지원)
3. 응답 데이터 확인 (디버깅용 출력)

---

## 보안 주의사항

### API 키 보안

- ✅ `api-proxy.php` 파일은 `.gitignore`에 추가되어 있음
- ✅ API 키는 서버에서만 사용됨
- ⚠️ PHP 파일 권한을 644로 설정 (실행 가능하지만 수정은 소유자만)
- ⚠️ 필요시 `.htaccess`로 접근 제한 가능

### 추가 보안 설정 (선택사항)

**`.htaccess` 파일에 추가하여 특정 IP만 허용:**

```apache
<Files "api-proxy.php">
    Order Deny,Allow
    Deny from all
    Allow from 127.0.0.1
    # Allow from YOUR_IP_ADDRESS
</Files>
```

**주의:** 이 설정은 모든 접근을 차단하므로, 웹사이트에서 사용할 수 없습니다. 일반적으로는 필요하지 않습니다.

---

## 체크리스트

PHP 프록시 설정 완료 확인:

- [ ] PHP 버전 확인 (5.6 이상)
- [ ] cURL 또는 allow_url_fopen 활성화 확인
- [ ] `api-proxy.php` 파일 업로드 완료
- [ ] 파일 권한 설정 (644)
- [ ] 직접 URL 접속 테스트 성공
- [ ] cURL 테스트 성공
- [ ] 클라이언트 코드 배포 완료
- [ ] 웹사이트에서 입찰공고 검색 테스트 성공

---

## 다음 단계

PHP 프록시 설정이 완료되면:

1. 클라이언트 코드가 자동으로 PHP 프록시를 사용하도록 수정됨
2. 웹사이트에서 입찰공고 검색 기능 테스트
3. 문제 발생 시 위의 "문제 해결" 섹션 참조

---

## 참고 자료

- [PHP cURL 문서](https://www.php.net/manual/en/book.curl.php)
- [조달청 공공데이터포털](https://www.data.go.kr/)
- 호스팅케이알 고객지원

