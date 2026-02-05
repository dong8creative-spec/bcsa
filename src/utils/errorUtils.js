/**
 * 에러 처리 유틸리티 함수
 */

/**
 * Firebase 에러를 한국어 메시지로 변환
 */
export const translateFirebaseError = (error) => {
    if (!error) return '알 수 없는 오류가 발생했습니다.';
    
    // Firebase Auth 에러 코드
    if (error.code) {
        const errorMessages = {
            // Auth 에러
            'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
            'auth/invalid-email': '유효하지 않은 이메일 주소입니다.',
            'auth/operation-not-allowed': '이 작업은 허용되지 않습니다.',
            'auth/weak-password': '비밀번호가 너무 약합니다. 6자 이상 입력해주세요.',
            'auth/user-disabled': '이 계정은 비활성화되었습니다.',
            'auth/user-not-found': '등록되지 않은 이메일입니다.',
            'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
            'auth/too-many-requests': '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
            'auth/network-request-failed': '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
            'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
            'auth/user-token-expired': '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
            'auth/requires-recent-login': '보안을 위해 다시 로그인해주세요.',
            // Firestore 에러
            'permission-denied': '권한이 없습니다. 관리자에게 문의해주세요.',
            'unavailable': '서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
            'deadline-exceeded': '요청 시간이 초과되었습니다. 다시 시도해주세요.',
            'already-exists': '이미 존재하는 데이터입니다.',
            'not-found': '요청한 데이터를 찾을 수 없습니다.',
            'failed-precondition': '요청을 처리할 수 없는 상태입니다.',
            'aborted': '요청이 취소되었습니다.',
            'out-of-range': '요청 범위를 벗어났습니다.',
            'unimplemented': '아직 구현되지 않은 기능입니다.',
            'internal': '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            'unauthenticated': '인증이 필요합니다. 로그인해주세요.',
            'resource-exhausted': '리소스가 부족합니다. 잠시 후 다시 시도해주세요.',
            // Storage 에러
            'storage/unauthorized': '이미지 업로드 권한이 없습니다. 로그인 후 다시 시도해주세요.',
            'storage/unauthenticated': '이미지 업로드에는 로그인이 필요합니다. 홈에서 로그인한 뒤 다시 시도해주세요.',
            'storage/retry-limit-exceeded': '네트워크가 불안정합니다. 잠시 후 다시 시도해주세요.',
            'storage/object-not-found': '요청한 파일을 찾을 수 없습니다.'
        };
        
        if (errorMessages[error.code]) {
            return errorMessages[error.code];
        }
    }
    
    // 에러 메시지가 문자열인 경우
    if (typeof error === 'string') {
        return error;
    }
    
    // error.message가 있는 경우
    if (error.message) {
        // 이미 한국어인 경우 그대로 반환
        if (/[가-힣]/.test(error.message)) {
            return error.message;
        }
        // 영문 메시지인 경우 기본 메시지 반환
        return '오류가 발생했습니다. 다시 시도해주세요.';
    }
    
    return '알 수 없는 오류가 발생했습니다.';
};
