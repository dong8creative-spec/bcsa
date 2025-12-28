/**
 * Firebase Configuration (예제)
 * 
 * 이 파일을 복사하여 firebase-config.js로 이름을 변경하고 실제 Firebase 프로젝트 정보로 채워주세요.
 * 
 * 사용 방법:
 * 1. 이 파일을 복사하여 assets/js/firebase-config.js 생성
 * 2. Firebase Console(https://console.firebase.google.com/)에서 프로젝트 설정 > 일반 탭에서
 *    웹 앱 추가 또는 기존 앱의 설정 정보 확인
 * 3. 아래의 플레이스홀더 값들을 실제 Firebase 프로젝트 값으로 교체
 * 4. firebase-config.js는 .gitignore에 포함되어 있어 Git에 커밋되지 않습니다.
 */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Google Analytics 사용 시
};

// Initialize Firebase (v8 SDK)
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    
    window.firebaseServices = {
      db: firebase.firestore(),
      auth: firebase.auth(),
      storage: firebase.storage()
    };
    
    console.log('✅ Firebase initialized successfully');
    
    // Safe function for checking Firebase config (if called from elsewhere)
    window.checkFirebaseConfig = function() {
      return {
        initialized: true,
        config: firebaseConfig,
        services: Object.keys(window.firebaseServices || {})
      };
    };
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    
    // Safe fallback function
    window.checkFirebaseConfig = function() {
      return {
        initialized: false,
        error: error.message
      };
    };
  }
} else {
  console.error('❌ Firebase SDK not loaded');
  
  // Safe fallback function
  window.checkFirebaseConfig = function() {
    return {
      initialized: false,
      error: 'Firebase SDK not loaded'
    };
  };
}




