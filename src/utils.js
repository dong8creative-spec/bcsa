/**
 * 유틸리티 함수 모음
 */

/**
 * 세미나 상태 계산 함수
 * @param {string} dateStr - 날짜 문자열 (YYYY.MM.DD 형식)
 * @returns {string} 상태 ('미정' | '모집중' | '마감임박' | '종료')
 */
export const calculateStatus = (dateStr) => {
    if (!dateStr) return "미정";
    const matches = dateStr.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
    if (!matches) return "모집중";
    
    try {
        const year = parseInt(matches[1]);
        const month = parseInt(matches[2]) - 1;
        const day = parseInt(matches[3]);
        const seminarDate = new Date(year, month, day);
        const today = new Date();
        seminarDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = seminarDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return "종료";
        if (diffDays <= 14) return "마감임박";
        return "모집중";
    } catch (error) {
        console.error('날짜 계산 오류:', error);
        return "모집중";
    }
};

/**
 * Google Drive 링크를 이미지 URL로 변환
 * @param {string} url - Google Drive 공유 링크
 * @returns {string} 변환된 이미지 URL
 */
export const convertDriveLink = (url) => {
    if (!url) return "";
    if (url.includes('drive.google.com') && url.includes('/d/')) {
        try {
            const fileId = url.split('/d/')[1].split('/')[0];
            return `https://drive.google.com/uc?export=view&id=${fileId}`;
        } catch (e) {
            console.error('Drive 링크 변환 오류:', e);
            return url;
        }
    }
    return url;
};

/**
 * CSV 데이터 파싱 함수 (개선된 버전 - 따옴표 및 셀 내부 쉼표 처리)
 * @param {string} csvText - CSV 텍스트
 * @returns {Array} 파싱된 데이터 배열
 */
export const parseCSV = (csvText) => {
    if (!csvText) return [];
    
    try {
        const lines = csvText.trim().split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        // CSV 파싱 함수 (따옴표 처리)
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // 이스케이프된 따옴표
                        current += '"';
                        i++; // 다음 따옴표 건너뛰기
                    } else {
                        // 따옴표 시작/끝
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // 필드 구분자
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            // 마지막 필드 추가
            result.push(current.trim());
            return result;
        };
        
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]).map(v => {
                // 따옴표 제거 및 빈 값 처리
                const cleaned = v.replace(/^"|"$/g, '');
                return cleaned === '' ? '' : cleaned;
            });
            
            const item = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // JSON 문자열인 경우 파싱 시도
                if (value.startsWith('[') || value.startsWith('{')) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        // JSON 파싱 실패 시 문자열 그대로 사용
                    }
                }
                
                item[header] = value;
            });
            
            // 빈 행 필터링 (모든 값이 비어있지 않은 경우만 추가)
            if (Object.values(item).some(v => v !== '' && v !== null && v !== undefined)) {
                data.push(item);
            }
        }
        
        return data;
    } catch (error) {
        console.error('CSV 파싱 오류:', error);
        return [];
    }
};

/**
 * Google Sheets에서 데이터 가져오기 (재시도 로직 포함)
 * @param {string} url - Google Sheets CSV URL
 * @param {number} retries - 재시도 횟수 (기본: 3)
 * @param {number} delay - 재시도 지연 시간 (ms, 기본: 1000)
 * @returns {Promise<Array>} 데이터 배열
 */
export const fetchSheetData = async (url, retries = 3, delay = 1000) => {
    if (!url) {
        console.warn('시트 URL이 비어있습니다.');
        return [];
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            const data = parseCSV(csvText);
            
            // 빈 데이터 체크
            if (data.length === 0 && i < retries - 1) {
                console.warn(`데이터가 비어있습니다. 재시도 중... (${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            return data;
        } catch (error) {
            console.error(`시트 데이터 가져오기 오류 (시도 ${i + 1}/${retries}):`, error);
            
            // 마지막 시도가 아니면 재시도
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                handleError(error, 'fetchSheetData');
                return [];
            }
        }
    }
    
    return [];
};

/**
 * 날짜 포맷팅 함수
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @param {string} format - 포맷 형식 (기본: 'YYYY.MM.DD')
 * @returns {string} 포맷된 날짜 문자열
 */
export const formatDate = (date, format = 'YYYY.MM.DD') => {
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    } catch (error) {
        console.error('날짜 포맷팅 오류:', error);
        return '';
    }
};

/**
 * 에러 핸들링 헬퍼
 * @param {Error} error - 에러 객체
 * @param {string} context - 에러 발생 컨텍스트
 */
export const handleError = (error, context = '') => {
    console.error(`[${context}] 에러 발생:`, error);
    // 필요시 사용자에게 알림 표시
    // alert(`오류가 발생했습니다: ${error.message}`);
};

/**
 * 이미지 로드 실패 시 대체 이미지 설정
 * @param {HTMLElement} imgElement - 이미지 엘리먼트
 * @param {string} fallbackUrl - 대체 이미지 URL
 */
export const setImageFallback = (imgElement, fallbackUrl = '') => {
    if (!imgElement) return;
    
    imgElement.onerror = () => {
        if (fallbackUrl) {
            imgElement.src = fallbackUrl;
        } else {
            // 기본 아바타 생성
            const name = imgElement.alt || 'User';
            imgElement.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        }
    };
};

/**
 * 객체 배열을 CSV 문자열로 변환
 * @param {Array} data - 변환할 데이터 배열
 * @param {Array} headers - CSV 헤더 배열 (선택사항, 자동 감지 가능)
 * @returns {string} CSV 문자열
 */
export const convertToCSV = (data, headers = null) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return '';
    }
    
    try {
        // 헤더 자동 감지
        if (!headers) {
            headers = Object.keys(data[0]);
        }
        
        // CSV 이스케이프 함수 (쉼표, 따옴표, 줄바꿈 처리)
        const escapeCSV = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            
            // 배열이나 객체인 경우 JSON 문자열로 변환
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            } else {
                value = String(value);
            }
            
            // 쉼표, 따옴표, 줄바꿈이 있으면 따옴표로 감싸기
            if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                // 따옴표는 두 개로 이스케이프
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }
            
            return value;
        };
        
        // 헤더 행 생성
        const headerRow = headers.map(escapeCSV).join(',');
        
        // 데이터 행 생성
        const dataRows = data.map(item => {
            return headers.map(header => {
                const value = item[header];
                return escapeCSV(value);
            }).join(',');
        });
        
        // CSV 문자열 조합
        return [headerRow, ...dataRows].join('\n');
    } catch (error) {
        console.error('CSV 변환 오류:', error);
        return '';
    }
};



