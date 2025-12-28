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
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting seminars:', error);
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
      const docRef = await addDoc(collection(db, 'seminars'), {
        ...seminarData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating seminar:', error);
      throw error;
    }
  },

  async updateSeminar(seminarId, seminarData) {
    try {
      const docRef = doc(db, 'seminars', seminarId);
      await updateDoc(docRef, {
        ...seminarData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating seminar:', error);
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
      console.error('Error getting bookmark:', error);
      throw error;
    }
  },

  async getUserBookmarks(userId) {
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', userId),
        orderBy('bookmarkedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          bookmarkedAt: data.bookmarkedAt?.toDate ? data.bookmarkedAt.toDate() : data.bookmarkedAt
        };
      });
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
  }
};

export default firebaseService;


