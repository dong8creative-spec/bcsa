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
      const docRef = await window.firebaseServices.db.collection('seminars').add({
        ...seminarData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating seminar:', error);
      throw error;
    }
  },

  async updateSeminar(seminarId, seminarData) {
    try {
      await window.firebaseServices.db.collection('seminars').doc(seminarId).update({
        ...seminarData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      });
    } catch (error) {
      console.error('Error updating seminar:', error);
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
  }
};

// Export for global use
window.firebaseService = firebaseService;
