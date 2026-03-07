/**
 * App.jsx에서 사용하는 순수 유틸/헬퍼 (상태 의존 없음)
 */

/** 승인된 회원만 필터링 (approvalStatus가 'approved'이거나 없는 회원) */
export function filterApprovedMembers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter((user) => {
    const isApproved = !user.approvalStatus || user.approvalStatus === 'approved';
    return isApproved;
  });
}

/** 카테고리별 컬러 클래스 반환 */
export function getCategoryColor(category) {
  const colorMap = {
    '네트워킹 모임': 'bg-green-100 text-green-700',
    '교육/세미나': 'bg-blue-100 text-blue-700',
    '커피챗': 'bg-amber-100 text-amber-700',
    '네트워킹/모임': 'bg-green-100 text-green-700',
    '투자/IR': 'bg-orange-100 text-orange-700',
    '멘토링/상담': 'bg-purple-100 text-purple-700',
    '기타': 'bg-gray-100 text-gray-700',
  };
  return colorMap[category] || 'bg-gray-100 text-gray-700';
}

/** 마감임박 여부 (시작 3일 이내 또는 참가율 80% 이상) */
export function isDeadlineSoon(seminar) {
  if (!seminar?.dateObj) return false;
  const today = new Date();
  const daysLeft = Math.ceil((seminar.dateObj - today) / (1000 * 60 * 60 * 24));
  const participantRatio = (seminar.currentParticipants || 0) / (seminar.maxParticipants || 999);
  return daysLeft <= 3 || participantRatio >= 0.8;
}
