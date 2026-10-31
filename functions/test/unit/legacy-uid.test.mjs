/** 예전 가입자 로그인 uid 찾기 (functions/legacyUid.js) — 가짜 auth */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegacyAuthUid } from '../../legacyUid.js';

const notFound = () => Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
const fakeAuth = ({ byId = {}, byEmail = {} } = {}) => ({
  getUser: async (uid) => { if (byId[uid]) return byId[uid]; throw notFound(); },
  getUserByEmail: async (e) => { if (byEmail[e]) return byEmail[e]; throw notFound(); },
});
const pw = (uid, { verified = false, created = '2024-01-01T00:00:00Z' } = {}) => ({
  uid, emailVerified: verified, providerData: [{ providerId: 'password' }], metadata: { creationTime: created },
});

test('uid 필드가 있으면 그대로', async () => {
  assert.deepEqual(await resolveLegacyAuthUid(fakeAuth(), 'd', { uid: 'u9' }), { uid: 'u9', how: 'field' });
});
test('문서 id가 Auth uid면 그대로', async () => {
  assert.deepEqual(await resolveLegacyAuthUid(fakeAuth({ byId: { d1: { uid: 'd1' } } }), 'd1', { email: 'a@x.com' }), { uid: 'd1', how: 'docId' });
});
test('비밀번호 계정 + 회원 문서 생성 1일 안에 만든 계정이면 인정', async () => {
  const auth = fakeAuth({ byEmail: { 'a@x.com': pw('authA', { created: '2024-01-01T12:00:00Z' }) } });
  assert.deepEqual(await resolveLegacyAuthUid(auth, 'legacy', { email: 'A@x.com', createdAt: '2024-01-01T00:00:00Z' }), { uid: 'authA', how: 'email' });
});
test('회원 문서보다 한참 뒤에 만든 미인증 계정은 거부(남의 이메일 선점 방지)', async () => {
  const auth = fakeAuth({ byEmail: { 'a@x.com': pw('attacker', { created: '2026-10-31T00:00:00Z' }) } });
  assert.equal(await resolveLegacyAuthUid(auth, 'legacy', { email: 'a@x.com', createdAt: '2024-01-01T00:00:00Z' }), null);
});
test('늦게 만든 계정이라도 이메일 인증이 끝났으면 인정', async () => {
  const auth = fakeAuth({ byEmail: { 'a@x.com': pw('authB', { verified: true, created: '2026-10-31T00:00:00Z' }) } });
  assert.equal((await resolveLegacyAuthUid(auth, 'legacy', { email: 'a@x.com', createdAt: '2024-01-01T00:00:00Z' })).uid, 'authB');
});
test('비밀번호 계정이 아니면(다른 카카오 계정 등) 거부, 같은 카카오 계정이면 인정', async () => {
  const kakao = { uid: 'kakao_5', emailVerified: false, providerData: [], metadata: { creationTime: '2024-01-01T00:00:00Z' } };
  const auth = fakeAuth({ byEmail: { 'k@x.com': kakao } });
  assert.equal(await resolveLegacyAuthUid(auth, 'legacy', { email: 'k@x.com', kakaoId: '6', createdAt: '2024-01-01T00:00:00Z' }), null);
  assert.equal((await resolveLegacyAuthUid(auth, 'legacy', { email: 'k@x.com', kakaoId: 5, createdAt: '2024-01-01T00:00:00Z' })).uid, 'kakao_5');
});
test('생성 시각 기록이 없고 미인증이면 거부', async () => {
  const auth = fakeAuth({ byEmail: { 'a@x.com': pw('authC') } });
  assert.equal(await resolveLegacyAuthUid(auth, 'legacy', { email: 'a@x.com' }), null);
});
