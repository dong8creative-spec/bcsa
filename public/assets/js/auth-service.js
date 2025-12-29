// Firebase Authentication Service
const authService = {
  // Sign up with email and password
  async signUp(email, password, userData) {
    try {
      const userCredential = await window.firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await window.firebaseService.createUser({
        uid: user.uid,
        email: user.email,
        ...userData,
        createdAt: new Date().toISOString()
      });
      
      return user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await window.firebaseServices.auth.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign out
  async signOut() {
    try {
      await window.firebaseServices.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser() {
    return window.firebaseServices.auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return window.firebaseServices.auth.onAuthStateChanged(callback);
  },

  // Get user data from Firestore
  async getUserData(uid) {
    try {
      const users = await window.firebaseService.getUsers();
      return users.find(u => u.uid === uid);
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      await window.firebaseService.updateUser(userId, profileData);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Reset password
  async resetPassword(email) {
    try {
      await window.firebaseServices.auth.sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }
};

// Export for global use
window.authService = authService;
