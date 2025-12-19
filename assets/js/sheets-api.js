/**
 * Google Sheets API 통신 모듈
 * Google Apps Script 웹앱과 통신하여 데이터를 읽고 씁니다.
 */

/**
 * Google Apps Script 웹앱 URL 가져오기
 */
function getScriptUrl() {
    return CONFIG?.GOOGLE_APPS_SCRIPT?.WEB_APP_URL || '';
}

/**
 * API 호출 헬퍼 함수
 */
async function callAPI(action, method = 'GET', data = null) {
    const scriptUrl = getScriptUrl();
    
    if (!scriptUrl) {
        console.warn('Google Apps Script URL이 설정되지 않았습니다. config.js를 확인하세요.');
        return { success: false, error: 'API URL not configured' };
    }
    
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (method === 'POST' && data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(scriptUrl + (method === 'GET' && action ? `?action=${action}` : ''), options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`API 호출 오류 (${action}):`, error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 게시글 관련 함수
// ==========================================

/**
 * 게시글 추가
 * @param {Object} postData - 게시글 데이터
 * @returns {Promise<Object>} 결과 객체
 */
async function addPostToSheet(postData) {
    try {
        const result = await callAPI('addPost', 'POST', {
            action: 'addPost',
            postData: postData
        });
        
        if (result.success) {
            console.log('✅ 게시글 추가 성공:', result.id);
        } else {
            console.error('❌ 게시글 추가 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('게시글 추가 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 게시글 목록 가져오기
 * @returns {Promise<Array>} 게시글 배열
 */
async function getPostsFromSheet() {
    try {
        const result = await callAPI('getPosts', 'GET');
        
        if (Array.isArray(result)) {
            console.log('✅ 게시글 로드 완료:', result.length, '개');
            return result;
        } else if (result.error) {
            console.error('❌ 게시글 로드 실패:', result.error);
            return [];
        }
        
        return [];
    } catch (error) {
        console.error('게시글 로드 오류:', error);
        return [];
    }
}

/**
 * 게시글 업데이트
 * @param {string|number} postId - 게시글 ID
 * @param {Object} updates - 업데이트할 필드들
 * @returns {Promise<Object>} 결과 객체
 */
async function updatePostInSheet(postId, updates) {
    try {
        const result = await callAPI('updatePost', 'POST', {
            action: 'updatePost',
            postId: postId,
            updates: updates
        });
        
        if (result.success) {
            console.log('✅ 게시글 업데이트 성공:', postId);
        } else {
            console.error('❌ 게시글 업데이트 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('게시글 업데이트 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 게시글 삭제
 * @param {string|number} postId - 게시글 ID
 * @returns {Promise<Object>} 결과 객체
 */
async function deletePostFromSheet(postId) {
    try {
        const result = await callAPI('deletePost', 'POST', {
            action: 'deletePost',
            postId: postId
        });
        
        if (result.success) {
            console.log('✅ 게시글 삭제 성공:', postId);
        } else {
            console.error('❌ 게시글 삭제 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 사용자 관련 함수
// ==========================================

/**
 * 사용자 저장/업데이트
 * @param {Object} userData - 사용자 데이터
 * @returns {Promise<Object>} 결과 객체
 */
async function saveUserToSheet(userData) {
    try {
        const result = await callAPI('saveUser', 'POST', {
            action: 'saveUser',
            userData: userData
        });
        
        if (result.success) {
            console.log('✅ 사용자 저장 성공:', userData.id);
        } else {
            console.error('❌ 사용자 저장 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('사용자 저장 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 사용자 목록 가져오기
 * @returns {Promise<Array>} 사용자 배열
 */
async function getUsersFromSheet() {
    try {
        const result = await callAPI('getUsers', 'GET');
        
        if (Array.isArray(result)) {
            console.log('✅ 사용자 로드 완료:', result.length, '명');
            return result;
        } else if (result.error) {
            console.error('❌ 사용자 로드 실패:', result.error);
            return [];
        }
        
        return [];
    } catch (error) {
        console.error('사용자 로드 오류:', error);
        return [];
    }
}

// ==========================================
// 세미나 신청 관련 함수
// ==========================================

/**
 * 세미나 신청 추가
 * @param {Object} applicationData - 신청 데이터
 * @returns {Promise<Object>} 결과 객체
 */
async function addSeminarApplicationToSheet(applicationData) {
    try {
        const result = await callAPI('addSeminarApplication', 'POST', {
            action: 'addSeminarApplication',
            applicationData: applicationData
        });
        
        if (result.success) {
            console.log('✅ 세미나 신청 성공:', result.id);
        } else {
            console.error('❌ 세미나 신청 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('세미나 신청 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 세미나 신청 목록 가져오기
 * @returns {Promise<Array>} 신청 배열
 */
async function getSeminarApplicationsFromSheet() {
    try {
        const result = await callAPI('getSeminarApplications', 'GET');
        
        if (Array.isArray(result)) {
            console.log('✅ 세미나 신청 로드 완료:', result.length, '개');
            return result;
        } else if (result.error) {
            console.error('❌ 세미나 신청 로드 실패:', result.error);
            return [];
        }
        
        return [];
    } catch (error) {
        console.error('세미나 신청 로드 오류:', error);
        return [];
    }
}

// ==========================================
// 문의 관련 함수
// ==========================================

/**
 * 문의 추가
 * @param {Object} inquiryData - 문의 데이터
 * @returns {Promise<Object>} 결과 객체
 */
async function addInquiryToSheet(inquiryData) {
    try {
        const result = await callAPI('addInquiry', 'POST', {
            action: 'addInquiry',
            inquiryData: inquiryData
        });
        
        if (result.success) {
            console.log('✅ 문의 추가 성공:', result.id);
        } else {
            console.error('❌ 문의 추가 실패:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('문의 추가 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 문의 목록 가져오기
 * @returns {Promise<Array>} 문의 배열
 */
async function getInquiriesFromSheet() {
    try {
        const result = await callAPI('getInquiries', 'GET');
        
        if (Array.isArray(result)) {
            console.log('✅ 문의 로드 완료:', result.length, '개');
            return result;
        } else if (result.error) {
            console.error('❌ 문의 로드 실패:', result.error);
            return [];
        }
        
        return [];
    } catch (error) {
        console.error('문의 로드 오류:', error);
        return [];
    }
}
