/**
 * 프로그램(세미나) 표시용 유틸: 정모 여부, 정원, 모집 종료 후 확정 인원 등
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

/** 프로그램 `date` 문자열 → 비교용 타임스탬프 (관리 화면과 동일 규칙) */
const parseSeminarDateToMs = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  const num = trimmed.replace(/\D/g, '');
  if (num.length >= 8) {
    const y = parseInt(num.slice(0, 4), 10);
    const m = parseInt(num.slice(4, 6), 10) - 1;
    const d = parseInt(num.slice(6, 8), 10);
    const h = num.length >= 10 ? parseInt(num.slice(8, 10), 10) : 0;
    const min = num.length >= 12 ? parseInt(num.slice(10, 12), 10) : 0;
    return new Date(y, m, d, h, min).getTime();
  }
  return 0;
};

const getTodayStartMs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * 모집이 끝난 것으로 볼 조건 (관리자가 최종 인원을 정정할 수 있는 시점과 동일)
 * — 상태 종료·후기 단계, 관리자 모집 중단, 또는 행사일이 지난 경우
 */
export const isSeminarRecruitmentEnded = (seminar) => {
  if (!seminar) return false;
  const st = seminar.status || '';
  if (st === '종료' || st === '후기작성가능') return true;
  if (seminar.recruitmentClosedByAdmin) return true;
  const t = parseSeminarDateToMs(seminar.date);
  if (t > 0 && t < getTodayStartMs()) return true;
  return false;
};

/** @deprecated 이름 통일용 별칭 */
export const isSeminarEligibleForFinalParticipantAdjust = isSeminarRecruitmentEnded;

/**
 * Firestore에 저장된 정원 (maxParticipants 또는 capacity). 0이면 미설정.
 */
export const getSeminarCapacity = (seminar) => {
  const n = Number(seminar?.maxParticipants ?? seminar?.capacity);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

/**
 * 모집 종료 후 관리자가 저장한 `finalParticipantCount`가 있으면 공개 UI에 우선 표시.
 * 없으면 기존 집계(`currentParticipants`, applications 반영 후 값 등).
 */
export const getDisplayedParticipantCurrent = (seminar) => {
  const final = Number(seminar?.finalParticipantCount);
  if (isSeminarRecruitmentEnded(seminar) && Number.isFinite(final) && final >= 0) {
    return Math.floor(final);
  }
  return Number(seminar?.currentParticipants) || 0;
};

/**
 * 신청 인원 UI용: 정원이 없으면 "N명"만, 있으면 current / max.
 * current는 정원을 넘어도 실제 값 그대로 표시 (예: 35/30).
 * @returns {{ mode: 'noCapacity'|'normal', current: number, max?: number }}
 */
export const getParticipantCountDisplay = (seminar) => {
  const cap = getSeminarCapacity(seminar);
  const current = getDisplayedParticipantCurrent(seminar);

  if (cap <= 0) {
    return { mode: 'noCapacity', current };
  }

  return { mode: 'normal', current, max: cap };
};
