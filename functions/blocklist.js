/**
 * 강제 탈퇴 회원 재가입 제한 목록(blockedRegistrations) — 확인값(해시)만 저장
 *
 * 처리방침 제3조 "재가입 제한 정보(이메일·전화번호를 변환한 확인값): 탈퇴일부터 1년"에 맞춰
 * 이메일·전화번호·uid 원문 대신 HMAC-SHA256(서버 비밀값, "종류:정규화값")만 저장한다.
 * 비밀값(BLOCKLIST_HASH_SECRET)은 Secret Manager에 두고 Functions에 defineSecret으로 연결한다.
 * 비밀값이 없으면 전화번호처럼 경우의 수가 적은 값은 해시만으로도 역산될 수 있으므로 이메일·전화 확인값을
 * 만들지 않는다(uid 기준 차단만 남기고 오류 로그를 남긴다).
 *
 * 문서 구조 (blockedRegistrations/{uidHash})
 *   { hashVersion: 1, uidHash, emailHash, phoneHash, reason, blockedAt, expiresAt }
 * 예전 형식(원문 uid·email·phone, blockedUntil)은 scripts/migrate-blocklist-hashes.mjs로 바꾼다.
 * 바꾸기 전에도 차단이 풀리지 않도록 조회는 예전 형식도 함께 확인한다.
 */
import crypto from 'crypto';

export const BLOCKED_REGISTRATIONS = 'blockedRegistrations';
export const BLOCK_HASH_VERSION = 1;
export const BLOCK_DURATION_YEARS = 1;

export const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** 전화번호 정규화: 숫자만, +82 국가번호는 0으로 (카카오는 "+82 10-1234-5678" 형식) */
export const normalizePhone = (v) => {
  let digits = typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '';
  if (digits.startsWith('82') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 11);
};

/** HMAC 확인값. 비밀값이 없거나 값이 비면 '' */
export function hashIdentifier(secret, kind, value) {
  const key = typeof secret === 'string' ? secret.trim() : '';
  if (!key || !value) return '';
  return crypto.createHmac('sha256', key).update(`${kind}:${value}`).digest('hex');
}

/** uid 확인값: 비밀값이 있으면 HMAC, 없으면 SHA-256 (uid는 추측할 수 없는 임의 문자열이라 역산 위험이 낮음) */
export function hashUid(secret, uid) {
  const u = String(uid || '').trim();
  if (!u) return '';
  return hashIdentifier(secret, 'uid', u) || crypto.createHash('sha256').update(`uid:${u}`).digest('hex');
}

export function buildBlockHashes(secret, { uid, email, phone }) {
  const e = normalizeEmail(email || '');
  const p = normalizePhone(phone || '');
  return {
    uidHash: hashUid(secret, uid),
    emailHash: hashIdentifier(secret, 'email', e),
    phoneHash: p.length >= 10 ? hashIdentifier(secret, 'phone', p) : '',
  };
}

export function blockExpiresAt(from = new Date()) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + BLOCK_DURATION_YEARS);
  return d;
}

const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function createBlocklist({ db, admin }) {
  const col = () => db.collection(BLOCKED_REGISTRATIONS);

  /** 차단 등록 (관리자 강제 탈퇴). 같은 사람을 다시 등록하면 기간을 새로 1년으로 덮어쓴다. */
  async function addBlock(secret, { uid, email, phone, reason = 'admin_forced', now = new Date() }) {
    const hashes = buildBlockHashes(secret, { uid, email, phone });
    if (!hashes.uidHash) throw new Error('uid is required');
    const expiresAt = blockExpiresAt(now);
    await col().doc(hashes.uidHash).set({
      hashVersion: BLOCK_HASH_VERSION,
      ...hashes,
      reason,
      secretMissing: !String(secret || '').trim(),
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });
    // 같은 uid로 남은 예전(원문) 문서는 지운다
    const legacyId = String(uid || '').trim();
    if (legacyId && legacyId !== hashes.uidHash) await col().doc(legacyId).delete().catch(() => {});
    return { expiresAt, hashes };
  }

  /** 차단 여부 확인. 기간이 지난 문서는 무시(예약 파기 작업이 지운다). */
  async function findActiveBlock(secret, { uid, email, phone, now = new Date() }) {
    const hashes = buildBlockHashes(secret, { uid, email, phone });
    const active = (snap) => {
      if (!snap || !snap.exists) return null;
      const d = snap.data() || {};
      const until = toDate(d.expiresAt) || toDate(d.blockedUntil);
      return until && until.getTime() > now.getTime() ? until : null;
    };
    const firstActive = async (q) => {
      const s = await q.limit(5).get();
      for (const doc of s.docs) {
        const u = active(doc);
        if (u) return u;
      }
      return null;
    };

    // 비밀값 설정 전에 등록된 uid 확인값(SHA-256)도 함께 확인한다
    const uidIds = [...new Set([hashes.uidHash, hashUid('', uid)].filter(Boolean))];
    for (const id of uidIds) {
      const u = active(await col().doc(id).get());
      if (u) return u;
    }
    if (hashes.emailHash) {
      const u = await firstActive(col().where('emailHash', '==', hashes.emailHash));
      if (u) return u;
    }
    if (hashes.phoneHash) {
      const u = await firstActive(col().where('phoneHash', '==', hashes.phoneHash));
      if (u) return u;
    }

    // 예전 원문 형식 (migrate-blocklist-hashes.mjs 실행 전 기록)
    const rawUid = String(uid || '').trim();
    const rawEmail = normalizeEmail(email || '');
    const rawPhone = normalizePhone(phone || '');
    if (rawUid) {
      const u = active(await col().doc(rawUid).get());
      if (u) return u;
    }
    if (rawEmail) {
      const u = await firstActive(col().where('email', '==', rawEmail));
      if (u) return u;
    }
    if (rawPhone.length >= 10) {
      const u = await firstActive(col().where('phone', '==', rawPhone));
      if (u) return u;
    }
    return null;
  }

  return { addBlock, findActiveBlock };
}
