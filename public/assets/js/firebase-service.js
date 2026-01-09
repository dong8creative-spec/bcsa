// Firebase Data Service Layer
const firebaseService = {
  // ==========================================
  // Users Collection
  // ==========================================
  async getUsers() {
    try {
      const snapshot = await window.firebaseServices.db.collection('users').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  },

  async getUser(userId) {
    try {
      const doc = await window.firebaseServices.db.collection('users').doc(userId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  async createUser(userData) {
    try {
      const docRef = await window.firebaseServices.db.collection('users').add({
        ...userData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(userId, userData) {
    try {
      await window.firebaseServices.db.collection('users').doc(userId).update({
        ...userData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      await window.firebaseServices.db.collection('users').doc(userId).delete();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  subscribeUsers(callback) {
    return window.firebaseServices.db.collection('users')
      .onSnapshot((snapshot) => {
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
      const snapshot = await window.firebaseServices.db.collection('seminars').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting seminars:', error);
      throw error;
    }
  },

  async getSeminar(seminarId) {
    try {
      const doc = await window.firebaseServices.db.collection('seminars').doc(seminarId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting seminar:', error);
      throw error;
    }
  },

  async createSeminar(seminarData) {
    try {
      console.log('🔥 Firebase createSeminar 호출:', {
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      };
      
      // 배열 필드 검증
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터:', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      const docRef = await window.firebaseServices.db.collection('seminars').add(dataToSave);
      
      console.log('✅ Firebase createSeminar 성공:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating seminar:', error);
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
      console.log('🔥 Firebase updateSeminar 호출:', {
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
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      };
      
      // 배열 필드 검증
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터:', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      await window.firebaseServices.db.collection('seminars').doc(seminarId).update(dataToSave);
      
      console.log('✅ Firebase updateSeminar 성공:', seminarId);
    } catch (error) {
      console.error('❌ Error updating seminar:', error);
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
      await window.firebaseServices.db.collection('seminars').doc(seminarId).delete();
    } catch (error) {
      console.error('Error deleting seminar:', error);
      throw error;
    }
  },

  subscribeSeminars(callback) {
    return window.firebaseServices.db.collection('seminars')
      .onSnapshot((snapshot) => {
        const seminars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(seminars);
      });
  },

  // ==========================================
  // Posts Collection
  // ==========================================
  async getPosts() {
    try {
      const snapshot = await window.firebaseServices.db.collection('posts')
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting posts:', error);
      throw error;
    }
  },

  async getPost(postId) {
    try {
      const doc = await window.firebaseServices.db.collection('posts').doc(postId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting post:', error);
      throw error;
    }
  },

  async createPost(postData) {
    try {
      const docRef = await window.firebaseServices.db.collection('posts').add({
        ...postData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(postId, postData) {
    try {
      await window.firebaseServices.db.collection('posts').doc(postId).update({
        ...postData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  async deletePost(postId) {
    try {
      await window.firebaseServices.db.collection('posts').doc(postId).delete();
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  subscribePosts(callback) {
    return window.firebaseServices.db.collection('posts')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(posts);
      });
  },

  // ==========================================
  // Applications Collection
  // ==========================================
  async getApplications() {
    try {
      const snapshot = await window.firebaseServices.db.collection('applications')
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting applications:', error);
      throw error;
    }
  },

  async getApplication(applicationId) {
    try {
      const doc = await window.firebaseServices.db.collection('applications').doc(applicationId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting application:', error);
      throw error;
    }
  },

  async createApplication(applicationData) {
    try {
      const docRef = await window.firebaseServices.db.collection('applications').add({
        ...applicationData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  },

  async updateApplication(applicationId, applicationData) {
    try {
      await window.firebaseServices.db.collection('applications').doc(applicationId).update({
        ...applicationData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  },

  async deleteApplication(applicationId) {
    try {
      await window.firebaseServices.db.collection('applications').doc(applicationId).delete();
    } catch (error) {
      console.error('Error deleting application:', error);
      throw error;
    }
  },

  subscribeApplications(callback) {
    return window.firebaseServices.db.collection('applications')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(applications);
      });
  },

  // ==========================================
  // Settings Collection
  // ==========================================
  async getSettings() {
    try {
      const doc = await window.firebaseServices.db.collection('settings').doc('main').get();
      if (doc.exists) {
        return doc.data();
      }
      return {};
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  async updateSettings(settingsData) {
    try {
      await window.firebaseServices.db.collection('settings').doc('main').set({
        ...settingsData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  subscribeSettings(callback) {
    return window.firebaseServices.db.collection('settings').doc('main')
      .onSnapshot((doc) => {
        if (doc.exists) {
          callback(doc.data());
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
      const batch = window.firebaseServices.db.batch();
      const snapshot = await window.firebaseServices.db.collection('users').get();
      let deletedCount = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // exceptEmail이 제공된 경우 해당 이메일 제외
        if (!exceptEmail || data.email !== exceptEmail) {
          batch.delete(doc.ref);
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
      const batch = window.firebaseServices.db.batch();
      const snapshot = await window.firebaseServices.db.collection('seminars').get();
      let deletedCount = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
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
      const batch = window.firebaseServices.db.batch();
      const snapshot = await window.firebaseServices.db.collection('posts').get();
      let deletedCount = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
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
      const batch = window.firebaseServices.db.batch();
      const snapshot = await window.firebaseServices.db.collection('applications').get();
      let deletedCount = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
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
      await window.firebaseServices.db.collection('settings').doc('main').set({
        ...defaultSettings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
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
      const docRef = await window.firebaseServices.db.collection('searchLogs').add({
        ...logData,
        searchedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating search log:', error);
      throw error;
    }
  },

  async getSearchLogs(limit = 50) {
    try {
      let query = window.firebaseServices.db.collection('searchLogs')
        .orderBy('searchedAt', 'desc');
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Timestamp를 Date로 변환
        searchedAt: doc.data().searchedAt?.toDate ? doc.data().searchedAt.toDate() : doc.data().searchedAt
      }));
    } catch (error) {
      console.error('Error getting search logs:', error);
      throw error;
    }
  },

  subscribeSearchLogs(callback, limit = 50) {
    try {
      let query = window.firebaseServices.db.collection('searchLogs')
        .orderBy('searchedAt', 'desc');
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      return query.onSnapshot((snapshot) => {
        const logs = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          // Timestamp를 Date로 변환
          searchedAt: doc.data().searchedAt?.toDate ? doc.data().searchedAt.toDate() : doc.data().searchedAt
        }));
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
      // 기존 북마크 확인
      const existingBookmark = await this.getBookmarkByBidNo(userId, bidData.bidNtceNo, bidData.bidNtceOrd);
      if (existingBookmark) {
        return existingBookmark.id; // 이미 북마크 되어 있으면 기존 ID 반환
      }
      
      const docRef = await window.firebaseServices.db.collection('bookmarks').add({
        userId: userId,
        bidNtceNo: bidData.bidNtceNo || '',
        bidNtceOrd: bidData.bidNtceOrd || '',
        bidNtceNm: bidData.bidNtceNm || '',
        bookmarkedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
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
        await window.firebaseServices.db.collection('bookmarks').doc(bookmark.id).delete();
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
      const snapshot = await window.firebaseServices.db.collection('bookmarks')
        .where('userId', '==', userId)
        .where('bidNtceNo', '==', bidNtceNo || '')
        .where('bidNtceOrd', '==', bidNtceOrd || '')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting bookmark:', error);
      throw error;
    }
  },

  async getUserBookmarks(userId) {
    try {
      const snapshot = await window.firebaseServices.db.collection('bookmarks')
        .where('userId', '==', userId)
        .orderBy('bookmarkedAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        bookmarkedAt: doc.data().bookmarkedAt?.toDate ? doc.data().bookmarkedAt.toDate() : doc.data().bookmarkedAt
      }));
    } catch (error) {
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
      const snapshot = await window.firebaseServices.db.collection('restaurants').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting restaurants:', error);
      throw error;
    }
  },

  async getRestaurant(restaurantId) {
    try {
      const doc = await window.firebaseServices.db.collection('restaurants').doc(restaurantId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting restaurant:', error);
      throw error;
    }
  },

  async createRestaurant(restaurantData) {
    try {
      const docRef = await window.firebaseServices.db.collection('restaurants').add({
        ...restaurantData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating restaurant:', error);
      throw error;
    }
  },

  async updateRestaurant(restaurantId, restaurantData) {
    try {
      await window.firebaseServices.db.collection('restaurants').doc(restaurantId).update({
        ...restaurantData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
    } catch (error) {
      console.error('Error updating restaurant:', error);
      throw error;
    }
  },

  async deleteRestaurant(restaurantId) {
    try {
      await window.firebaseServices.db.collection('restaurants').doc(restaurantId).delete();
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      throw error;
    }
  }
};

// Export for global use
window.firebaseService = firebaseService;
