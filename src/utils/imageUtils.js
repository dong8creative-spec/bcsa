/**
 * 이미지 처리 유틸리티 함수
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { CONFIG } from '../config';

const IMAGE_TYPES = ['program', 'content', 'community', 'company'];

/**
 * Firebase Storage 권한/인증 관련 에러인지 여부
 */
const isStorageAuthError = (code) =>
  code === 'storage/unauthorized' ||
  code === 'storage/unauthenticated' ||
  code === 'storage/object-not-found';

/**
 * Firebase Storage에 이미지 파일 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} type - 이미지 유형 (program | content | community | company)
 * @returns {Promise<string>} 다운로드 URL
 */
export const uploadImageToStorage = async (file, type = 'program') => {
  try {
    const safeType = IMAGE_TYPES.includes(type) ? type : 'program';
    const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const path = `images/${safeType}/${id}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    const code = error?.code || error?.name || '';
    if (isStorageAuthError(code)) {
      throw new Error('이미지 업로드에는 로그인이 필요합니다. 홈에서 이메일/비밀번호로 로그인한 뒤 다시 시도해주세요. (관리자는 마스터 코드만이 아니라 회원 로그인도 필요할 수 있습니다.)');
    }
    if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
      throw new Error('네트워크가 불안정합니다. 잠시 후 다시 시도해주세요.');
    }
    if (error?.message) {
      throw error;
    }
    throw new Error('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
  }
};

const IMGBB_API_KEY = CONFIG.IMGBB?.API_KEY || '4c975214037cdf1889d5d02a01a7831d';

/**
 * 이미지를 ImgBB에 업로드
 */
export const uploadImageToImgBB = async (base64Image, fileName) => {
    try {
        // base64 데이터 추출 (data:image/jpeg;base64, 부분 제거)
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        
        // ImgBB API는 base64 문자열을 직접 받을 수 있음
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64Data);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        // 응답 상태 확인
        if (!response.ok) {
            const errorText = await response.text();
            console.error('ImgBB API 응답 오류:', response.status, errorText);
            throw new Error(`이미지 업로드 실패 (HTTP ${response.status})`);
        }

        const data = await response.json();
        
        // 응답 데이터 확인
        if (!data) {
            throw new Error('서버 응답이 비어있습니다.');
        }

        if (data.success && data.data && data.data.url) {
            return {
                success: true,
                url: data.data.url,
                deleteUrl: data.data.delete_url || null,
                id: data.data.id
            };
        } else {
            // 에러 메시지 추출
            const errorMessage = data.error?.message || 
                                data.error || 
                                (typeof data.error === 'string' ? data.error : null) ||
                                '이미지 업로드 실패';
            console.error('ImgBB API 에러 응답:', data);
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('이미지 업로드 오류:', error);
        // 네트워크 오류인 경우
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        }
        // 이미 에러 메시지가 있는 경우 그대로 전달
        if (error.message) {
            throw error;
        }
        throw new Error('이미지 업로드 중 알 수 없는 오류가 발생했습니다.');
    }
};

/**
 * 파일을 Base64로 변환
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * 이미지 리사이징 (base64 문자열 또는 File 객체 모두 지원)
 */
export const resizeImage = (input, maxWidth, maxHeight = null, quality = 0.9) => {
    return new Promise((resolve, reject) => {
        // maxHeight가 없으면 maxWidth와 동일하게 설정
        const maxH = maxHeight || maxWidth;
        
        // input이 base64 문자열인지 File 객체인지 확인
        const isBase64 = typeof input === 'string' && (input.startsWith('data:') || !input.includes('/'));
        
        const processImage = (imageSrc, mimeType = 'image/jpeg') => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 비율 유지하면서 리사이징
                if (width > maxWidth || height > maxH) {
                    const ratio = Math.min(maxWidth / width, maxH / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    } else {
                        reject(new Error('이미지 리사이징 실패'));
                    }
                }, mimeType, quality);
            };
            img.onerror = reject;
            img.src = imageSrc;
        };
        
        if (isBase64) {
            // base64 문자열인 경우
            const mimeType = input.startsWith('data:') 
                ? input.split(',')[0].split(':')[1].split(';')[0] 
                : 'image/jpeg';
            processImage(input, mimeType);
        } else {
            // File 객체인 경우
            const reader = new FileReader();
            reader.onload = (e) => {
                processImage(e.target.result, input.type || 'image/jpeg');
            };
            reader.onerror = reject;
            reader.readAsDataURL(input);
        }
    });
};

/**
 * 로고 또는 파비콘을 GitHub에 업로드하기 위해 다운로드
 */
export const uploadLogoOrFaviconToGitHub = async (file, type, options = {}) => {
    try {
        let base64Image;
        
        if (type === 'logo' && options.maxWidth && options.maxHeight) {
            base64Image = await resizeImage(file, options.maxWidth, options.maxHeight, options.quality || 0.9);
        } else {
            base64Image = await fileToBase64(file);
        }
        
        const blob = await fetch(base64Image).then(r => r.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (type === 'logo') {
            const extension = file.name.split('.').pop() || 'png';
            a.download = `logo.${extension}`;
            alert('로고 파일을 다운로드했습니다.\n이제 깃허브의 assets/images/ 폴더에 업로드해주세요.');
        } else if (type === 'favicon') {
            const fileName = file.name || 'favicon.ico';
            a.download = fileName;
            alert('파비콘 파일을 다운로드했습니다.\n이제 깃허브의 assets/images/ 폴더에 업로드해주세요.');
        }
        
        a.click();
        URL.revokeObjectURL(url);
        
        return {
            success: true,
            url: base64Image,
            message: '파일을 다운로드했습니다. 깃허브에 수동으로 업로드해주세요.',
            githubPath: type === 'logo' 
                ? 'assets/images/logo.png'
                : `assets/images/${file.name || 'favicon.ico'}`
        };
    } catch (error) {
        throw error;
    }
};
