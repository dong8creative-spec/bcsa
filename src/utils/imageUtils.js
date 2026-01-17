/**
 * 이미지 처리 유틸리티 함수
 */

import { CONFIG } from '../config';

const IMGBB_API_KEY = CONFIG.IMGBB?.API_KEY || '4c975214037cdf1889d5d02a01a7831d';

/**
 * 이미지를 ImgBB에 업로드
 */
export const uploadImageToImgBB = async (base64Image, fileName) => {
    try {
        // base64 데이터 추출
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        
        // Blob으로 변환하여 FormData에 추가
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', blob, fileName || 'image.jpg');

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success && data.data && data.data.url) {
            return {
                success: true,
                url: data.data.url,
                deleteUrl: data.data.delete_url || null,
                id: data.data.id
            };
        } else {
            throw new Error(data.error?.message || data.error || '이미지 업로드 실패');
        }
    } catch (error) {
        console.error('이미지 업로드 오류:', error);
        throw error;
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
 * 이미지 리사이징
 */
export const resizeImage = (file, maxWidth, maxHeight, quality = 0.9) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 비율 유지하면서 리사이징
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
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
                }, file.type || 'image/png', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
