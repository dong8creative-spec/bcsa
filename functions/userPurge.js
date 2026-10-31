/**
 * 회원 탈퇴·강제 탈퇴 시 서버 쪽 정리 (callable purgeUserData의 본체)
 *
 * 원칙 (개인정보 보호법 제21조, 전자상거래법 제6조)
 *  - 법으로 남겨야 하는 기록은 필요한 항목만 legalRetention에 따로 복사한 뒤 원본을 지운다.
 *  - 그 밖의 정보는 바로 지우거나, 다른 회원의 기록(정산 장부·신고 처리)이 깨지지 않게 이름·uid를 지워 익명화한다.
 *
 * 처리 내용
 *  1. 운영 중(approved)인 모임의 그룹장이면 탈퇴를 막는다 → 모임장 변경 또는 모임 종료 후 다시 시도.
 *     (멤버·회차·결제가 걸린 모임을 그룹장 없이 남기거나, 탈퇴만으로 남의 모임을 닫지 않기 위함)
 *  2. 세미나 신청: 결제 건은 보존 기록(payment, 5년) 복사 후 삭제. 무료 신청은 바로 삭제.
 *  3. 결제 대기(pendingPayments): 삭제.
 *  4. 그룹 결제 장부(groupPayments): 결제·환불된 건은 보존 기록 복사 후 장부에서 이름·uid를 지워 익명화
 *     (그룹장 정산 금액이 맞도록 금액·상태·정산 여부는 남긴다). 미결제(pending) 건은 삭제.
 *  5. 모임 멤버 문서·출석 기록: 삭제. 승인 전·반려된 개설 신청은 통째로 삭제, 종료된 모임은 그룹장 이름만 지운다.
 *  6. 신고: 본인이 낸 신고와 본인을 대상으로 한 신고는 분쟁 기록(dispute, 3년) 복사 후 원본에서 이름·uid를 지운다
 *     (처리 중인 신고를 운영진이 계속 볼 수 있게 원본은 남김).
 *  7. 알림(users/{id}/notifications): 삭제.
 * 게시글·맛집·호스팅 이미지 삭제와 회원 문서·Auth 삭제는 지금처럼 클라이언트(firebaseService.purgeUserRelatedData
 * 이후 deleteUser/deleteAuthUser)가 한다.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import {
  buildSeminarPaymentRecord, buildGroupPaymentRecord, buildReportRecord, writeRetention,
} from './retention.js';

export const WITHDRAWN_LABEL = '탈퇴한 회원';

const hasPayment = (a) => !!(a?.merchant_uid || a?.merchantUid || a?.imp_uid || a?.impUid);

export function createUserPurge({ db, admin, getPortOneV2PaymentInfo = async () => null, now = () => new Date() }) {
  const FieldValue = admin.firestore.FieldValue;

  async function queryByFields(collection, fields, values) {
    const out = new Map();
    for (const f of fields) {
      for (const v of values) {
        const snap = await db.collection(collection).where(f, '==', v).get();
        snap.docs.forEach((d) => out.set(d.id, d));
      }
    }
    return [...out.values()];
  }

  async function commitOps(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  /** 운영 중인 모임의 그룹장인지 (탈퇴 차단용) */
  async function findActiveLedGroups(ids) {
    const docs = await queryByFields('groups', ['leaderUid'], ids);
    return docs.filter((d) => (d.data() || {}).status === 'approved');
  }

  /**
   * @param {{ docId: string, authUid: string, profile: { name?: string, email?: string, phone?: string }, reason: 'withdrawal'|'admin_forced' }} p
   */
  async function purge({ docId, authUid, profile = {}, reason = 'withdrawal' }) {
    const ids = [...new Set([docId, authUid].map((v) => String(v || '').trim()).filter(Boolean))];
    if (ids.length === 0) throw new HttpsError('invalid-argument', '회원 정보를 찾을 수 없습니다.');
    const summary = { applications: 0, retained: 0, pendingPayments: 0, groupPayments: 0, members: 0, attendance: 0, groups: 0, reports: 0, notifications: 0 };

    // 1) 운영 중 모임의 그룹장 → 차단 (아무것도 지우기 전에 확인)
    const led = await findActiveLedGroups(ids);
    if (led.length > 0) {
      const titles = led.map((d) => `「${(d.data() || {}).title || '이름 없는 모임'}」`).join(', ');
      throw new HttpsError(
        'failed-precondition',
        `운영 중인 모임 ${titles}의 모임장입니다. 운영진에게 모임장 변경이나 모임 종료를 요청한 뒤 다시 탈퇴해 주세요.`,
        { reason: 'active_group_leader', groupIds: led.map((d) => d.id) },
      );
    }

    // 2) 세미나 신청
    const apps = await queryByFields('applications', ['userId', 'user_id'], ids);
    const seminarCache = new Map();
    const loadSeminar = async (sid) => {
      if (!sid) return null;
      if (!seminarCache.has(sid)) {
        const s = await db.collection('seminars').doc(sid).get();
        seminarCache.set(sid, s.exists ? s.data() || {} : null);
      }
      return seminarCache.get(sid);
    };
    for (const d of apps) {
      const a = d.data() || {};
      if (hasPayment(a)) {
        const sid = String(a.seminarId || a.programId || a.seminar_id || '');
        const paymentId = a.merchant_uid || a.merchantUid || '';
        let payInfo = null;
        try { payInfo = paymentId ? await getPortOneV2PaymentInfo(paymentId) : null; } catch (_) { payInfo = null; }
        const record = buildSeminarPaymentRecord({
          application: a, seminar: await loadSeminar(sid), seminarId: sid, payInfo, reason, profile,
          cancel: { note: '탈퇴 시점에 취소되지 않은 결제 신청 (환불 요청 시 이 기록으로 확인)' },
        });
        const batch = db.batch();
        await writeRetention({ db, admin, record, writer: batch, now: now() });
        batch.delete(d.ref);
        await batch.commit();
        summary.retained += 1;
      } else {
        await d.ref.delete();
      }
      summary.applications += 1;
    }

    // 3) 결제 대기
    const pendings = await queryByFields('pendingPayments', ['user_id', 'userId'], ids);
    await commitOps(pendings.map((d) => (b) => b.delete(d.ref)));
    summary.pendingPayments = pendings.length;

    // 4) 그룹 결제 장부
    const gpays = await queryByFields('groupPayments', ['uid'], ids);
    for (const d of gpays) {
      const g = d.data() || {};
      if (['paid', 'refunded'].includes(g.status)) {
        const batch = db.batch();
        await writeRetention({ db, admin, record: buildGroupPaymentRecord({ paymentId: d.id, pay: g, reason, profile }), writer: batch, now: now() });
        batch.update(d.ref, { uid: '', name: WITHDRAWN_LABEL, payerWithdrawn: true, payerWithdrawnAt: FieldValue.serverTimestamp() });
        await batch.commit();
        summary.retained += 1;
      } else {
        await d.ref.delete();
      }
      summary.groupPayments += 1;
    }

    // 5) 모임: 멤버 문서·출석 기록·내가 연 모임
    const groupsSnap = await db.collection('groups').get();
    const memberRefs = groupsSnap.docs.flatMap((g) => ids.map((id) => g.ref.collection('members').doc(id)));
    if (memberRefs.length) {
      const memberSnaps = await db.getAll(...memberRefs);
      const existing = memberSnaps.filter((s) => s.exists);
      await commitOps(existing.map((s) => (b) => b.delete(s.ref)));
      summary.members = existing.length;
    }
    // 컬렉션 그룹 색인 없이 동작하도록 그룹별 회차 목록을 읽는다 (그룹·회차 수가 많지 않음)
    const sessionDocs = (await Promise.all(groupsSnap.docs.map((g) => g.ref.collection('sessions').get()))).flatMap((x) => x.docs);
    const attRefs = sessionDocs.flatMap((s) => ids.map((id) => s.ref.collection('attendance').doc(id)));
    if (attRefs.length) {
      const attSnaps = await db.getAll(...attRefs);
      const existing = attSnaps.filter((s) => s.exists);
      await commitOps(existing.map((s) => (b) => b.delete(s.ref)));
      summary.attendance = existing.length;
    }
    for (const g of groupsSnap.docs) {
      const gd = g.data() || {};
      if (!ids.includes(String(gd.leaderUid || ''))) continue;
      const hasPayments = !(await db.collection('groupPayments').where('groupId', '==', g.id).limit(1).get()).empty;
      if (['pending', 'rejected'].includes(gd.status) && !hasPayments) {
        await db.recursiveDelete(g.ref);
      } else {
        await g.ref.update({ leaderName: WITHDRAWN_LABEL, leaderWithdrawn: true, updatedAt: FieldValue.serverTimestamp() });
      }
      summary.groups += 1;
    }

    // 6) 신고
    const filed = await queryByFields('reports', ['reporterUid'], ids);
    const targeted = (await queryByFields('reports', ['targetId'], ids)).filter((d) => (d.data() || {}).targetType === 'member');
    for (const [docs, role] of [[filed, 'reporter'], [targeted, 'target']]) {
      for (const d of docs) {
        const r = d.data() || {};
        const batch = db.batch();
        await writeRetention({ db, admin, record: buildReportRecord({ reportId: d.id, report: r, reason, role, profile }), writer: batch, now: now() });
        batch.update(d.ref, role === 'reporter'
          ? { reporterUid: '', reporterName: WITHDRAWN_LABEL, reporterWithdrawn: true }
          : { targetTitle: WITHDRAWN_LABEL, targetWithdrawn: true });
        await batch.commit();
        summary.reports += 1;
        summary.retained += 1;
      }
    }

    // 7) 알림
    for (const id of ids) {
      const ns = await db.collection('users').doc(id).collection('notifications').get();
      await commitOps(ns.docs.map((n) => (b) => b.delete(n.ref)));
      summary.notifications += ns.size;
    }

    return summary;
  }

  return { purge, findActiveLedGroups };
}
