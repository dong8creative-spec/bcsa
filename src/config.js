/**
 * 부산청년사업가들 웹사이트 설정 파일
 * Google Sheets 연동 URL 및 기본 설정
 */

export const CONFIG = {
    SHEET_URLS: {
        CONFIG: "", 
        MEMBER: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEmEPSeDn1EUcf0DQWJ1EJ3t4nonCL42odDnJn7j8kxAkxl2qJDsXs6mDnxX2tfBJusuNC8ULgWXt4/pub?output=csv", 
        SEMINAR: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUgeDh3zYtSZ57dm1bVKKZIgYUaCjbCDE5ZxMI_EkzctTfKdT6_1KMI0nDT47MT_Flmp47zd8258Q7/pub?output=csv", 
        FOOD: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4XbOCG-q4zXslRt9RhKYeDNqh2oPgwZP_Y1odlRpybG72n0K4Pb0YvXq9-O40_jYJSa8xadm9ZAUF/pub?output=csv", 
        ADMIN_EDIT: "https://docs.google.com/spreadsheets"
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
    
    ADMIN: {
        ID: 'admin',
        PASSWORD: '1234',
        MASTER_CODE: 'master9999'
    },
    
    PORTONE: {
        IMP_CODE: 'imp00000000'
    },
    
    IMGBB: {
        API_KEY: '4c975214037cdf1889d5d02a01a7831d'
    },
    
    PUBLIC_DATA_API: {
        API_KEY: ''
    },
    
    G2B_API: {
        API_KEY: '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b',
        BASE_URL: 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService'
    },
    
    EMAILJS: {
        SERVICE_ID: '',
        TEMPLATE_ID_FIND_ID: '',
        TEMPLATE_ID_RESET_PASSWORD: '',
        PUBLIC_KEY: ''
    },
    
    GOOGLE_APPS_SCRIPT: {
        WEB_APP_URL: '',
        SPREADSHEET_ID: ''
    }
};

export default CONFIG;



