import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Icons } from './Icons';
import { translateFirebaseError } from '../utils/errorUtils';

/** 카카오 심볼 아이콘 (로그인 버튼용) */
const KakaoSymbol = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.89 5.33 4.71 6.71-.15.55-.54 1.98-.62 2.29-.09.37.14.36.29.26.12-.08 1.92-1.3 2.7-1.83.62.09 1.26.14 1.92.14 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
  </svg>
);

/**
 * 관리자 권한이 필요한 라우트를 보호하는 컴포넌트
 * 로그인(카카오/Google) + Firestore role·등급 또는 Custom Claims
 */
export const AdminRoute = ({ children }) => {
  const navigate = useNavigate();
  const {
    isAdmin,
    isLoading,
    isAuthenticated,
    authUser,
    userDoc,
    redirectError,
    signInWithGoogle,
    signInWithKakao,
    signOut,
  } = useAdminAuth();
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (redirectError) {
      if (redirectError?.code === 'auth/popup-closed-by-user') {
        setLoginError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else {
        setLoginError(translateFirebaseError(redirectError));
      }
    }
  }, [redirectError]);

  const handleGoogleLogin = async () => {
    setLoginError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // redirect 성공 시 페이지가 Google로 이동함
    } catch (error) {
      console.error('Google 로그인 오류:', error);
      if (error?.code === 'auth/popup-closed-by-user') {
        setLoginError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else {
        setLoginError(translateFirebaseError(error));
      }
      setSigningIn(false);
    }
  };

  const handleKakaoLogin = () => {
    setLoginError('');
    setSigningIn(true);
    try {
      signInWithKakao();
    } catch (error) {
      console.error('카카오 로그인 오류:', error);
      setLoginError(error?.message || '카카오 로그인을 시작할 수 없습니다.');
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  if (isLoading || signingIn) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4" />
          <p className="text-gray-600">관리자 인증 확인 중...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return children;
  }

  return (
    <div className="min-h-screen bg-soft flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-card p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
            <Icons.Shield size={32} className="text-brand" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">관리자 로그인</h2>
          <p className="text-gray-600">
            {signingIn
              ? '로그인 페이지로 이동 중...'
              : isAuthenticated
              ? '관리자 권한이 있는 계정으로 다시 로그인해 주세요.'
              : '관리자 권한이 있는 계정으로 로그인해 주세요.'}
          </p>
        </div>

        {isAuthenticated && !isAdmin && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-bold">로그인은 되었지만 관리자 권한이 없습니다</p>
            <p>
              계정: <span className="font-bold">{authUser?.email || userDoc?.email || '알 수 없음'}</span>
            </p>
            {authUser?.uid && (
              <p className="text-xs text-amber-800 break-all">
                Firebase UID: {authUser.uid}
                <br />
                Firestore <code className="bg-amber-100 px-1 rounded">users</code> 문서에 위 UID와{' '}
                <code className="bg-amber-100 px-1 rounded">role: admin</code> 또는{' '}
                <code className="bg-amber-100 px-1 rounded">memberGrade: 마스터</code> 설정이 필요합니다.
              </p>
            )}
          </div>
        )}

        {loginError && (
          <p className="mb-4 text-sm text-red-500 flex items-center gap-1 justify-center">
            <Icons.AlertCircle size={16} />
            {loginError}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleKakaoLogin}
            disabled={signingIn}
            className="w-full px-6 py-3 bg-[#FEE500] text-[#191919] rounded-xl font-bold hover:bg-[#FDD835] transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <KakaoSymbol className="w-5 h-5" />
            카카오로 로그인
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={signingIn}
            className="w-full px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Icons.Google size={20} />
            Google로 로그인
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 border-2 border-blue-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              메인으로
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                다른 계정
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
