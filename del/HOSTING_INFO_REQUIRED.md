# 호스팅케이알 서버 정보 요청

PHP 프록시를 설정하기 위해 다음 정보가 필요합니다.

---

## 필수 확인 사항

### 1. PHP 환경 정보

다음 중 하나의 방법으로 확인 가능합니다:

**방법 A: 호스팅케이알 관리자 페이지**
- 호스팅케이알 관리자 페이지 접속
- PHP 설정 또는 서버 정보 메뉴 확인
- 다음 정보 확인:
  - ✅ PHP 버전 (5.6 이상 필요)
  - ✅ cURL 확장 모듈 활성화 여부
  - ✅ `allow_url_fopen` 설정 (On/Off)

**방법 B: PHP 정보 파일 생성 (권장)**

다음 내용으로 `phpinfo.php` 파일을 생성하고 서버에 업로드:

```php
<?php
phpinfo();
?>
```

브라우저에서 `https://bcsa.co.kr/phpinfo.php` 접속하여 확인

**⚠️ 보안 주의:** 확인 후 반드시 `phpinfo.php` 파일을 삭제하세요!

**확인할 항목:**
- PHP Version: `5.6` 이상
- curl: `enabled` 또는 `사용 가능`
- allow_url_fopen: `On`

---

### 2. FTP 접속 정보

**필요한 정보:**
- FTP 호스트 주소 (예: `ftp.bcsa.co.kr` 또는 IP 주소)
- FTP 포트 (보통 `21`)
- FTP 사용자명
- FTP 비밀번호
- 웹 루트 디렉토리 경로 (보통 `public_html`, `www`, `htdocs` 등)

**확인 방법:**
- 호스팅케이알 관리자 페이지 > FTP 설정
- 또는 호스팅케이알 고객지원 문의

---

### 3. 파일 업로드 방법

**선택 가능한 방법:**
- [ ] FTP 클라이언트 사용 가능 (FileZilla, WinSCP 등)
- [ ] cPanel 파일 관리자 사용 가능
- [ ] 기타 방법: _________________

---

## 제공할 정보 양식

다음 정보를 작성하여 제공해주세요:

```
=== 호스팅케이알 서버 정보 ===

1. PHP 버전: [예: 7.4]
2. cURL 사용 가능: [예: 예 / 아니오]
3. allow_url_fopen: [예: On / Off]

4. FTP 호스트: [예: ftp.bcsa.co.kr]
5. FTP 포트: [예: 21]
6. FTP 사용자명: [예: username]
7. 웹 루트 디렉토리: [예: public_html]

8. 파일 업로드 방법: [예: FTP 클라이언트 / cPanel]
```

---

## 빠른 확인 방법

### PHP 버전 확인 스크립트

다음 내용으로 `check-php.php` 파일을 생성하고 서버에 업로드:

```php
<?php
echo "PHP Version: " . phpversion() . "\n";
echo "cURL: " . (function_exists('curl_init') ? '사용 가능' : '사용 불가') . "\n";
echo "allow_url_fopen: " . (ini_get('allow_url_fopen') ? 'On' : 'Off') . "\n";
?>
```

브라우저에서 접속하여 확인 후 삭제

---

## 다음 단계

정보를 제공해주시면:

1. ✅ PHP 프록시 스크립트가 이미 생성되어 있음 (`api-proxy.php`)
2. ✅ 클라이언트 코드 수정 완료
3. ⏳ PHP 파일을 호스팅케이알 서버에 업로드
4. ⏳ 테스트 및 확인

---

## 참고

- PHP 프록시 파일은 이미 프로젝트에 생성되어 있습니다
- 클라이언트 코드도 수정이 완료되었습니다
- 이제 PHP 파일만 서버에 업로드하면 됩니다
- 자세한 업로드 방법은 `HOSTING_PROXY_SETUP.md` 참조

