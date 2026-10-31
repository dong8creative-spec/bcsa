/**
 * 세미나(프로그램) 환불 금액 계산 — 순수 함수 (firebase 의존 없음, 단위 테스트 대상)
 *
 * 기준 (2026-10-31 약관 검토 ①-1 반영)
 * 1. 회사 사정으로 취소된 세미나: 언제나 전액.
 * 2. 결제한 날부터 7일 이내이고 세미나 시작 전: 전액 (전자상거래법 제17조 제1항, 제18조 제9항 — 청약철회는 위약금 청구 불가).
 *    날짜는 한국 시간(KST) 달력 기준이며 결제일은 세지 않는다(민법 제157조 초일 불산입).
 *    예) 10월 1일 결제 → 10월 8일 23:59(KST)까지 취소하면 전액.
 * 3. 그 밖의 경우(결제 7일 경과): 세미나 날짜까지 남은 일수로 차등
 *    3일 이상 전 100% · 2일 전 90% · 1일 전 80% · 당일·시작 이후 0%.
 * 4. 시작 시각이 지나면 어떤 경우든 0% (회사 사정 취소 제외).
 *
 * 결제 시각을 알 수 없으면(옛 기록) 호출하는 쪽에서 신청 생성 시각(createdAt)을 넘긴다. 신청 문서는 결제 확인
 * 뒤에 만들어지므로 createdAt은 실제 결제 시각과 같거나 늦다 → 7일 계산이 소비자에게 불리해지지 않는다.
 * 그마저 없으면(paidAt 미상) 사업자가 결제일을 증명할 수 없으므로 7일 이내로 본다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const COOLING_OFF_DAYS = 7;

/** 다양한 시간 표현 → epoch ms (Firestore Timestamp, {seconds}, {_seconds}, Date, ISO 문자열, 숫자) */
export function toMillis(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object') {
    const s = v.seconds ?? v._seconds;
    if (s != null) return Number(s) * 1000 + Math.floor(Number(v.nanoseconds ?? v._nanoseconds ?? 0) / 1e6);
    return null;
  }
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** epoch ms → KST 달력 날짜의 일련번호 (날짜 차이 계산용) */
export function kstDayNumber(ms) {
  return Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
}

/**
 * 세미나 날짜 문자열 파싱. 관리자 화면 형식 "YYYY.MM.DD HH:mm" 외에 "YYYY-MM-DD", "YYYY/MM/DD", ISO도 허용.
 * 시각은 KST로 해석한다.
 * @returns {{ dayNumber: number, startMs: number, hasTime: boolean } | null}
 */
export function parseSeminarDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const tm = s.slice(m[0].length).match(/(\d{1,2}):(\d{2})/);
  const hh = tm ? Number(tm[1]) : 0;
  const mm = tm ? Number(tm[2]) : 0;
  // KST 자정(또는 시작 시각) = UTC 기준 9시간 전
  const startMs = Date.UTC(y, mo - 1, d, hh, mm) - KST_OFFSET_MS;
  const dayNumber = Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS);
  return { dayNumber, startMs, hasTime: !!tm };
}

/**
 * @param {object} p
 * @param {number} p.paidAmount 실제 결제 금액
 * @param {string} p.seminarDate 세미나 날짜("YYYY.MM.DD HH:mm"). 시각이 없으면 그날 0시(KST)를 시작으로 본다.
 * @param {*} [p.paidAt] 결제 시각(없으면 7일 이내로 간주)
 * @param {*} [p.now] 기준 시각 (테스트용, 기본 현재)
 * @param {boolean} [p.companyCaused] 회사 사정 취소 여부
 * @returns {{ amount: number, rate: number, rule: string, withinCoolingOff: boolean, beforeStart: boolean }}
 */
export function calculateSeminarRefund({ paidAmount, seminarDate, paidAt = null, now = Date.now(), companyCaused = false }) {
  const amount = Math.max(0, Math.floor(Number(paidAmount) || 0));
  const nowMs = toMillis(now) ?? Date.now();
  const result = (rate, rule, extra = {}) => ({
    amount: rate >= 1 ? amount : Math.floor(amount * rate),
    rate,
    rule,
    withinCoolingOff: false,
    beforeStart: true,
    ...extra,
  });

  if (companyCaused) return result(1, 'company_cancelled');

  const sem = parseSeminarDate(seminarDate);
  const paidMs = toMillis(paidAt);
  const withinCoolingOff = paidMs == null
    ? true
    : kstDayNumber(nowMs) - kstDayNumber(paidMs) <= COOLING_OFF_DAYS;

  // 세미나 날짜를 알 수 없으면 예전과 같이 전액(분쟁 시 사업자 불리 방지)
  if (!sem) return result(1, 'unknown_date', { withinCoolingOff });

  const beforeStart = nowMs < sem.startMs;
  if (!beforeStart) return result(0, 'started', { withinCoolingOff, beforeStart: false });
  if (withinCoolingOff) return result(1, 'cooling_off', { withinCoolingOff: true });

  const diffDays = sem.dayNumber - kstDayNumber(nowMs);
  if (diffDays >= 3) return result(1, 'tier_3d_or_more');
  if (diffDays === 2) return result(0.9, 'tier_2d');
  if (diffDays === 1) return result(0.8, 'tier_1d');
  return result(0, 'same_day');
}

/** 회사 사정 취소 표시 (seminars 문서): cancelledByOrganizer === true 또는 상태값이 취소·폐강 */
export function isSeminarCancelledByCompany(seminar) {
  if (!seminar || typeof seminar !== 'object') return false;
  if (seminar.cancelledByOrganizer === true) return true;
  const st = String(seminar.status || '').trim();
  return ['취소', '폐강', '행사취소', 'cancelled', 'canceled'].includes(st);
}

/**
 * 환불 계산에 쓸 결제 시각 고르기: 포트원 실결제 시각 → 신청서 paidAt → 신청 생성 시각 → appliedAt.
 * (createdAt·appliedAt은 결제 확인 뒤 기록되므로 실제 결제 시각보다 늦거나 같다 = 소비자에게 불리하지 않음)
 */
export function pickPaidAt({ portonePaidAt, application } = {}) {
  const a = application || {};
  for (const v of [portonePaidAt, a.paidAt, a.createdAt, a.appliedAt]) {
    const ms = toMillis(v);
    if (ms != null) return ms;
  }
  return null;
}
