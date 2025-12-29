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
    
    // Safe function for checking Firebase config
    window.checkFirebaseConfig = function() {
      return {
        initialized: true,
        config: firebaseConfig,
        services: Object.keys(window.firebaseServices || {}),
        app: app.name
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

