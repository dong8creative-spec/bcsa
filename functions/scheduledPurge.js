/**
 * 매일 실행하는 기한 경과 정보 파기 (onSchedule dailyLegalPurge의 본체)
 *
 *  1. legalRetention: retainUntil이 지난 보존 기록 삭제 (결제 5년·분쟁 3년)
 *     단, 신고(dispute) 기록은 원본 신고가 아직 처리 중이면 30일씩 미루고, 처리를 마쳤으면 처리일부터 3년이 되도록 늘린다.
 *  2. blockedRegistrations: expiresAt(예전 형식은 blockedUntil)이 지난 재가입 제한 기록 삭제 (1년)
 *  3. reports: 처리 완료(resolved)된 신고 중 처리일(resolvedAt, 없으면 접수일)부터 3년이 지난 것 삭제
 *  4. kakaoOAuthCodes: 로그인 도중 그만둬 교환되지 않은 1회용 코드(이름·연락처·이메일 포함) 중 만료된 것 삭제
 *  5. 프로그램 신청서 답변(참여 경로·신청 계기·사전 질문·식사 여부): 행사일부터 1년이 지나면 지운다.
 *     신청 문서(참가 기록)와 결제번호는 남고, 결제·취소 기록은 legalRetention(5년)에 따로 보관된다.
 *  6. 사업자등록증 사본(users.businessRegistrationDoc): 확인이 끝난 뒤 남아 있는 사본 삭제
 *     - 운영진이 사업자 확인(businessVerified)을 마쳤으면 바로 삭제
 *     - 가입 승인 회원: 늦어도 승인(approvedAt) 후 30일 안에 삭제. 승인 시각 기록이 없는 예전 회원·승인 뒤 다시 낸 사본은
 *       이 작업이 사본을 처음 본 날부터 29일 뒤(매일 실행이라 30일 안) 삭제
 *     - 승인 대기·반려 회원의 사본은 운영진 심사에 필요하므로 지우지 않는다
 *     삭제 후 businessDocDeletedAt만 남긴다.
 */
import crypto from 'crypto';
import { LEGAL_RETENTION, RETENTION_YEARS } from './retention.js';
import { BLOCKED_REGISTRATIONS } from './blocklist.js';
import { parseSeminarDate } from './refund.js';

export const BUSINESS_DOC_DEADLINE_DAYS = 30; // 승인 후 이 기간 안에 삭제 (처리방침 제3조)
export const BUSINESS_DOC_GRACE_DAYS = BUSINESS_DOC_DEADLINE_DAYS - 1; // 처음 본 날 기준 (매일 실행 여유 1일)
export const REPORT_RETENTION_YEARS = RETENTION_YEARS.dispute;
export const APPLICATION_ANSWER_RETENTION_DAYS = 365;
export const APPLICATION_ANSWER_FIELDS = ['participationPath', 'applyReason', 'preQuestions', 'mealAfter', 'reason', 'questions'];
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const addYears = (d, y) => { const x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; };

export function createScheduledPurge({ db, admin }) {
  const { Timestamp, FieldValue } = admin.firestore;

  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += 300) {
      const batch = db.batch();
      ops.slice(i, i + 300).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  async function deleteQuery(q) {
    let total = 0;
    for (;;) {
      const snap = await q.limit(300).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      if (snap.size < 300) break;
    }
    return total;
  }

  /** 기한이 지난 보존 기록 삭제 (처리 중이거나 늦게 처리된 신고 기록은 기한 연장) */
  async function purgeRetention(now) {
    const snap = await db.collection(LEGAL_RETENTION).where('retainUntil', '<=', Timestamp.fromDate(now)).get();
    let deleted = 0; let extended = 0;
    const ops = [];
    for (const d of snap.docs) {
      const r = d.data() || {};
      if (r.category === 'dispute' && r.reportId) {
        const rep = await db.collection('reports').doc(String(r.reportId)).get();
        if (rep.exists) {
          const x = rep.data() || {};
          let until = null;
          if (x.status !== 'resolved') until = new Date(now.getTime() + 30 * DAY_MS);
          else {
            const resolvedAt = toDate(x.resolvedAt);
            if (resolvedAt && addYears(resolvedAt, REPORT_RETENTION_YEARS) > now) until = addYears(resolvedAt, REPORT_RETENTION_YEARS);
          }
          if (until) {
            ops.push((b) => b.update(d.ref, { retainUntil: Timestamp.fromDate(until), retainExtendedAt: Timestamp.fromDate(now) }));
            extended += 1;
            continue;
          }
        }
      }
      ops.push((b) => b.delete(d.ref));
      deleted += 1;
    }
    await commitInChunks(ops);
    return { deleted, extended };
  }

  /** 행사일부터 1년 지난 프로그램 신청서 답변 지우기 */
  async function purgeApplicationAnswers(now) {
    const seminars = await db.collection('seminars').get();
    const expired = new Set();
    for (const s of seminars.docs) {
      const sem = parseSeminarDate((s.data() || {}).date);
      if (sem && now.getTime() - sem.startMs >= APPLICATION_ANSWER_RETENTION_DAYS * DAY_MS) expired.add(s.id);
    }
    let cleared = 0;
    for (const sid of expired) {
      const docs = new Map();
      for (const f of ['seminarId', 'programId', 'seminar_id']) {
        (await db.collection('applications').where(f, '==', sid).get()).docs.forEach((d) => docs.set(d.id, d));
      }
      const ops = [];
      for (const d of docs.values()) {
        const a = d.data() || {};
        if (a.formAnswersDeletedAt) continue;
        if (!APPLICATION_ANSWER_FIELDS.some((k) => k in a)) continue;
        const update = Object.fromEntries(APPLICATION_ANSWER_FIELDS.map((k) => [k, FieldValue.delete()]));
        ops.push((b) => b.update(d.ref, { ...update, formAnswersDeletedAt: FieldValue.serverTimestamp() }));
      }
      await commitInChunks(ops);
      cleared += ops.length;
    }
    return cleared;
  }

  async function purgeBusinessDocs(now) {
    const result = { deleted: 0, marked: 0 };
    const snap = await db.collection('users').where('businessRegistrationFileName', '!=', '').get();
    for (const d of snap.docs) {
      const u = d.data() || {};
      const docData = typeof u.businessRegistrationDoc === 'string' ? u.businessRegistrationDoc : '';
      const fileName = String(u.businessRegistrationFileName || '');
      if (!docData && !fileName) continue;
      const fingerprint = crypto.createHash('sha256').update(`${fileName}|${docData}`).digest('hex').slice(0, 32);
      const clearDoc = {
        businessRegistrationDoc: '',
        businessRegistrationFileName: '',
        businessDocFingerprint: FieldValue.delete(),
        businessDocSeenAt: FieldValue.delete(),
        businessDocDeletedAt: FieldValue.serverTimestamp(),
      };
      if (u.businessVerified === true) {
        await d.ref.update(clearDoc);
        result.deleted += 1;
        continue;
      }
      // 승인 상태 값이 없는 예전 회원은 승인 회원으로 본다(publicMirrors.isApprovedMember와 같은 기준)
      if (u.approvalStatus && u.approvalStatus !== 'approved') continue;
      const approvedAt = toDate(u.approvedAt);
      const deadline = approvedAt ? approvedAt.getTime() + BUSINESS_DOC_DEADLINE_DAYS * DAY_MS : null;
      const seenAt = toDate(u.businessDocSeenAt);
      const sameCopy = !!seenAt && u.businessDocFingerprint === fingerprint;
      // 매일 한 번 돌므로 기한 하루 전부터 지워 "승인 후 30일 안"을 지킨다
      const pastDeadline = deadline != null && now.getTime() >= deadline - DAY_MS;
      // 승인 때부터 있던 사본(이 작업이 아직 본 적 없음) 또는 기한 안에 처음 본 같은 사본 → 승인 후 30일이 기한.
      // 기한이 지난 뒤 사본을 바꿔 낸 경우(본 적 있는 사본과 다름)는 다시 낸 날부터 29일.
      if (pastDeadline && (!seenAt || (sameCopy && seenAt.getTime() <= deadline))) {
        await d.ref.update(clearDoc);
        result.deleted += 1;
        continue;
      }
      if (!sameCopy) {
        await d.ref.update({ businessDocFingerprint: fingerprint, businessDocSeenAt: Timestamp.fromDate(now) });
        result.marked += 1;
        continue;
      }
      if (now.getTime() - seenAt.getTime() >= BUSINESS_DOC_GRACE_DAYS * DAY_MS) {
        await d.ref.update(clearDoc);
        result.deleted += 1;
      }
    }
    return result;
  }

  async function run(now = new Date()) {
    const ts = Timestamp.fromDate(now);
    const retention = await purgeRetention(now);
    const blocks = await deleteQuery(db.collection(BLOCKED_REGISTRATIONS).where('expiresAt', '<=', ts))
      + await deleteQuery(db.collection(BLOCKED_REGISTRATIONS).where('blockedUntil', '<=', ts));

    // 신고: status 단일 조건으로 가져와 날짜는 코드에서 비교 (복합 색인 없이 동작)
    const resolved = await db.collection('reports').where('status', '==', 'resolved').get();
    const old = resolved.docs.filter((d) => {
      const x = d.data() || {};
      const base = toDate(x.resolvedAt) || toDate(x.createdAt);
      return base && addYears(base, REPORT_RETENTION_YEARS) <= now;
    });
    await commitInChunks(old.map((d) => (b) => b.delete(d.ref)));
    const reports = old.length;

    const kakaoCodes = await deleteQuery(db.collection('kakaoOAuthCodes').where('exp', '<=', now.getTime()));
    const applicationAnswers = await purgeApplicationAnswers(now);
    const businessDocs = await purgeBusinessDocs(now);
    return { retention, blocks, reports, kakaoCodes, applicationAnswers, businessDocs };
  }

  return { run, purgeBusinessDocs, purgeApplicationAnswers, purgeRetention };
}
