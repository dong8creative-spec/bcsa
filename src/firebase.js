import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA9aeP_SeSCJIgzST45tPj7FFZZcEfEaec",
  authDomain: "bcsa-b190f.firebaseapp.com",
  projectId: "bcsa-b190f",
  storageBucket: "bcsa-b190f.firebasestorage.app",
  messagingSenderId: "999075400884",
  appId: "1:999075400884:web:a1ff5389741417e4ca5be1",
  measurementId: "G-13X3J2EYQ2"
};

/**
 * 로컬 시험용: 개발 서버를 VITE_USE_EMULATORS=1 로 켜면 실제 저장소 대신 Firebase 에뮬레이터(가짜 저장소)에 붙는다.
 * 운영 빌드(npm run build)에서는 import.meta.env.DEV 가 false 라 이 분기가 통째로 빠진다.
 */
export const USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1';

const app = initializeApp(USE_EMULATORS ? { ...firebaseConfig, projectId: 'demo-bcsa' } : firebaseConfig);

/** 로컬 캐시: 재방문·탭 간 onSnapshot 최초 응답이 훨씬 빨라짐 */
function createFirestoreDb() {
  if (USE_EMULATORS) return initializeFirestore(app, { localCache: memoryLocalCache() });
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    console.warn('Persistent Firestore cache unavailable, falling back to memory cache:', error);
    return initializeFirestore(app, {
      localCache: memoryLocalCache()
    });
  }
}

export const db = createFirestoreDb();
export const auth = getAuth(app);
auth.languageCode = 'ko';
if (USE_EMULATORS) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(getFunctions(app, 'asia-northeast3'), '127.0.0.1', 5001);
  window.__testSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
}
export const storage = getStorage(app);

export default app;
