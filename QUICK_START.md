# 🚀 빠른 배포 시작 가이드

> 호스팅케이알 배포를 위한 간단한 체크리스트

---

## ⚡ 5분 요약

### 1️⃣ Firebase Functions 배포
```bash
# Firebase 로그인
firebase login

# Functions 배포
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 2️⃣ Firebase Console 설정
- **환경 변수 설정**:
  - `G2B_API_KEY` = `05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b`
  - `ALLOWED_ORIGINS` = `https://호스팅케이알도메인.com,https://www.호스팅케이알도메인.com,https://bcsa.co.kr`

- **Firestore 인덱스 생성** (북마크 2개)

### 3️⃣ GitHub 푸시
```bash
git add .
git commit -m "배포 준비"
git push origin main
```

### 4️⃣ 호스팅케이알 FTP 업로드
- 모든 파일 업로드 (FTP 클라이언트 사용)
- `assets/js/config.js`, `firebase-config.js` 직접 업로드

### 5️⃣ 테스트
- 호스팅케이알 도메인에서 입찰공고 검색 테스트

---

## 📋 상세 가이드

자세한 설명은 **`DEPLOYMENT_GUIDE.md`** 파일을 참고하세요.

---

## ⚠️ 주의사항

1. **민감한 파일은 GitHub에 업로드하지 마세요**
   - `assets/js/config.js`
   - `assets/js/firebase-config.js`

2. **호스팅케이알 도메인을 CORS에 추가하세요**
   - Firebase Console > Functions > 설정 > 환경 변수
   - `ALLOWED_ORIGINS`에 도메인 추가 후 Functions 재배포

3. **Firestore 인덱스는 필수입니다**
   - 북마크 기능 작동을 위해 반드시 생성 필요

---

## 🆘 문제 발생 시

자세한 문제 해결 방법은 **`DEPLOYMENT_GUIDE.md`**의 "문제 해결 가이드" 섹션을 참고하세요.

