import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';
import { firebaseService } from './firebaseService';
import { getKakaoCallbackBaseUrl } from '../utils/api';

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
   * 카카오 로그인 시작: 백엔드 /api/auth/kakao/start 로 이동 (프론트 JS 키 불필요)
   * @param {{ signup?: boolean }} [options] - signup: 가입 흐름 표시 (콜백 후 /signup?from=kakao 이동)
   */
  startKakaoLogin(options = {}) {
    const base = getKakaoCallbackBaseUrl();
    const params = new URLSearchParams({ origin: window.location.origin });
    if (options.signup) params.set('signup', '1');
    window.location.href = `${base}/api/auth/kakao/start?${params.toString()}`;
  },

  /**
   * 이미 로그인된 사용자의 계정에 카카오를 연결 (마이페이지 → 카카오 연동)
   * @param {string} uid - 현재 로그인된 Firebase uid
   */
  startKakaoLink(uid) {
    const base = getKakaoCallbackBaseUrl();
    const params = new URLSearchParams({ origin: window.location.origin, link_uid: uid });
    window.location.href = `${base}/api/auth/kakao/start?${params.toString()}`;
  },

  /** 카카오 콜백 후 백엔드가 발급한 Firebase Custom Token으로 로그인 */
  async signInWithKakaoToken(customToken) {
    const userCredential = await signInWithCustomToken(auth, customToken);
    return userCredential.user;
  },

  /**
   * 카카오 콜백 1회용 code를 Custom Token + 프로필로 교환 (토큰 URL 노출 방지)
   * @returns {Promise<{ token: string, profile: object|null, isNew: boolean }>}
   */
  async exchangeKakaoCode(code) {
    const base = getKakaoCallbackBaseUrl();
    const res = await fetch(`${base}/api/auth/kakao/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.token) {
      const err = new Error(data?.error || 'kakao_exchange_failed');
      err.code = data?.error || 'kakao_exchange_failed';
      throw err;
    }
    return { token: data.token, profile: data.profile || null, isNew: data.isNew === true };
  },

  // Sign out (Firebase Auth 세션 종료)
  async logout() {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  /** @deprecated logout() 사용 */
  async signOut() {
    return this.logout();
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

  // Reset password (한국어 HTML 메일 또는 Firebase 한국어 폴백 — Cloud Function)
  async resetPassword(email) {
    const emailStr = (email ?? '').toString().trim();
    try {
      auth.languageCode = 'ko';
      await firebaseService.requestPasswordReset(emailStr);
    } catch (error) {
      console.warn('Custom password reset failed, falling back to Firebase email:', error);
      auth.languageCode = 'ko';
      await sendPasswordResetEmail(auth, emailStr);
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



