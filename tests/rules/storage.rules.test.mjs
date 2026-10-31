/** storage.rules 테스트 (Storage 에뮬레이터) — npm run test:rules */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

let env;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const meta = (ownerUid) => ({ contentType: 'image/png', ...(ownerUid ? { customMetadata: { ownerUid } } : {}) });
const st = (uid, claims = {}) => (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).storage();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bcsa',
    storage: { rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (c) => {
    await c.storage().ref('images/community/mine.png').put(png, meta('u1'));
    await c.storage().ref('images/community/legacy.png').put(png, meta());
  });
});

describe('Storage 이미지: 올린 본인·관리자만 삭제', () => {
  test('로그인 회원: 본인 표시로 업로드 허용', async () => { await assertSucceeds(st('u1').ref('images/community/new.png').put(png, meta('u1'))); });
  test('남의 uid로 표시해 업로드 거부', async () => { await assertFails(st('u1').ref('images/community/x.png').put(png, meta('u2'))); });
  test('표시 없이 업로드 허용(예전 화면 호환)', async () => { await assertSucceeds(st('u1').ref('images/company/y.png').put(png, meta())); });
  test('비로그인 업로드 거부', async () => { await assertFails(st(null).ref('images/community/z.png').put(png, meta())); });
  test('이미지가 아닌 파일 거부', async () => { await assertFails(st('u1').ref('images/community/a.txt').put(png, { contentType: 'text/plain' })); });
  test('올린 본인 삭제 허용', async () => { await assertSucceeds(st('u1').ref('images/community/mine.png').delete()); });
  test('다른 회원 삭제 거부', async () => { await assertFails(st('u2').ref('images/community/mine.png').delete()); });
  test('표시 없는 예전 파일은 회원 삭제 거부', async () => { await assertFails(st('u1').ref('images/community/legacy.png').delete()); });
  test('관리자 삭제 허용', async () => { await assertSucceeds(st('boss', { admin: true }).ref('images/community/legacy.png').delete()); });
  test('본인도 덮어쓰기 거부(관리자만)', async () => { await assertFails(st('u1').ref('images/community/mine.png').put(png, meta('u1'))); });
  test('누구나 읽기 허용', async () => { await assertSucceeds(st(null).ref('images/community/mine.png').getDownloadURL()); });
});
