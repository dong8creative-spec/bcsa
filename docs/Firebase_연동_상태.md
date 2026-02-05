# Firebase 연동 상태 점검

## 1. 프로젝트 및 설정

| 항목 | 값 | 상태 |
|------|-----|------|
| 프로젝트 ID | `bcsa-b190f` | `.firebaserc`와 `firebase.js` 일치 |
| API Key | 설정됨 (firebase.js) | 하드코딩 |
| Auth 도메인 | `bcsa-b190f.firebaseapp.com` | OK |
| Storage 버킷 | `bcsa-b190f.firebasestorage.app` | OK |
| 환경 변수 | 없음 | Firebase 설정은 모두 `src/firebase.js`에 직접 정의 |

---

## 2. 사용 중인 Firebase 서비스

### 2.1 Authentication
- **파일**: `src/firebase.js` (getAuth), `src/services/authService.js`
- **용도**: 이메일/비밀번호 로그인·회원가입·로그아웃
- **상태**: 정상 연동 (signInWithEmailAndPassword, createUserWithEmailAndPassword 등 사용)

### 2.2 Firestore
- **파일**: `src/firebase.js` (getFirestore), `src/services/firebaseService.js`
- **사용 컬렉션**:
  - `users` — 회원 정보
  - `seminars` — 프로그램/세미나
  - `posts` — 커뮤니티 게시글·후기
  - `applications` — 프로그램 신청
  - `settings` — 앱 설정
  - `siteContent` — 사이트 콘텐츠
  - `searchLogs` — 검색 로그
  - `restaurants` — 맛집
  - `bookmarks` — 즐겨찾기 (루트 컬렉션)
  - `users/{userId}/bookmarks` — 사용자별 즐겨찾기 (서브컬렉션)

### 2.3 Storage
- **파일**: `src/firebase.js` (getStorage), `src/utils/imageUtils.js`
- **경로**: `images/{type}/{id}_{filename}` (type: program | content | community | company)
- **용도**: 프로그램/커뮤니티/마이페이지 등 이미지 업로드

### 2.4 Hosting & Functions
- **firebase.json**: hosting(public: dist), functions(source: functions, nodejs20), emulators 설정
- **배포**: `firebase deploy` 시 hosting, functions, rules 반영

---

## 3. 보안 규칙 (Rules)

### 3.1 Firestore (`firestore.rules`)
- **현재 정의된 규칙**: `users/{userId}/bookmarks/{bookmarkId}` 만 존재
  - `read, write`: `request.auth != null && request.auth.uid == userId`
- **주의**: `users`, `seminars`, `posts`, `applications`, `settings`, `siteContent`, `searchLogs`, `restaurants`, 루트 `bookmarks` 에 대한 규칙이 **파일에는 없음**.
  - 이 rules 파일을 그대로 배포하면 위 컬렉션들은 **규칙 불일치로 접근 거부**될 수 있음.
  - 콘솔에서만 규칙을 관리 중이거나, 아직 이 파일로 배포하지 않았다면 콘솔 규칙이 적용 중일 수 있음.

**권장**: Firestore 콘솔에서 현재 배포된 규칙 확인 후, 필요하면 `firestore.rules`에 위 컬렉션에 대한 read/write 규칙을 추가하고 다시 배포.

### 3.2 Storage (`storage.rules`)
- `images/**`
  - **read**: 모든 사용자 (`if true`)
  - **write**: 로그인 사용자만 (`if request.auth != null`)
- 이미지 업로드는 **Firebase 로그인 필수** (마스터 코드만으로는 업로드 불가).

---

## 4. 연동 요약

| 서비스 | 연동 | 비고 |
|--------|------|------|
| Firebase App (config) | ✅ | projectId bcsa-b190f |
| Auth | ✅ | 이메일/비밀번호 |
| Firestore | ⚠️ | 사용 중이지만 rules 파일에는 대부분 컬렉션 미정의 |
| Storage | ✅ | 읽기 공개, 쓰기 인증 필요 |
| Hosting/Functions | ✅ | firebase.json 설정됨 |

---

## 5. 확인 방법

1. **콘솔에서 Firestore 규칙 확인**  
   Firebase Console → Firestore Database → 규칙 탭에서 실제 배포된 규칙 확인.

2. **실제 동작 확인**  
   - 로그인 후 프로그램 목록/게시글 로드  
   - 이미지 업로드 (로그인 상태에서)  
   - 관리자 페이지에서 프로그램·게시글 저장  

3. **규칙 배포**  
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage
   ```
   `firestore.rules`를 수정했다면 위로 배포 후 다시 테스트.

---

*문서 생성: Firebase 연동 상태 점검*
