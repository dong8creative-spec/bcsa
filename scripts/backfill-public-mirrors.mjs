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
 *   node scripts/backfill-public-mirrors.mjs --count-missing-uid   # 읽기 전용: uid 필드 없는 회원 문서 수만 출력
 *
 * uid 필드가 없는 예전 가입자는 functions/legacyUid.js 조건(같은 이메일의 비밀번호·같은 카카오 계정 +
 * 이메일 인증 또는 회원 문서 생성 1일 안에 만든 계정)을 만족할 때만 로그인 uid로 인정하고, 그때 회원 문서에 uid를 한 번 적는다.
 */

import admin from 'firebase-admin';
import { buildPublicProfile, buildPublicApplication, isApprovedMember } from '../functions/publicMirrors.js';
import { resolveLegacyAuthUid } from '../functions/legacyUid.js';

const DRY_RUN = process.argv.includes('--dry-run');
const COUNT_MISSING_UID = process.argv.includes('--count-missing-uid');

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
  let resolvedByEmail = 0; let unresolved = 0;
  for (const d of usersSnap.docs) {
    const u = d.data() || {};
    if (!isApprovedMember(u)) continue;
    let r = null;
    try { r = await resolveLegacyAuthUid(admin.auth(), d.id, u); } catch (e) { console.warn(`  - uid 확인 실패 ${d.id.slice(0, 6)}…: ${e.code || e.message}`); }
    if (!r) { unresolved += 1; continue; }
    accessKeep.add(r.uid);
    ops.push((b) => b.set(db.collection('memberAccess').doc(r.uid), { docId: d.id, approved: true }));
    if (r.how === 'email' && !u.uid) {
      resolvedByEmail += 1;
      ops.push((b) => b.update(d.ref, { uid: r.uid, uidResolvedAt: now, uidResolvedBy: 'email' }));
    }
  }
  const accessStale = accessSnap.docs.filter((d) => !accessKeep.has(d.id));
  accessStale.forEach((d) => ops.push((b) => b.delete(d.ref)));
  ops.push((b) => b.set(db.collection('publicStats').doc('members'), { approvedMemberCount: keep.size, updatedAt: now }));
  console.log(`[memberAccess] ${accessKeep.size}건, 정리 ${accessStale.length}건 · 이메일로 uid 확인 ${resolvedByEmail}건 · 확인 못 함 ${unresolved}건 · [publicStats/members] ${keep.size}명`);
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

/** 읽기 전용: uid 필드가 없는 회원 문서 수 (쓰기 없음) */
async function countMissingUid() {
  const snap = await db.collection('users').get();
  const missing = snap.docs.filter((d) => !(d.data() || {}).uid);
  const approved = missing.filter((d) => isApprovedMember(d.data() || {}));
  console.log(`[uid 없는 회원 문서] 전체 ${snap.size}건 중 ${missing.length}건 (그중 승인 회원 ${approved.length}건) — 읽기만 했습니다`);
}

if (COUNT_MISSING_UID) {
  try {
    await countMissingUid();
    process.exit(0);
  } catch (e) {
    console.error('실패:', e.message);
    process.exit(1);
  }
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
