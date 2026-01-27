import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Icons } from './Icons';

/**
 * 관리자 권한이 필요한 라우트를 보호하는 컴포넌트
 * @param {Object} props
 * @param {React.ReactNode} props.children - 보호할 컴포넌트
 * @param {string} props.redirectTo - 권한이 없는 경우 리다이렉트할 경로
 */
export const AdminRoute = ({ children, redirectTo = '/' }) => {
  const { isAdmin, isLoading, checkAdminCode } = useAdminAuth();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    
    if (checkAdminCode(codeInput)) {
      setIsVerified(true);
      setShowCodeInput(false);
      setCodeError('');
    } else {
      setCodeError('잘못된 마스터 코드입니다.');
      setCodeInput('');
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
          <p className="mt-4 text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 관리자가 아니고 코드도 확인되지 않은 경우
  if (!isAdmin && !isVerified) {
    // 마스터 코드 입력 모달 표시
    if (!showCodeInput) {
      setShowCodeInput(true);
    }

    return (
      <div className="min-h-screen bg-soft flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-card p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
              <Icons.Lock size={32} className="text-brand" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              관리자 인증
            </h2>
            <p className="text-gray-600">
              마스터 코드를 입력하세요
            </p>
          </div>

          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={codeInput}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 4); // 4자리로 제한
                  setCodeInput(value);
                  setCodeError('');
                }}
                placeholder="마스터 코드 입력 (4자리)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-brand transition-colors"
                maxLength={4}
                autoFocus
              />
              {codeError && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <Icons.AlertCircle size={16} />
                  {codeError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!codeInput.trim()}
                className="flex-1 px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 관리자이거나 코드가 확인된 경우
  return children;
};
