# apibid 배포 실패 "Image not found" 해결 가이드

**에러 메시지:**  
`Image 'asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1' not found.`

이 문서는 위 에러가 뭔지, 왜 나는지, 어떻게 고치는지를 **처음 쓰시는 분도 따라 할 수 있게** 단계별로 정리한 가이드입니다.

---

## 1. 에러가 뭔지 쉽게 이해하기

### 비유로 이해하기

- **배포** = "이 컨테이너 이미지로 서버를 켜라"고 GCP에 시키는 것
- **이미지** = 서버가 실행할 "설치 파일" 같은 것 (Docker 이미지)
- **에러** = "그 설치 파일(이미지)을 찾을 수 없다"

즉, **"version_1 이라는 이름의 이미지를 쓰라고 했는데, 그 이름의 이미지가 저장소에 없다"**는 뜻입니다.

### 실제로 일어나는 일

1. GCP가 apibid 서비스를 새 버전으로 배포하려고 함
2. 설정에 적힌 이미지 주소:  
   `asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1`
3. GCP가 그 주소로 이미지를 찾으려 함
4. **해당 저장소에 그 이름·태그의 이미지가 없어서** "not found" 로 배포 실패

그래서 해결책은 둘 중 하나입니다.

- **방법 A:** 그 이미지를 **직접 만들어서(빌드)** 저장소에 **올리기(푸시)** 한 뒤, 다시 배포
- **방법 B:** 이미 다른 이름/태그로 올라가 있는 이미지가 있다면, **배포 설정을 그 이미지 주소로 바꾸기**

아래는 방법 A·B를 초보자도 따라 할 수 있게 단계별로 쓴 것입니다.

---

## 2. 먼저 확인할 것: 이미지가 정말 없는지

GCP 콘솔에서 "이미지 저장소"에 들어가서, 해당 이미지(이름·태그)가 있는지 확인합니다.

### 2-1. GCP 콘솔 접속

1. 브라우저에서 **https://console.cloud.google.com** 접속
2. 로그인 후, **프로젝트 선택**에서 **bcsa-b190f** 선택

### 2-2. Artifact Registry 열기

1. 왼쪽 메뉴(☰) 클릭
2. **"Artifact Registry"** 검색 후 클릭  
   (또는: 빌드 → Artifact Registry)
3. **"저장소"** 탭 선택

### 2-3. 저장소와 이미지 확인

1. 목록에서 **gcf-artifacts** 저장소 클릭
2. 그 안에 **bcsa-b190f_asia-northeast3_api_bid** 같은 이름의 이미지가 있는지 확인
3. 있으면 **태그**를 봅니다:  
   - `version_1` 이 있는지  
   - 없으면 `latest` 나 `sha-xxxx` 같은 다른 태그가 있는지

**정리:**

- **이미지 자체가 없음** → 방법 A (빌드 후 푸시) 필요
- **이미지는 있는데 태그가 `version_1` 이 아님** → 방법 B (배포 설정에서 이미지 주소/태그를 실제 있는 걸로 변경) 또는 방법 A에서 `version_1` 태그로 푸시

---

## 3. 방법 A: 이미지를 직접 빌드해서 올리기

"이미지가 없다"고 나오는 경우, **누군가 그 이미지를 빌드하고 Artifact Registry에 푸시**해 줘야 합니다.

### 3-1. 이미지가 어디서 만들어지는지 찾기

- 이 **bcsa** 저장소에는 **프론트(GitHub Pages)** 배포만 있고, **apibid용 Docker 이미지를 빌드하는 코드/워크플로는 없을 수 있습니다.**
- apibid는 **다른 저장소**이거나 **GCP Cloud Build** 등 다른 파이프라인에서 빌드할 수 있습니다.

**확인할 것:**

1. **다른 GitHub 저장소**  
   - bcsa-b190f / API / apibid 같은 이름의 **별도 저장소**가 있는지
   - 그 저장소에 `Dockerfile` 이나 `cloudbuild.yaml` 이 있는지
2. **GCP Cloud Build**  
   - 콘솔에서: 빌드 → Cloud Build → 기록  
   - apibid 또는 api_bid 관련 **트리거/빌드 기록**이 있는지  
   - **자세한 단계는 아래 "3-1-2. GCP Cloud Build 트리거·빌드 기록 확인 (상세)" 참고**
3. **팀 내부**  
   - "apibid 백엔드는 어디서 배포하나요? Docker 이미지는 어디서 빌드하나요?" 로 한 번만 확인

#### 3-1-2. GCP Cloud Build 트리거·빌드 기록 확인 (상세)

**트리거**와 **빌드 기록**이 뭔지 먼저 이해하면 좋습니다.

- **빌드 기록**: "과거에 실행된 빌드 작업들의 목록"입니다. 수동으로 돌린 빌드나, 트리거에 의해 자동으로 돌아간 빌드가 모두 여기 나옵니다.
- **트리거**: "특정 조건(예: GitHub에 푸시, 수동 실행)이 되면 자동으로 빌드를 실행하는 설정"입니다. 트리거가 있으면, 그 트리거가 어떤 저장소/브랜치에서 어떤 이미지를 빌드·푸시하는지 확인할 수 있습니다.

**단계 1: GCP 콘솔에서 Cloud Build 열기**

1. 브라우저에서 **https://console.cloud.google.com** 접속 후 로그인
2. 상단 프로젝트 선택에서 **bcsa-b190f** 선택
3. 왼쪽 **햄버거 메뉴(≡)** 클릭
4. **"빌드"** 또는 **"Build"** 항목 찾기  
   - 없으면 상단 검색창에 **"Cloud Build"** 입력 후 **Cloud Build** 선택
5. **Cloud Build** 메뉴 안에 보통 다음이 있습니다:
   - **기록** (History)
   - **트리거** (Triggers)

**단계 2: 빌드 기록에서 apibid 관련 빌드 찾기**

1. 왼쪽에서 **「기록」(History)** 클릭
2. 목록에 나오는 **각 빌드**를 하나씩 클릭해서 열어봅니다
3. 다음을 확인합니다:
   - **빌드 ID / 제목**: apibid, api_bid, bcsa, API 등 관련 키워드가 들어 있는지
   - **상태**: 성공(초록) / 실패(빨강) / 진행 중
   - **단계(Steps)** 또는 **로그**:  
     - "docker build", "gcr.io", "artifact registry", "api_bid" 같은 단어가 있는지  
     - 이미지 이름에 `bcsa-b190f_asia-northeast3_api_bid` 가 포함돼 있는지
4. **관련 빌드가 있으면**:  
   - 그 빌드가 **어떤 소스(저장소·브랜치)**에서 실행됐는지  
   - **어떤 이미지 이름·태그**로 푸시하도록 설정돼 있는지  
   를 로그/단계에서 확인합니다.  
   푸시 이미지가 `version_1` 이 아니면, 그 트리거나 설정을 `version_1` 로 푸시하도록 바꾸거나, 배포 설정을 그 빌드가 푸시하는 태그에 맞추면 됩니다.
5. **관련 빌드가 전혀 없으면**:  
   - apibid 이미지는 아직 이 프로젝트의 Cloud Build로는 한 번도 빌드된 적이 없다는 뜻일 수 있습니다.  
   - 다른 저장소·다른 파이프라인에서 빌드하거나, **트리거**를 새로 만들어야 할 수 있습니다.

**단계 3: 트리거에서 apibid 관련 자동 빌드 찾기**

1. Cloud Build 왼쪽 메뉴에서 **「트리거」(Triggers)** 클릭
2. 프로젝트에 등록된 **트리거 목록**이 나옵니다
3. 각 트리거 이름/설명을 보면서 다음을 확인합니다:
   - **이름**: apibid, api_bid, bcsa, API 등이 들어 있는지
   - **연결된 저장소**: 어떤 GitHub/Cloud Source 저장소인지
   - **구성**: "Dockerfile" / "cloudbuild.yaml" 등 어떤 방식으로 빌드하는지
4. **관련 트리거가 있으면**:  
   - 해당 트리거 클릭 → **편집**  
   - **이미지(태그)** 설정 부분에서, 푸시되는 이미지가  
     `asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1`  
     와 같은지 확인  
   - 다르면 **같게 수정**한 뒤 트리거를 **수동 실행**해 보거나, 연결된 저장소에 커밋을 푸시해서 빌드가 한 번 돌게 합니다.
5. **관련 트리거가 없으면**:  
   - "저장소에 푸시하면 자동으로 apibid 이미지를 빌드하는 설정"은 없다는 뜻입니다.  
   - **새 트리거**를 만들어서 apibid 소스와 Dockerfile(또는 cloudbuild.yaml)로 빌드·푸시하도록 설정하거나,  
   - **수동 빌드**를 한 번 제출해서 이미지를 만든 뒤, 그 이미지로 배포하는 방식으로 진행할 수 있습니다.

**정리**

- **기록**에서 apibid/api_bid 관련 빌드가 보이면 → 그 빌드(또는 같은 설정의 트리거)가 **어떤 이미지**를 **어디에** 푸시하는지 확인하고, 필요하면 태그를 `version_1` 로 맞추거나 배포 설정을 그 태그에 맞춥니다.
- **트리거**에 apibid 관련 항목이 있으면 → 그 트리거를 한 번 실행해서 이미지를 만들고, 푸시 이미지가 `version_1` 이 아니면 설정을 수정한 뒤 다시 실행합니다.
- **기록·트리거 둘 다 관련 게 없으면** → 이 프로젝트에서는 apibid 이미지를 아직 Cloud Build로 안 만들고 있는 것이므로, 새 트리거 추가 또는 수동 빌드(또는 다른 파이프라인)로 이미지를 처음부터 만들어야 합니다.

---

빌드하는 곳을 찾으면, 그 파이프라인/스크립트가  
`asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1`  
(또는 동일 저장소·이미지명에 `version_1` 태그)로 푸시하도록 되어 있는지 확인하면 됩니다.

### 3-2. GCP에서 직접 빌드·푸시하는 경우 (Cloud Build 예시)

이미지 빌드가 **GCP Cloud Build**로 되어 있다면, 대략 다음 순서입니다.

1. **Cloud Build 사용 설정**
   - GCP 콘솔 → API 및 서비스 → 라이브러리  
   - "Cloud Build API" 검색 후 사용 설정

2. **소스 코드 위치**
   - apibid **소스 코드**(Dockerfile이 있는 폴더)가 있는 곳:  
     GitHub 저장소 또는 GCP Cloud Source Repositories

3. **빌드 설정**
   - Cloud Build → 트리거 또는 "수동 제출"
   - 이미지 이름을 다음처럼 맞춤:  
     `asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1`  
   - 태그를 **version_1** 로 지정해서 푸시

4. **권한**
   - Cloud Build 서비스 계정에  
     "Artifact Registry 쓰기" 권한이 있어야 푸시 가능  
   - Artifact Registry → gcf-artifacts 저장소 → 권한에서  
     Cloud Build 기본 서비스 계정에 **작성자** 역할이 있는지 확인

빌드가 한 번 성공하면, Artifact Registry에 이미지가 생기므로, 그다음에 apibid 배포를 다시 시도하면 "Image not found"가 사라질 수 있습니다.

### 3-3. 로컬에서 Docker로 빌드·푸시하는 경우 (고급)

- apibid용 **Dockerfile**이 있는 프로젝트를 로컬에 클론
- `gcloud auth configure-docker asia-northeast3-docker.pkg.dev` 로 레지스트리 로그인
- `docker build` 후  
  `docker push asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:version_1`  
  로 푸시

이 경우에도 **최종 이미지 주소와 태그**가 배포 설정과 **완전히 같아야** 합니다.

---

## 4. 방법 B: 배포 설정을 "이미 있는 이미지"로 바꾸기

이미 **다른 태그**(예: `latest`, `sha-abc123`)로 같은 이미지가 저장소에 올라가 있다면,  
**배포할 때 쓰는 이미지 주소만** 그쪽으로 바꾸면 됩니다.

### 4-1. 실제로 있는 이미지 주소 확인

1. GCP 콘솔 → **Artifact Registry** → **gcf-artifacts**
2. **bcsa-b190f_asia-northeast3_api_bid** 이미지 클릭
3. **태그** 탭에서 실제로 있는 태그 확인 (예: `latest`, `v1.0`, `sha-xxxx`)

예:  
`asia-northeast3-docker.pkg.dev/bcsa-b190f/gcf-artifacts/bcsa-b190f_asia-northeast3_api_bid:latest`

### 4-2. Cloud Functions/Cloud Run 배포 설정에서 이미지 변경

apibid가 **Cloud Functions (Gen2)** 로 배포되어 있다면:

1. GCP 콘솔 → **Cloud Functions** (또는 **서버리스** 메뉴)
2. **apibid** 함수(서비스) 선택
3. **편집** 또는 **새 리비전 배포** 들어가기
4. **컨테이너 이미지** 설정에서  
   - 기존: `...api_bid:version_1`  
   - 변경: Artifact Registry에 **실제 있는** 이미지 주소·태그로 수정  
     (예: `...api_bid:latest`)
5. 저장 후 배포

이렇게 하면 "없는 이미지" 대신 "있는 이미지"를 쓰게 되어, "Image not found" 에러가 해결됩니다.

---

## 5. 요약 체크리스트

- [ ] GCP 콘솔에서 **bcsa-b190f** 프로젝트 선택
- [ ] **Artifact Registry** → **gcf-artifacts** 에서  
      `bcsa-b190f_asia-northeast3_api_bid` 이미지 존재 여부 확인
- [ ] **태그** 확인: `version_1` 이 있는지, 없으면 어떤 태그가 있는지
- [ ] **이미지가 없으면 (방법 A)**  
  - apibid 이미지를 빌드·푸시하는 **위치**(다른 repo, Cloud Build 등) 찾기  
  - 그 파이프라인에서 **version_1** 태그로 푸시하거나,  
  - 수동으로 한 번 빌드·푸시 후 배포 재시도
- [ ] **이미지는 있는데 태그만 다르면 (방법 B)**  
  - 배포 설정의 이미지 주소를 **실제 있는 이미지·태그**로 변경

---

## 6. 참고: 이 저장소(bcsa)와의 관계

- 이 **bcsa** 저장소의 `deploy.yml` 은 **프론트엔드(GitHub Pages)** 만 배포합니다.
- **apibid** 백엔드(카카오 콜백 등 API)는 **별도 서비스**이며,  
  이미지 빌드/푸시는 **다른 저장소** 또는 **GCP Cloud Build/트리거**에서 이뤄질 가능성이 큽니다.
- 따라서 "Image not found" 해결은 **apibid를 배포하는 쪽**(다른 repo, GCP 설정)에서 진행하는 것이 맞고,  
  이 가이드는 그 작업을 **초보자도 단계별로 따라 할 수 있게** 정리한 것입니다.

추가로, 카카오 로그인 등에 쓰는 API 주소가  
`https://apibid-oytjv32jna-du.a.run.app` (Cloud Run) 이라면,  
지금 실패한 건 **Cloud Functions 쪽 apibid**일 수 있어,  
실제 사용 중인 서비스가 Cloud Run 이라면 그 서비스는 별도로 배포/확인하면 됩니다.
