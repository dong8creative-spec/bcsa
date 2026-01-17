/**
 * 인증 관련 유틸리티 함수
 */

import { firebaseService } from '../services/firebaseService';
import { authService } from '../services/authService';

/**
 * 사용자 데이터를 스토리지에서 로드
 */
export const loadUsersFromStorage = async () => {
    try {
        if (firebaseService && firebaseService.getUsers) {
            return await firebaseService.getUsers();
        }
        return [];
    } catch (error) {
        return [];
    }
};

/**
 * 비밀번호 해싱
 */
export const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

/**
 * 비밀번호 검증
 */
export const verifyPassword = async (password, hashedPassword) => {
    const hash = await hashPassword(password);
    return hash === hashedPassword;
};

/**
 * 임시 비밀번호 생성
 */
export const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

/**
 * EmailJS를 통한 이메일 발송
 */
export const sendEmailViaEmailJS = async (templateId, templateParams) => {
    try {
        const { CONFIG } = await import('../config');
        const emailjsConfig = CONFIG.EMAILJS || null;
        
        if (!emailjsConfig || !emailjsConfig.SERVICE_ID || !emailjsConfig.PUBLIC_KEY) {
            throw new Error('EmailJS 설정이 완료되지 않았습니다.');
        }
        
        if (typeof emailjs !== 'undefined') {
            emailjs.init(emailjsConfig.PUBLIC_KEY);
            const response = await emailjs.send(
                emailjsConfig.SERVICE_ID,
                templateId,
                templateParams
            );
            return { success: true, response };
        } else {
            throw new Error('EmailJS 라이브러리가 로드되지 않았습니다.');
        }
    } catch (error) {
        return { success: false, error: error.message || '이메일 발송에 실패했습니다.' };
    }
};

/**
 * 사용자 데이터를 스토리지에 저장
 */
export const saveUsersToStorage = async (users) => {
    if (!users || !Array.isArray(users)) return;
    
    try {
        for (const user of users) {
            if (user.id && firebaseService && firebaseService.updateUser) {
                await firebaseService.updateUser(user.id, user);
            } else if (firebaseService && firebaseService.createUser) {
                await firebaseService.createUser(user);
            }
        }
    } catch (error) {
        console.error('사용자 저장 오류:', error);
    }
};

/**
 * 현재 사용자 데이터 로드
 */
export const loadCurrentUserFromStorage = async () => {
    try {
        const currentUser = authService.getCurrentUser();
        if (currentUser && firebaseService && firebaseService.getUser) {
            const userDoc = await firebaseService.getUser(currentUser.uid);
            return userDoc;
        }
        return null;
    } catch (error) {
        return null;
    }
};

/**
 * 현재 사용자 데이터 저장 (빈 함수 - Firebase Auth 사용)
 */
export const saveCurrentUserToStorage = (user) => {
    // Firebase Auth를 사용하므로 로컬 스토리지 저장 불필요
};
