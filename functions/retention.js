/**
 * 법정 보존 기록 분리 보관 (legalRetention 컬렉션) — 관리자만 읽기, 클라이언트 쓰기 금지(firestore.rules)
 *
 * 전자상거래법 제6조·시행령 제6조 제1항, 개인정보 보호법 제21조 제3항(다른 개인정보와 분리 저장)에 따라
 * 탈퇴·취소로 원본(신청서·결제 장부·신고)을 지우기 전에 꼭 필요한 항목만 복사해 둔다.
 *   - category 'payment' : 대금결제·재화등의 공급 및 계약·청약철회 기록 → 5년 (시행령 제6조 제1항 제2호·제3호)
 *   - category 'dispute' : 소비자 불만·분쟁(신고) 처리 기록 → 3년 (시행령 제6조 제1항 제4호)
 * 보존 기간의 기준일(retainFrom): 결제 기록은 마지막 거래 시점(결제·취소·환불 중 가장 늦은 때), 신고는 처리를 마친 날.
 * 기준일을 알 수 없으면 보관을 시작한 날(탈퇴·취소 처리일). 기간이 지나면 dailyLegalPurge가 지운다
 * (처리 중인 신고의 기록은 처리를 마친 날부터 다시 3년이 되도록 늘린다).
 *
 * 남기는 항목(이 목록 밖의 값은 복사하지 않는다):
 *   공통: category, source, reason, subjectUid, name, phone, email, retainedAt, retainUntil, legalBasis
 *   결제: paymentId, amount, amountSource, paidAt, cancelledAt, refundedAt, refundAmount, refundRule, status,
 *         itemType('seminar'|'groupSession'), itemId, itemTitle, itemDate, groupId, groupTitle, sessionId, sessionTitle, note
 *   신고: reportId, targetType, targetId, targetTitle, reportReason, reportStatus, reportCreatedAt, note
 */

export const LEGAL_RETENTION = 'legalRetention';
export const RETENTION_YEARS = { payment: 5, dispute: 3 };
export const LEGAL_BASIS = {
  payment: '전자상거래법 제6조, 같은 법 시행령 제6조 제1항 제2호·제3호 (대금결제·계약·청약철회 기록 5년)',
  dispute: '전자상거래법 제6조, 같은 법 시행령 제6조 제1항 제4호 (소비자 불만·분쟁처리 기록 3년)',
};

const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function retainUntilDate(category, from = new Date()) {
  const years = RETENTION_YEARS[category];
  if (!years) throw new Error(`unknown retention category: ${category}`);
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Timestamp·Date·ISO 문자열·ms를 Firestore에 넣을 Date로 (모르면 null) */
const asDate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'object' && (v.seconds != null || v._seconds != null)) return new Date(Number(v.seconds ?? v._seconds) * 1000);
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const latestDate = (...vals) => {
  const ds = vals.map((v) => asDate(v)).filter(Boolean);
  return ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null;
};

/** 기록에 기준일(retainFrom)을 붙인다: 결제·취소·환불 시각 중 가장 늦은 때 */
const withPaymentBase = (rec) => ({ ...rec, retainFrom: latestDate(rec.paidAt, rec.cancelledAt, rec.refundedAt) });

/** 세미나 신청(결제 건) → 보존 기록 필드 */
export function buildSeminarPaymentRecord(args) {
  return withPaymentBase(seminarPaymentFields(args));
}
function seminarPaymentFields({ application, seminar, seminarId, payInfo, reason, cancel = {}, profile = {} }) {
  const a = application || {};
  const paymentId = str(a.merchant_uid || a.merchantUid || a.imp_uid || a.impUid, 120);
  const fromPortone = num(payInfo?.paidTotal);
  const fromApp = num(a.paidAmount);
  const fromFee = num(seminar?.applicationFee);
  const amount = fromPortone > 0 ? fromPortone : (fromApp > 0 ? fromApp : (fromFee > 0 ? fromFee : null));
  return {
    category: 'payment',
    source: 'seminarApplication',
    reason: str(reason, 40),
    subjectUid: str(a.userId || a.user_id, 128),
    name: str(a.userName || profile.name, 60),
    phone: str(a.userPhone || profile.phone, 30),
    email: str(a.userEmail || profile.email, 120),
    paymentId,
    amount,
    amountSource: fromPortone > 0 ? 'portone' : (fromApp > 0 ? 'application' : (fromFee > 0 ? 'seminarFee' : 'unknown')),
    paidAt: asDate(payInfo?.payment?.paidAt) || asDate(a.paidAt) || asDate(a.createdAt) || asDate(a.appliedAt),
    status: str(cancel.status || (payInfo?.status ? String(payInfo.status).toLowerCase() : 'paid'), 30),
    cancelledAt: asDate(cancel.cancelledAt) || asDate(payInfo?.payment?.cancelledAt),
    refundedAt: asDate(cancel.refundedAt),
    refundAmount: num(cancel.refundAmount),
    refundRule: str(cancel.refundRule, 40),
    itemType: 'seminar',
    itemId: str(seminarId || a.seminarId || a.programId || a.seminar_id, 128),
    itemTitle: str(seminar?.title, 120),
    itemDate: str(seminar?.date, 40),
    note: str(cancel.note, 300),
  };
}

/** 결제 대기 문서(자동 환불 등 신청이 만들어지지 않은 결제) → 보존 기록 */
export function buildPendingPaymentRecord({ merchantUid, pending, seminar, reason, amount, note }) {
  const p = pending || {};
  return withPaymentBase({
    category: 'payment',
    source: 'seminarPendingPayment',
    reason: str(reason, 40),
    subjectUid: str(p.user_id || p.userId, 128),
    name: str(p.user_name || p.userName, 60),
    phone: str(p.user_phone || p.userPhone, 30),
    email: str(p.user_email || p.userEmail, 120),
    paymentId: str(merchantUid, 120),
    amount: num(amount),
    amountSource: 'portone',
    paidAt: null,
    status: 'refunded',
    cancelledAt: new Date(),
    refundedAt: new Date(),
    refundAmount: num(amount),
    refundRule: 'company_full_refund',
    itemType: 'seminar',
    itemId: str(p.seminar_id || p.seminarId, 128),
    itemTitle: str(seminar?.title, 120),
    itemDate: str(seminar?.date, 40),
    note: str(note, 300),
  });
}

/** 그룹 회차 QR 결제(정산 장부) → 보존 기록 */
export function buildGroupPaymentRecord({ paymentId, pay, reason, profile = {} }) {
  const g = pay || {};
  return withPaymentBase({
    category: 'payment',
    source: 'groupPayment',
    reason: str(reason, 40),
    subjectUid: str(g.uid, 128),
    name: str(g.name || profile.name, 60),
    phone: str(profile.phone, 30),
    email: str(profile.email, 120),
    paymentId: str(paymentId, 120),
    amount: num(g.amount),
    amountSource: 'groupPayment',
    paidAt: asDate(g.paidAt),
    status: str(g.status, 30),
    cancelledAt: asDate(g.refundedAt),
    refundedAt: asDate(g.refundedAt),
    refundAmount: g.status === 'refunded' ? num(g.amount) : null,
    refundRule: g.status === 'refunded' ? 'group_full_refund' : '',
    itemType: 'groupSession',
    itemId: str(g.sessionId, 128),
    itemTitle: str(g.sessionTitle, 120),
    groupId: str(g.groupId, 128),
    groupTitle: str(g.groupTitle, 120),
    sessionId: str(g.sessionId, 128),
    sessionTitle: str(g.sessionTitle, 120),
    note: str([g.refundReason, g.failReason].filter(Boolean).join(' / '), 300),
  });
}

/** 신고 → 분쟁(신고) 처리 기록 */
export function buildReportRecord({ reportId, report, reason, role, profile = {} }) {
  const r = report || {};
  return {
    category: 'dispute',
    source: 'report',
    reason: str(reason, 40),
    subjectUid: str(role === 'target' ? r.targetId : r.reporterUid, 128),
    name: str(role === 'target' ? (profile.name || r.targetTitle) : (r.reporterName || profile.name), 60),
    phone: str(profile.phone, 30),
    email: str(profile.email, 120),
    reportId: str(reportId, 128),
    subjectRole: role === 'target' ? 'target' : 'reporter',
    targetType: str(r.targetType, 20),
    targetId: str(r.targetId, 128),
    targetTitle: str(r.targetTitle, 100),
    reportReason: str(r.reason, 1000),
    reportStatus: str(r.status, 20),
    reportCreatedAt: asDate(r.createdAt),
    reportResolvedAt: r.status === 'resolved' ? asDate(r.resolvedAt) : null,
    note: str(r.resolutionNote || r.note, 300),
    // 처리를 마친 신고는 처리일부터 3년, 처리 중이면 지금부터(처리가 끝나면 예약 파기 작업이 기한을 늘림)
    retainFrom: r.status === 'resolved' ? asDate(r.resolvedAt) : null,
  };
}

/** 보존 기록 쓰기 (tx·batch가 있으면 그 안에서) */
export function writeRetention({ db, admin, record, writer = null, now = new Date() }) {
  const ref = db.collection(LEGAL_RETENTION).doc();
  const { retainFrom, ...rest } = record;
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const base = retainFrom instanceof Date && !Number.isNaN(retainFrom.getTime()) ? retainFrom : now;
  const data = {
    ...clean,
    legalBasis: LEGAL_BASIS[record.category],
    retainedAt: admin.firestore.Timestamp.fromDate(now),
    retainFrom: admin.firestore.Timestamp.fromDate(base),
    retainUntil: admin.firestore.Timestamp.fromDate(retainUntilDate(record.category, base)),
  };
  for (const k of ['paidAt', 'cancelledAt', 'refundedAt', 'reportCreatedAt', 'reportResolvedAt']) {
    if (data[k] instanceof Date) data[k] = admin.firestore.Timestamp.fromDate(data[k]);
  }
  if (writer) {
    writer.set(ref, data);
    return Promise.resolve(ref);
  }
  return ref.set(data).then(() => ref);
}
