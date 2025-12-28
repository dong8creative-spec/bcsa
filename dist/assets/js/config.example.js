/**
 * 부산청년사업가들 웹사이트 설정 파일 (예제)
 * 
 * 이 파일을 복사하여 config.js로 이름을 변경하고 실제 값으로 채워주세요.
 * 
 * 사용 방법:
 * 1. 이 파일을 복사하여 assets/js/config.js 생성
 * 2. 아래의 플레이스홀더 값들을 실제 값으로 교체
 * 3. config.js는 .gitignore에 포함되어 있어 Git에 커밋되지 않습니다.
 */

const CONFIG = {
    SHEET_URLS: {
        CONFIG: "", 
        MEMBER: "YOUR_GOOGLE_SHEETS_MEMBER_CSV_URL", 
        SEMINAR: "YOUR_GOOGLE_SHEETS_SEMINAR_CSV_URL", 
        FOOD: "YOUR_GOOGLE_SHEETS_FOOD_CSV_URL", 
        ADMIN_EDIT: "YOUR_GOOGLE_SHEETS_EDIT_URL"
    },
    
    SHEET_LOADING: {
        ENABLED: true,
        CACHE_DURATION: 5 * 60 * 1000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },
    
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
    
    // ⚠️ 보안: 실제 운영 시 반드시 강력한 비밀번호로 변경하세요
    ADMIN: {
        ID: 'admin',
        PASSWORD: 'YOUR_STRONG_ADMIN_PASSWORD', // 강력한 비밀번호로 변경 필수
        MASTER_CODE: 'YOUR_STRONG_MASTER_CODE' // 복잡한 코드로 변경 필수
    },
    
    PORTONE: {
        // PortOne 대시보드(https://admin.portone.io/)에서 발급받은 가맹점 식별코드
        IMP_CODE: 'YOUR_PORTONE_IMP_CODE'
    },
    
    IMGBB: {
        // ImgBB API 키 (https://api.imgbb.com/ 에서 발급)
        API_KEY: 'YOUR_IMGBB_API_KEY'
    },
    
    PUBLIC_DATA_API: {
        // 공공데이터포털(https://www.data.go.kr/)에서 발급받은 Service Key
        // "사업자등록번호 진위확인" 검색 → API 신청
        API_KEY: 'YOUR_PUBLIC_DATA_API_KEY'
    },
    
    G2B_API: {
        // 나라장터 공공조달 입찰공고 API 키
        // 공공데이터포털에서 "나라장터 공공조달 입찰공고" 검색 → API 신청
        API_KEY: 'YOUR_G2B_API_KEY',
        BASE_URL: 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService'
    },
    
    EMAILJS: {
        // EmailJS 서비스 ID (https://www.emailjs.com/)
        SERVICE_ID: 'YOUR_EMAILJS_SERVICE_ID',
        TEMPLATE_ID_FIND_ID: 'YOUR_EMAILJS_TEMPLATE_ID_FIND_ID',
        TEMPLATE_ID_RESET_PASSWORD: 'YOUR_EMAILJS_TEMPLATE_ID_RESET_PASSWORD',
        PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY'
    },
    
    GOOGLE_APPS_SCRIPT: {
        WEB_APP_URL: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
        SPREADSHEET_ID: 'YOUR_GOOGLE_SHEETS_SPREADSHEET_ID'
    }
};




