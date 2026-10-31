/**
 * 예전 가입자(회원 문서 id ≠ 로그인 uid, 문서에 uid 필드도 없음)의 로그인 uid를 서버에서 찾는다.
 * syncPublicProfile·scripts/backfill-public-mirrors.mjs 공용 (auth는 admin.auth()를 넘겨받음).
 *
 * 남의 이메일로 계정을 먼저 만들어 회원 자리를 가로채지 못하도록, 아래를 모두 만족할 때만 인정한다.
 *  1. 같은 이메일의 Firebase Auth 계정이 있고
 *  2. 그 계정이 이메일·비밀번호 로그인 계정이거나, 회원 문서의 카카오 연결(kakaoId)과 같은 카카오 계정(kakao_{id})이며
 *  3. 이메일 인증이 끝났거나(emailVerified), 계정 생성 시각이 회원 문서 생성 시각 + 1일 이전
 * 문서 id 자체가 Auth uid이면 그대로 쓴다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (v) => {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object' && (v.seconds != null || v._seconds != null)) return Number(v.seconds ?? v._seconds) * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * @returns {Promise<{ uid: string, how: 'docId'|'email' } | null>}
 */
export async function resolveLegacyAuthUid(auth, docId, u) {
  if (!u || typeof u !== 'object') return null;
  if (u.uid) return { uid: String(u.uid), how: 'field' };
  try {
    const byId = await auth.getUser(String(docId));
    if (byId?.uid) return { uid: byId.uid, how: 'docId' };
  } catch (e) {
    if (e?.code && e.code !== 'auth/user-not-found') throw e;
  }
  const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
  if (!email) return null;
  let au;
  try {
    au = await auth.getUserByEmail(email);
  } catch (e) {
    if (e?.code === 'auth/user-not-found') return null;
    throw e;
  }
  if (!au?.uid) return null;
  const providers = (au.providerData || []).map((p) => p.providerId);
  const sameKakao = u.kakaoId != null && au.uid === `kakao_${String(u.kakaoId)}`;
  if (!providers.includes('password') && !sameKakao) return null;
  const docCreated = toMs(u.createdAt);
  const authCreated = toMs(au.metadata?.creationTime);
  const createdInTime = docCreated != null && authCreated != null && authCreated <= docCreated + DAY_MS;
  if (au.emailVerified !== true && !createdInTime) return null;
  return { uid: au.uid, how: 'email' };
}
