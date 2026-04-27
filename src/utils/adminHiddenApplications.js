/**
 * 관리자가 명단에서만 숨긴 신청 — Firestore 미삭제, localStorage + CustomEvent로
 * 홈·목록 등 공개 UI의 currentParticipants 집계에 반영.
 */

import { SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD } from '../constants/appConstants';

export const ADMIN_HIDDEN_APPLICATIONS_KEY = 'bcsa_admin_hidden_application_ids';

export const ADMIN_HIDDEN_APPLICATIONS_CHANGED = 'bcsa-admin-hidden-applications-changed';

export function notifyAdminHiddenApplicationsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_HIDDEN_APPLICATIONS_CHANGED));
}

/** application.seminarId(또는 programId)를 문자열로 통일 */
export function toSeminarId(v) {
  if (v == null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  if (typeof v === 'object' && v != null) {
    if ('id' in v && v.id != null) return String(v.id);
    if ('path' in v && typeof v.path === 'string') {
      const parts = v.path.split('/');
      return (parts[parts.length - 1] || '').trim();
    }
  }
  return String(v).trim();
}

/** 프로그램(세미나) 문서와 매칭할 식별자 집합 */
export function collectProgramSeminarKeys(program) {
  const keys = new Set();
  const add = (x) => {
    const s = toSeminarId(x);
    if (s) keys.add(s);
  };
  if (!program) return keys;
  add(program.seminarDocumentId);
  add(program.id);
  add(program.seminarId);
  add(program.programId);
  add(program.seminar_id);
  add(program.program_id);
  return keys;
}

/**
 * @returns {Array<{ applicationId: string, programKeys: string[] }>}
 */
export function readAdminHiddenEntries() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_HIDDEN_APPLICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length === 0) return [];
    // 레거시: 문서 id 문자열 배열만 저장되던 형식
    if (typeof parsed[0] === 'string' || typeof parsed[0] === 'number') {
      return parsed
        .filter((id) => id != null && String(id).trim() !== '')
        .map((id) => ({ applicationId: String(id), programKeys: [] }));
    }
    return parsed
      .filter((x) => x && x.applicationId != null && String(x.applicationId).trim() !== '')
      .map((x) => ({
        applicationId: String(x.applicationId),
        programKeys: Array.isArray(x.programKeys) ? x.programKeys.map(String).filter(Boolean) : [],
      }));
  } catch {
    return [];
  }
}

/**
 * @param {Array<{ applicationId: string, programKeys: string[] }>} entries
 */
export function writeAdminHiddenEntries(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_HIDDEN_APPLICATIONS_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('admin hidden entries persist failed', e);
  }
}

function keysFromApplicationRow(app) {
  if (!app) return [];
  return [
    toSeminarId(app.seminarId),
    toSeminarId(app.programId),
    toSeminarId(app.seminar_id),
    toSeminarId(app.program_id),
  ].filter(Boolean);
}

/**
 * 세미나(프로그램) 하나에 대해, 숨김 처리된 신청 건수 (문서당 1회만 카운트)
 * @param {object} seminar
 * @param {Array<{ applicationId: string, programKeys: string[] }>} entries
 * @param {Record<string, object>} appById applicationId -> Firestore 신청 행 (programKeys 비어 있을 때 보조)
 */
export function countHiddenApplicationsForSeminar(seminar, entries, appById = {}) {
  const sKeys = collectProgramSeminarKeys(seminar);
  if (sKeys.size === 0) return 0;
  let n = 0;
  const seen = new Set();
  for (const e of entries) {
    const aid = String(e.applicationId || '');
    if (!aid || seen.has(aid)) continue;
    let keys =
      Array.isArray(e.programKeys) && e.programKeys.length > 0 ? e.programKeys : null;
    if (!keys && appById[aid]) {
      keys = keysFromApplicationRow(appById[aid]);
    }
    if (!keys || keys.length === 0) continue;
    if (keys.some((k) => sKeys.has(k))) {
      seen.add(aid);
      n += 1;
    }
  }
  return n;
}

/** 신규 프로그램: 신청 인원을 applications 건수로만 표시 */
export function seminarUsesApplicationsParticipantCount(seminar) {
  return seminar?.[SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD] === true;
}

/**
 * 세미나에 연결된 applications 문서 수 (ProgramManagement와 동일한 seminar/program 키 매칭)
 */
export function countApplicationsMatchingSeminar(seminar, applications) {
  const keys = collectProgramSeminarKeys(seminar);
  if (keys.size === 0) return 0;
  let n = 0;
  for (const app of applications || []) {
    const cand = [
      toSeminarId(app.seminarId),
      toSeminarId(app.programId),
      toSeminarId(app.seminar_id),
      toSeminarId(app.program_id),
    ].filter(Boolean);
    if (cand.some((c) => keys.has(c))) n += 1;
  }
  return n;
}

/**
 * 공개 UI용:
 * - useApplicationsParticipantCount: applications 매칭 건수(−숨김)만 사용.
 * - 그 외(레거시): Firestore currentParticipants와 applications 매칭 건수 중 큰 값을 쓴 뒤 숨김을 뺌.
 *   (신청은 applications에만 쌓이고 카운터 증가가 실패한 경우에도 명단과 맞게 보이게 함)
 */
export function applyPublicSeminarParticipantDisplay(seminars, applications, entries, appById = {}) {
  const list = Array.isArray(seminars) ? seminars : [];
  const apps = Array.isArray(applications) ? applications : [];
  return list.map((s) => {
    const sub = countHiddenApplicationsForSeminar(s, entries, appById);
    const matched = countApplicationsMatchingSeminar(s, apps);
    const fromField = Number(s.currentParticipants) || 0;
    const base = seminarUsesApplicationsParticipantCount(s)
      ? matched
      : Math.max(fromField, matched);
    const next = Math.max(0, base - sub);
    if (next === fromField && sub === 0) return s;
    return { ...s, currentParticipants: next };
  });
}
