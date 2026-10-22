/**
 * 소모임·스터디(그룹) 서버 로직: 개설 신청, 가입, QR 출석, QR 결제
 *
 * 데이터 구조 (Firestore)
 * - groups/{groupId}: 그룹 정보. status = pending(승인 대기) | approved | rejected | closed
 * - groups/{groupId}/members/{uid}: 멤버. role = leader | member, status = pending | active | left | rejected
 * - groups/{groupId}/sessions/{sessionId}: 회차(일정·장소·참가비). 그룹장이 직접 관리
 * - groups/{groupId}/sessions/{sessionId}/attendance/{uid}: 출석 기록
 * - groupPayments/{paymentId}: QR 결제 기록 (그룹장 정산용 장부 겸용, 서버만 쓰기)
 *
 * QR 출석 흐름
 * 1. 그룹장 화면이 getSessionQrToken을 30초마다 불러 QR을 새로 그린다 (사진 공유로 대리 출석 방지).
 * 2. 멤버가 QR을 찍으면 issueCheckInPass가 토큰(90초 유효)을 확인하고 10분짜리 출석 패스를 준다.
 *    로그인·회원가입에 시간이 걸려도 출석할 수 있게 하기 위함.
 * 3. 로그인한 멤버가 checkInSession(pass)를 부르면 무료 회차는 바로 출석, 유료 회차는 결제 건을 만든다.
 * 4. 결제 후 completeGroupPayment(또는 결제 웹훅)가 포트원에서 실결제·금액을 확인하고 출석+결제를 함께 기록한다.
 */
import crypto from 'crypto';
import { HttpsError } from 'firebase-functions/v2/https';

const QR_WINDOW_MS = 30 * 1000;
const QR_GRACE_WINDOWS = 2; // 현재 + 직전 2개 창(최대 약 90초)까지 인정
const PASS_TTL_MS = 10 * 60 * 1000;
const GROUP_TYPES = ['meetup', 'study'];
const GROUP_MODES = ['offline', 'online', 'hybrid'];
const JOIN_POLICIES = ['open', 'approval'];

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function createGroupHandlers({ db, admin, verifyPortOnePayment, cancelPortOnePayment, isCallerAdmin }) {
  const QR_SECRET = process.env.ATTENDANCE_QR_SECRET || '';
  const requireSecret = () => {
    if (!QR_SECRET) throw new HttpsError('failed-precondition', '출석 QR 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요.');
  };
  const sign = (payload) => crypto.createHmac('sha256', QR_SECRET).update(payload).digest('base64url');
  const safeEqual = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };

  const groupRef = (gid) => db.collection('groups').doc(String(gid));
  const sessionRef = (gid, sid) => groupRef(gid).collection('sessions').doc(String(sid));
  const memberRef = (gid, uid) => groupRef(gid).collection('members').doc(String(uid));
  const attendanceRef = (gid, sid, uid) => sessionRef(gid, sid).collection('attendance').doc(String(uid));

  async function loadGroupAndSession(gid, sid) {
    const [g, s] = await Promise.all([groupRef(gid).get(), sessionRef(gid, sid).get()]);
    if (!g.exists || !s.exists) throw new HttpsError('not-found', '그룹 또는 회차를 찾을 수 없습니다.');
    return { group: g.data() || {}, session: s.data() || {} };
  }

  async function getProfile(uid) {
    const snap = await db.collection('users').doc(uid).get();
    const u = snap.exists ? snap.data() || {} : {};
    return { name: str(u.name || u.nickname || '회원', 40), img: str(u.img, 500), approved: !u.approvalStatus || u.approvalStatus === 'approved' };
  }

  const requireAuth = (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    return request.auth.uid;
  };

  async function isLeaderOrAdmin(request, group) {
    const uid = request.auth?.uid;
    if (!uid) return false;
    if (group.leaderUid === uid) return true;
    return isCallerAdmin({ uid, admin: request.auth.token?.admin });
  }

  async function countActiveMembers(gid) {
    const snap = await groupRef(gid).collection('members').where('status', '==', 'active').count().get();
    return snap.data().count || 0;
  }

  /** 멤버 확인·자동 가입. 바로 가입(open) 그룹은 정원 안에서 자동 가입, 승인제는 기존 멤버만 */
  async function ensureMember(gid, group, uid, { autoJoin }) {
    const ref = memberRef(gid, uid);
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : null;
    if (cur?.status === 'active') return cur;
    if (!autoJoin || group.joinPolicy !== 'open') {
      throw new HttpsError('permission-denied', cur?.status === 'pending'
        ? '그룹장의 가입 승인을 기다리고 있습니다.'
        : '이 그룹의 멤버만 출석할 수 있습니다. 먼저 그룹에 가입해 주세요.');
    }
    const cap = Number(group.capacity) || 0;
    if (cap > 0 && (await countActiveMembers(gid)) >= cap) {
      throw new HttpsError('resource-exhausted', '그룹 정원이 가득 찼습니다.');
    }
    const profile = await getProfile(uid);
    const data = { uid, name: profile.name, img: profile.img, role: 'member', status: 'active', joinedAt: admin.firestore.FieldValue.serverTimestamp() };
    await ref.set(data, { merge: true });
    return data;
  }

  /** 결제 확인 후 출석+결제 기록 (completeGroupPayment·웹훅 공용, 여러 번 불려도 결과 동일) */
  async function finalizeGroupPayment(paymentId) {
    const payRef = db.collection('groupPayments').doc(String(paymentId));
    const paySnap = await payRef.get();
    if (!paySnap.exists) return { ok: false, error: 'payment_not_found' };
    const pay = paySnap.data();
    if (pay.status === 'paid') return { ok: true, alreadyPaid: true, groupId: pay.groupId, sessionId: pay.sessionId };

    const v = await verifyPortOnePayment({ paymentId, expectedAmount: pay.amount });
    if (!v.verified) {
      if (v.reason === 'amount_mismatch') {
        const actual = Number(v.actual) || 0;
        await cancelPortOnePayment({ paymentId, reason: '결제 금액 불일치로 인한 자동 환불', paidAmount: actual, refundAmount: actual });
        await payRef.set({ status: 'refunded', failReason: 'amount_mismatch', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
      return { ok: false, error: v.reason || 'payment_not_verified' };
    }

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(payRef);
      if (fresh.data()?.status === 'paid') return;
      tx.set(payRef, { status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp(), settled: false }, { merge: true });
      tx.set(attendanceRef(pay.groupId, pay.sessionId, pay.uid), {
        uid: pay.uid,
        name: pay.name || '',
        method: 'qr',
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        paid: true,
        paymentId: String(paymentId),
        amount: pay.amount,
      }, { merge: true });
    });
    return { ok: true, groupId: pay.groupId, sessionId: pay.sessionId };
  }

  // ── callable 본체 ───────────────────────────────────────────

  /** 그룹 개설 신청 (운영진 승인 전까지 비공개) */
  async function createGroupRequest(request) {
    const uid = requireAuth(request);
    const d = request.data || {};
    const profile = await getProfile(uid);
    if (!profile.approved) throw new HttpsError('permission-denied', '가입 승인된 회원만 그룹을 만들 수 있습니다.');
    const type = GROUP_TYPES.includes(d.type) ? d.type : null;
    const title = str(d.title, 60);
    const description = str(d.description, 3000);
    if (!type || title.length < 2 || description.length < 10) {
      throw new HttpsError('invalid-argument', '그룹 종류, 이름(2자 이상), 소개(10자 이상)를 입력해 주세요.');
    }
    const ref = db.collection('groups').doc();
    const batch = db.batch();
    batch.set(ref, {
      type,
      title,
      description,
      region: str(d.region, 40),
      mode: GROUP_MODES.includes(d.mode) ? d.mode : 'offline',
      schedule: str(d.schedule, 200),
      capacity: Math.max(0, Math.min(500, Math.floor(Number(d.capacity) || 0))),
      joinPolicy: JOIN_POLICIES.includes(d.joinPolicy) ? d.joinPolicy : 'approval',
      leaderUid: uid,
      leaderName: profile.name,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(memberRef(ref.id, uid), {
      uid, name: profile.name, img: profile.img, role: 'leader', status: 'active',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { groupId: ref.id };
  }

  /** 가입 신청: 바로 가입 그룹은 즉시 멤버, 승인제는 그룹장 승인 대기 */
  async function joinGroup(request) {
    const uid = requireAuth(request);
    const gid = str(request.data?.groupId, 100);
    const g = await groupRef(gid).get();
    if (!g.exists || g.data().status !== 'approved') throw new HttpsError('not-found', '가입할 수 있는 그룹이 아닙니다.');
    const group = g.data();
    const existing = await memberRef(gid, uid).get();
    if (existing.exists && ['active', 'pending'].includes(existing.data().status)) {
      return { status: existing.data().status };
    }
    if (group.joinPolicy === 'open') {
      await ensureMember(gid, group, uid, { autoJoin: true });
      return { status: 'active' };
    }
    const profile = await getProfile(uid);
    await memberRef(gid, uid).set({
      uid, name: profile.name, img: profile.img, role: 'member', status: 'pending',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { status: 'pending' };
  }

  /** 그룹장 화면용 QR 토큰 (30초마다 바뀜) */
  async function getSessionQrToken(request) {
    requireAuth(request);
    requireSecret();
    const gid = str(request.data?.groupId, 100);
    const sid = str(request.data?.sessionId, 100);
    const { group } = await loadGroupAndSession(gid, sid);
    if (!(await isLeaderOrAdmin(request, group))) throw new HttpsError('permission-denied', '그룹장만 출석 QR을 띄울 수 있습니다.');
    const w = Math.floor(Date.now() / QR_WINDOW_MS);
    const token = `${w}.${sign(`qr|${gid}|${sid}|${w}`).slice(0, 22)}`;
    const msLeft = QR_WINDOW_MS - (Date.now() % QR_WINDOW_MS);
    return { token, refreshInMs: msLeft };
  }

  /** QR을 찍은 직후(로그인 전에도) 토큰 확인 → 10분짜리 출석 패스 + 회차 안내 정보 */
  async function issueCheckInPass(request) {
    requireSecret();
    const gid = str(request.data?.groupId, 100);
    const sid = str(request.data?.sessionId, 100);
    const [wStr, sig] = str(request.data?.token, 80).split('.');
    const w = Number(wStr);
    const now = Math.floor(Date.now() / QR_WINDOW_MS);
    const fresh = Number.isInteger(w) && w <= now && now - w <= QR_GRACE_WINDOWS;
    if (!fresh || !sig || !safeEqual(sig, sign(`qr|${gid}|${sid}|${w}`).slice(0, 22))) {
      throw new HttpsError('failed-precondition', 'QR 코드가 만료되었습니다. 그룹장 화면의 QR을 다시 찍어 주세요.');
    }
    const { group, session } = await loadGroupAndSession(gid, sid);
    if (group.status !== 'approved') throw new HttpsError('failed-precondition', '운영 중인 그룹이 아닙니다.');
    if (session.attendanceOpen === false) throw new HttpsError('failed-precondition', '이 회차는 출석을 받지 않고 있습니다.');
    const exp = Date.now() + PASS_TTL_MS;
    const body = b64url(JSON.stringify({ g: gid, s: sid, exp }));
    return {
      pass: `${body}.${sign(`pass|${body}`)}`,
      group: { title: group.title, type: group.type },
      session: { title: session.title || '', startsAt: session.startsAt || '', location: session.location || '', fee: Number(session.fee) || 0 },
    };
  }

  function readPass(pass) {
    const [body, sig] = str(pass, 600).split('.');
    if (!body || !sig || !safeEqual(sig, sign(`pass|${body}`))) throw new HttpsError('failed-precondition', '출석 정보가 올바르지 않습니다. QR을 다시 찍어 주세요.');
    let p;
    try {
      p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new HttpsError('failed-precondition', '출석 정보가 올바르지 않습니다. QR을 다시 찍어 주세요.');
    }
    if (!p.exp || Date.now() > p.exp) throw new HttpsError('failed-precondition', '출석 가능 시간이 지났습니다. QR을 다시 찍어 주세요.');
    return p;
  }

  /** 로그인한 멤버의 출석 처리. 유료 회차는 결제 건을 만들어 돌려준다 */
  async function checkInSession(request) {
    const uid = requireAuth(request);
    requireSecret();
    const { g: gid, s: sid } = readPass(request.data?.pass);
    const { group, session } = await loadGroupAndSession(gid, sid);
    if (group.status !== 'approved') throw new HttpsError('failed-precondition', '운영 중인 그룹이 아닙니다.');
    if (session.attendanceOpen === false) throw new HttpsError('failed-precondition', '이 회차는 출석을 받지 않고 있습니다.');
    const member = await ensureMember(gid, group, uid, { autoJoin: true });

    const att = await attendanceRef(gid, sid, uid).get();
    const fee = Math.max(0, Math.floor(Number(session.fee) || 0));
    if (att.exists && (fee === 0 || att.data().paid === true || att.data().cashPaid === true)) {
      return { status: 'already_checked_in', groupId: gid, sessionId: sid };
    }

    if (fee === 0) {
      await attendanceRef(gid, sid, uid).set({
        uid, name: member.name || '', method: 'qr',
        checkedAt: admin.firestore.FieldValue.serverTimestamp(), paid: false,
      }, { merge: true });
      return { status: 'checked_in', groupId: gid, sessionId: sid };
    }

    // 유료 회차: 결제 건 생성 (같은 사람·같은 회차의 미결제 건은 재사용)
    const existing = await db.collection('groupPayments')
      .where('uid', '==', uid).where('sessionId', '==', sid).where('status', '==', 'pending').limit(1).get();
    let paymentId;
    if (!existing.empty && existing.docs[0].data().amount === fee) {
      paymentId = existing.docs[0].id;
    } else {
      paymentId = `g_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      await db.collection('groupPayments').doc(paymentId).set({
        uid, name: member.name || '', groupId: gid, sessionId: sid, leaderUid: group.leaderUid,
        groupTitle: group.title || '', sessionTitle: session.title || '',
        amount: fee, status: 'pending', settled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    const orderName = `${group.title || '그룹'} ${session.title || ''}`.trim().slice(0, 50);
    return { status: 'payment_required', paymentId, amount: fee, orderName, groupId: gid, sessionId: sid };
  }

  /** 결제 직후(또는 모바일 결제 복귀 후) 호출: 포트원 확인 후 출석+결제 기록 */
  async function completeGroupPayment(request) {
    const uid = requireAuth(request);
    const paymentId = str(request.data?.paymentId, 80);
    const snap = await db.collection('groupPayments').doc(paymentId).get();
    if (!snap.exists || snap.data().uid !== uid) throw new HttpsError('not-found', '결제 정보를 찾을 수 없습니다.');
    try {
      return await finalizeGroupPayment(paymentId);
    } catch (e) {
      console.warn('[Group Payment] verify error', e.response?.status || e.message);
      return { ok: false, error: 'verify_error' };
    }
  }

  return {
    finalizeGroupPayment,
    callables: { createGroupRequest, joinGroup, getSessionQrToken, issueCheckInPass, checkInSession, completeGroupPayment },
  };
}
