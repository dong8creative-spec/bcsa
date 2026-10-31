/**
 * 기본 프로필 그림 (이름 첫 글자) — 브라우저 안에서 SVG로 만든다.
 * 예전에는 ui-avatars.com 주소에 회원 이름을 넣어 썼는데, 그 주소를 그릴 때마다 이름이
 * 해외 서비스로 전송되어 개인정보처리방침에 없는 국외 이전이 됐다. 이제 외부로 보내지 않는다.
 */

const PALETTE = ['#2563EB', '#0F766E', '#7C3AED', '#C2410C', '#BE185D', '#15803D', '#0369A1', '#B45309'];

/** 외부 아바타 생성 서비스 주소인지 (이 주소는 그리지 않고 로컬 그림으로 바꾼다) */
export const isExternalAvatarUrl = (url) =>
    typeof url === 'string' && /^(https?:)?\/\/(www\.)?ui-avatars\.com\//i.test(url.trim());

const hashString = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
};

const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/** 이름에서 표시할 글자: 한글은 첫 글자, 영문은 앞 두 단어의 머리글자 */
export const getInitials = (name) => {
    const n = String(name || '').trim();
    if (!n) return '';
    if (/^[A-Za-z]/.test(n)) {
        const parts = n.split(/\s+/).filter(Boolean);
        return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    }
    return Array.from(n)[0];
};

/** 이름 첫 글자 SVG data URI (네트워크 요청 없음) */
export const buildInitialsAvatar = (name) => {
    const initials = getInitials(name);
    const bg = PALETTE[hashString(String(name || '회원')) % PALETTE.length];
    const text = initials
        ? `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="SUIT, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="${initials.length > 1 ? 38 : 44}" font-weight="600" fill="#ffffff">${escapeXml(initials)}</text>`
        : '<circle cx="50" cy="40" r="16" fill="#ffffff" opacity=".9"/><path d="M20 86c4-17 16-26 30-26s26 9 30 26z" fill="#ffffff" opacity=".9"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${text}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/**
 * 회원 프로필 사진 표시용 주소. 사진이 없거나 예전 ui-avatars 주소면 로컬 그림을 쓴다.
 * @param {string|object} img 저장된 img 값(문자열 또는 { url | firebase | imgbb })
 * @param {string} name 회원 이름(로컬 그림 글자용, 외부로 보내지 않음)
 */
export const getProfileImageUrl = (img, name) => {
    let url = '';
    if (typeof img === 'string') url = img.trim();
    else if (img && typeof img === 'object') url = String(img.url || img.firebase || img.imgbb || '').trim();
    if (!url || isExternalAvatarUrl(url)) return buildInitialsAvatar(name);
    return url;
};

/** 저장 전에 외부 아바타 주소를 지운다 (빈 값이면 화면에서 로컬 그림을 그린다) */
export const stripExternalAvatar = (img) => (isExternalAvatarUrl(img) ? '' : (img || ''));
