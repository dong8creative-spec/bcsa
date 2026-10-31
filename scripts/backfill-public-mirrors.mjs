#!/usr/bin/env node
/**
 * 공개용 사본 일괄 생성 (보안 규칙 변경 직후 1회 실행)
 *
 * users → publicProfiles·memberAccess(승인 회원 표시)·publicStats/members(회원 수),
 * applications → publicApplications, groups/{id}/members → groups.memberCount(활동 중 멤버 수)
 * 이후에는 Cloud Functions 트리거(syncPublicProfile, syncPublicApplication, syncGroupMemberCount)가 자동으로 맞춘다.
 * 2026-10-31: 회원명단·모임 멤버 명단을 승인 회원·모임 멤버에게만 보이게 바꾼 규칙(firestore.rules)을 배포하기 전에
 * 이 스크립트를 한 번 더 실행해야 예전 가입자(회원 문서 id ≠ 로그인 uid)도 회원명단을 볼 수 있다.
 *
 * 실행 전:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * 실행:
 *   node scripts/backfill-public-mirrors.mjs --dry-run   # 건수만 확인
 *   node scripts/backfill-public-mirrors.mjs
 */

import admin from 'firebase-admin';
import { buildPublicProfile, buildPublicApplication, isApprovedMember } from '../functions/publicMirrors.js';

const DRY_RUN = process.argv.includes('--dry-run');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function backfillProfiles() {
  const [usersSnap, existingSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('publicProfiles').get(),
  ]);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const keep = new Set();
  const ops = [];
  usersSnap.docs.forEach((d) => {
    const u = d.data() || {};
    if (!isApprovedMember(u)) return;
    keep.add(d.id);
    ops.push((b) => b.set(db.collection('publicProfiles').doc(d.id), { ...buildPublicProfile(d.id, u), updatedAt: now }));
  });
  const stale = existingSnap.docs.filter((d) => !keep.has(d.id));
  stale.forEach((d) => ops.push((b) => b.delete(d.ref)));
  console.log(`[publicProfiles] 회원 ${usersSnap.size}명 중 공개 ${keep.size}명, 정리 ${stale.length}건`);

  // 승인 회원 표시(로그인 uid 기준) — firestore.rules isApprovedMemberCaller가 사용
  const accessSnap = await db.collection('memberAccess').get();
  const accessKeep = new Set();
  usersSnap.docs.forEach((d) => {
    const u = d.data() || {};
    if (!isApprovedMember(u)) return;
    const authUid = String(u.uid || d.id);
    accessKeep.add(authUid);
    ops.push((b) => b.set(db.collection('memberAccess').doc(authUid), { docId: d.id, approved: true }));
  });
  const accessStale = accessSnap.docs.filter((d) => !accessKeep.has(d.id));
  accessStale.forEach((d) => ops.push((b) => b.delete(d.ref)));
  ops.push((b) => b.set(db.collection('publicStats').doc('members'), { approvedMemberCount: keep.size, updatedAt: now }));
  console.log(`[memberAccess] ${accessKeep.size}건, 정리 ${accessStale.length}건 · [publicStats/members] ${keep.size}명`);
  if (!DRY_RUN) await commitInChunks(ops);
}

async function backfillGroupMemberCounts() {
  const groupsSnap = await db.collection('groups').get();
  const ops = [];
  for (const g of groupsSnap.docs) {
    const agg = await g.ref.collection('members').where('status', '==', 'active').count().get();
    const n = agg.data().count || 0;
    ops.push((b) => b.update(g.ref, { memberCount: n }));
  }
  console.log(`[groups.memberCount] 그룹 ${groupsSnap.size}개`);
  if (!DRY_RUN) await commitInChunks(ops);
}

async function backfillApplications() {
  const [appsSnap, existingSnap] = await Promise.all([
    db.collection('applications').get(),
    db.collection('publicApplications').get(),
  ]);
  const keep = new Set(appsSnap.docs.map((d) => d.id));
  const ops = appsSnap.docs.map((d) => (b) => b.set(db.collection('publicApplications').doc(d.id), buildPublicApplication(d.data() || {})));
  const stale = existingSnap.docs.filter((d) => !keep.has(d.id));
  stale.forEach((d) => ops.push((b) => b.delete(d.ref)));
  console.log(`[publicApplications] 신청 ${appsSnap.size}건 복사, 정리 ${stale.length}건`);
  if (!DRY_RUN) await commitInChunks(ops);
}

try {
  await backfillProfiles();
  await backfillApplications();
  await backfillGroupMemberCounts();
  console.log(DRY_RUN ? '드라이런 완료 (쓰기 없음)' : '완료');
  process.exit(0);
} catch (e) {
  console.error('실패:', e.message);
  process.exit(1);
}
