# 프로그램 신청 시 "필수항목 미기입" 오류 정정 계획

## 1. 현상 정리

- **증상**: 프로그램 신청자가 참여 경로·식사 여부·개인정보 동의 등 신청서 필수 항목을 모두 입력하고 신청을 완료했는데도, "필수항목을 기입하지 않았다"는 식의 오류가 발생한다는 제보.
- **의도**: 신청 폼의 필수 항목을 다 채웠음에도 오류가 나는 원인을 찾고, 필요한 경우만 안내되도록 수정.

---

## 2. 오류 가능 원인 (코드 기준)

### 2-1. **신청서 payload의 연락처/이메일 누락**

- **위치**: `src/App.jsx` 내 `handleSeminarApply`
- **내용**: `application` 객체의 `userPhone`, `userEmail`을 아래처럼만 채움.
  - `userPhone: currentUser.phone || ''`
  - `userEmail: currentUser.email` (이메일은 보통 한 필드만 사용)
- **문제**: Firestore/가입 플로우에서는 `phone` / `phoneNumber` / `verifiedPhone` 등 여러 필드가 쓰일 수 있음. `currentUser.phone`만 보면 일부 회원은 연락처가 비어 있고, 이 상태로 제출 시:
  - Google Sheets 등 외부 API에서 “필수항목 미기입”으로 거부하거나,
  - 나중에 “필수 회원정보 입력 안내”와 혼동될 수 있음.

### 2-2. **“필수 회원정보 입력 안내” 모달과의 혼동**

- **위치**: `src/components/AppLayout.jsx`
- **내용**: `isProfileIncomplete(currentUser)`가 true이면 "필수 회원정보가 입력되지 않았습니다. 서비스 이용을 위해 마이페이지에서 입력해 주세요." 모달 표시.
- **문제**: 사용자는 “신청서 필수 항목”을 채웠다고 생각하는데, 실제로는 **회원 프로필(마이페이지) 필수 항목**이 비어 있어 모달이 뜨는 경우일 수 있음. 이때 사용자가 “필수항목을 기입하지 않았다”고 표현할 수 있음.
- **추가**: `isProfileIncomplete`는 이미 이전에 수정되었으나, 연락처 검사가 `phone`/`phoneNumber`/`verifiedPhone` 중 일부만 보거나, 형식(11자리 01x 등)이 엄격하면 “실제로는 다 채웠는데 불완전”으로 나올 여지가 있음.

### 2-3. **Sheets API 응답 메시지 미반영**

- **위치**: `src/App.jsx` — `addSeminarApplicationToSheet` 호출 후
- **내용**: `result.success === false`일 때 무조건 `'신청 저장에 실패했습니다. 다시 시도해주세요.'`만 표시.
- **문제**: 서버/스크립트에서 "필수항목을 기입하지 않았습니다" 같은 메시지를 `result.error` 등으로 내려줘도, 클라이언트에서 사용하지 않아 사용자가 원인을 알기 어려움.

### 2-4. **신청 제출 전 연락처/이메일 검증 부재**

- **위치**: `src/App.jsx` — `handleSeminarApply` 내부
- **내용**: `currentUser` 기준으로 `application`을 만들기만 하고, `userName`/`userEmail`/`userPhone`이 비어 있어도 그대로 제출 시도.
- **문제**: 백엔드에서 거부되기 전에, “신청서 제출에 필요한 연락처/이메일이 없음”을 먼저 알려주는 검사가 없음.

---

## 3. 정정 방향 (수정 계획)

### 3-1. 신청서 payload 연락처/이메일 수집 통일

- **파일**: `src/App.jsx` — `handleSeminarApply` 내 `application` 객체 및 `firebaseService.createApplication` 인자.
- **내용**:
  - `userPhone`: `currentUser.phone || currentUser.phoneNumber || currentUser.verifiedPhone || ''` 로 통일.
  - `userEmail`: `currentUser.email` 유지. (다른 필드가 있다면 동일 방식으로 fallback 추가.)
- **목적**: 실제로 저장된 연락처가 `phoneNumber`/`verifiedPhone`에만 있어도 신청서에 포함되도록 하여, “필수항목 미기입”이 연락처 누락 때문에 나오지 않도록 함.

### 3-2. 신청 제출 전 필수 값 검증 및 안내 문구 명확화

- **파일**: `src/App.jsx` — `handleSeminarApply` 상단(신청 정보 저장 직전).
- **내용**:
  - 위와 동일한 규칙으로 `userPhone`, `userEmail`, `userName`을 한 번 계산.
  - 이 중 **신청서 제출에 필수**인 항목(이름, 이메일, 연락처)이 비어 있으면:
    - 제출하지 않고,
    - `alert` 등으로 **“프로그램 신청을 위해 마이페이지에서 이름·연락처·이메일을 입력해 주세요”** 같은 문구로 안내.
  - 이렇게 하면 “신청서 폼”이 아니라 “회원 프로필(마이페이지) 필수 항목” 문제임을 사용자에게 분리해서 전달 가능.

### 3-3. Sheets(또는 외부 API) 오류 메시지 노출

- **파일**: `src/App.jsx` — `addSeminarApplicationToSheet` 호출 후 `!result.success` 분기.
- **내용**:
  - `result.error`(또는 서버에서 내려주는 메시지 필드)가 있으면 그 내용을 `alert`에 포함.
  - 예: `alert(result.error || '신청 저장에 실패했습니다. 다시 시도해주세요.');`
- **목적**: 서버가 “필수항목을 기입하지 않았습니다” 등을 반환하면 사용자에게 그대로 보여 주어, 원인 파악이 쉽게 함.

### 3-4. (선택) 프로그램 신청 페이지에서의 “필수 회원정보” 안내 분리

- **파일**: `src/components/AppLayout.jsx` 또는 프로그램 신청 뷰.
- **내용**:
  - 프로그램 신청 페이지(또는 신청 플로우)일 때, `isProfileIncomplete`가 true이면:
    - 기존과 동일한 모달을 띄우되, 문구를 **“프로그램 신청을 완료하려면 마이페이지에서 필수 회원정보(연락처·이메일 등)를 먼저 입력해 주세요”**처럼 “신청 완료”와 연계된 메시지로 바꾸거나,
    - 또는 신청 제출 시점에만 위 3-2 검증으로 “마이페이지에서 입력해 주세요”로 유도하고, 모달은 다른 페이지에서만 띄우는 방식 검토.
- **목적**: “신청서 필수 항목”과 “회원 프로필 필수 항목”을 사용자 인지상 더 명확히 구분.

### 3-5. isProfileIncomplete 연락처 검사 재확인

- **파일**: `src/components/AppLayout.jsx` — `isProfileIncomplete`.
- **내용**:
  - 연락처 검사 시 `user.phone || user.phoneNumber || user.verifiedPhone`를 모두 반영하고 있는지 확인.
  - 이미 반영되어 있다면, `verifiedPhone` 형식(11자리 01x)이 실제 저장 형식과 맞는지 확인. 필요 시 숫자만 추출해 11자리·01x 여부만 보는 등 유연하게 조정.
- **목적**: 실제로 프로필을 다 채운 회원에게는 “필수 회원정보 입력 안내”가 뜨지 않도록 해, “필수항목 미기입” 혼동을 줄임.

---

## 4. 수정 순서 제안

1. **3-1**  
   `handleSeminarApply`에서 `userPhone`(및 필요 시 `userEmail`) 수집 로직을 `phone`/`phoneNumber`/`verifiedPhone`(및 이메일 fallback) 반영하도록 수정.
2. **3-2**  
   동일 함수 상단에서 “신청 제출에 필요한 이름·연락처·이메일” 검증 추가 및 부족 시 마이페이지 안내 메시지로 중단.
3. **3-3**  
   `addSeminarApplicationToSheet` 실패 시 `result.error` 등 서버 메시지를 alert에 포함.
4. **3-5**  
   `isProfileIncomplete` 연락처(및 필요 시 이메일) 검사 재검토 및 필요 시 완화/통일.
5. **3-4**  
   필요 시 프로그램 신청 화면/플로우에서만 “필수 회원정보” 문구를 신청 완료와 연계되도록 조정.

---

## 5. 검증 포인트

- 회원 프로필에 연락처가 `phone` / `phoneNumber` / `verifiedPhone` 중 한 필드에만 있어도 프로그램 신청 시 `userPhone`이 채워져 제출되는지.
- 연락처 또는 이메일이 비어 있는 회원이 신청 버튼을 눌렀을 때, “마이페이지에서 이름·연락처·이메일을 입력해 주세요” 등으로만 안내되고, “신청서 필수 항목”이 아니라 “회원 정보” 문제임이 드러나는지.
- Sheets(또는 외부 API)가 “필수항목 미기입” 메시지를 반환할 경우, 해당 문구가 그대로 사용자에게 노출되는지.
- 프로필을 모두 채운 회원에게는 “필수 회원정보 입력 안내” 모달이 뜨지 않는지.

---

## 6. 요약

- **원인**: (1) 신청서에 넣는 연락처가 `currentUser.phone`만 사용되어 `phoneNumber`/`verifiedPhone`이 반영되지 않음, (2) “필수 회원정보” 모달과 “신청서 필수 항목”이 사용자에게 혼동됨, (3) 외부 API 오류 메시지 미노출, (4) 제출 전 연락처/이메일 검증 없음.
- **정정**: 연락처/이메일 수집 통일, 제출 전 필수 값 검증 및 문구 명확화, API 오류 메시지 노출, `isProfileIncomplete` 재확인. 필요 시 프로그램 신청 시에만 “필수 회원정보” 문구를 신청 완료와 연계해 안내.
