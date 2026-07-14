#!/usr/bin/env node
/**
 * config/siteAdmins.json 에 적힌 이메일 → Firebase 관리자 권한 배포
 *
 * - Auth Custom Claims: { admin: true }
 * - Firestore users: role admin, memberGrade 마스터, approvalStatus approved
 * - Firestore settings/siteAdmins: 배포된 목록 기록
 *
 * 실행 전:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * 실행:
 *   npm run sync-admins
 *   node scripts/sync-site-admins.mjs --email someone@example.com
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../config/siteAdmins.json');

function loadAdminEmails() {
  const emailArgIdx = process.argv.indexOf('--email');
  if (emailArgIdx !== -1) {
    const email = String(process.argv[emailArgIdx + 1] || '').trim().toLowerCase();
    if (!email) throw new Error('--email 뒤에 이메일을 입력해 주세요.');
    return [email];
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  const list = Array.isArray(raw.admins) ? raw.admins : [];
  return [...new Set(list.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
}

async function findUserDocByEmail(db, email) {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  return null;
}

async function upsertAdminUserDoc(db, authUser) {
  const uid = authUser.uid;
  const email = (authUser.email || '').trim();
  const payload = {
    uid,
    email,
    name: authUser.displayName || email.split('@')[0] || '관리자',
    role: 'admin',
    memberGrade: '마스터',
    approvalStatus: 'approved',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const byIdRef = db.collection('users').doc(uid);
  const byIdSnap = await byIdRef.get();
  if (byIdSnap.exists) {
    await byIdRef.set(payload, { merge: true });
    return byIdRef.id;
  }

  const byEmailDoc = await findUserDocByEmail(db, email);
  if (byEmailDoc) {
    await byEmailDoc.ref.set({ ...payload, uid }, { merge: true });
    return byEmailDoc.id;
  }

  await byIdRef.set({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return uid;
}

async function main() {
  const emails = loadAdminEmails();
  if (emails.length === 0) {
    console.log('[sync-site-admins] config/siteAdmins.json admins 가 비어 있습니다.');
    process.exit(0);
  }

  if (!admin.apps.length) admin.initializeApp();
  const auth = admin.auth();
  const db = admin.firestore();

  const results = [];

  for (const email of emails) {
    try {
      const authUser = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(authUser.uid, { admin: true });
      const docId = await upsertAdminUserDoc(db, authUser);
      results.push({ email, uid: authUser.uid, docId, status: 'ok' });
      console.log(`[sync-site-admins] OK  ${email}  uid=${authUser.uid}  users/${docId}`);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        results.push({ email, status: 'skipped', reason: 'auth/user-not-found (Google 로그인 1회 필요)' });
        console.warn(`[sync-site-admins] SKIP ${email} — Firebase Auth에 계정 없음. /admin 에서 Google 로그인 후 다시 실행`);
      } else {
        results.push({ email, status: 'error', reason: err.message || String(err) });
        console.error(`[sync-site-admins] ERR ${email}:`, err.message || err);
      }
    }
  }

  await db.collection('settings').doc('siteAdmins').set({
    admins: emails,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    results,
  }, { merge: true });

  console.log(`[sync-site-admins] 완료 (${results.filter((r) => r.status === 'ok').length}/${emails.length}명 반영)`);
  console.log('[sync-site-admins] 권한 반영 후 해당 계정은 /admin 에서 로그아웃 후 다시 Google 로그인해야 할 수 있습니다.');
}

main().catch((err) => {
  console.error('[sync-site-admins] failed:', err.message || err);
  process.exit(1);
});
