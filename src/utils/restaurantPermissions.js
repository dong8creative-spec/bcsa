/** 소유자 외 맛집 정보 수정 허용 등급(회원 `memberGrade` 값과 일치해야 함) */
const PRIVILEGED_EDIT_MEMBER_GRADES = new Set(['마스터', '파트너사']);

/**
 * 맛집 상세 정보를 수정할 수 있는지 여부
 * — 등록 소유자, 또는 마스터/파트너사 회원등급
 */
export function canEditRestaurantInfo(user, restaurant) {
    if (!user || !restaurant) return false;
    const uid = String(user.id || user.uid || '');
    const ownerId = String(restaurant.ownerId || '');
    if (uid && ownerId && uid === ownerId) return true;
    const grade = String(user.memberGrade ?? '').trim();
    return PRIVILEGED_EDIT_MEMBER_GRADES.has(grade);
}

export function isRestaurantOwner(user, restaurant) {
    if (!user || !restaurant) return false;
    const uid = String(user.id || user.uid || '');
    const ownerId = String(restaurant.ownerId || '');
    return Boolean(uid && ownerId && uid === ownerId);
}
