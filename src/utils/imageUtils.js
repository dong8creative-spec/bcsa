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

const FIREBASE_UPLOAD_TIMEOUT_MS = 4 * 1000; // 4초 내 응답 없으면 ImgBB 폴백
const PROGRAM_RESIZE_THRESHOLD_BYTES = 200 * 1024; // 200KB 이상이면 이미지 리사이즈 (업로드 용량 감소)
const PROGRAM_MAX_SIZE = 1600; // 프로그램 이미지 최대 긴 변 1600px

/**
 * 사이트에 등록·업로드되는 이미지 공통: WebP 인코딩 품질 (0~1, 약 85%)
 * uploadImage, uploadImageForAdmin, convertToWebP, 리사이즈 WebP 경로에 사용
 */
export const UPLOAD_WEBP_QUALITY = 0.85;

const PROGRAM_QUALITY = UPLOAD_WEBP_QUALITY;

/**
 * Base64 데이터 URL → File 변환 (리사이즈 후 업로드용)
 */
const dataURLToFile = (dataUrl, fileName, mimeType = 'image/jpeg') => {
  return fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => new File([blob], fileName, { type: blob.type || mimeType }));
};

/** 업로드용 파일명을 .webp 확장자로 변환 */
const toWebpFileName = (name) => (name || 'image.jpg').replace(/\.[^.]+$/i, '.webp');

/**
 * Admin 전용 이미지 업로드: ImgBB만 사용 (Firebase 미사용)
 * 프로그램/후기/콘텐츠 등 관리자 업로드는 모두 이 함수 사용
 * 용량이 크면 리사이즈 후 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {Object} options - { maxSize?: number, quality?: number } (기본 1600, UPLOAD_WEBP_QUALITY)
 * @returns {Promise<string>} 업로드된 이미지의 URL
 */
/**
 * Admin 전용: 업로드 후 URL + ImgBB delete_url(삭제용)
 * @returns {Promise<{ url: string, deleteUrl: string | null }>}
 */
export const uploadImageForAdminWithMeta = async (file, options = {}) => {
  // #region agent log
  const __prep0 = Date.now();
  // #endregion
  const maxSize = options.maxSize ?? PROGRAM_MAX_SIZE;
  const quality = options.quality ?? PROGRAM_QUALITY;
  let base64;
  const outName = toWebpFileName(file.name || 'image.jpg');
  if (file.size > PROGRAM_RESIZE_THRESHOLD_BYTES) {
    try {
      const dataUrl = await fileToBase64(file);
      base64 = await resizeImage(dataUrl, maxSize, maxSize, quality, { outputMimeType: 'image/webp' });
    } catch (_) {
      const webpFile = await convertToWebP(file, quality);
      base64 = await fileToBase64(webpFile);
    }
  } else {
    const webpFile = await convertToWebP(file, quality);
    base64 = await fileToBase64(webpFile);
  }
  // #region agent log
  fetch('http://127.0.0.1:7639/ingest/72157b14-4914-4475-b029-d2a102db65f8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'119938'},body:JSON.stringify({sessionId:'119938',runId:'pre-fix',hypothesisId:'H2',location:'imageUtils.js:uploadImageForAdminWithMeta:prep',message:'after webp+base64, before imgbb',data:{prepMs:Date.now()-__prep0,fileSize:file?.size||0,base64Len:typeof base64==='string'?base64.length:0,usedResize:file.size>PROGRAM_RESIZE_THRESHOLD_BYTES},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const result = await uploadImageToImgBB(base64, outName);
  const url = result?.url ?? (typeof result === 'string' ? result : null);
  if (url) {
    return { url, deleteUrl: result?.deleteUrl || null };
  }
  throw new Error(result?.message || '이미지 업로드에 실패했습니다.');
};

export const uploadImageForAdmin = async (file, options = {}) => {
  const { url } = await uploadImageForAdminWithMeta(file, options);
  return url;
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
      const resized = await resizeImage(base64, PROGRAM_MAX_SIZE, PROGRAM_MAX_SIZE, PROGRAM_QUALITY, { outputMimeType: 'image/webp' });
      fileToUse = await dataURLToFile(resized, toWebpFileName(file.name || 'image.jpg'), 'image/webp');
    } catch (_) {
      fileToUse = await convertToWebP(file);
    }
  } else {
    fileToUse = await convertToWebP(file);
  }

  if (isLocalOrigin()) {
    try {
      const base64 = await fileToBase64(fileToUse);
      const result = await uploadImageToImgBB(base64, fileToUse.name || toWebpFileName(file.name) || 'image.webp');
      const url = result?.url ?? (typeof result === 'string' ? result : null);
      return { firebase: null, imgbb: url || null };
    } catch (_) {
      return { firebase: null, imgbb: null };
    }
  }

  const base64 = await fileToBase64(fileToUse);
  const name = fileToUse.name || toWebpFileName(file.name) || 'image.webp';
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
    const url = item.url || item.firebase || item.imgbb || '';
    return typeof url === 'string' ? url : '';
  }
  return '';
};

/** 게시글/썸네일 등: 문자열 URL 또는 { url, deleteUrl } 모두에서 표시용 URL */
export const getDisplayImageUrl = (item) => normalizeImageItem(item);

/**
 * 이미지 배열을 표시용 URL 문자열 배열로 정규화 (기존 소비처 호환)
 */
export const normalizeImagesList = (images) => {
  if (!Array.isArray(images)) return [];
  return images.map(normalizeImageItem).filter((url) => url && url.trim() !== '');
};

/**
 * Firebase Storage(우선) 또는 ImgBB. ImgBB인 경우 delete_url로 이후 완전 삭제 가능
 * @returns {Promise<{ url: string, deleteUrl: string | null, storage: 'firebase' | 'imgbb' }>}
 */
export const uploadImageWithMeta = async (file, type = 'program') => {
  let fileToUse = file;
  if (file.size > PROGRAM_RESIZE_THRESHOLD_BYTES) {
    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64, PROGRAM_MAX_SIZE, PROGRAM_MAX_SIZE, PROGRAM_QUALITY, { outputMimeType: 'image/webp' });
      fileToUse = await dataURLToFile(resized, toWebpFileName(file.name || 'image.jpg'), 'image/webp');
    } catch (_) {
      fileToUse = await convertToWebP(file);
    }
  } else {
    fileToUse = await convertToWebP(file);
  }

  try {
    const url = await Promise.race([
      uploadImageToStorage(fileToUse, type),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), FIREBASE_UPLOAD_TIMEOUT_MS)
      ),
    ]);
    return { url, deleteUrl: null, storage: 'firebase' };
  } catch (e) {
    /* ImgBB 폴백 */
  }
  const base64 = await fileToBase64(fileToUse);
  const result = await uploadImageToImgBB(base64, fileToUse.name || toWebpFileName(file.name) || 'image.webp');
  const url = result?.url ?? (typeof result === 'string' ? result : null);
  if (url) {
    return { url, deleteUrl: result?.deleteUrl || null, storage: 'imgbb' };
  }
  throw new Error(result?.message || 'ImgBB 업로드 후 URL을 받지 못했습니다.');
};

/**
 * 통합 이미지 업로드: Firebase Storage 시도 후 실패/타임아웃 시 ImgBB 폴백
 * (프로그램 등록은 uploadProgramImage 사용 권장)
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} type - 이미지 유형 (program | content | community | company). Firebase 경로에만 사용됨.
 * @returns {Promise<string>} 업로드된 이미지의 URL (Firebase 또는 ImgBB)
 */
export const uploadImage = async (file, type = 'program') => {
  const { url } = await uploadImageWithMeta(file, type);
  return url;
};

/**
 * Firestore에 저장된 문서(게시글·맛집·외부포스터 등)에서 ImgBB 삭제 URL 수집
 * @param {object} data
 * @returns {string[]}
 */
export function collectImgbbDeleteUrlsFromPayload(data) {
  if (!data || typeof data !== 'object') return [];
  const set = new Set();
  if (data.posterDeleteUrl) set.add(String(data.posterDeleteUrl).trim());
  if (Array.isArray(data.imageDeleteUrls)) {
    data.imageDeleteUrls.forEach((u) => {
      if (u) set.add(String(u).trim());
    });
  }
  const lists = [data.images, data.reviewImages, data.storeImages, data.itemImages, data.photos];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      if (it && typeof it === 'object') {
        if (it.deleteUrl) set.add(String(it.deleteUrl).trim());
        if (it.imgbbDeleteUrl) set.add(String(it.imgbbDeleteUrl).trim());
      }
    }
  }
  return [...set].filter((u) => u.length > 0);
}

/**
 * ImgBB에서 이미지 제거(업로드 응답의 delete_url GET). CORS로 실패해도 no-cors로 1회 시도
 * @param {string} deleteUrl
 */
export async function requestImgbbImageDeletion(deleteUrl) {
  if (!deleteUrl || typeof deleteUrl !== 'string') return;
  const u = deleteUrl.trim();
  if (!u.startsWith('http')) return;
  try {
    await fetch(u, { method: 'GET', mode: 'cors' });
  } catch (_) {
    try {
      await fetch(u, { method: 'GET', mode: 'no-cors' });
    } catch (e2) {
      console.warn('[ImgBB] delete 요청 실패(무시):', e2);
    }
  }
}

/**
 * payload에 수집된 모든 ImgBB delete URL 호출(병렬, 실패 무시)
 */
export async function deleteHostedImagesForPayload(data) {
  const urls = collectImgbbDeleteUrlsFromPayload(data);
  await Promise.allSettled(urls.map((d) => requestImgbbImageDeletion(d)));
}

const IMGBB_FETCH_TIMEOUT_MS = 25 * 1000; // 25초 내 응답 없으면 중단 (업로드 중 무한 대기 방지)

/**
 * 이미지를 ImgBB에 업로드 (타임아웃 적용)
 */
export const uploadImageToImgBB = async (base64Image, fileName) => {
    // #region agent log
    const __tFetch0 = Date.now();
    // #endregion
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMGBB_FETCH_TIMEOUT_MS);

    try {
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64Data);
        // #region agent log
        fetch('http://127.0.0.1:7639/ingest/72157b14-4914-4475-b029-d2a102db65f8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'119938'},body:JSON.stringify({sessionId:'119938',runId:'pre-fix',hypothesisId:'H1',location:'imageUtils.js:uploadImageToImgBB:fetchStart',message:'imgbb fetch start',data:{base64DataLen:base64Data.length,fileName:fileName||'',timeoutMs:IMGBB_FETCH_TIMEOUT_MS},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        // #region agent log
        fetch('http://127.0.0.1:7639/ingest/72157b14-4914-4475-b029-d2a102db65f8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'119938'},body:JSON.stringify({sessionId:'119938',runId:'pre-fix',hypothesisId:'H1',location:'imageUtils.js:uploadImageToImgBB:fetchOk',message:'imgbb response received',data:{ok:response.ok,status:response.status,elapsedMs:Date.now()-__tFetch0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

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
        // #region agent log
        fetch('http://127.0.0.1:7639/ingest/72157b14-4914-4475-b029-d2a102db65f8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'119938'},body:JSON.stringify({sessionId:'119938',runId:'pre-fix',hypothesisId:'H1',location:'imageUtils.js:uploadImageToImgBB:catch',message:'imgbb fetch failed',data:{errorName:error?.name,errorMessage:String(error?.message||''),isAbort:error?.name==='AbortError',elapsedMs:Date.now()-__tFetch0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
 * @param {Object} options - { outputMimeType?: 'image/webp' } 출력을 WebP로 할 때 사용 (미지원 브라우저는 원본 포맷으로 폴백)
 */
export const resizeImage = (input, maxWidth, maxHeight = null, quality = 0.9, options = {}) => {
    return new Promise((resolve, reject) => {
        const maxH = maxHeight || maxWidth;
        const isBase64 = typeof input === 'string' && (input.startsWith('data:') || !input.includes('/'));
        const outputMimeType = options.outputMimeType || null;

        const processImage = (imageSrc, mimeType = 'image/jpeg') => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxH) {
                    const ratio = Math.min(maxWidth / width, maxH / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const tryBlob = (outMime) => {
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        } else if (outMime === 'image/webp') {
                            tryBlob(mimeType);
                        } else {
                            reject(new Error('이미지 리사이징 실패'));
                        }
                    }, outMime, quality);
                };
                tryBlob(outputMimeType === 'image/webp' ? 'image/webp' : mimeType);
            };
            img.onerror = reject;
            img.src = imageSrc;
        };

        if (isBase64) {
            const mimeType = input.startsWith('data:')
                ? input.split(',')[0].split(':')[1].split(';')[0]
                : 'image/jpeg';
            processImage(input, mimeType);
        } else {
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
 * 이미지를 WebP로 변환 (용량 절감, 업로드 전 사용)
 * @param {File} file - 원본 이미지 파일
 * @param {number} quality - 0~1 (기본 UPLOAD_WEBP_QUALITY, 약 85%)
 * @returns {Promise<File>} WebP File (미지원 브라우저는 원본 반환)
 */
export const convertToWebP = (file, quality = UPLOAD_WEBP_QUALITY) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], toWebpFileName(file.name), { type: 'image/webp' }));
        } else {
          resolve(file);
        }
      }, 'image/webp', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

/**
 * 로고 또는 파비콘을 GitHub에 업로드하기 위해 다운로드
 */
export const uploadLogoOrFaviconToGitHub = async (file, type, options = {}) => {
    try {
        let base64Image;
        
        if (type === 'logo' && options.maxWidth && options.maxHeight) {
            base64Image = await resizeImage(file, options.maxWidth, options.maxHeight, options.quality ?? UPLOAD_WEBP_QUALITY, { outputMimeType: 'image/webp' });
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
