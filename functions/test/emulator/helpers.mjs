/** 에뮬레이터 테스트 공용: firebase-admin을 demo 프로젝트·Firestore 에뮬레이터에 연결 */
import admin from 'firebase-admin';

export const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-bcsa';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST가 없습니다. npm run test:functions 로 실행하세요(운영 DB 보호).');
}
export const BUCKET = `${PROJECT_ID}.appspot.com`;
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
export const db = admin.firestore();
export { admin };

export async function clearFirestore() {
  const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clear failed ${res.status}`);
}

/** Auth 에뮬레이터 없이 쓰는 가짜 admin (firestore는 진짜, auth만 기록용) */
export function fakeAdmin() {
  const deleted = [];
  return {
    deleted,
    firestore: admin.firestore,
    auth: () => ({ deleteUser: async (uid) => { deleted.push(uid); } }),
  };
}

export const snap = (data) => (data ? { exists: true, data: () => data } : { exists: false, data: () => undefined });

export async function all(path) {
  const s = await db.collection(path).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
