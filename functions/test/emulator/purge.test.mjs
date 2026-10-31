/** 탈퇴 정리(userPurge)·예약 파기(scheduledPurge) — Firestore 에뮬레이터 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db, admin, clearFirestore, all } from './helpers.mjs';
import { createUserPurge, WITHDRAWN_LABEL } from '../../userPurge.js';
import { createScheduledPurge, BUSINESS_DOC_GRACE_DAYS } from '../../scheduledPurge.js';

const { Timestamp } = admin.firestore;
const portone = async (paymentId) => (paymentId === 'p_paid'
  ? { paidTotal: 30000, cancellable: 30000, status: 'PAID', payment: { paidAt: '2026-11-01T01:00:00Z' } }
  : null);
const NOW = new Date('2026-11-05T00:00:00Z');
const purger = () => createUserPurge({ db, admin, getPortOneV2PaymentInfo: portone, now: () => NOW });

async function seedMember() {
  const b = db.batch();
  b.set(db.doc('users/u1'), { uid: 'u1', name: '홍길동', email: 'hong@example.com', phone: '01011112222', approvalStatus: 'approved' });
  b.set(db.doc('users/u1/notifications/n1'), { message: 'x' });
  b.set(db.doc('seminars/s1'), { title: '11월 세미나', date: '2026.11.20 19:00', applicationFee: 30000 });
  b.set(db.doc('applications/a_paid'), {
    userId: 'u1', seminarId: 's1', userName: '홍길동', userPhone: '01011112222', userEmail: 'hong@example.com',
    merchant_uid: 'p_paid', preQuestions: '비공개 질문', mealAfter: '예', createdAt: Timestamp.fromDate(new Date('2026-11-01T01:00:05Z')),
  });
  b.set(db.doc('applications/a_free'), { userId: 'u1', seminarId: 'free' });
  b.set(db.doc('applications/other'), { userId: 'u2', seminarId: 's1', merchant_uid: 'p_other' });
  b.set(db.doc('pendingPayments/pp1'), { user_id: 'u1', seminar_id: 's1', user_phone: '01011112222' });
  b.set(db.doc('pendingPayments/pp2'), { user_id: 'u2', seminar_id: 's1' });
  b.set(db.doc('groups/g1'), { title: '독서 모임', status: 'approved', leaderUid: 'u_leader', leaderName: '모임장' });
  b.set(db.doc('groups/g1/members/u1'), { uid: 'u1', name: '홍길동', img: 'x', role: 'member', status: 'active' });
  b.set(db.doc('groups/g1/members/u2'), { uid: 'u2', name: '다른 회원', role: 'member', status: 'active' });
  b.set(db.doc('groups/g1/sessions/ss1'), { title: '1회', fee: 5000 });
  b.set(db.doc('groups/g1/sessions/ss1/attendance/u1'), { uid: 'u1', name: '홍길동', paid: true, paymentId: 'g_paid', amount: 5000 });
  b.set(db.doc('groups/g1/sessions/ss1/attendance/u2'), { uid: 'u2', name: '다른 회원' });
  b.set(db.doc('groupPayments/g_paid'), { uid: 'u1', name: '홍길동', groupId: 'g1', sessionId: 'ss1', leaderUid: 'u_leader', groupTitle: '독서 모임', sessionTitle: '1회', amount: 5000, status: 'paid', settled: false, paidAt: Timestamp.fromDate(new Date('2026-11-02T10:00:00Z')) });
  b.set(db.doc('groupPayments/g_pending'), { uid: 'u1', name: '홍길동', groupId: 'g1', sessionId: 'ss1', amount: 5000, status: 'pending' });
  b.set(db.doc('reports/r_filed'), { reporterUid: 'u1', reporterName: '홍길동', targetType: 'group', targetId: 'g1', targetTitle: '독서 모임', reason: '광고 글', status: 'open' });
  b.set(db.doc('reports/r_target'), { reporterUid: 'u2', reporterName: '다른 회원', targetType: 'member', targetId: 'u1', targetTitle: '홍길동', reason: '무례함', status: 'open' });
  await b.commit();
}

describe('탈퇴 정리 purgeUserData 본체', () => {
  beforeEach(async () => { await clearFirestore(); await seedMember(); });

  test('결제 신청은 보존 기록(5년) 복사 후 삭제, 무료 신청·결제대기 삭제, 남의 데이터는 그대로', async () => {
    const summary = await purger().purge({ docId: 'u1', authUid: 'u1', profile: { name: '홍길동', email: 'hong@example.com', phone: '01011112222' }, reason: 'withdrawal' });
    assert.equal(summary.applications, 2);
    assert.deepEqual((await all('applications')).map((a) => a.id), ['other']);
    assert.deepEqual((await all('pendingPayments')).map((a) => a.id), ['pp2']);

    const rec = (await all('legalRetention')).find((r) => r.source === 'seminarApplication');
    assert.ok(rec, 'seminar retention record');
    assert.equal(rec.category, 'payment');
    assert.equal(rec.name, '홍길동');
    assert.equal(rec.phone, '01011112222');
    assert.equal(rec.email, 'hong@example.com');
    assert.equal(rec.paymentId, 'p_paid');
    assert.equal(rec.amount, 30000);
    assert.equal(rec.amountSource, 'portone');
    assert.equal(rec.itemTitle, '11월 세미나');
    assert.equal(rec.paidAt.toDate().toISOString(), '2026-11-01T01:00:00.000Z');
    assert.equal(rec.retainUntil.toDate().toISOString(), '2031-11-05T00:00:00.000Z');
    assert.ok(!('preQuestions' in rec) && !('mealAfter' in rec));
  });

  test('모임 멤버 문서·출석 삭제, 결제 장부는 보존 기록 후 익명화, 미결제 건 삭제', async () => {
    await purger().purge({ docId: 'u1', authUid: 'u1', profile: { name: '홍길동', phone: '01011112222' } });
    assert.equal((await db.doc('groups/g1/members/u1').get()).exists, false);
    assert.equal((await db.doc('groups/g1/members/u2').get()).exists, true);
    assert.equal((await db.doc('groups/g1/sessions/ss1/attendance/u1').get()).exists, false);
    assert.equal((await db.doc('groups/g1/sessions/ss1/attendance/u2').get()).exists, true);
    const gp = (await db.doc('groupPayments/g_paid').get()).data();
    assert.equal(gp.uid, '');
    assert.equal(gp.name, WITHDRAWN_LABEL);
    assert.equal(gp.amount, 5000);
    assert.equal(gp.status, 'paid');
    assert.equal(gp.settled, false);
    assert.equal((await db.doc('groupPayments/g_pending').get()).exists, false);
    const rec = (await all('legalRetention')).find((r) => r.source === 'groupPayment');
    assert.equal(rec.paymentId, 'g_paid');
    assert.equal(rec.name, '홍길동');
    assert.equal(rec.phone, '01011112222');
    assert.equal(rec.groupTitle, '독서 모임');
  });

  test('신고: 분쟁 기록(3년) 복사 후 원본에서 이름·uid 제거, 알림 삭제', async () => {
    await purger().purge({ docId: 'u1', authUid: 'u1', profile: { name: '홍길동' } });
    const filed = (await db.doc('reports/r_filed').get()).data();
    assert.equal(filed.reporterUid, '');
    assert.equal(filed.reporterName, WITHDRAWN_LABEL);
    assert.equal(filed.reason, '광고 글');
    const target = (await db.doc('reports/r_target').get()).data();
    assert.equal(target.targetTitle, WITHDRAWN_LABEL);
    assert.equal(target.reporterName, '다른 회원');
    const disputes = (await all('legalRetention')).filter((r) => r.category === 'dispute');
    assert.equal(disputes.length, 2);
    assert.ok(disputes.every((d) => d.retainUntil.toDate().toISOString() === '2029-11-05T00:00:00.000Z'));
    assert.equal((await db.collection('users/u1/notifications').get()).size, 0);
  });

  test('운영 중 모임의 모임장은 탈퇴를 막고 아무것도 지우지 않는다', async () => {
    await assert.rejects(
      purger().purge({ docId: 'u_leader', authUid: 'u_leader' }),
      (e) => e.code === 'failed-precondition' && /독서 모임/.test(e.message),
    );
    assert.equal((await db.doc('groups/g1').get()).data().leaderName, '모임장');
    // 같은 사람이 다른 데이터를 갖고 있어도 그대로
    await db.doc('applications/lead_app').set({ userId: 'u_leader', seminarId: 'free' });
    await assert.rejects(purger().purge({ docId: 'u_leader', authUid: 'u_leader' }));
    assert.equal((await db.doc('applications/lead_app').get()).exists, true);
  });

  test('승인 전 개설 신청은 통째로 삭제, 종료된 모임은 모임장 이름만 지움', async () => {
    const b = db.batch();
    b.set(db.doc('groups/g_pend'), { title: '신청 중', status: 'pending', leaderUid: 'u1', leaderName: '홍길동' });
    b.set(db.doc('groups/g_pend/members/u1'), { uid: 'u1', role: 'leader', status: 'active' });
    b.set(db.doc('groups/g_closed'), { title: '끝난 모임', status: 'closed', leaderUid: 'u1', leaderName: '홍길동' });
    b.set(db.doc('groups/g_closed/members/u1'), { uid: 'u1', role: 'leader', status: 'active' });
    await b.commit();
    await purger().purge({ docId: 'u1', authUid: 'u1' });
    assert.equal((await db.doc('groups/g_pend').get()).exists, false);
    assert.equal((await db.doc('groups/g_pend/members/u1').get()).exists, false);
    const closed = (await db.doc('groups/g_closed').get()).data();
    assert.equal(closed.leaderName, WITHDRAWN_LABEL);
    assert.equal((await db.doc('groups/g_closed/members/u1').get()).exists, false);
  });

  test('예전 가입자(문서 id ≠ uid): 두 id 모두로 찾아 정리', async () => {
    await db.doc('applications/legacy_app').set({ userId: 'legacyDoc', seminarId: 'free' });
    await db.doc('groups/g1/members/legacyAuth').set({ uid: 'legacyAuth', status: 'active' });
    await purger().purge({ docId: 'legacyDoc', authUid: 'legacyAuth' });
    assert.equal((await db.doc('applications/legacy_app').get()).exists, false);
    assert.equal((await db.doc('groups/g1/members/legacyAuth').get()).exists, false);
  });
});

describe('예약 파기 dailyLegalPurge 본체', () => {
  beforeEach(clearFirestore);
  const ts = (iso) => Timestamp.fromDate(new Date(iso));
  const now = new Date('2026-11-05T00:00:00Z');

  test('보존 기한·재가입 제한 기한이 지난 문서만 삭제', async () => {
    const b = db.batch();
    b.set(db.doc('legalRetention/old'), { category: 'payment', retainUntil: ts('2026-11-04T00:00:00Z') });
    b.set(db.doc('legalRetention/keep'), { category: 'payment', retainUntil: ts('2031-11-04T00:00:00Z') });
    b.set(db.doc('blockedRegistrations/old'), { expiresAt: ts('2026-01-01T00:00:00Z') });
    b.set(db.doc('blockedRegistrations/legacyOld'), { email: 'a@b.com', blockedUntil: ts('2026-01-01T00:00:00Z') });
    b.set(db.doc('blockedRegistrations/keep'), { expiresAt: ts('2027-01-01T00:00:00Z') });
    await b.commit();
    const r = await createScheduledPurge({ db, admin }).run(now);
    assert.equal(r.retention, 1);
    assert.equal(r.blocks, 2);
    assert.deepEqual((await all('legalRetention')).map((d) => d.id), ['keep']);
    assert.deepEqual((await all('blockedRegistrations')).map((d) => d.id), ['keep']);
  });

  test('처리 완료 후 3년 지난 신고만 삭제', async () => {
    const b = db.batch();
    b.set(db.doc('reports/old'), { status: 'resolved', createdAt: ts('2023-11-01T00:00:00Z') });
    b.set(db.doc('reports/recent'), { status: 'resolved', createdAt: ts('2025-11-01T00:00:00Z') });
    b.set(db.doc('reports/openOld'), { status: 'open', createdAt: ts('2020-01-01T00:00:00Z') });
    await b.commit();
    const r = await createScheduledPurge({ db, admin }).run(now);
    assert.equal(r.reports, 1);
    assert.deepEqual((await all('reports')).map((d) => d.id).sort(), ['openOld', 'recent']);
  });

  test('사업자등록증 사본: 확인 완료는 바로, 승인 회원은 발견 후 유예 기간 뒤 삭제, 심사 중은 유지', async () => {
    const doc = 'data:image/png;base64,AAAA';
    const b = db.batch();
    b.set(db.doc('users/verified'), { approvalStatus: 'approved', businessVerified: true, businessRegistrationDoc: doc, businessRegistrationFileName: 'a.png' });
    b.set(db.doc('users/approvedNew'), { approvalStatus: 'approved', businessRegistrationDoc: doc, businessRegistrationFileName: 'b.png' });
    b.set(db.doc('users/pending'), { approvalStatus: 'pending', businessRegistrationDoc: doc, businessRegistrationFileName: 'c.png' });
    b.set(db.doc('users/none'), { approvalStatus: 'approved', businessRegistrationDoc: '', businessRegistrationFileName: '' });
    await b.commit();
    const purge = createScheduledPurge({ db, admin });

    let r = await purge.purgeBusinessDocs(now);
    assert.deepEqual(r, { deleted: 1, marked: 1 });
    assert.equal((await db.doc('users/verified').get()).data().businessRegistrationDoc, '');
    assert.ok((await db.doc('users/verified').get()).data().businessDocDeletedAt);
    assert.equal((await db.doc('users/approvedNew').get()).data().businessRegistrationDoc, doc);

    const almost = new Date(now.getTime() + (BUSINESS_DOC_GRACE_DAYS - 1) * 86400000);
    r = await purge.purgeBusinessDocs(almost);
    assert.equal((await db.doc('users/approvedNew').get()).data().businessRegistrationDoc, doc);

    // 유예 중 새 사본을 올리면 그날부터 다시 셈
    await db.doc('users/approvedNew').update({ businessRegistrationDoc: 'data:image/png;base64,BBBB' });
    const later = new Date(now.getTime() + BUSINESS_DOC_GRACE_DAYS * 86400000);
    r = await purge.purgeBusinessDocs(later);
    assert.equal(r.marked, 1);
    assert.equal((await db.doc('users/approvedNew').get()).data().businessRegistrationDoc, 'data:image/png;base64,BBBB');

    const muchLater = new Date(later.getTime() + BUSINESS_DOC_GRACE_DAYS * 86400000);
    r = await purge.purgeBusinessDocs(muchLater);
    const u = (await db.doc('users/approvedNew').get()).data();
    assert.equal(u.businessRegistrationDoc, '');
    assert.equal(u.businessRegistrationFileName, '');
    assert.equal(u.businessDocFingerprint, undefined);
    assert.equal((await db.doc('users/pending').get()).data().businessRegistrationDoc, doc);
  });
});
