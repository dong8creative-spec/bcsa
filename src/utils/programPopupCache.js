/** 홈 프로그램 팝업 즉시 표시용 localStorage 스냅샷 (맛집 캐시 패턴) */
export const PROGRAM_POPUP_CACHE_KEY = 'bcsa_program_popup_cache_v1';
/** 이번 탭 세션에서 팝업을 닫았음 (탭 닫으면 초기화) */
export const PROGRAM_POPUP_SESSION_DISMISSED_KEY = 'bcsa_program_popup_dismissed_session';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

export function isProgramPopupDismissedThisSession() {
    try {
        if (typeof sessionStorage === 'undefined') return false;
        return sessionStorage.getItem(PROGRAM_POPUP_SESSION_DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

export function markProgramPopupDismissedThisSession() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(PROGRAM_POPUP_SESSION_DISMISSED_KEY, '1');
        }
    } catch (_) {}
}

export function clearProgramPopupSessionDismissed() {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(PROGRAM_POPUP_SESSION_DISMISSED_KEY);
        }
    } catch (_) {}
}

/** 팝업 카드에 필요한 최소 필드만 저장 */
export function pickPopupCacheFields(program) {
    if (!program || typeof program !== 'object') return null;
    return {
        id: program.id,
        title: program.title || '',
        img: program.img || '',
        isExternalPoster: !!program.isExternalPoster,
        externalLink: program.externalLink || '',
        isDeadlineSoon: !!program.isDeadlineSoon,
    };
}

export function readProgramPopupCache() {
    try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(PROGRAM_POPUP_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const savedAt = Number(parsed?.savedAt) || 0;
        if (!savedAt || Date.now() - savedAt > CACHE_TTL_MS) return [];
        const items = parsed?.items;
        return Array.isArray(items) ? items.filter((p) => p && p.img) : [];
    } catch {
        return [];
    }
}

export function writeProgramPopupCache(items) {
    try {
        if (typeof localStorage === 'undefined' || !Array.isArray(items) || items.length === 0) return;
        const payload = {
            savedAt: Date.now(),
            items: items.map(pickPopupCacheFields).filter(Boolean),
        };
        localStorage.setItem(PROGRAM_POPUP_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

/** 포스터 URL preload (표시 전 decode 가속) */
export function preloadPopupImages(programs) {
    if (!Array.isArray(programs)) return;
    programs.forEach((p) => {
        if (p?.img && typeof p.img === 'string') {
            const img = new Image();
            img.src = p.img;
        }
    });
}
