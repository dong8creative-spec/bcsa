import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
  signOut, 
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';
import { firebaseService } from './firebaseService';
import { CONFIG } from '../config';

export const authService = {
  // Sign up with email and password
  async signUp(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await firebaseService.createUser({
        uid: user.uid,
        email: user.email,
        ...userData,
        createdAt: new Date().toISOString()
      });
      
      return user;
    } catch (error) {
      throw error;
    }
  },

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      // 호출부(handleLogin)에서 translateFirebaseError로 사용자 안내
      throw error;
    }
  },

  /**
   * 카카오 로그인 시작: 카카오 인증 페이지로 리다이렉트.
   * @param {string} callbackUrl - 백엔드 콜백 URL (예: https://apibid-xxx.run.app/api/auth/kakao/callback)
   */
  startKakaoLogin(callbackUrl) {
    if (typeof window === 'undefined' || !window.Kakao) {
      throw new Error('카카오 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    }
    const key = CONFIG.KAKAO?.JAVASCRIPT_KEY;
    if (!key) {
      throw new Error('카카오 로그인이 설정되지 않았습니다.');
    }
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(key);
    }
    window.Kakao.Auth.authorize({
      redirectUri: callbackUrl,
      scope: 'profile_nickname,account_email,phone_number'
    });
  },

  /**
   * 카카오 콜백 후 전달받은 커스텀 토큰으로 Firebase 로그인
   * @param {string} customToken - 백엔드에서 발급한 Firebase 커스텀 토큰
   * @returns {Promise<import('firebase/auth').User>}
   */
  async signInWithKakaoToken(customToken) {
    const userCredential = await signInWithCustomToken(auth, customToken);
    return userCredential.user;
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(auth, callback);
  },

  // Get user data from Firestore (문서 id가 uid인 경우 단일 조회)
  async getUserData(uid) {
    try {
      const userDoc = await firebaseService.getUser(uid);
      if (userDoc) return userDoc;
      const users = await firebaseService.getUsers();
      return users.find(u => u.uid === uid) || null;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      await firebaseService.updateUser(userId, profileData);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Reset password
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  /** 현재 로그인한 Firebase Auth 사용자 삭제 (자진 탈퇴 시 재가입 가능하도록) */
  async deleteCurrentUser() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('로그인된 사용자가 없습니다.');
    }
    try {
      await deleteUser(user);
    } catch (error) {
      console.error('Error deleting current user:', error);
      throw error;
    }
  }
};

export default authService;



