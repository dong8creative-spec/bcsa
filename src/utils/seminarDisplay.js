/**
 * 프로그램(세미나) 표시용 유틸: 정모 여부, 정원 등
 */

/** 제목에 '정모' 포함 여부 */
export const is정모 = (seminar) => (seminar?.title || '').includes('정모');

/**
 * 정모에만 의미 있는 Firestore `overflowParticipants` 저장값.
 * 공개 UI의 신청 인원 숫자에는 사용하지 않음(레거시·관리 기록용).
 * @param {{ id?: string, overflowParticipants?: number | string, title?: string }} seminar
 * @returns {number} 정모가 아니면 0, 정모면 저장된 초과 인원(없으면 0)
 */
export const getDisplayedOverflow = (seminar) => {
  if (!seminar || !is정모(seminar)) return 0;
  return Number(seminar.overflowParticipants) || 0;
};

/**
 * Firestore에 저장된 정원 (maxParticipants 또는 capacity). 0이면 미설정.
 */
export const getSeminarCapacity = (seminar) => {
  const n = Number(seminar?.maxParticipants ?? seminar?.capacity);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

/**
 * 신청 인원 UI용: 정원이 없으면 "N명"만, 있으면 실제 집계 기준 current / max.
 * @returns {{ mode: 'noCapacity'|'normal', current: number, max?: number }}
 */
export const getParticipantCountDisplay = (seminar) => {
  const cap = getSeminarCapacity(seminar);
  const rawCurrent = Number(seminar?.currentParticipants) || 0;
  const ended = seminar?.status === '종료';

  if (cap <= 0) {
    return { mode: 'noCapacity', current: rawCurrent };
  }

  const current = ended ? cap : rawCurrent;
  return { mode: 'normal', current, max: cap };
};
