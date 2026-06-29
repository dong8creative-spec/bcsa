import { calculateStatus } from './index.js';

export const PROGRAM_RECRUITMENT_FIELDS = {
  PAUSED: 'programRecruitmentPaused',
  START_AT: 'programRecruitmentStartAt',
  END_AT: 'programRecruitmentEndAt',
};

export function toRecruitmentMs(value) {
  if (value == null || value === '') return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds != null) return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getProgramRecruitmentState(content = {}, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const startMs = toRecruitmentMs(content[PROGRAM_RECRUITMENT_FIELDS.START_AT]);
  const endMs = toRecruitmentMs(content[PROGRAM_RECRUITMENT_FIELDS.END_AT]);
  const paused = content[PROGRAM_RECRUITMENT_FIELDS.PAUSED] === true;

  if (paused) {
    return { open: false, reason: 'paused', label: '모집중단', startMs, endMs };
  }
  if (startMs != null && nowMs < startMs) {
    return { open: false, reason: 'before_start', label: '모집예정', startMs, endMs };
  }
  if (endMs != null && nowMs > endMs) {
    return { open: false, reason: 'after_end', label: '모집종료', startMs, endMs };
  }
  return { open: true, reason: 'open', label: '모집중', startMs, endMs };
}

/** 전역 모집 중단/재개 대상: 행사일(마감)이 남아 모집중·마감임박인 프로그램만 */
export function isSeminarEligibleForGlobalRecruitmentControl(seminar) {
  if (!seminar) return false;
  if (seminar.recruitmentClosedByAdmin) return false;
  const naturalStatus = calculateStatus(seminar.date || '');
  return naturalStatus === '모집중' || naturalStatus === '마감임박';
}

export function applyProgramRecruitmentState(seminar, recruitmentState) {
  if (!seminar || recruitmentState?.open !== false) return seminar;
  if (!isSeminarEligibleForGlobalRecruitmentControl(seminar)) return seminar;
  return {
    ...seminar,
    status: '종료',
    recruitmentClosedByGlobalSetting: true,
    recruitmentClosedLabel: recruitmentState.label,
    recruitmentClosedReason: recruitmentState.reason,
  };
}

export function formatProgramRecruitmentRange(content = {}) {
  const startMs = toRecruitmentMs(content[PROGRAM_RECRUITMENT_FIELDS.START_AT]);
  const endMs = toRecruitmentMs(content[PROGRAM_RECRUITMENT_FIELDS.END_AT]);
  const fmt = (ms) => (ms == null ? '' : new Date(ms).toLocaleString('ko-KR'));
  if (startMs != null && endMs != null) return `${fmt(startMs)} ~ ${fmt(endMs)}`;
  if (startMs != null) return `${fmt(startMs)}부터`;
  if (endMs != null) return `${fmt(endMs)}까지`;
  return '상시 모집';
}
