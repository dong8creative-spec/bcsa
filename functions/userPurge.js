/**
 * 회원 탈퇴·강제 탈퇴 시 서버 쪽 정리 (callable purgeUserData의 본체)
 *
 * 원칙 (개인정보 보호법 제21조, 전자상거래법 제6조)
 *  - 법으로 남겨야 하는 기록은 필요한 항목만 legalRetention에 따로 복사한 뒤 원본을 지운다.
 *  - 그 밖의 정보는 바로 지우거나, 다른 회원의 기록(정산 장부·신고 처리)이 깨지지 않게 이름·uid를 지워 익명화한다.
 *
 * 먼저 확인하고 막는 경우 (아무것도 지우기 전에)
 *  a. 운영 중(approved)인 그룹의 그룹장 → 본인·관리자 모두 차단. 회사에 그룹장 변경·그룹 종료를 요청한 뒤 탈퇴
 *     (이용약관 제13조 제1항).
 *  b. 아직 시작하지 않은 유료 프로그램 신청이 남아 있으면 본인 탈퇴·관리자 강제 탈퇴 모두 차단 → 먼저 「신청 취소」 또는
 *     포트원 환불(이용약관 제13조 제5항). 포트원에서 이미 전액 취소된 결제는 막지 않는다. 메시지에 프로그램명·날짜·금액.
 *  c. 결제는 됐는데 신청으로 옮겨지지 않은 결제 대기(포트원 PAID)가 있으면 본인·관리자 모두 차단 → 운영진이 신청 편입·환불.
 *
 * 처리 내용
 *  1. 세미나 신청: 결제 건은 보존 기록(payment, 5년) 복사 후 삭제. 무료 신청은 바로 삭제. 아직 시작 전인 세미나는
 *     참가 인원(예전 방식 currentParticipants)을 줄인다(onSeatReleased).
 *  2. 결제 대기(pendingPayments): 결제 완료 건은 위 c에서 막으므로, 남은 미결제·취소 건을 삭제.
 *  3. 그룹 결제 장부(groupPayments): 결제·환불된 건은 보존 기록 복사 후 장부에서 이름·uid를 지워 익명화
 *     (그룹장 정산 금액이 맞도록 금액·상태·정산 여부는 남긴다). 미결제(pending) 건은 삭제.
 *  4. 그룹 멤버 문서·출석 기록: 삭제. 승인 전·반려된 개설 신청은 통째로 삭제, 종료된 그룹은 그룹장 이름·uid만 지운다.
 *  5. 신고: 본인이 낸 신고와 본인을 대상으로 한 신고는 분쟁 기록(dispute, 3년) 복사 후 원본에서 이름·uid를 지운다
 *     (처리 중인 신고를 운영진이 계속 볼 수 있게 원본은 남김).
 *  6. 알림(users/{id}/notifications): 삭제.
 *  7. Firebase Storage 이미지: 회원 업로드 폴더(images/community/, images/company/)에서 회원이 올린 파일(ownerUid)과
 *     회원 문서·게시글·맛집에 주소가 든 파일을 지운다. 사이트 콘텐츠(images/program/, images/content/)는 지우지 않는다
 *     (본인이 올린 것으로 확인된 프로필 사진 1장만 예외).
 * 게시글·맛집 문서 삭제와 회원 문서·Auth 삭제는 지금처럼 클라이언트(firebaseService.purgeUserRelatedData
 * 이후 deleteUser/deleteAuthUser)가 한다.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import {
  buildSeminarPaymentRecord, buildGroupPaymentRecord, buildReportRecord, writeRetention,
} from './retention.js';
import { parseSeminarDate } from './refund.js';

export const WITHDRAWN_LABEL = '탈퇴한 회원';
const MEMBER_IMAGE_PREFIXES = ['images/community/', 'images/company/'];
const PROFILE_EXTRA_PREFIX = 'images/content/';

const hasPayment = (a) => !!(a?.merchant_uid || a?.merchantUid || a?.imp_uid || a?.impUid);
const seminarIdOf = (a) => String(a?.seminarId || a?.programId || a?.seminar_id || '');

/** 값 안의 모든 문자열(중첩 포함) */
function collectStrings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object' && typeof v.toDate !== 'function') Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

/** Storage 다운로드 주소 → { bucket, path } (Storage 주소가 아니면 null) */
export function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  let m = url.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/);
  if (m) {
    try { return { bucket: m[1], path: decodeURIComponent(m[2]) }; } catch (_) { return null; }
  }
  m = url.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/([^?#]+)/);
  if (m) {
    try { return { bucket: m[1], path: decodeURIComponent(m[2]) }; } catch (_) { return null; }
  }
  m = url.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (m) return { bucket: m[1], path: m[2] };
  return null;
}

export function createUserPurge({
  db, admin, getPortOneV2PaymentInfo = async () => null, now = () => new Date(),
  bucket = null, onSeatReleased = async () => {},
}) {
  const FieldValue = admin.firestore.FieldValue;

  async function queryByFields(collection, fields, values) {
    const out = new Map();
    for (const f of fields) {
      for (const v of values) {
        const snap = await db.collection(collection).where(f, '==', v).get();
        snap.docs.forEach((d) => out.set(d.id, d));
      }
    }
    return [...out.values()];
  }

  async function commitOps(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  /** 운영 중인 그룹의 그룹장인지 (탈퇴 차단용) */
  async function findActiveLedGroups(ids) {
    const docs = await queryByFields('groups', ['leaderUid'], ids);
    return docs.filter((d) => (d.data() || {}).status === 'approved');
  }

  const payInfoSafe = async (paymentId) => {
    try { return paymentId ? await getPortOneV2PaymentInfo(paymentId) : null; } catch (_) { return null; }
  };
  const isPaidStatus = (info) => String(info?.status || '').toUpperCase() === 'PAID';

  /**
   * 회원이 올린 Storage 파일 삭제. 반환: 지운 파일 수
   * - 지울 수 있는 곳은 회원 업로드 폴더(images/community/, images/company/)뿐이다. 사이트 콘텐츠
   *   (images/program/, images/content/)는 게시글에 주소가 들어 있어도 지우지 않는다(관리자 회원이든 아니든).
   * - 예외: 회원 문서의 프로필 사진(img)이 images/content/에 있고 그 파일을 올린 사람(ownerUid)이 본인으로
   *   확인되면 지운다(프로필 사진 자르기 업로드).
   * - 다른 회원이 올린 파일(ownerUid가 다름)은 주소가 들어 있어도 지우지 않는다.
   */
  async function purgeStorage(ids, { userDocs, extraDocs }) {
    if (!bucket) return 0;
    const isMemberPath = (p) => MEMBER_IMAGE_PREFIXES.some((pre) => p.startsWith(pre));
    const targets = new Map(); // path → 'member' | 'ownProfile'

    // 1) ownerUid 메타데이터로 찾기 (회원 업로드 폴더만)
    for (const prefix of MEMBER_IMAGE_PREFIXES) {
      const [files] = await bucket.getFiles({ prefix });
      for (const f of files) {
        const owner = f.metadata?.metadata?.ownerUid;
        if (owner && ids.includes(String(owner))) targets.set(f.name, 'member');
      }
    }
    // 2) 회원 문서·게시글·맛집에 들어 있는 Storage 주소 (ownerUid가 없는 예전 업로드)
    for (const data of [...userDocs, ...extraDocs]) {
      for (const str of collectStrings(data)) {
        const loc = storagePathFromUrl(str);
        if (loc && loc.bucket === bucket.name && isMemberPath(loc.path)) targets.set(loc.path, 'member');
      }
    }
    // 3) 프로필 사진(img)이 사이트 콘텐츠 폴더에 있는 경우: 본인이 올린 것이 확인될 때만
    for (const u of userDocs) {
      const loc = storagePathFromUrl(u?.img);
      if (loc && loc.bucket === bucket.name && loc.path.startsWith(PROFILE_EXTRA_PREFIX) && !targets.has(loc.path)) {
        targets.set(loc.path, 'ownProfile');
      }
    }

    let n = 0;
    for (const [path, kind] of targets) {
      const file = bucket.file(path);
      try {
        const [meta] = await file.getMetadata();
        const owner = meta?.metadata?.ownerUid;
        if (owner && !ids.includes(String(owner))) continue;
        if (kind === 'ownProfile' && !owner) continue; // 올린 사람이 확인되지 않은 콘텐츠 이미지는 남긴다
        await file.delete();
        n += 1;
      } catch (e) {
        if (e?.code !== 404) console.warn('[purgeUserData] storage delete', path, e?.message);
      }
    }
    return n;
  }

  /**
   * @param {{ docId: string, authUid: string, profile?: { name?: string, email?: string, phone?: string },
   *           userData?: object, reason?: 'withdrawal'|'admin_forced' }} p
   */
  async function purge({ docId, authUid, profile = {}, userData = {}, reason = 'withdrawal' }) {
    const ids = [...new Set([docId, authUid].map((v) => String(v || '').trim()).filter(Boolean))];
    if (ids.length === 0) throw new HttpsError('invalid-argument', '회원 정보를 찾을 수 없습니다.');
    const isSelf = reason === 'withdrawal';
    const nowDate = now();
    const summary = { applications: 0, retained: 0, pendingPayments: 0, groupPayments: 0, members: 0, attendance: 0, groups: 0, reports: 0, notifications: 0, storageFiles: 0 };

    // a) 운영 중 그룹의 그룹장 → 차단
    const led = await findActiveLedGroups(ids);
    if (led.length > 0) {
      const titles = led.map((d) => `「${(d.data() || {}).title || '이름 없는 그룹'}」`).join(', ');
      // 이용약관 제13조 제1항: 운영 중인 그룹의 그룹장은 회사에 그룹장 변경이나 그룹 종료를 요청한 뒤 탈퇴
      throw new HttpsError(
        'failed-precondition',
        `운영 중인 그룹 ${titles}의 그룹장이라 바로 탈퇴할 수 없어요. 멤버 보호를 위해 회사(운영진)에 그룹장 변경이나 그룹 종료를 요청해 주세요. 처리되면 탈퇴할 수 있습니다.`,
        { reason: 'active_group_leader', groupIds: led.map((d) => d.id) },
      );
    }

    const apps = await queryByFields('applications', ['userId', 'user_id'], ids);
    const seminarCache = new Map();
    const loadSeminar = async (sid) => {
      if (!sid) return null;
      if (!seminarCache.has(sid)) {
        const s = await db.collection('seminars').doc(sid).get();
        seminarCache.set(sid, s.exists ? s.data() || {} : null);
      }
      return seminarCache.get(sid);
    };
    const notStarted = async (sid) => {
      const sem = parseSeminarDate((await loadSeminar(sid))?.date);
      return !!sem && nowDate.getTime() < sem.startMs;
    };

    const won = (n) => (Number(n) > 0 ? `${Number(n).toLocaleString('ko-KR')}원` : '금액 확인 필요');
    const isCancelledStatus = (info) => /CANCEL/i.test(String(info?.status || ''));

    // b) 시작 전 유료 신청이 남아 있으면 본인 탈퇴·관리자 강제 탈퇴 모두 차단 (먼저 취소·환불)
    //    포트원에서 이미 전액 취소된 결제는 막지 않는다(보존 기록만 남기고 정리).
    const upcomingPaid = [];
    for (const d of apps) {
      const a = d.data() || {};
      const sid = seminarIdOf(a);
      if (!hasPayment(a) || !(await notStarted(sid))) continue;
      const info = await payInfoSafe(a.merchant_uid || a.merchantUid || '');
      if (isCancelledStatus(info)) continue;
      const sem = await loadSeminar(sid);
      upcomingPaid.push(`「${sem?.title || '프로그램'}」(${sem?.date || '날짜 미정'}, ${won(info?.paidTotal || a.paidAmount || sem?.applicationFee)})`);
    }
    if (upcomingPaid.length) {
      throw new HttpsError(
        'failed-precondition',
        isSelf
          ? `아직 열리지 않은 유료 프로그램 신청 ${upcomingPaid.join(', ')}이 있어요. 마이페이지에서 먼저 「신청 취소」를 하시면 취소/환불 규정에 따라 환불됩니다. 그 뒤에 탈퇴해 주세요.`
          : `이 회원에게 아직 열리지 않은 유료 프로그램 신청 ${upcomingPaid.join(', ')}이 있어 탈퇴 처리를 멈췄어요. 회원에게 마이페이지 「신청 취소」를 안내하거나, 포트원 관리자 화면에서 결제를 취소(환불)한 뒤 다시 탈퇴 처리해 주세요.`,
        { reason: 'upcoming_paid_application', items: upcomingPaid },
      );
    }

    // c) 결제는 끝났지만 신청으로 옮겨지지 않은 결제 대기 → 본인·관리자 모두 차단 (운영진이 신청 편입 또는 환불)
    const pendings = await queryByFields('pendingPayments', ['user_id', 'userId'], ids);
    const paidPendings = [];
    for (const d of pendings) {
      const info = await payInfoSafe(d.data()?.merchant_uid || d.id);
      if (isPaidStatus(info)) paidPendings.push({ d, info });
    }
    if (paidPendings.length) {
      const items = [];
      for (const { d, info } of paidPendings) {
        const p = d.data() || {};
        const sem = await loadSeminar(String(p.seminar_id || p.seminarId || ''));
        items.push(`「${sem?.title || '프로그램'}」(${sem?.date || '날짜 미정'}, ${won(info?.paidTotal)}, 결제번호 ${p.merchant_uid || d.id})`);
      }
      throw new HttpsError(
        'failed-precondition',
        isSelf
          ? '결제가 끝났지만 신청 확인이 끝나지 않은 건이 있어요. 운영진이 확인해 신청 또는 환불로 처리한 뒤 탈퇴할 수 있습니다. 회사 이메일·전화로 문의해 주세요.'
          : `이 회원에게 결제는 끝났지만 신청으로 옮겨지지 않은 건 ${items.join(', ')}이 있어 탈퇴 처리를 멈췄어요. 결제 대기 목록에서 신청으로 옮기거나 포트원에서 환불한 뒤 다시 탈퇴 처리해 주세요.`,
        { reason: 'paid_pending_payment', items },
      );
    }

    // 1) 세미나 신청
    for (const d of apps) {
      const a = d.data() || {};
      const sid = seminarIdOf(a);
      const upcoming = await notStarted(sid);
      if (hasPayment(a)) {
        const payInfo = await payInfoSafe(a.merchant_uid || a.merchantUid || '');
        const record = buildSeminarPaymentRecord({
          application: a, seminar: await loadSeminar(sid), seminarId: sid, payInfo, reason, profile,
          cancel: {
            note: upcoming ? '시작 전 신청 — 포트원에서 취소된 결제의 정리 기록' : '탈퇴 시점의 결제 신청 기록',
          },
        });
        const batch = db.batch();
        await writeRetention({ db, admin, record, writer: batch, now: nowDate });
        batch.delete(d.ref);
        await batch.commit();
        summary.retained += 1;
      } else {
        await d.ref.delete();
      }
      if (upcoming && sid) await onSeatReleased(sid);
      summary.applications += 1;
    }

    // 2) 결제 대기: 위에서 결제 완료 건은 막았으므로 남은 것은 미결제·취소 건 → 삭제
    await commitOps(pendings.map((d) => (b) => b.delete(d.ref)));
    summary.pendingPayments = pendings.length;

    // 3) 그룹 결제 장부
    const gpays = await queryByFields('groupPayments', ['uid'], ids);
    for (const d of gpays) {
      const g = d.data() || {};
      if (['paid', 'refunded'].includes(g.status)) {
        const batch = db.batch();
        await writeRetention({ db, admin, record: buildGroupPaymentRecord({ paymentId: d.id, pay: g, reason, profile }), writer: batch, now: nowDate });
        batch.update(d.ref, { uid: '', name: WITHDRAWN_LABEL, payerWithdrawn: true, payerWithdrawnAt: FieldValue.serverTimestamp() });
        await batch.commit();
        summary.retained += 1;
      } else {
        await d.ref.delete();
      }
      summary.groupPayments += 1;
    }

    // 4) 그룹: 멤버 문서·출석 기록·내가 연 그룹
    const groupsSnap = await db.collection('groups').get();
    const memberRefs = groupsSnap.docs.flatMap((g) => ids.map((id) => g.ref.collection('members').doc(id)));
    if (memberRefs.length) {
      const memberSnaps = await db.getAll(...memberRefs);
      const existing = memberSnaps.filter((s) => s.exists);
      await commitOps(existing.map((s) => (b) => b.delete(s.ref)));
      summary.members = existing.length;
    }
    // 컬렉션 그룹 색인 없이 동작하도록 그룹별 회차 목록을 읽는다 (그룹·회차 수가 많지 않음)
    const sessionDocs = (await Promise.all(groupsSnap.docs.map((g) => g.ref.collection('sessions').get()))).flatMap((x) => x.docs);
    const attRefs = sessionDocs.flatMap((s) => ids.map((id) => s.ref.collection('attendance').doc(id)));
    if (attRefs.length) {
      const attSnaps = await db.getAll(...attRefs);
      const existing = attSnaps.filter((s) => s.exists);
      await commitOps(existing.map((s) => (b) => b.delete(s.ref)));
      summary.attendance = existing.length;
    }
    for (const g of groupsSnap.docs) {
      const gd = g.data() || {};
      if (!ids.includes(String(gd.leaderUid || ''))) continue;
      const hasPayments = !(await db.collection('groupPayments').where('groupId', '==', g.id).limit(1).get()).empty;
      if (['pending', 'rejected'].includes(gd.status) && !hasPayments) {
        await db.recursiveDelete(g.ref);
      } else {
        // 종료된 그룹: 기록은 남기되 그룹장 이름·uid는 지운다 (결제 장부의 leaderUid는 정산 확인용으로 남음)
        await g.ref.update({ leaderName: WITHDRAWN_LABEL, leaderUid: '', leaderWithdrawn: true, updatedAt: FieldValue.serverTimestamp() });
      }
      summary.groups += 1;
    }

    // 5) 신고
    const filed = await queryByFields('reports', ['reporterUid'], ids);
    const targeted = (await queryByFields('reports', ['targetId'], ids)).filter((d) => (d.data() || {}).targetType === 'member');
    for (const [docs, role] of [[filed, 'reporter'], [targeted, 'target']]) {
      for (const d of docs) {
        const r = d.data() || {};
        const batch = db.batch();
        await writeRetention({ db, admin, record: buildReportRecord({ reportId: d.id, report: r, reason, role, profile }), writer: batch, now: nowDate });
        batch.update(d.ref, role === 'reporter'
          ? { reporterUid: '', reporterName: WITHDRAWN_LABEL, reporterWithdrawn: true }
          : { targetId: '', targetTitle: WITHDRAWN_LABEL, targetWithdrawn: true });
        await batch.commit();
        summary.reports += 1;
        summary.retained += 1;
      }
    }

    // 6) 알림
    for (const id of ids) {
      const ns = await db.collection('users').doc(id).collection('notifications').get();
      await commitOps(ns.docs.map((n) => (b) => b.delete(n.ref)));
      summary.notifications += ns.size;
    }

    // 7) Storage 이미지 (회원 문서·게시글·맛집에 든 주소 + ownerUid 메타데이터)
    try {
      const userDocs = (await db.getAll(...ids.map((id) => db.collection('users').doc(id)))).filter((s) => s.exists).map((s) => s.data());
      const posts = await queryByFields('posts', ['authorId'], ids);
      const restaurants = await queryByFields('restaurants', ['ownerId'], ids);
      summary.storageFiles = await purgeStorage(ids, {
        userDocs: [userData, ...userDocs],
        extraDocs: [...posts, ...restaurants].map((d) => d.data()),
      });
    } catch (e) {
      console.error('[purgeUserData] storage purge failed', e?.message);
    }

    return summary;
  }

  return { purge, findActiveLedGroups, purgeStorage };
}
