import React from 'react';

/**
 * 페이지 제목 공통 컴포넌트
 */
const PageTitle = ({ pageKey, pageTitles, defaultText = '', defaultSize = 'text-3xl', defaultWeight = 'font-bold', className = '' }) => {
    // pageTitles가 없거나 해당 키가 없으면 기본값 사용
    const pageTitle = pageTitles && pageTitles[pageKey] ? pageTitles[pageKey] : null;
    const text = pageTitle?.text || defaultText;
    const fontSize = pageTitle?.fontSize || defaultSize;
    const fontWeight = pageTitle?.fontWeight || defaultWeight;
    
    // 기본값이 없으면 빈 문자열 반환
    if (!text) return null;
    
    return (
        <h2 
            className={`${fontSize} ${fontWeight} text-dark mb-2 ${className}`}
            style={{ whiteSpace: 'pre-line' }}
        >
            {text}
        </h2>
    );
};

export default PageTitle;
