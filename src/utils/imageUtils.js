/**
 * 이미지 처리 유틸리티 함수
 *
 * 이미지 저장소는 Firebase Storage 하나만 쓴다 (2026-11 개정).
 * 예전에는 ImgBB(해외 무료 이미지 호스팅)로도 올렸으나, 위탁 계약이 없고 서버 국가를 알 수 없어
 * 회원·관리자 업로드 모두 중단했다. 이미 ImgBB에 있는 이미지의 삭제(delete_url 호출)만 남겨 둔다.
 */

import app, { auth } from '../firebase';

/** 파일 저장소(Firebase Storage)는 업로드할 때만 내려받는다 (첫 화면 번들 축소) */
let storageModulePromise = null;
const loadStorage = () => {
  if (!storageModulePromise) {
    storageModulePromise = import('firebase/storage').then((m) => ({ ...m, storage: m.getStorage(app) }));
  }
  return storageModulePromise;
};
import { getApiBaseUrl } from './api';

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
    const { ref, uploadBytes, getDownloadURL, storage } = await loadStorage();
    const storageRef = ref(storage, path);
    // 올린 사람 uid를 남겨 두면 storage.rules에서 본인 삭제를 허용할 수 있다
    const ownerUid = auth?.currentUser?.uid || '';
    await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      ...(ownerUid ? { customMetadata: { ownerUid } } : {}),
    });
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    const code = error?.code || error?.name || '';
    if (isStorageAuthError(code)) {
      throw new Error('이미지 업로드에는 로그인이 필요합니다. 홈에서 로그인한 뒤 다시 시도해 주세요.');
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

/** data: URL(WebP 등) → Firebase Storage 업로드 후 다운로드 URL */
export const uploadDataUrlToStorage = async (dataUrl, type = 'program', fileName = 'image.webp') => {
  if (!dataUrl || typeof dataUrl !== 'string') throw new Error('이미지 데이터가 없습니다.');
  const file = await dataURLToFile(dataUrl, fileName, 'image/webp');
  return uploadImageToStorage(file, type);
};

/**
 * 사이트에 등록·업로드되는 이미지 공통: WebP 인코딩 품질 (0~1, 약 85%)
 */
export const UPLOAD_WEBP_QUALITY = 0.85;

const PROGRAM_QUALITY = UPLOAD_WEBP_QUALITY;

/**
 * 사이트 이미지 업로드 공통: Cloud Functions(sharp)만 사용 — 원본 1/2 + WebP(기본 85%).
 * VITE_API_URL 미설정·API 실패 시 에러(브라우저 캔버스/JPEG 폴백 없음).
 */
async function encodeHalfWebpViaServer(imageDataUrl, quality) {
  const base = (getApiBaseUrl() || '').trim();
  if (!base) {
    throw new Error(
      '이미지는 WebP로만 저장됩니다. 빌드 환경에 VITE_API_URL(apiBid 루트 URL)을 설정해주세요.'
    );
  }
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new Error('이미지 데이터가 없습니다.');
  }
  const url = `${base.replace(/\/$/, '')}/api/images/encode-webp`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, quality }),
    });
  } catch (e) {
    throw new Error(
      `이미지 WebP 변환 API에 연결할 수 없습니다. 네트워크와 VITE_API_URL을 확인해주세요. (${e?.message || 'network'})`
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = typeof errJson?.error === 'string' ? errJson.error : '';
    } catch {
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* no-op */
      }
    }
    throw new Error(detail || `이미지 WebP 변환 실패 (HTTP ${res.status})`);
  }
  const j = await res.json();
  const dataUrl = j?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/webp')) {
    throw new Error('이미지 변환 응답이 올바른 WebP가 아닙니다.');
  }
  return dataUrl;
}

/**
 * File → data URL(원본의 1/2 크기, WebP만 — sharp API)
 */
export async function encodeImageHalfWebpDataUrl(file, quality = UPLOAD_WEBP_QUALITY) {
  if (typeof window === 'undefined' || !file) {
    return Promise.reject(new Error('encodeImageHalfWebpDataUrl: File이 필요합니다.'));
  }
  return encodeHalfWebpViaServer(await fileToBase64(file), quality);
}

/**
 * data: URL(또는 base64) → data URL(원본의 1/2 크기, WebP만 — sharp API)
 */
export async function encodeImageHalfWebpFromDataUrl(dataUrl, quality = UPLOAD_WEBP_QUALITY) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return Promise.reject(new Error('data URL이 필요합니다.'));
  }
  return encodeHalfWebpViaServer(dataUrl, quality);
}

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

export async function fileToHalfWebpFile(file, quality = UPLOAD_WEBP_QUALITY) {
  const dataUrl = await encodeImageHalfWebpDataUrl(file, quality);
  return dataURLToFile(dataUrl, toWebpFileName(file.name), 'image/webp');
}

/**
 * Admin 전용 이미지 업로드 (프로그램·포스터·지원사업·공지 이미지): Firebase Storage
 * (원본의 1/2 픽셀 + WebP 품질 기본 UPLOAD_WEBP_QUALITY)
 * @param {File} file - 업로드할 이미지 파일
 * @param {Object} options - { quality?: number, type?: 'program' | 'content' }
 * @returns {Promise<{ url: string, deleteUrl: null }>} deleteUrl은 예전 ImgBB 호환용(항상 null)
 */
export const uploadImageForAdminWithMeta = async (file, options = {}) => {
  const quality = options.quality ?? PROGRAM_QUALITY;
  const type = IMAGE_TYPES.includes(options.type) ? options.type : 'program';
  const webpFile = await fileToHalfWebpFile(file, quality);
  const url = await uploadImageToStorage(webpFile, type);
  if (url) return { url, deleteUrl: null };
  throw new Error('이미지 업로드에 실패했습니다.');
};

export const uploadImageForAdmin = async (file, options = {}) => {
  const { url } = await uploadImageForAdminWithMeta(file, options);
  return url;
};

/** @deprecated Admin은 uploadImageForAdmin 사용. 프로그램 등록 호환용 별칭 */
export const uploadProgramImage = uploadImageForAdmin;

/**
 * (호환용) 예전 이중 업로드 함수. 이제 Firebase Storage에만 올린다.
 * @returns {Promise<{ firebase: string | null, imgbb: null }>}
 */
export const uploadImageDual = async (file, type = 'program') => {
  const fileToUse = await fileToHalfWebpFile(file, PROGRAM_QUALITY);
  try {
    const url = await uploadImageToStorage(fileToUse, type);
    return { firebase: url || null, imgbb: null };
  } catch (_) {
    return { firebase: null, imgbb: null };
  }
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
 * 회원·관리자 공통 이미지 업로드: Firebase Storage만 사용 (ImgBB 폴백 없음)
 * @returns {Promise<{ url: string, deleteUrl: null, storage: 'firebase' }>}
 */
export const uploadImageWithMeta = async (file, type = 'program') => {
  const fileToUse = await fileToHalfWebpFile(file, PROGRAM_QUALITY);
  const url = await uploadImageToStorage(fileToUse, type);
  if (!url) throw new Error('이미지 업로드 후 주소를 받지 못했습니다. 다시 시도해 주세요.');
  return { url, deleteUrl: null, storage: 'firebase' };
};

/**
 * 통합 이미지 업로드 (Firebase Storage)
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} type - 이미지 유형 (program | content | community | company)
 * @returns {Promise<string>} 업로드된 이미지의 URL
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

const isOurStorageUrl = (u) =>
  typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/images%2F/i.test(u.trim());

/**
 * Firestore 문서에서 우리 Firebase Storage 이미지 주소(images/…) 수집
 * @returns {string[]}
 */
export function collectStorageImageUrlsFromPayload(data) {
  if (!data || typeof data !== 'object') return [];
  const set = new Set();
  const push = (v) => {
    const url = normalizeImageItem(v);
    if (isOurStorageUrl(url)) set.add(url.trim());
  };
  [data.posterUrl, data.thumbnailUrl, data.imageUrl].forEach(push);
  const lists = [data.images, data.imageUrls, data.reviewImages, data.storeImages, data.itemImages, data.photos];
  for (const list of lists) {
    if (Array.isArray(list)) list.forEach(push);
  }
  return [...set];
}

/** Firebase Storage 이미지 삭제(실패 무시). 규칙상 관리자 또는 올린 본인(ownerUid)만 지울 수 있다 */
export async function deleteStorageImageByUrl(url) {
  if (!isOurStorageUrl(url)) return;
  try {
    const { ref, deleteObject, storage } = await loadStorage();
    await deleteObject(ref(storage, url));
  } catch (e) {
    console.warn('[Storage] 이미지 삭제 실패(무시):', e?.code || e?.message);
  }
}

/**
 * payload에 있는 호스팅 이미지 정리(병렬, 실패 무시)
 * - 예전 ImgBB 이미지: delete_url 호출
 * - Firebase Storage 이미지: 파일 삭제
 */
export async function deleteHostedImagesForPayload(data) {
  const urls = collectImgbbDeleteUrlsFromPayload(data);
  const storageUrls = collectStorageImageUrlsFromPayload(data);
  await Promise.allSettled([
    ...urls.map((d) => requestImgbbImageDeletion(d)),
    ...storageUrls.map((u) => deleteStorageImageByUrl(u)),
  ]);
}

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
 * 이미지를 WebP File로 변환 (원본의 1/2 픽셀 + WebP, sharp API만)
 */
export const convertToWebP = (file, quality = UPLOAD_WEBP_QUALITY) =>
  fileToHalfWebpFile(file, quality);

/**
 * 로고 또는 파비콘을 GitHub에 업로드하기 위해 다운로드
 */
export const uploadLogoOrFaviconToGitHub = async (file, type, options = {}) => {
    try {
        let base64Image;
        if (type === 'logo') {
            base64Image = await encodeImageHalfWebpDataUrl(file, options.quality ?? UPLOAD_WEBP_QUALITY);
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
