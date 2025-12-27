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
    firebase.initializeApp(firebaseConfig);
    
    window.firebaseServices = {
      db: firebase.firestore(),
      auth: firebase.auth(),
      storage: firebase.storage()
    };
    
    // Realtime Database is optional - only initialize if needed
    // If you need Realtime Database, uncomment the line below and add databaseURL to firebaseConfig
    // window.firebaseServices.rtdb = firebase.database();
    
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
