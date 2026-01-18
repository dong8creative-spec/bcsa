/**
 * Firebase Configuration
 * 
 * Firebase v8 SDK를 사용하는 admin.html을 위한 설정 파일
 */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9aeP_SeSCJIgzST45tPj7FFZZcEfEaec",
  authDomain: "bcsa-b190f.firebaseapp.com",
  projectId: "bcsa-b190f",
  storageBucket: "bcsa-b190f.firebasestorage.app",
  messagingSenderId: "999075400884",
  appId: "1:999075400884:web:a1ff5389741417e4ca5be1",
  measurementId: "G-13X3J2EYQ2"
};

// Initialize Firebase (v8 SDK)
if (typeof firebase !== 'undefined') {
  try {
    // 이미 초기화되었는지 확인
    let app;
    try {
      app = firebase.app();
      console.log('✅ Firebase already initialized');
    } catch (e) {
      // 초기화되지 않았으면 초기화
      app = firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized successfully');
    }
    
    // Firebase 서비스 초기화
    window.firebaseServices = {
      db: firebase.firestore(),
      auth: firebase.auth(),
      storage: firebase.storage()
    };
    
    console.log('✅ Firebase services initialized:', {
      db: !!window.firebaseServices.db,
      auth: !!window.firebaseServices.auth,
      storage: !!window.firebaseServices.storage
    });
    
    // Safe function for checking Firebase config (이미 정의되어 있으면 업데이트, 없으면 새로 정의)
    if (typeof window.checkFirebaseConfig === 'function') {
      // 이미 정의되어 있으면 Firebase 초기화 후 정보로 업데이트
      const originalCheckFirebaseConfig = window.checkFirebaseConfig;
      window.checkFirebaseConfig = function() {
        try {
          const result = originalCheckFirebaseConfig();
          // Firebase가 초기화된 경우 추가 정보 업데이트
          if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            result.initialized = true;
            result.config = firebaseConfig;
            result.services = Object.keys(window.firebaseServices || {});
            result.app = app.name;
          }
          return result;
        } catch (error) {
          return {
            initialized: true,
            config: firebaseConfig,
            services: Object.keys(window.firebaseServices || {}),
            app: app.name
          };
        }
      };
    } else {
      // 함수가 없으면 새로 정의
      window.checkFirebaseConfig = function() {
        return {
          initialized: true,
          config: firebaseConfig,
          services: Object.keys(window.firebaseServices || {}),
          app: app.name
        };
      };
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    
    // Safe fallback function (이미 정의되어 있으면 덮어쓰지 않음)
    if (typeof window.checkFirebaseConfig !== 'function') {
      window.checkFirebaseConfig = function() {
        return {
          initialized: false,
          error: error.message
        };
      };
    }
  }
} else {
  console.error('❌ Firebase SDK not loaded');
  
  // Safe fallback function (이미 정의되어 있으면 덮어쓰지 않음)
  if (typeof window.checkFirebaseConfig !== 'function') {
    window.checkFirebaseConfig = function() {
      return {
        initialized: false,
        error: 'Firebase SDK not loaded'
      };
    };
  }
}

