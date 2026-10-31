/** index.js 트리거(syncPublicProfile·syncGroupMemberCount) — 함수 본체를 에뮬레이터 DB로 직접 실행 */
import { before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db, clearFirestore, snap } from './helpers.mjs';

let fns;
before(async () => { fns = await import('../../index.js'); });

const userEvent = (userId, beforeData, afterData) => ({
  params: { userId },
  data: { before: snap(beforeData), after: snap(afterData) },
});

describe('syncPublicProfile: 공개 프로필·승인 표시·홈 회원 수', () => {
  beforeEach(clearFirestore);

  test('승인 회원: 공개 프로필 + memberAccess(로그인 uid 기준) + 회원 수', async () => {
    const u = { uid: 'authA', name: '김회원', email: 'a@x.com', birthdate: '1990-01-01', approvalStatus: 'approved' };
    await fns.syncPublicProfile.run(userEvent('docA', null, u));
    const p = (await db.doc('publicProfiles/docA').get()).data();
    assert.equal(p.name, '김회원');
    assert.equal(p.email, undefined);
    assert.equal(p.birthdate, undefined);
    assert.deepEqual((await db.doc('memberAccess/authA').get()).data(), { docId: 'docA', approved: true });
    assert.equal((await db.doc('publicStats/members').get()).data().approvedMemberCount, 1);
  });

  test('승인 취소·탈퇴: 공개 프로필·승인 표시 삭제, 회원 수 감소', async () => {
    const u = { uid: 'authB', name: '박회원', approvalStatus: 'approved' };
    await fns.syncPublicProfile.run(userEvent('authB', null, u));
    await fns.syncPublicProfile.run(userEvent('authB', u, { ...u, approvalStatus: 'pending' }));
    assert.equal((await db.doc('publicProfiles/authB').get()).exists, false);
    assert.equal((await db.doc('memberAccess/authB').get()).exists, false);
    assert.equal((await db.doc('publicStats/members').get()).data().approvedMemberCount, 0);
    await fns.syncPublicProfile.run(userEvent('authB', { ...u, approvalStatus: 'pending' }, null));
    assert.equal((await db.doc('memberAccess/authB').get()).exists, false);
  });
});

describe('syncGroupMemberCount: 활동 중 멤버 수만 그룹 문서에', () => {
  beforeEach(clearFirestore);

  test('active 멤버만 센다', async () => {
    await db.doc('groups/g1').set({ title: '모임', status: 'approved' });
    await db.doc('groups/g1/members/a').set({ status: 'active' });
    await db.doc('groups/g1/members/b').set({ status: 'active' });
    await db.doc('groups/g1/members/c').set({ status: 'pending' });
    await fns.syncGroupMemberCount.run({ params: { groupId: 'g1', uid: 'c' }, data: { before: snap(null), after: snap({ status: 'pending' }) } });
    assert.equal((await db.doc('groups/g1').get()).data().memberCount, 2);
    await db.doc('groups/g1/members/b').update({ status: 'left' });
    await fns.syncGroupMemberCount.run({ params: { groupId: 'g1', uid: 'b' }, data: { before: snap({ status: 'active' }), after: snap({ status: 'left' }) } });
    assert.equal((await db.doc('groups/g1').get()).data().memberCount, 1);
  });

  test('그룹이 삭제된 뒤의 멤버 변경은 오류 없이 넘어간다', async () => {
    await fns.syncGroupMemberCount.run({ params: { groupId: 'gone', uid: 'x' }, data: { before: snap({ status: 'active' }), after: snap(null) } });
    assert.equal((await db.doc('groups/gone').get()).exists, false);
  });
});

describe('purgeUserData callable: 본인·관리자 권한', () => {
  beforeEach(clearFirestore);
  const call = (auth, data = {}) => fns.purgeUserData.run({ auth, data });

  test('로그인 없이 호출하면 거부', async () => {
    await assert.rejects(call(null), (e) => e.code === 'unauthenticated');
  });

  test('일반 회원이 남의 탈퇴 정리를 요청하면 거부하고 아무것도 지우지 않는다', async () => {
    await db.doc('users/victim').set({ uid: 'victim', name: '피해자' });
    await db.doc('applications/v1').set({ userId: 'victim', seminarId: 'free' });
    await db.doc('users/attacker').set({ uid: 'attacker', role: 'user' });
    await assert.rejects(call({ uid: 'attacker', token: {} }, { docId: 'victim', uid: 'victim' }), (e) => e.code === 'permission-denied');
    assert.equal((await db.doc('applications/v1').get()).exists, true);
  });

  test('본인 탈퇴 정리: 결제 기록 사유 withdrawal', async () => {
    await db.doc('users/me').set({ uid: 'me', name: '본인', phone: '01012345678' });
    await db.doc('applications/m1').set({ userId: 'me', seminarId: 's', merchant_uid: 'p_x', paidAmount: 1000 });
    const r = await call({ uid: 'me', token: {} });
    assert.equal(r.success, true);
    const rec = (await db.collection('legalRetention').get()).docs.map((d) => d.data());
    assert.equal(rec.length, 1);
    assert.equal(rec[0].reason, 'withdrawal');
    assert.equal(rec[0].phone, '01012345678');
    assert.equal((await db.doc('applications/m1').get()).exists, false);
  });

  test('관리자 강제 탈퇴 정리: 사유 admin_forced, 예전 가입자 문서 id로도 처리', async () => {
    await db.doc('users/boss').set({ uid: 'boss', role: 'admin' });
    await db.doc('users/oldDoc').set({ uid: 'oldAuth', name: '예전 회원', email: 'o@x.com' });
    await db.doc('applications/o1').set({ userId: 'oldAuth', seminarId: 's', merchant_uid: 'p_o', paidAmount: 2000 });
    await call({ uid: 'boss', token: {} }, { docId: 'oldDoc', uid: 'oldAuth' });
    const rec = (await db.collection('legalRetention').get()).docs.map((d) => d.data());
    assert.equal(rec[0].reason, 'admin_forced');
    assert.equal(rec[0].email, 'o@x.com');
  });
});
