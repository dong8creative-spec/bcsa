import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

/**
 * 관리자 권한 확인 커스텀 훅
 * @returns {Object} { isAdmin, isLoading, checkAdminCode }
 */
export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        
        // 관리자 권한 확인 (role이 'admin' 또는 'master'인 경우)
        const isAdminUser = user && (user.role === 'admin' || user.role === 'master');
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * 마스터 코드 확인
   * @param {string} code - 입력된 마스터 코드
   * @returns {boolean} 코드가 유효한지 여부
   */
  const checkAdminCode = (code) => {
    const ADMIN_CODE = '0219';
    return code === ADMIN_CODE;
  };

  return {
    isAdmin,
    isLoading,
    currentUser,
    checkAdminCode
  };
};
