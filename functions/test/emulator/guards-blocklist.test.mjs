/** 회원 문서 서버 확인(만 14세·재가입 제한)·재가입 제한 확인값·변환 스크립트 — Firestore 에뮬레이터 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { db, admin, clearFirestore, fakeAdmin, all } from './helpers.mjs';
import { createBlocklist, buildBlockHashes } from '../../blocklist.js';
import { createUserGuards } from '../../userGuards.js';

const SECRET = 'test-secret-for-emulator-only';
const run = promisify(execFile);

describe('재가입 제한 확인값 저장·조회', () => {
  beforeEach(clearFirestore);
  const bl = () => createBlocklist({ db, admin });

  test('원문 이메일·전화·uid를 저장하지 않고, 확인값으로 찾는다', async () => {
    const { expiresAt } = await bl().addBlock(SECRET, { uid: 'kakao_77', email: 'Bad@Example.com', phone: '010-9999-8888', now: new Date('2026-11-01T00:00:00Z') });
    assert.equal(expiresAt.toISOString(), '2027-11-01T00:00:00.000Z');
    const docs = await all('blockedRegistrations');
    assert.equal(docs.length, 1);
    const json = JSON.stringify(docs[0]);
    for (const raw of ['kakao_77', 'example.com', '99998888']) assert.ok(!json.includes(raw), raw);
    assert.equal(docs[0].hashVersion, 1);

    const now = new Date('2026-12-01T00:00:00Z');
    assert.ok(await bl().findActiveBlock(SECRET, { email: 'bad@example.com', now }));
    assert.ok(await bl().findActiveBlock(SECRET, { phone: '+82 10-9999-8888', now }));
    assert.ok(await bl().findActiveBlock(SECRET, { uid: 'kakao_77', now }));
    assert.equal(await bl().findActiveBlock(SECRET, { email: 'other@example.com', phone: '01000000000', now }), null);
    assert.equal(await bl().findActiveBlock('wrong-secret', { email: 'bad@example.com', now }), null);
  });

  test('1년이 지나면 차단되지 않는다', async () => {
    await bl().addBlock(SECRET, { uid: 'u9', email: 'x@y.com', now: new Date('2025-01-01T00:00:00Z') });
    assert.equal(await bl().findActiveBlock(SECRET, { email: 'x@y.com', now: new Date('2026-01-02T00:00:00Z') }), null);
  });

  test('변환 전 원문 형식 기록도 계속 차단하고, 다시 등록하면 원문 문서를 지운다', async () => {
    await db.doc('blockedRegistrations/u_old').set({ uid: 'u_old', email: 'old@x.com', phone: '01012341234', blockedUntil: admin.firestore.Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')) });
    const now = new Date('2026-11-01T00:00:00Z');
    assert.ok(await bl().findActiveBlock(SECRET, { email: 'old@x.com', now }));
    assert.ok(await bl().findActiveBlock(SECRET, { phone: '01012341234', now }));
    await bl().addBlock(SECRET, { uid: 'u_old', email: 'old@x.com', phone: '01012341234', now });
    assert.equal((await db.doc('blockedRegistrations/u_old').get()).exists, false);
    assert.ok(await bl().findActiveBlock(SECRET, { email: 'old@x.com', now }));
  });

  test('비밀값이 없으면 uid로만 차단(이메일·전화 확인값 없음)', async () => {
    await bl().addBlock('', { uid: 'kakao_5', email: 'n@x.com', phone: '01055556666' });
    const [d] = await all('blockedRegistrations');
    assert.equal(d.emailHash, '');
    assert.equal(d.phoneHash, '');
    assert.equal(d.secretMissing, true);
    assert.ok(await bl().findActiveBlock(SECRET, { uid: 'kakao_5' }), '비밀값 설정 뒤에도 uid로 찾힘');
    assert.equal(await bl().findActiveBlock(SECRET, { email: 'n@x.com' }), null);
  });
});

describe('회원 문서 서버 확인 guardUserDoc 본체', () => {
  beforeEach(clearFirestore);

  test('새 문서가 만 14세 미만(규칙을 피한 형식)이면 문서와 Auth 계정 삭제', async () => {
    const fa = fakeAdmin();
    const guards = createUserGuards({ db, admin: fa, blocklist: createBlocklist({ db, admin }) });
    const u = { uid: 'kid', name: '어린이', birthdate: '20150505', approvalStatus: 'pending' };
    await db.doc('users/kid').set(u);
    const action = await guards.onUserWritten({ userId: 'kid', before: null, after: u, secret: SECRET, now: new Date('2026-11-01T00:00:00Z') });
    assert.equal(action, 'deleted_under14');
    assert.equal((await db.doc('users/kid').get()).exists, false);
    assert.deepEqual(fa.deleted, ['kid']);
  });

  test('기존 만 14세 미만 회원을 승인하면 승인 대기로 되돌림', async () => {
    const guards = createUserGuards({ db, admin: fakeAdmin(), blocklist: null });
    const before = { uid: 'kid2', birthdate: '2013-05-05', approvalStatus: 'pending' };
    const after = { ...before, approvalStatus: 'approved' };
    await db.doc('users/kid2').set(after);
    assert.equal(await guards.onUserWritten({ userId: 'kid2', before, after, secret: SECRET, now: new Date('2026-11-01T00:00:00Z') }), 'reverted_under14');
    const d = (await db.doc('users/kid2').get()).data();
    assert.equal(d.approvalStatus, 'pending');
    assert.equal(d.ageRestricted, true);
  });

  test('재가입 제한 기간의 이메일로 새로 가입하면 반려 상태로 바꿈', async () => {
    const bl = createBlocklist({ db, admin });
    await bl.addBlock(SECRET, { uid: 'old_uid', email: 'banned@x.com', phone: '01077778888' });
    const guards = createUserGuards({ db, admin: fakeAdmin(), blocklist: bl });
    const u = { uid: 'new_uid', email: 'Banned@X.com', birthdate: '1990-01-01', approvalStatus: 'pending' };
    await db.doc('users/new_uid').set(u);
    assert.equal(await guards.onUserWritten({ userId: 'new_uid', before: null, after: u, secret: SECRET }), 'rejected_blocked');
    const d = (await db.doc('users/new_uid').get()).data();
    assert.equal(d.approvalStatus, 'rejected');
    assert.equal(d.blockedRegistration, true);
  });

  test('일반 가입은 그대로', async () => {
    const guards = createUserGuards({ db, admin: fakeAdmin(), blocklist: createBlocklist({ db, admin }) });
    const u = { uid: 'adult', email: 'ok@x.com', birthdate: '1990-01-01', approvalStatus: 'pending' };
    await db.doc('users/adult').set(u);
    assert.equal(await guards.onUserWritten({ userId: 'adult', before: null, after: u, secret: SECRET }), 'none');
    assert.equal((await db.doc('users/adult').get()).data().approvalStatus, 'pending');
  });
});

describe('scripts/migrate-blocklist-hashes.mjs', () => {
  beforeEach(clearFirestore);
  const script = fileURLToPath(new URL('../../../scripts/migrate-blocklist-hashes.mjs', import.meta.url));
  const env = { ...process.env, BLOCKLIST_HASH_SECRET: SECRET, GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'demo-bcsa' };

  test('기본은 드라이런(쓰기 없음), --apply면 확인값으로 변환·기한 경과 삭제', async () => {
    const future = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 100 * 86400000));
    const past = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000));
    await db.doc('blockedRegistrations/u_raw').set({ uid: 'u_raw', email: 'raw@x.com', phone: '01033334444', blockedUntil: future, reason: 'admin_forced' });
    await db.doc('blockedRegistrations/u_exp').set({ uid: 'u_exp', email: 'exp@x.com', blockedUntil: past });

    const dry = await run(process.execPath, [script], { env });
    assert.match(dry.stdout, /드라이런/);
    assert.equal((await all('blockedRegistrations')).length, 2);
    assert.equal((await db.doc('blockedRegistrations/u_raw').get()).data().email, 'raw@x.com');

    await run(process.execPath, [script, '--apply'], { env });
    const docs = await all('blockedRegistrations');
    assert.equal(docs.length, 1);
    const h = buildBlockHashes(SECRET, { uid: 'u_raw', email: 'raw@x.com', phone: '01033334444' });
    assert.equal(docs[0].id, h.uidHash);
    assert.equal(docs[0].emailHash, h.emailHash);
    assert.equal(docs[0].phoneHash, h.phoneHash);
    assert.ok(!JSON.stringify(docs[0]).includes('raw@x.com'));
    assert.ok(await createBlocklist({ db, admin }).findActiveBlock(SECRET, { email: 'raw@x.com' }));
  });

  test('비밀값이 없으면 실행을 거부', async () => {
    await assert.rejects(run(process.execPath, [script], { env: { ...env, BLOCKLIST_HASH_SECRET: '' } }));
  });
});
