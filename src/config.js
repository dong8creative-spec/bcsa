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
    
    ADMIN: {
        ID: 'admin',
        PASSWORD: '1234',
        MASTER_CODE: 'master9999'
    },
    
    // 포트원(구 아임포트) 결제: 관리자 콘솔에서 발급한 가맹점 식별코드
    // https://admin.portone.io 또는 https://admin.iamport.kr → 시스템 설정 → 가맹점 식별코드
    PORTONE: {
        IMP_CODE: typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTONE_IMP_CODE
            ? import.meta.env.VITE_PORTONE_IMP_CODE
            : 'imp00000000',
        CHANNEL_KEY: typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTONE_CHANNEL_KEY
            ? import.meta.env.VITE_PORTONE_CHANNEL_KEY
            : ''
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



