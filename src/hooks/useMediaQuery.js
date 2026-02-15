import { useState, useEffect } from 'react';

/**
 * 미디어 쿼리 매칭 여부를 반환하는 훅 (리사이즈 시 갱신)
 * @param {string} query - CSS 미디어 쿼리 (예: '(max-width: 1399px)')
 * @returns {boolean}
 */
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e) => setMatches(e.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

/** desktop 브레이크포인트(1400px) 미만이면 모바일로 간주 */
export const MOBILE_QUERY = '(max-width: 1399px)';
