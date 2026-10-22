#!/usr/bin/env node
/**
 * 공개용 사본 일괄 생성 (보안 규칙 변경 직후 1회 실행)
 *
 * users → publicProfiles, applications → publicApplications
 * 이후에는 Cloud Functions 트리거(syncPublicProfile, syncPublicApplication)가 자동으로 맞춘다.
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
  console.log(DRY_RUN ? '드라이런 완료 (쓰기 없음)' : '완료');
  process.exit(0);
} catch (e) {
  console.error('실패:', e.message);
  process.exit(1);
}
