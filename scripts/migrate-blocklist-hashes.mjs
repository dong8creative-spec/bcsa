#!/usr/bin/env node
/**
 * 재가입 제한 목록(blockedRegistrations) 1회 변환: 원문 uid·이메일·전화번호 → HMAC 확인값
 * (2026-10-31 약관 검토 ①-7 — 처리방침의 "확인값" 표기와 실제 저장을 맞춘다)
 *
 * 기본은 드라이런(읽기만, 건수·대상만 출력). 실제로 바꾸려면 --apply.
 * 비밀값은 Functions 비밀값(BLOCKLIST_HASH_SECRET)과 반드시 같은 값을 넣어야 한다. 다르면 차단 확인이 맞지 않는다.
 *
 * 실행 순서 (운영자):
 *   1) firebase functions:secrets:set BLOCKLIST_HASH_SECRET   # 긴 임의 문자열, 예: openssl rand -hex 32
 *   2) Functions 배포 (addBlockedRegistration·checkBlockedRegistration·guardUserDoc가 새 형식 사용)
 *   3) export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *      export BLOCKLIST_HASH_SECRET="$(firebase functions:secrets:access BLOCKLIST_HASH_SECRET)"
 *      node scripts/migrate-blocklist-hashes.mjs            # 드라이런
 *      node scripts/migrate-blocklist-hashes.mjs --apply    # 실제 변환
 *
 * 기한(1년)이 이미 지난 기록은 변환하지 않고 지운다(--apply일 때).
 * 에뮬레이터 확인: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-bcsa node scripts/migrate-blocklist-hashes.mjs --apply
 */
import admin from 'firebase-admin';
import {
  BLOCKED_REGISTRATIONS, BLOCK_HASH_VERSION, buildBlockHashes, blockExpiresAt,
} from '../functions/blocklist.js';

const APPLY = process.argv.includes('--apply');
const SECRET = (process.env.BLOCKLIST_HASH_SECRET || '').trim();

if (!SECRET) {
  console.error('BLOCKLIST_HASH_SECRET 환경 변수가 없습니다. Functions 비밀값과 같은 값을 넣어 주세요.');
  process.exit(1);
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { Timestamp } = admin.firestore;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `에뮬레이터 ${process.env.FIRESTORE_EMULATOR_HOST}`
    : `프로젝트 ${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '(기본 자격 증명의 프로젝트)'}`;
  console.log(`[대상] ${target} · ${APPLY ? '실제 변환(--apply)' : '드라이런(쓰기 없음)'}`);

  const now = new Date();
  const snap = await db.collection(BLOCKED_REGISTRATIONS).get();
  let converted = 0; let expired = 0; let already = 0;
  for (const d of snap.docs) {
    const x = d.data() || {};
    if (x.hashVersion === BLOCK_HASH_VERSION) { already += 1; continue; }
    const until = toDate(x.expiresAt) || toDate(x.blockedUntil)
      || (toDate(x.blockedAt) ? blockExpiresAt(toDate(x.blockedAt)) : blockExpiresAt(now));
    if (until.getTime() <= now.getTime()) {
      expired += 1;
      console.log(`  - 기한 경과 삭제: ${d.id.slice(0, 6)}… (${until.toISOString().slice(0, 10)})`);
      if (APPLY) await d.ref.delete();
      continue;
    }
    const hashes = buildBlockHashes(SECRET, { uid: x.uid || d.id, email: x.email || '', phone: x.phone || '' });
    const newRef = db.collection(BLOCKED_REGISTRATIONS).doc(hashes.uidHash);
    converted += 1;
    console.log(`  - 변환: ${d.id.slice(0, 6)}… → ${hashes.uidHash.slice(0, 10)}… (이메일 ${hashes.emailHash ? 'O' : 'X'}, 전화 ${hashes.phoneHash ? 'O' : 'X'}, ~${until.toISOString().slice(0, 10)})`);
    if (!APPLY) continue;
    const existing = await newRef.get();
    const existingUntil = existing.exists ? toDate(existing.data().expiresAt) : null;
    const batch = db.batch();
    batch.set(newRef, {
      hashVersion: BLOCK_HASH_VERSION,
      ...hashes,
      reason: x.reason || 'admin_forced',
      secretMissing: false,
      blockedAt: x.blockedAt || Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(existingUntil && existingUntil > until ? existingUntil : until),
      migratedAt: Timestamp.fromDate(now),
    });
    if (newRef.path !== d.ref.path) batch.delete(d.ref);
    await batch.commit();
  }
  console.log(`[결과] 전체 ${snap.size}건 · 변환 ${converted} · 기한 경과 ${expired} · 이미 새 형식 ${already}${APPLY ? '' : ' (드라이런: 바뀐 것 없음)'}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
