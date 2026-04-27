/**
 * App.jsx에서 사용하는 순수 유틸/헬퍼 (상태 의존 없음)
 */

import { getSeminarCapacity, is정모 } from './utils/seminarDisplay';

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
  const cap = getSeminarCapacity(seminar);
  const ratio = cap > 0 ? (seminar.currentParticipants || 0) / cap : 0;
  return daysLeft <= 3 || ratio >= 0.8;
}

/** Firestore Timestamp / Date / millis → 밀리초 (없거나 파싱 실패 시 null) */
export function firestoreLikeToMillis(val) {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  }
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val.getTime();
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
  }
  return null;
}

/**
 * 홈 팝업에 올 세미나 후보(날짜·이미지·정원 필터 적용, 최대 maxSeminars개)
 * @param {Array} seminarsData
 * @param {Date} [now]
 * @param {number} [maxSeminars]
 */
export function getUpcomingSeminarPopupCandidates(seminarsData, now = new Date(), maxSeminars = 3) {
  if (!Array.isArray(seminarsData) || seminarsData.length === 0) return [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const toDateObj = (dateVal) => {
    if (dateVal == null) return null;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal instanceof Date) return Number.isNaN(dateVal.getTime()) ? null : dateVal;
    const str = String(dateVal).trim();
    const matches = str ? str.match(/(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})/) : null;
    if (!matches) return null;
    const year = parseInt(matches[1], 10);
    const month = parseInt(matches[2], 10) - 1;
    const day = parseInt(matches[3], 10);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return seminarsData
    .filter((s) => s.status !== '종료')
    .map((s) => {
      const seminarDate = toDateObj(s.date);
      if (!seminarDate) return null;
      seminarDate.setHours(0, 0, 0, 0);
      if (seminarDate >= today) return { ...s, dateObj: seminarDate };
      return null;
    })
    .filter(Boolean)
    .filter((s) => !!s.img)
    .filter((s) => {
      const full = is정모(s)
        ? false
        : (s.currentParticipants || 0) >= (s.maxParticipants || 999);
      return is정모(s) || !full;
    })
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, maxSeminars)
    .map((s) => ({
      ...s,
      isDeadlineSoon: isDeadlineSoon(s),
    }));
}

const MAX_POPUP_CARDS = 3;

/**
 * 기간 내 활성화된 외부행사 포스터 후보.
 * @param {Array<{ id: string, posterUrl?: string, linkUrl?: string, title?: string, enabled?: boolean, displayStartAt?: unknown, displayEndAt?: unknown, sortOrder?: number }>} externalPosters
 * @param {Date} [now]
 * @param {object} [options]
 * @param {boolean} [options.ignoreDateRange] — true면 기간(시작~종료)이 아닌 것도 이미지+활성이면 후보
 */
export function buildActiveExternalPosterItems(externalPosters, now = new Date(), options = {}) {
  const { ignoreDateRange = false } = options;
  const nowMs = now.getTime();
  return (externalPosters || [])
    .filter((p) => p.enabled !== false && (p.posterUrl || '').toString().trim())
    .filter((p) => {
      if (ignoreDateRange) return true;
      const start = firestoreLikeToMillis(p.displayStartAt);
      const end = firestoreLikeToMillis(p.displayEndAt);
      if (start == null || end == null) return false;
      return nowMs >= start && nowMs <= end;
    })
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((p) => ({
      id: `ext_${p.id}`,
      isExternalPoster: true,
      title: (p.title || '외부 행사').toString(),
      img: (p.posterUrl || '').toString().trim(),
      externalLink: (p.linkUrl || '').toString().trim(),
      isDeadlineSoon: false,
    }));
}

/**
 * 외부행사(기간 내) + 다가오는 프로그램을 합쳐 팝업 카드 최대 3개.
 * 외부는 sortOrder 순, 이후 세미나 날짜순.
 * @param {Array} seminarsData
 * @param {Array} [externalPosters]
 * @param {Date} [now]
 */
export function buildProgramPopupItems(seminarsData, externalPosters, now = new Date()) {
  const activeExternal = buildActiveExternalPosterItems(externalPosters || [], now, {});
  const seminarSlots = Math.max(0, MAX_POPUP_CARDS - activeExternal.length);
  const seminars = getUpcomingSeminarPopupCandidates(seminarsData, now, seminarSlots);
  return [...activeExternal, ...seminars].slice(0, MAX_POPUP_CARDS);
}
