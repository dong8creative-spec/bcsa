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
import { db } from '../firebase';

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

  async createUser(userData) {
    try {
      const docRef = await addDoc(collection(db, 'users'), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
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

  subscribeUsers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(users);
    });
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
      
      // 배열 필드 검증
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
      
      // 배열 필드 검증
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
      const docRef = doc(db, 'posts', postId);
      await updateDoc(docRef, {
        ...postData,
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
      console.error('Error getting applications:', error);
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
  // Bookmarks Collection
  // ==========================================
  async addBookmark(userId, bidData) {
    try {
      const existingBookmark = await this.getBookmarkByBidNo(userId, bidData.bidNtceNo, bidData.bidNtceOrd);
      if (existingBookmark) {
        return existingBookmark.id;
      }
      
      const docRef = await addDoc(collection(db, 'bookmarks'), {
        userId: userId,
        bidNtceNo: bidData.bidNtceNo || '',
        bidNtceOrd: bidData.bidNtceOrd || '',
        bidNtceNm: bidData.bidNtceNm || '',
        bookmarkedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      throw error;
    }
  },

  async removeBookmark(userId, bidNtceNo, bidNtceOrd) {
    try {
      const bookmark = await this.getBookmarkByBidNo(userId, bidNtceNo, bidNtceOrd);
      if (bookmark) {
        await deleteDoc(doc(db, 'bookmarks', bookmark.id));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  },

  async getBookmarkByBidNo(userId, bidNtceNo, bidNtceOrd) {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:656',message:'getBookmarkByBidNo called',data:{userId,bidNtceNo,bidNtceOrd},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', userId),
        where('bidNtceNo', '==', bidNtceNo || ''),
        where('bidNtceOrd', '==', bidNtceOrd || ''),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:673',message:'getBookmarkByBidNo error',data:{error:error.message,code:error.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      console.error('Error getting bookmark:', error);
      throw error;
    }
  },

  async getUserBookmarks(userId) {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:678',message:'getUserBookmarks called - NO orderBy',data:{userId,hasOrderBy:false},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      // orderBy를 제거하여 인덱스 없이도 작동하도록 수정
      // 클라이언트 측에서 정렬 처리
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', userId)
      );
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:687',message:'Query created, about to getDocs',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const snapshot = await getDocs(q);
      
      const bookmarks = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          bookmarkedAt: data.bookmarkedAt?.toDate ? data.bookmarkedAt.toDate() : data.bookmarkedAt
        };
      });
      
      // 클라이언트 측에서 날짜순 정렬
      return bookmarks.sort((a, b) => {
        const dateA = a.bookmarkedAt ? (a.bookmarkedAt instanceof Date ? a.bookmarkedAt : new Date(a.bookmarkedAt)) : new Date(0);
        const dateB = b.bookmarkedAt ? (b.bookmarkedAt instanceof Date ? b.bookmarkedAt : new Date(b.bookmarkedAt)) : new Date(0);
        return dateB.getTime() - dateA.getTime(); // 내림차순
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:702',message:'getUserBookmarks success',data:{userId,bookmarksCount:bookmarks.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.js:704',message:'getUserBookmarks error',data:{error:error.message,code:error.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('Error getting user bookmarks:', error);
      throw error;
    }
  },

  async isBookmarked(userId, bidNtceNo, bidNtceOrd) {
    try {
      const bookmark = await this.getBookmarkByBidNo(userId, bidNtceNo, bidNtceOrd);
      return bookmark !== null;
    } catch (error) {
      console.error('Error checking bookmark:', error);
      return false;
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
  }
};

export default firebaseService;



