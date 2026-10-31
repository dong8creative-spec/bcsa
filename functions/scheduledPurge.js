/**
 * 매일 실행하는 기한 경과 정보 파기 (onSchedule dailyLegalPurge의 본체)
 *
 *  1. legalRetention: retainUntil이 지난 보존 기록 삭제 (결제 5년·분쟁 3년)
 *  2. blockedRegistrations: expiresAt(예전 형식은 blockedUntil)이 지난 재가입 제한 기록 삭제 (1년)
 *  3. reports: 처리 완료(resolved)된 신고 중 접수 후 3년이 지난 것 삭제 (분쟁처리 기록 3년)
 *  4. 사업자등록증 사본(users.businessRegistrationDoc): 확인이 끝난 뒤 남아 있는 사본 삭제
 *     - 운영진이 사업자 확인(businessVerified)을 마쳤으면 바로 삭제
 *     - 가입 승인(approvalStatus 'approved', 값이 없는 예전 회원 포함)된 회원은 사본을 처음 발견한 날부터 BUSINESS_DOC_GRACE_DAYS일 뒤 삭제
 *       (승인 직후 운영진이 사업자 확인을 할 시간을 남김. 새 사본을 올리면 그날부터 다시 셈)
 *     - 승인 대기·반려 회원의 사본은 운영진 심사에 필요하므로 지우지 않는다
 *     삭제 후 businessDocDeletedAt만 남긴다.
 */
import crypto from 'crypto';
import { LEGAL_RETENTION } from './retention.js';
import { BLOCKED_REGISTRATIONS } from './blocklist.js';

export const BUSINESS_DOC_GRACE_DAYS = 30;
export const REPORT_RETENTION_YEARS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function createScheduledPurge({ db, admin }) {
  const { Timestamp, FieldValue } = admin.firestore;

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

  async function purgeBusinessDocs(now) {
    const result = { deleted: 0, marked: 0 };
    const snap = await db.collection('users').where('businessRegistrationFileName', '!=', '').get();
    const graceMs = BUSINESS_DOC_GRACE_DAYS * DAY_MS;
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
      const seenAt = toDate(u.businessDocSeenAt);
      if (!seenAt || u.businessDocFingerprint !== fingerprint) {
        await d.ref.update({ businessDocFingerprint: fingerprint, businessDocSeenAt: Timestamp.fromDate(now) });
        result.marked += 1;
        continue;
      }
      if (now.getTime() - seenAt.getTime() >= graceMs) {
        await d.ref.update(clearDoc);
        result.deleted += 1;
      }
    }
    return result;
  }

  async function run(now = new Date()) {
    const ts = Timestamp.fromDate(now);
    const reportCutoff = new Date(now);
    reportCutoff.setFullYear(reportCutoff.getFullYear() - REPORT_RETENTION_YEARS);

    const retention = await deleteQuery(db.collection(LEGAL_RETENTION).where('retainUntil', '<=', ts));
    const blocks = await deleteQuery(db.collection(BLOCKED_REGISTRATIONS).where('expiresAt', '<=', ts))
      + await deleteQuery(db.collection(BLOCKED_REGISTRATIONS).where('blockedUntil', '<=', ts));

    // 신고: status 단일 조건으로 가져와 날짜는 코드에서 비교 (복합 색인 없이 동작)
    let reports = 0;
    const resolved = await db.collection('reports').where('status', '==', 'resolved').get();
    const old = resolved.docs.filter((d) => {
      const c = toDate((d.data() || {}).createdAt);
      return c && c.getTime() <= reportCutoff.getTime();
    });
    for (let i = 0; i < old.length; i += 300) {
      const batch = db.batch();
      old.slice(i, i + 300).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    reports = old.length;

    const businessDocs = await purgeBusinessDocs(now);
    return { retention, blocks, reports, businessDocs };
  }

  return { run, purgeBusinessDocs };
}
