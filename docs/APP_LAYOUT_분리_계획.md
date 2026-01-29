# App.jsx 메인 return → AppLayout 분리 계획

## 목적
- App.jsx의 메인 `return` JSX(약 3248~3844줄)를 `AppLayout.jsx`로 분리하여 파일 크기 축소
- esbuild 파싱 오류(닫는 `</div>` 1개 부족) 해소 및 유지보수성 향상

---

## 1. 범위 확인

### 추출 대상
- **파일**: `src/App.jsx`
- **시작**: 3248줄 `return (` 다음의 `<div className="min-h-screen ...">` 부터
- **끝**: 3843줄 `</div>` (루트 div 닫기) 까지
- **제외**: 3248줄의 `return (` 와 3844줄의 `);` 는 App.jsx에 유지

### 추출 후 App.jsx 구조
```jsx
// App.jsx
return (
    <AppLayout
        popupPrograms={popupPrograms}
        closePopupAndMarkAsShown={closePopupAndMarkAsShown}
        handleProgramAlertConfirm={handleProgramAlertConfirm}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        handleNavigation={handleNavigation}
        menuEnabled={menuEnabled}
        menuNames={menuNames}
        menuOrder={menuOrder}
        // ... (아래 props 목록 참고)
    />
);
```

---

## 2. AppLayout이 받을 props 목록

아래는 App 컴포넌트 내부에서 메인 return JSX가 사용하는 상태/함수들입니다.  
이름만 나열하며, 타입은 기존 App.jsx 정의를 그대로 옮기면 됩니다.

### 팝업·모달 관련
- `popupPrograms`, `closePopupAndMarkAsShown`, `handleProgramAlertConfirm`
- `applySeminarFromPopup`, `setApplySeminarFromPopup`, `closePopupAndMarkAsShown`
- `isApplyModalOpen`, `setIsApplyModalOpen`, `handleProgramApply`, `handleProgramAlertConfirm`

### 메뉴·네비게이션
- `isMenuOpen`, `setIsMenuOpen`, `handleNavigation`
- `menuEnabled`, `menuNames`, `menuOrder`

### 로그인·회원
- `currentUser`, `setShowLoginModal`, `setShowSignUpModal`
- `setIsInquiryModalOpen`

### 콘텐츠·데이터
- `content` (홈 화면 콘텐츠)
- `seminarsData`, `communityPosts`, `restaurantsData`, `membersData` 등 뷰에 필요한 데이터

### 기타 상태·핸들러
- `scrolled`, `setCurrentView`, `pageTitles`
- `handleCommunityCreate`, `handleCommunityDelete`, `handleCommunityUpdate`
- `openKakaoPlacesSearch`, `setReviewSeminar` 등  
(실제 JSX에서 참조하는 변수/함수만 골라서 props로 전달)

---

## 3. 작업 단계

### Step 1: AppLayout.jsx 파일 생성
1. `src/components/AppLayout.jsx` 생성
2. 상단에 React import 및 필요한 자식 컴포넌트/아이콘 import
   - 예: `PageTitle`, `Icons`, `MobileMenu`, `CommunityView`, `RestaurantsListView` 등 메인 return에서 쓰는 컴포넌트
3. 함수 시그니처 작성:
   ```jsx
   const AppLayout = (props) => {
       const {
           popupPrograms,
           closePopupAndMarkAsShown,
           // ... 위 props 목록 전부 구조분해
       } = props;
       return (
           <div className="min-h-screen bg-white text-dark font-sans ...">
               {/* 3249~3843줄 내용 그대로 이동 */}
           </div>
       );
   };
   export default AppLayout;
   ```

### Step 2: App.jsx에서 JSX 잘라내기
1. 3249줄 `<div className="min-h-screen ...">` 부터 3843줄 `</div>` 까지 **잘라내기** (삭제)
2. 잘라낸 블록은 Step 1에서 만든 AppLayout.jsx의 `return (` 안에 **붙여넣기**
3. 붙여넣은 JSX 안에서 사용하는 모든 변수/함수가 AppLayout의 props(또는 props에서 구조분해한 이름)로 존재하는지 확인

### Step 3: App.jsx에 AppLayout 사용
1. App.jsx 상단에 추가:
   ```jsx
   import AppLayout from './components/AppLayout';
   ```
2. 기존 `return (` ~ `);` 를 다음으로 교체:
   ```jsx
   return (
       <AppLayout
           popupPrograms={popupPrograms}
           closePopupAndMarkAsShown={closePopupAndMarkAsShown}
           handleProgramAlertConfirm={handleProgramAlertConfirm}
           isMenuOpen={isMenuOpen}
           setIsMenuOpen={setIsMenuOpen}
           handleNavigation={handleNavigation}
           menuEnabled={menuEnabled}
           menuNames={menuNames}
           menuOrder={menuOrder}
           currentUser={currentUser}
           setShowLoginModal={setShowLoginModal}
           setShowSignUpModal={setShowSignUpModal}
           setIsInquiryModalOpen={setIsInquiryModalOpen}
           content={content}
           pageTitles={pageTitles}
           // ... (메인 return에서 참조하는 나머지 전부)
       />
   );
   ```
3. App.jsx에서 사용하는 변수/함수 이름과 AppLayout props 이름이 일치하는지 확인

### Step 4: props 목록 정확히 맞추기
1. AppLayout.jsx 안의 JSX에서 참조하는 이름을 모두 나열
2. 그 이름이 모두 `props`에서 오는지 확인 (없으면 App.jsx에서 해당 prop 전달 추가)
3. 전달하지 않아도 되는 것(예: 상수, import한 컴포넌트)은 제외

### Step 5: 빌드 및 동작 확인
1. `npm run build` 실행하여 esbuild 오류 해소 여부 확인
2. `npm run dev` 로 실행 후 홈/메뉴/팝업/모달 등 메인 플로우 클릭으로 확인

---

## 4. 주의사항

- **상태/함수는 App에 유지**: `useState`, `useEffect`, 이벤트 핸들러 등은 그대로 App.jsx에 두고, 필요한 것만 props로 AppLayout에 넘깁니다.
- **자식 컴포넌트 import**: AppLayout에서 쓰는 뷰/모달 컴포넌트는 AppLayout.jsx에서 import합니다 (예: `CommunityView`, `RestaurantsListView`, `MobileMenu` 등).
- **renderView 등 함수**: `renderView`처럼 메인 return 전에 정의된 함수는 App.jsx에 두고, `renderView` 자체를 props로 넘기거나, AppLayout에 넘긴 데이터/핸들러로 AppLayout 안에서 동일 로직을 구성할 수 있습니다. (선택: renderView를 prop으로 넘기면 App 수정 최소화)

---

## 5. 예상 결과

- App.jsx: 약 600줄 수준으로 축소 (상태/effect/핸들러 + `return <AppLayout ... />` 위주)
- AppLayout.jsx: 약 600줄 (메인 JSX 블록)
- `<div>` / `</div>` 개수가 각 파일 내에서 균형 맞아 esbuild 파싱 오류 해소
- 빌드 성공: `npm run build` 통과

---

## 6. (선택) renderView 처리

현재 App에서는 `renderView()`가 뷰별 JSX를 반환합니다. 선택지는 두 가지입니다.

- **A. renderView를 그대로 App에 두고, 반환값만 AppLayout으로 전달**  
  - 예: `renderView()` 결과를 state나 변수에 담아 `<AppLayout mainContent={renderView()} ... />` 처럼 넘김  
  - AppLayout은 `mainContent`만 받아서 메인 영역에 렌더링.

- **B. renderView 로직을 AppLayout 안으로 이동**  
  - App에서 view 관련 state/핸들러만 AppLayout에 props로 넘기고, AppLayout 내부에서 `currentView` 등에 따라 JSX 분기.  
  - App.jsx 수정은 적지만 AppLayout이 커질 수 있음.

권장: **A**로 진행하면 기존 구조를 최소로 바꾸면서 분리할 수 있습니다.

---

이 계획서대로 진행하면 App.jsx 메인 return을 AppLayout으로 분리하고, 빌드 오류를 해소할 수 있습니다.
