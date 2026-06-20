/** Firestore 사용자 문서 기준 관리자 여부 (관리자 페이지·API 공통) */
export function isAdminUser(userDoc) {
  if (!userDoc) return false;
  const role = String(userDoc.role || '').trim();
  if (role === 'admin' || role === 'master') return true;
  const grade = String(userDoc.memberGrade || '').trim();
  return grade === '마스터' || grade === '운영진';
}
