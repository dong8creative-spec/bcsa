#!/usr/bin/env node
/**
 * 테스트용 계정 생성 (Firebase Auth + Firestore users)
 *
 * 실행 전:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * 실행:
 *   node scripts/create-test-user.mjs
 *   node scripts/create-test-user.mjs --email id0089@naver.com --password 'dlehdgjs8A!'
 */

import admin from 'firebase-admin';

const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const i = args.indexOf(name);
  if (i === -1) return defaultValue;
  return args[i + 1] ?? defaultValue;
};

const email = getArg('--email', 'id0089@naver.com');
const password = getArg('--password', 'dlehdgjs8A!');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const auth = admin.auth();
  const db = admin.firestore();

  // 1) 이메일로 기존 사용자 확인
  let existingByEmail = null;
  try {
    existingByEmail = await auth.getUserByEmail(email);
  } catch (_) {
    // 없으면 getUserByEmail throws
  }
  if (existingByEmail) {
    console.log('[create-test-user] 이미 존재하는 이메일입니다. uid:', existingByEmail.uid);
    const userRef = db.collection('users').doc(existingByEmail.uid);
    const snap = await userRef.get();
    if (snap.exists) {
      console.log('[create-test-user] Firestore users 문서도 이미 있습니다.');
    } else {
      console.log('[create-test-user] Firestore 문서만 생성합니다.');
      await createFirestoreUser(db, existingByEmail.uid, email);
    }
    process.exit(0);
    return;
  }

  // 2) Auth 사용자 생성
  const userRecord = await auth.createUser({
    email,
    password,
    emailVerified: false
  });
  const uid = userRecord.uid;
  console.log('[create-test-user] Auth 사용자 생성됨. uid:', uid);

  // 3) Firestore users 문서 생성 (앱에서 사용하는 최소 필드)
  await createFirestoreUser(db, uid, email);
  console.log('[create-test-user] Firestore users 문서 생성됨.');
  console.log('[create-test-user] 완료. 로그인: email=', email);
  process.exit(0);
}

async function createFirestoreUser(db, uid, email) {
  const userRef = db.collection('users').doc(uid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const data = {
    uid,
    email,
    name: '테스트회원',
    nickname: '테스트',
    userType: '일반회원',
    birthdate: '1990-01-01',
    gender: '기타',
    phone: '01000000000',
    phonePublic: false,
    createdAt: now,
    updatedAt: now
  };
  await userRef.set(data);
}

main().catch((err) => {
  console.error('[create-test-user] 오류:', err);
  process.exit(1);
});
