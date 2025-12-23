/**
 * 부산청년사업가들 웹사이트 설정 파일
 * Google Sheets 연동 URL 및 기본 설정
 * 
 * ====================================================================
 * 📋 설정 가이드 및 체크리스트
 * ====================================================================
 * 
 * 실제 운영 전에 다음 항목들을 반드시 확인하고 설정하세요:
 * 
 * ✅ 필수 설정 항목 (운영 전 반드시 완료)
 * 
 * [ ] 1. PortOne 가맹점 식별코드
 *        - 위치: CONFIG.PORTONE.IMP_CODE (현재: 'imp00000000')
 *        - 발급: https://admin.portone.io/ 에서 가맹점 식별코드 확인
 *        - 용도: 본인인증 및 결제 서비스
 *        - 상태: 설정하지 않으면 본인인증 기능이 작동하지 않습니다
 * 
 * [ ] 2. 관리자 계정 보안 설정
 *        - 위치: CONFIG.ADMIN
 *        - 관리자 비밀번호 변경 (현재: '1234')
 *        - 마스터 코드 변경 (현재: 'master9999')
 *        - 보안: 실제 운영 시 반드시 강력한 비밀번호로 변경하세요
 * 
 * ⚠️ 권장 설정 항목 (기능 향상을 위해 권장)
 * 
 * [ ] 3. 공공데이터포털 API 키
 *        - 위치: CONFIG.PUBLIC_DATA_API.API_KEY (현재: 빈 값)
 *        - 발급: https://www.data.go.kr/ → "사업자등록번호 진위확인" 검색 → API 신청
 *        - 용도: 사업자등록번호 실제 검증
 *        - 참고: 설정하지 않으면 형식 검증만 수행됩니다 (체크섬 검증)
 *        - 상태: 선택사항이지만 실제 사업자 검증을 위해 권장됩니다
 * 
 * [ ] 4. Google Sheets URL 확인
 *        - 위치: CONFIG.SHEET_URLS
 *        - MEMBER: 회원 데이터 시트 URL 확인
 *        - SEMINAR: 세미나 데이터 시트 URL 확인
 *        - FOOD: 맛집 데이터 시트 URL 확인
 *        - 참고: 각 시트가 공개 설정되어 있고 CSV 형식으로 공개되어 있는지 확인
 * 
 * 📝 설정 방법 상세 가이드
 * 
 * 1. PortOne 가맹점 식별코드 설정:
 *    - PortOne 대시보드(https://admin.portone.io/) 접속
 *    - 회원가입 또는 로그인
 *    - 대시보드에서 가맹점 식별코드 확인
 *    - CONFIG.PORTONE.IMP_CODE에 실제 코드 입력
 * 
 * 2. 공공데이터포털 API 키 설정:
 *    - 공공데이터포털(https://www.data.go.kr/) 접속
 *    - "사업자등록번호 진위확인" 검색
 *    - 원하는 API 선택 후 신청
 *    - 발급받은 Service Key를 CONFIG.PUBLIC_DATA_API.API_KEY에 입력
 * 
 * 3. 관리자 계정 보안:
 *    - CONFIG.ADMIN.PASSWORD를 강력한 비밀번호로 변경
 *    - CONFIG.ADMIN.MASTER_CODE를 복잡한 코드로 변경
 *    - 파일을 Git에 커밋하기 전에 .gitignore에 추가하거나 별도 관리
 * 
 * ====================================================================
 */

// Google Sheets CSV URL 설정
// 각 시트의 CSV 공개 URL을 설정합니다.
// Google Sheets에서 "파일 > 공유 > 웹에 게시" 후 CSV 형식으로 공개 URL을 복사하세요.
const CONFIG = {
    SHEET_URLS: {
        // 설정 시트 URL (현재 미사용, 향후 확장 가능)
        CONFIG: "", 
        // 회원 데이터 시트 URL
        MEMBER: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEmEPSeDn1EUcf0DQWJ1EJ3t4nonCL42odDnJn7j8kxAkxl2qJDsXs6mDnxX2tfBJusuNC8ULgWXt4/pub?output=csv", 
        // 세미나 데이터 시트 URL
        SEMINAR: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUgeDh3zYtSZ57dm1bVKKZIgYUaCjbCDE5ZxMI_EkzctTfKdT6_1KMI0nDT47MT_Flmp47zd8258Q7/pub?output=csv", 
        // 맛집 데이터 시트 URL
        FOOD: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4XbOCG-q4zXslRt9RhKYeDNqh2oPgwZP_Y1odlRpybG72n0K4Pb0YvXq9-O40_jYJSa8xadm9ZAUF/pub?output=csv", 
        // 게시글 데이터 시트 URL
        POSTS: "", // TODO: 게시글 시트 CSV 공개 URL을 설정하세요
        // 관리자 편집 페이지 링크 (실제 편집은 Google Sheets에서 직접 수행)
        ADMIN_EDIT: "https://docs.google.com/spreadsheets"
    },
    
    // Google Sheets 데이터 로딩 설정
    SHEET_LOADING: {
        ENABLED: true, // Google Sheets 데이터 로딩 활성화 여부
        CACHE_DURATION: 5 * 60 * 1000, // 캐시 지속 시간 (5분)
        RETRY_ATTEMPTS: 3, // 실패 시 재시도 횟수
        RETRY_DELAY: 1000 // 재시도 간 지연 시간 (1초)
    },
    
    // 기본 콘텐츠
    DEFAULT_CONTENT: {
        hero_title: "함께 성장하는\n청년 사업가 커뮤니티",
        hero_desc: "부산 지역 청년 사업가들이 모여 아이디어를 공유하고, 네트워킹하며 함께 성장해나가는 공간입니다.",
        stat_1_val: "200+", 
        stat_1_desc: "활동중인 사업가",
        stat_2_val: "80+", 
        stat_2_desc: "진행된 세미나",
        stat_3_val: "35+", 
        stat_3_desc: "투자 성공 사례",
        stat_4_val: "100%", 
        stat_4_desc: "성장 열정",
        cta_title: "사업의 꿈을 현실로!",
        cta_desc: "혼자 고민하지 마세요. 부산 최고의 청년 사업가들과 함께 당신의 비즈니스를 다음 단계로 끌어올리세요.",
        category_area_options: ["부산 전체", "해운대구 / IT", "부산진구 / 유통", "남구 / 금융"],
        category_activity_options: ["비즈니스 세미나", "투자 설명회", "네트워킹 파티", "멘토링"],
        category_target_options: ["예비/초기 창업가", "시리즈A 단계", "대학생", "일반인"],
    },
    
    // 관리자 설정
    // 실제 운영 시 반드시 비밀번호와 마스터 코드를 변경하세요
    ADMIN: {
        ID: 'admin', // 관리자 아이디
        PASSWORD: '1234', // 관리자 비밀번호 (변경 권장)
        MASTER_CODE: 'master9999' // 마스터 코드 (특수 기능 접근용, 변경 권장)
    },
    
    // PortOne (구 아임포트) 결제 및 본인인증 설정
    // 본인인증 기능을 사용하려면 반드시 설정해야 합니다
    PORTONE: {
        // PortOne 대시보드에서 발급받은 가맹점 식별코드
        // 발급 방법:
        // 1. https://admin.portone.io/ 에서 회원가입/로그인
        // 2. 대시보드에서 가맹점 식별코드 확인
        // 3. 아래 값에 실제 코드로 교체
        IMP_CODE: 'imp00000000' // TODO: 실제 가맹점 식별코드로 교체 필요
    },
    
    // ImgBB 이미지 업로드 API 키
    // 커뮤니티 게시글 및 후기 이미지 업로드에 사용됩니다
    IMGBB: {
        // ImgBB API 키 (https://api.imgbb.com/ 에서 발급 가능)
        API_KEY: '4c975214037cdf1889d5d02a01a7831d'
    },
    
    // 공공데이터포털 API 설정
    PUBLIC_DATA_API: {
        // 공공데이터포털(https://www.data.go.kr/)에서 발급받은 Service Key
        // 사업자등록번호 진위확인 서비스 API 키 필요
        // 발급 방법: https://www.data.go.kr/ → "사업자등록번호 진위확인" 검색 → API 신청
        API_KEY: '' // TODO: 실제 API 키로 교체 필요
    },
    
    // 나라장터 공공조달 입찰공고 API 설정
    G2B_API: {
        // 나라장터 공공조달 입찰공고 API 키
        // 발급 방법:
        // 1. https://www.data.go.kr/ 접속 및 로그인
        // 2. 상단 메뉴에서 "데이터셋" 선택
        // 3. 검색창에 "나라장터 공공조달 입찰공고" 또는 "BidPublicInfoService" 입력
        // 4. 검색 결과에서 "나라장터 공공조달 입찰공고정보 서비스" 선택
        // 5. "활용신청" 버튼 클릭하여 신청 (활용 목적 입력 필요)
        // 6. 승인 완료 후 마이페이지 > "내 데이터"에서 발급된 Service Key 확인
        // 7. 아래 API_KEY에 발급받은 Service Key 입력
        // 
        // 인증키 사용 관련 유의사항:
        // API 환경 또는 API 호출 조건에 따라 인증키가 적용되는 방식이 다를 수 있습니다.
        // 포털에서 제공되는 Encoding/Decoding 된 인증키를 적용하면서 구동되는 키를 사용하시기 바랍니다.
        API_KEY: '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b',
        // API 기본 URL
        // 공공데이터포털에서 제공하는 엔드포인트
        BASE_URL: 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService'
    },
    
    // EmailJS 설정 (아이디/비밀번호 찾기 기능용)
    EMAILJS: {
        // EmailJS 서비스 ID
        // 발급 방법:
        // 1. https://www.emailjs.com/ 접속 및 회원가입
        // 2. Email Service 추가 (Gmail, Outlook 등)
        // 3. Email Templates 생성:
        //    - 아이디 찾기 템플릿: {{user_id}} 변수 사용
        //    - 비밀번호 재설정 템플릿: {{temporary_password}} 변수 사용
        // 4. Integration > Browser에서 Public Key 확인
        // 5. 아래 값들에 실제 설정 값 입력
        SERVICE_ID: '', // TODO: EmailJS 서비스 ID로 교체 필요
        TEMPLATE_ID_FIND_ID: '', // TODO: 아이디 찾기 템플릿 ID로 교체 필요
        TEMPLATE_ID_RESET_PASSWORD: '', // TODO: 비밀번호 재설정 템플릿 ID로 교체 필요
        PUBLIC_KEY: '' // TODO: EmailJS Public Key로 교체 필요
    },
    
    // Google Apps Script 웹앱 설정 (공유 데이터베이스용)
    GOOGLE_APPS_SCRIPT: {
        // Google Apps Script 웹앱 URL
        // 설정 방법:
        // 1. Google Sheets에서 새 스프레드시트 생성
        // 2. 확장 프로그램 > Apps Script 클릭
        // 3. google-apps-script.gs 파일의 코드를 복사하여 붙여넣기
        // 4. SPREADSHEET_ID를 실제 스프레드시트 ID로 변경
        // 5. 배포 > 새 배포 > 웹 앱으로 배포
        // 6. 실행 권한 설정 (본인 계정으로 실행)
        // 7. 배포 후 받은 웹앱 URL을 아래에 입력
        WEB_APP_URL: '', // TODO: Google Apps Script 웹앱 URL로 교체 필요
        
        // Google Sheets 스프레드시트 ID
        // Google Sheets URL에서 추출: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
        SPREADSHEET_ID: '' // TODO: Google Sheets 스프레드시트 ID로 교체 필요
    }
};

