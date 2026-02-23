/**
 * 프로그램(세미나) 표시용 유틸: 정모 여부, 초과 인원 표시값 등
 */

/** 제목에 '정모' 포함 여부 */
export const is정모 = (seminar) => (seminar?.title || '').includes('정모');

/** id 기반 결정론적 해시 (같은 id면 항상 같은 값) */
const hashId = (id) => (String(id).split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) >>> 0);

/**
 * 정모일 때 표시용 초과 인원: 저장된 값 + 5~8명 임의 추가 (id 기반으로 동일 프로그램은 항상 동일)
 * @param {{ id?: string, overflowParticipants?: number | string, title?: string }} seminar
 * @returns {number} 표시할 초과 인원 수 (정모가 아니거나 없으면 0)
 */
export const getDisplayedOverflow = (seminar) => {
  if (!seminar || !is정모(seminar)) return 0;
  const stored = Number(seminar.overflowParticipants) || 0;
  const id = seminar.id != null ? String(seminar.id) : '';
  const extra = 5 + (hashId(id) % 4); // 5, 6, 7, 8
  return stored + extra;
};
