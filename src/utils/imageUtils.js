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

const FIREBASE_UPLOAD_TIMEOUT_MS = 6 * 1000; // 6초 내 응답 없으면 ImgBB 폴백 (프로그램 업로드 속도 개선)
const PROGRAM_RESIZE_THRESHOLD_BYTES = 400 * 1024; // 400KB 이상이면 프로그램 이미지 리사이즈
const PROGRAM_MAX_SIZE = 1600; // 프로그램 이미지 최대 긴 변 1600px
const PROGRAM_QUALITY = 0.82;

/**
 * Base64 데이터 URL → File 변환 (리사이즈 후 업로드용)
 */
const dataURLToFile = (dataUrl, fileName, mimeType = 'image/jpeg') => {
  return fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => new File([blob], fileName, { type: blob.type || mimeType }));
};

/**
 * Admin 전용 이미지 업로드: ImgBB만 사용 (Firebase 미사용)
 * 프로그램/후기/콘텐츠 등 관리자 업로드는 모두 이 함수 사용
 * 용량이 크면 리사이즈 후 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {Object} options - { maxSize?: number, quality?: number } (기본 1600, 0.82)
 * @returns {Promise<string>} 업로드된 이미지의 URL
 */
export const uploadImageForAdmin = async (file, options = {}) => {
  const maxSize = options.maxSize ?? PROGRAM_MAX_SIZE;
  const quality = options.quality ?? PROGRAM_QUALITY;
  let base64;
  if (file.size > PROGRAM_RESIZE_THRESHOLD_BYTES) {
    try {
      const dataUrl = await fileToBase64(file);
      base64 = await resizeImage(dataUrl, maxSize, maxSize, quality);
    } catch (_) {
      base64 = await fileToBase64(file);
    }
  } else {
    base64 = await fileToBase64(file);
  }
  const result = await uploadImageToImgBB(base64, file.name || 'image.jpg');
  const url = result?.url ?? (typeof result === 'string' ? result : null);
  if (url) return url;
  throw new Error(result?.message || '이미지 업로드에 실패했습니다.');
};

/** @deprecated Admin은 uploadImageForAdmin 사용. 프로그램 등록 호환용 별칭 */
export const uploadProgramImage = uploadImageForAdmin;

const isLocalOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  const o = window.location.origin;
  return o.startsWith('http://127.0.0.1') || o.startsWith('http://localhost');
};

/**
 * Firebase + ImgBB 이중 업로드. 로컬에서는 Firebase 생략(ImgBB만).
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} type - 'program' | 'community' | 'company'
 * @returns {Promise<{ firebase: string | null, imgbb: string | null }>}
 */
export const uploadImageDual = async (file, type = 'program') => {
  let fileToUse = file;
  if (file.size > PROGRAM_RESIZE_THRESHOLD_BYTES) {
    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64, PROGRAM_MAX_SIZE, PROGRAM_MAX_SIZE, PROGRAM_QUALITY);
      fileToUse = await dataURLToFile(resized, file.name || 'image.jpg', file.type || 'image/jpeg');
    } catch (_) {
      fileToUse = file;
    }
  }

  if (isLocalOrigin()) {
    try {
      const base64 = await fileToBase64(fileToUse);
      const result = await uploadImageToImgBB(base64, fileToUse.name || file.name || 'image.jpg');
      const url = result?.url ?? (typeof result === 'string' ? result : null);
      return { firebase: null, imgbb: url || null };
    } catch (_) {
      return { firebase: null, imgbb: null };
    }
  }

  const base64 = await fileToBase64(fileToUse);
  const name = fileToUse.name || file.name || 'image.jpg';
  const [firebaseResult, imgbbResult] = await Promise.allSettled([
    uploadImageToStorage(fileToUse, type),
    uploadImageToImgBB(base64, name)
  ]);
  const firebaseUrl = firebaseResult.status === 'fulfilled' ? firebaseResult.value : null;
  const imgbbUrl = imgbbResult.status === 'fulfilled'
    ? (imgbbResult.value?.url ?? (typeof imgbbResult.value === 'string' ? imgbbResult.value : null))
    : null;
  return { firebase: firebaseUrl || null, imgbb: imgbbUrl || null };
};

/**
 * 이미지 항목을 표시용 URL 문자열로 정규화 (문자열 또는 { firebase, imgbb } 객체 지원)
 */
export const normalizeImageItem = (item) => {
  if (item == null) return '';
  if (typeof item === 'string' && item.trim() !== '') return item;
  if (typeof item === 'object' && item !== null) {
    const url = item.firebase || item.imgbb || '';
    return typeof url === 'string' ? url : '';
  }
  return '';
};

/**
 * 이미지 배열을 표시용 URL 문자열 배열로 정규화 (기존 소비처 호환)
 */
export const normalizeImagesList = (images) => {
  if (!Array.isArray(images)) return [];
  return images.map(normalizeImageItem).filter((url) => url && url.trim() !== '');
};

/**
 * 통합 이미지 업로드: Firebase Storage 시도 후 실패/타임아웃 시 ImgBB 폴백
 * (프로그램 등록은 uploadProgramImage 사용 권장)
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} type - 이미지 유형 (program | content | community | company). Firebase 경로에만 사용됨.
 * @returns {Promise<string>} 업로드된 이미지의 URL (Firebase 또는 ImgBB)
 */
export const uploadImage = async (file, type = 'program') => {
  let fileToUse = file;
  if (type === 'program' && file.size > PROGRAM_RESIZE_THRESHOLD_BYTES) {
    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64, PROGRAM_MAX_SIZE, PROGRAM_MAX_SIZE, PROGRAM_QUALITY);
      fileToUse = await dataURLToFile(resized, file.name || 'image.jpg', file.type || 'image/jpeg');
    } catch (_) {
      fileToUse = file;
    }
  }

  let firebaseError;
  try {
    const url = await Promise.race([
      uploadImageToStorage(fileToUse, type),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), FIREBASE_UPLOAD_TIMEOUT_MS)
      ),
    ]);
    return url;
  } catch (e) {
    firebaseError = e;
  }
  try {
    const base64 = await fileToBase64(fileToUse);
    const result = await uploadImageToImgBB(base64, fileToUse.name || file.name || 'image.jpg');
    const url = result?.url ?? (typeof result === 'string' ? result : null);
    if (url) return url;
    throw new Error(result?.message || 'ImgBB 업로드 후 URL을 받지 못했습니다.');
  } catch (imgbbError) {
    throw imgbbError instanceof Error ? imgbbError : new Error(imgbbError?.message || '이미지 업로드에 실패했습니다.');
  }
};

const IMGBB_FETCH_TIMEOUT_MS = 25 * 1000; // 25초 내 응답 없으면 중단 (업로드 중 무한 대기 방지)

/**
 * 이미지를 ImgBB에 업로드 (타임아웃 적용)
 */
export const uploadImageToImgBB = async (base64Image, fileName) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMGBB_FETCH_TIMEOUT_MS);

    try {
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64Data);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ImgBB API 응답 오류:', response.status, errorText);
            throw new Error(`이미지 업로드 실패 (HTTP ${response.status}). ${errorText.slice(0, 80)}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.error('ImgBB 응답 JSON 파싱 실패', parseErr);
            throw new Error('서버 응답 형식 오류입니다. 잠시 후 다시 시도해주세요.');
        }

        if (!data) {
            throw new Error('서버 응답이 비어있습니다.');
        }

        const imageUrl = data.data?.url || data.data?.display_url || data.data?.image?.url;
        if (data.success && imageUrl) {
            return {
                success: true,
                url: imageUrl,
                deleteUrl: data.data?.delete_url || null,
                id: data.data?.id
            };
        }

        const errorMessage = data.error?.message || data.error ||
            (typeof data.error === 'string' ? data.error : null) || '이미지 업로드 실패';
        console.error('ImgBB API 에러 응답:', data);
        throw new Error(errorMessage);
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('이미지 업로드 오류:', error);
        if (error.name === 'AbortError') {
            throw new Error('업로드 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도해주세요.');
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        }
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
