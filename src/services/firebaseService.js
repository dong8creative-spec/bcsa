import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where, 
  limit,
  onSnapshot,
  writeBatch,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase';

// Firebase Data Service Layer
export const firebaseService = {
  // ==========================================
  // Users Collection
  // ==========================================
  async getUsers() {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  },

  async getUser(userId) {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  /** 이메일로 기존 회원 1명 조회 (중복 검사용, 회원 수와 무관하게 1건만 읽음) */
  async getUserByEmail(email) {
    if (!email || typeof email !== 'string' || !email.trim()) return null;
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', email.trim()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() };
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  },

  /** 연락처(정규화된 숫자 문자열)로 기존 회원 1명 조회 (중복 검사용) */
  async getUserByPhone(normalizedPhone) {
    if (!normalizedPhone || typeof normalizedPhone !== 'string') return null;
    const digits = normalizedPhone.replace(/\D/g, '');
    if (!digits.length) return null;
    try {
      const q = query(
        collection(db, 'users'),
        where('phone', '==', digits),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        const q2 = query(
          collection(db, 'users'),
          where('phoneNumber', '==', digits),
          limit(1)
        );
        const snap2 = await getDocs(q2);
        if (snap2.empty) return null;
        const d = snap2.docs[0];
        return { id: d.id, ...d.data() };
      }
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() };
    } catch (error) {
      console.error('Error getting user by phone:', error);
      throw error;
    }
  },

  async createUser(userData) {
    try {
      const data = {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (userData.uid) {
        await setDoc(doc(db, 'users', userData.uid), data);
        return userData.uid;
      }
      const docRef = await addDoc(collection(db, 'users'), data);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(userId, userData) {
    try {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, {
        ...userData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  /** 관리자 강제 탈퇴 시 Firebase Auth 사용자 삭제 (Cloud Function 호출, 재가입 가능하도록) */
  async deleteAuthUser(uid) {
    const uidStr = typeof uid === 'string' ? uid.trim() : (uid ? String(uid).trim() : '');
    if (!uidStr) {
      throw new Error('삭제할 사용자 uid가 없습니다.');
    }
    try {
      const functions = getFunctions(app, 'asia-northeast3');
      const callable = httpsCallable(functions, 'deleteAuthUser');
      await callable({ uid: uidStr });
    } catch (error) {
      const msg = error?.message || error?.details || 'Auth 사용자 삭제 실패';
      console.error('Error deleting Auth user:', error);
      throw new Error(typeof msg === 'string' ? msg : 'Auth 사용자 삭제에 실패했습니다.');
    }
  },

  subscribeUsers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(users);
    });
  },

  // ==========================================
  // User Notifications (users/{userId}/notifications)
  // ==========================================
  async addUserNotification(userId, { type, message, correctedFields }) {
    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const docRef = await addDoc(notificationsRef, {
        type: type || 'profile_corrected',
        message: message || '회원정보가 정정되었습니다.',
        correctedFields: correctedFields || [],
        createdAt: serverTimestamp(),
        read: false
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding user notification:', error);
      throw error;
    }
  },

  async getUserNotifications(userId) {
    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  },

  subscribeUserNotifications(userId, callback) {
    if (!userId) return () => {};
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(list);
    });
  },

  async markNotificationRead(userId, notificationId) {
    try {
      const docRef = doc(db, 'users', userId, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error('Error marking notification read:', error);
      throw error;
    }
  },

  // 햇반 계정 식별 함수
  isHaetbanAccount(user) {
    return user.name === '햇반' || 
           user.email === 'haetban@bcsa-b190f.firebaseapp.com' || 
           (user.isAdmin === true && user.name === '햇반');
  },

  // ==========================================
  // Seminars Collection
  // ==========================================
  async getSeminars() {
    try {
      const snapshot = await getDocs(collection(db, 'seminars'));
      const seminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📖 Firebase getSeminars 성공:', {
        count: seminars.length,
        sample: seminars.length > 0 ? {
          id: seminars[0].id,
          title: seminars[0].title,
          images: seminars[0].images,
          imagesType: Array.isArray(seminars[0].images) ? 'array' : typeof seminars[0].images,
          img: seminars[0].img
        } : null
      });
      return seminars;
    } catch (error) {
      console.error('❌ Error getting seminars:', error);
      throw error;
    }
  },

  async getSeminar(seminarId) {
    try {
      const docRef = doc(db, 'seminars', seminarId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting seminar:', error);
      throw error;
    }
  },

  async createSeminar(seminarData) {
    try {
      console.log('🔥 Firebase createSeminar 호출 (인덱스):', {
        seminarData: {
          ...seminarData,
          images: seminarData.images,
          imagesLength: Array.isArray(seminarData.images) ? seminarData.images.length : 'not array',
          img: seminarData.img
        }
      });
      
      // Firestore에 저장할 데이터 준비
      const dataToSave = {
        ...seminarData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // images: 배열만 검사. 요소는 문자열 또는 { firebase, imgbb } 이중 저장 형식 모두 허용
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터 (인덱스):', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      const docRef = await addDoc(collection(db, 'seminars'), dataToSave);
      
      console.log('✅ Firebase createSeminar 성공 (인덱스):', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating seminar (인덱스):', error);
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        seminarData
      });
      throw error;
    }
  },

  async updateSeminar(seminarId, seminarData) {
    try {
      console.log('🔥 Firebase updateSeminar 호출 (인덱스):', {
        seminarId,
        seminarData: {
          ...seminarData,
          images: seminarData.images,
          imagesLength: Array.isArray(seminarData.images) ? seminarData.images.length : 'not array',
          img: seminarData.img
        }
      });
      
      // Firestore에 저장할 데이터 준비
      const dataToSave = {
        ...seminarData,
        updatedAt: serverTimestamp()
      };
      
      // images: 배열만 검사. 요소는 문자열 또는 { firebase, imgbb } 이중 저장 형식 모두 허용
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터 (인덱스):', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      const docRef = doc(db, 'seminars', seminarId);
      await updateDoc(docRef, dataToSave);
      
      console.log('✅ Firebase updateSeminar 성공 (인덱스):', seminarId);
    } catch (error) {
      console.error('❌ Error updating seminar (인덱스):', error);
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        seminarId,
        seminarData
      });
      throw error;
    }
  },

  async deleteSeminar(seminarId) {
    try {
      await deleteDoc(doc(db, 'seminars', seminarId));
    } catch (error) {
      console.error('Error deleting seminar:', error);
      throw error;
    }
  },

  subscribeSeminars(callback) {
    return onSnapshot(collection(db, 'seminars'), (snapshot) => {
      const seminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(seminars);
    });
  },

  // ==========================================
  // Posts Collection
  // ==========================================
  async getPosts() {
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting posts:', error);
      throw error;
    }
  },

  async getPost(postId) {
    try {
      const docRef = doc(db, 'posts', postId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting post:', error);
      throw error;
    }
  },

  async createPost(postData) {
    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(postId, postData) {
    try {
      // undefined 및 null 필드 제거 및 데이터 정제
      const cleanedData = Object.keys(postData).reduce((acc, key) => {
        const value = postData[key];
        // undefined, null이 아니고, 빈 배열이 아닌 경우만 포함
        if (value !== undefined && value !== null) {
          // 빈 배열도 유효한 값으로 처리 (이미지 삭제 시 빈 배열이 될 수 있음)
          acc[key] = value;
        }
        return acc;
      }, {});
      
      const docRef = doc(db, 'posts', postId);
      await updateDoc(docRef, {
        ...cleanedData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  async deletePost(postId) {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  subscribePosts(callback) {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(posts);
    });
  },

  // ==========================================
  // Applications Collection
  // ==========================================
  async getApplications() {
    try {
      const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // orderBy 인덱스 미설정 시 폴백: 인덱스 없이 전체 조회 후 메모리에서 정렬
      console.warn('getApplications orderBy 실패, 전체 조회 후 정렬:', error?.message);
      try {
        const snapshot = await getDocs(collection(db, 'applications'));
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const toMs = (v) => {
          if (!v) return 0;
          if (v.toMillis && typeof v.toMillis === 'function') return v.toMillis();
          if (v.seconds != null) return v.seconds * 1000;
          return new Date(v).getTime() || 0;
        };
        list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        return list;
      } catch (fallbackError) {
        console.error('Error getting applications (fallback):', fallbackError);
        throw fallbackError;
      }
    }
  },

  async getApplicationsByUserId(userId) {
    try {
      // orderBy를 제거하여 인덱스 불필요하도록 수정
      const q = query(
        collection(db, 'applications'), 
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 클라이언트 측에서 정렬 (createdAt 기준 내림차순)
      return applications.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime; // 내림차순 (최신순)
      });
    } catch (error) {
      console.error('Error getting applications by userId:', error);
      // 인덱스 오류인 경우 사용자에게 안내
      if (error.code === 'failed-precondition') {
        console.warn('Firestore 인덱스가 필요합니다. 관리자에게 문의하세요.');
      }
      throw error;
    }
  },

  async getApplication(applicationId) {
    try {
      const docRef = doc(db, 'applications', applicationId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting application:', error);
      throw error;
    }
  },

  async createApplication(applicationData) {
    try {
      const docRef = await addDoc(collection(db, 'applications'), {
        ...applicationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  },

  async updateApplication(applicationId, applicationData) {
    try {
      const docRef = doc(db, 'applications', applicationId);
      await updateDoc(docRef, {
        ...applicationData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  },

  async deleteApplication(applicationId) {
    try {
      await deleteDoc(doc(db, 'applications', applicationId));
    } catch (error) {
      console.error('Error deleting application:', error);
      throw error;
    }
  },

  subscribeApplications(callback) {
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(applications);
    });
  },

  // ==========================================
  // Settings Collection
  // ==========================================
  async getSettings() {
    try {
      const docRef = doc(db, 'settings', 'main');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return {};
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  async updateSettings(settingsData) {
    try {
      const docRef = doc(db, 'settings', 'main');
      await setDoc(docRef, {
        ...settingsData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  subscribeSettings(callback) {
    const docRef = doc(db, 'settings', 'main');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback({});
      }
    });
  },

  // ==========================================
  // Bulk Delete Functions
  // ==========================================
  async deleteAllUsers(exceptEmail) {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'users'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!exceptEmail || data.email !== exceptEmail) {
          batch.delete(docSnap.ref);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}명의 사용자가 삭제되었습니다.`);
      } else {
        console.log('삭제할 사용자가 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all users:', error);
      throw error;
    }
  },

  async deleteAllSeminars() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'seminars'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 프로그램이 삭제되었습니다.`);
      } else {
        console.log('삭제할 프로그램이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all seminars:', error);
      throw error;
    }
  },

  async deleteAllPosts() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'posts'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 게시글이 삭제되었습니다.`);
      } else {
        console.log('삭제할 게시글이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all posts:', error);
      throw error;
    }
  },

  async deleteAllApplications() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'applications'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 신청이 삭제되었습니다.`);
      } else {
        console.log('삭제할 신청이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all applications:', error);
      throw error;
    }
  },

  async resetSettings(defaultSettings) {
    try {
      const docRef = doc(db, 'settings', 'main');
      await setDoc(docRef, {
        ...defaultSettings,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Settings가 기본값으로 초기화되었습니다.');
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  },

  // ==========================================
  // SearchLogs Collection
  // ==========================================
  async createSearchLog(logData) {
    try {
      const docRef = await addDoc(collection(db, 'searchLogs'), {
        ...logData,
        searchedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating search log:', error);
      throw error;
    }
  },

  async getSearchLogs(limitCount = 50) {
    try {
      let q = query(collection(db, 'searchLogs'), orderBy('searchedAt', 'desc'));
      
      if (limitCount > 0) {
        q = query(q, limit(limitCount));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          searchedAt: data.searchedAt?.toDate ? data.searchedAt.toDate() : data.searchedAt
        };
      });
    } catch (error) {
      console.error('Error getting search logs:', error);
      throw error;
    }
  },

  subscribeSearchLogs(callback, limitCount = 50) {
    try {
      let q = query(collection(db, 'searchLogs'), orderBy('searchedAt', 'desc'));
      
      if (limitCount > 0) {
        q = query(q, limit(limitCount));
      }
      
      return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { 
            id: docSnap.id, 
            ...data,
            searchedAt: data.searchedAt?.toDate ? data.searchedAt.toDate() : data.searchedAt
          };
        });
        callback(logs);
      }, (error) => {
        console.error('Error in search logs subscription:', error);
      });
    } catch (error) {
      console.error('Error subscribing to search logs:', error);
      throw error;
    }
  },

  // ==========================================
  // Restaurants Collection
  // ==========================================
  async getRestaurants() {
    try {
      const q = query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting restaurants:', error);
      throw error;
    }
  },

  async getRestaurant(restaurantId) {
    try {
      const docRef = doc(db, 'restaurants', restaurantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting restaurant:', error);
      throw error;
    }
  },

  async createRestaurant(restaurantData) {
    try {
      const docRef = await addDoc(collection(db, 'restaurants'), {
        ...restaurantData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating restaurant:', error);
      throw error;
    }
  },

  async updateRestaurant(restaurantId, restaurantData) {
    try {
      const docRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(docRef, {
        ...restaurantData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating restaurant:', error);
      throw error;
    }
  },

  async deleteRestaurant(restaurantId) {
    try {
      await deleteDoc(doc(db, 'restaurants', restaurantId));
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      throw error;
    }
  },

  subscribeRestaurants(callback) {
    const q = query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const restaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(restaurants);
    });
  },

  // ==========================================
  // Site Content Collection
  // ==========================================
  async getContent() {
    try {
      const docRef = doc(db, 'siteContent', 'main');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().content || {};
      }
      
      // 문서가 없으면 빈 객체 반환 (defaultContent는 클라이언트에서 처리)
      return {};
    } catch (error) {
      console.error('Error getting content:', error);
      throw error;
    }
  },

  async updateContent(contentData, userId) {
    try {
      const docRef = doc(db, 'siteContent', 'main');
      
      // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
      await setDoc(docRef, {
        content: contentData,
        updatedAt: serverTimestamp(),
        updatedBy: userId || 'anonymous'
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Error updating content:', error);
      throw error;
    }
  },

  subscribeContent(callback) {
    const docRef = doc(db, 'siteContent', 'main');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().content || {});
      } else {
        callback({});
      }
    });
  }
};

export default firebaseService;



