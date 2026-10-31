import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA9aeP_SeSCJIgzST45tPj7FFZZcEfEaec",
  authDomain: "bcsa-b190f.firebaseapp.com",
  projectId: "bcsa-b190f",
  storageBucket: "bcsa-b190f.firebasestorage.app",
  messagingSenderId: "999075400884",
  appId: "1:999075400884:web:a1ff5389741417e4ca5be1",
  measurementId: "G-13X3J2EYQ2"
};

const app = initializeApp(firebaseConfig);

/** 로컬 캐시: 재방문·탭 간 onSnapshot 최초 응답이 훨씬 빨라짐 */
function createFirestoreDb() {
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
// 파일 저장소(Storage)는 src/utils/imageUtils.js에서 업로드할 때만 불러온다

export default app;
