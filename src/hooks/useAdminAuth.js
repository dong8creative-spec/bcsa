import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { resolveIsAdmin } from '../utils/adminAccess';

/**
 * 관리자 권한 확인 커스텀 훅 (Google 로그인 + Firestore role)
 */
export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [redirectError, setRedirectError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadUserDoc = async (user) => {
      if (!user) {
        setUserDoc(null);
        setIsAdmin(false);
        return;
      }
      try {
        const doc = await authService.getUserData(user);
        let claims = {};
        try {
          const tokenResult = await user.getIdTokenResult(true);
          claims = tokenResult.claims || {};
        } catch (tokenErr) {
          console.warn('관리자 claim 확인 오류:', tokenErr);
        }
        if (cancelled) return;
        setUserDoc(doc);
        setIsAdmin(resolveIsAdmin({ userDoc: doc, claims }));
      } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
        if (cancelled) return;
        setUserDoc(null);
        setIsAdmin(false);
      }
    };

    (async () => {
      try {
        await authService.completeGoogleRedirectSignIn();
      } catch (error) {
        console.error('Google redirect 로그인 오류:', error);
        if (!cancelled) setRedirectError(error);
      }
    })();

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      if (cancelled) return;
      setAuthUser(user);
      await loadUserDoc(user);
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setRedirectError(null);
    await authService.signInWithGoogle();
  }, []);

  const signInWithKakao = useCallback(() => {
    setRedirectError(null);
    try {
      sessionStorage.setItem('bcsa_admin_return', '1');
    } catch (_) {}
    authService.startKakaoLogin();
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
  }, []);

  return {
    isAdmin,
    isLoading,
    isAuthenticated: !!authUser,
    authUser,
    userDoc,
    currentUser: userDoc,
    redirectError,
    signInWithGoogle,
    signInWithKakao,
    signOut,
  };
};
