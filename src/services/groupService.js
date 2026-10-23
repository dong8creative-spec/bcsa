/**
 * 소모임·스터디(그룹) 데이터 서비스
 * - 읽기·그룹장 설정 변경은 Firestore 직접 (firestore.rules가 권한 확인)
 * - 개설 신청·가입·QR 출석·결제 확인은 Cloud Functions callable (functions/groups.js)
 */
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc,
  setDoc, serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db, auth } from '../firebase';
import { PORTONE_IMP_CODE, PORTONE_CHANNEL_KEY } from '../constants';
import { useRedirectPayment } from '../utils/paymentEnv';

export const GROUP_TYPE_LABEL = { meetup: '소모임', study: '스터디' };
export const GROUP_MODE_LABEL = { offline: '오프라인', online: '온라인', hybrid: '온·오프라인' };
export const JOIN_POLICY_LABEL = { open: '바로 가입', approval: '그룹장 승인 후 가입' };
export const GROUP_STATUS_LABEL = { pending: '승인 대기', approved: '운영 중', rejected: '반려', closed: '종료' };
/** 그룹 커버 이미지 (public/assets/images/groups, Codex 생성 원본은 1584×990 → 1200×750 JPG) */
export const GROUP_COVERS = [
  ['study', '스터디 테이블'], ['meetup', '저녁 모임'], ['networking', '네트워킹'],
  ['workshop', '워크숍'], ['online', '온라인'], ['busan', '부산 동네'],
];
export const groupCoverUrl = (group) => {
  const key = GROUP_COVERS.some(([k]) => k === group?.cover) ? group.cover : (group?.type === 'study' ? 'study' : 'meetup');
  return `/assets/images/groups/cover-${key}.jpg`;
};

const call = async (name, data) => {
  const fn = httpsCallable(getFunctions(app, 'asia-northeast3'), name);
  try {
    const res = await fn(data);
    return res.data;
  } catch (e) {
    // callable 오류 메시지(서버의 HttpsError 문구)를 그대로 화면에 보여준다
    throw new Error(e?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
};

const withId = (d) => ({ id: d.id, ...d.data() });
const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (v ? new Date(v).getTime() : 0)));

export const groupService = {
  // ── 그룹 ──
  subscribeApprovedGroups(callback) {
    const q = query(collection(db, 'groups'), where('status', '==', 'approved'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)));
    }, (e) => { console.error('groups subscribe', e); callback([]); });
  },
  /** 내가 그룹장인 그룹(승인 대기 포함) */
  async getMyLedGroups(uid) {
    if (!uid) return [];
    const snap = await getDocs(query(collection(db, 'groups'), where('leaderUid', '==', uid)));
    return snap.docs.map(withId);
  },
  /** 관리자: 전체 그룹 (승인 대기 우선) */
  subscribeAllGroupsAdmin(callback) {
    return onSnapshot(collection(db, 'groups'), (snap) => {
      const order = { pending: 0, approved: 1, rejected: 2, closed: 3 };
      callback(snap.docs.map(withId).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || toMs(b.createdAt) - toMs(a.createdAt)));
    }, (e) => { console.error('groups admin subscribe', e); callback([]); });
  },
  subscribeGroup(groupId, callback) {
    return onSnapshot(doc(db, 'groups', groupId), (d) => callback(d.exists() ? withId(d) : null), () => callback(null));
  },
  createGroupRequest: (data) => call('createGroupRequest', data),
  updateGroupSettings(groupId, data) {
    return updateDoc(doc(db, 'groups', groupId), { ...data, updatedAt: serverTimestamp() });
  },
  setGroupStatusAdmin(groupId, status, extra = {}) {
    return updateDoc(doc(db, 'groups', groupId), {
      status, ...extra, updatedAt: serverTimestamp(),
      ...(status === 'approved' ? { approvedAt: serverTimestamp(), approvedBy: auth.currentUser?.uid || '' } : {}),
    });
  },

  // ── 멤버 ──
  subscribeMembers(groupId, callback) {
    return onSnapshot(collection(db, 'groups', groupId, 'members'), (snap) => callback(snap.docs.map(withId)), () => callback([]));
  },
  joinGroup: (groupId) => call('joinGroup', { groupId }),
  setMemberStatus(groupId, uid, status) {
    return updateDoc(doc(db, 'groups', groupId, 'members', uid), { status });
  },

  // ── 회차 ──
  subscribeSessions(groupId, callback) {
    const q = query(collection(db, 'groups', groupId, 'sessions'), orderBy('startsAt', 'asc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(withId)), (e) => { console.error('sessions', e); callback([]); });
  },
  addSession(groupId, data) {
    return addDoc(collection(db, 'groups', groupId, 'sessions'), { ...data, attendanceOpen: true, createdAt: serverTimestamp() });
  },
  updateSession(groupId, sessionId, data) {
    return updateDoc(doc(db, 'groups', groupId, 'sessions', sessionId), data);
  },
  deleteSession(groupId, sessionId) {
    return deleteDoc(doc(db, 'groups', groupId, 'sessions', sessionId));
  },

  // ── 출석 ──
  subscribeAttendance(groupId, sessionId, callback) {
    return onSnapshot(collection(db, 'groups', groupId, 'sessions', sessionId, 'attendance'), (snap) => callback(snap.docs.map(withId)), () => callback([]));
  },
  async getMyAttendance(groupId, sessionId, uid) {
    const d = await getDoc(doc(db, 'groups', groupId, 'sessions', sessionId, 'attendance', uid));
    return d.exists() ? withId(d) : null;
  },
  markManualAttendance(groupId, sessionId, member, { cashPaid = false } = {}) {
    return setDoc(doc(db, 'groups', groupId, 'sessions', sessionId, 'attendance', member.uid), {
      uid: member.uid, name: member.name || '', method: 'manual', checkedAt: serverTimestamp(), cashPaid,
    });
  },
  setCashPaid(groupId, sessionId, uid, cashPaid) {
    return updateDoc(doc(db, 'groups', groupId, 'sessions', sessionId, 'attendance', uid), { cashPaid });
  },
  removeAttendance(groupId, sessionId, uid) {
    return deleteDoc(doc(db, 'groups', groupId, 'sessions', sessionId, 'attendance', uid));
  },

  // ── QR 출석·결제 ──
  getSessionQrToken: (groupId, sessionId) => call('getSessionQrToken', { groupId, sessionId }),
  issueCheckInPass: (groupId, sessionId, token) => call('issueCheckInPass', { groupId, sessionId, token }),
  checkInSession: (pass) => call('checkInSession', { pass }),
  completeGroupPayment: (paymentId) => call('completeGroupPayment', { paymentId }),
  refundGroupPayment: (paymentId, reason) => call('refundGroupPayment', { paymentId, reason }),

  // ── 신고 ──
  createReport({ targetType, targetId, targetTitle, reason, reporter }) {
    return addDoc(collection(db, 'reports'), {
      targetType, targetId, targetTitle: String(targetTitle || '').slice(0, 100), reason: String(reason || '').slice(0, 1000),
      reporterUid: reporter.uid, reporterName: reporter.name || '', status: 'open', createdAt: serverTimestamp(),
    });
  },
  subscribeOpenReports(callback) {
    return onSnapshot(query(collection(db, 'reports'), where('status', '==', 'open')), (snap) => callback(snap.docs.map(withId)), () => callback([]));
  },
  resolveReport(reportId) {
    return updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
  },
  /** 그룹장: 내 그룹 결제 내역(정산 장부) */
  async getGroupPayments(groupId, leaderUid) {
    const snap = await getDocs(query(collection(db, 'groupPayments'), where('leaderUid', '==', leaderUid), where('groupId', '==', groupId)));
    return snap.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  },

  /**
   * 포트원 결제창 호출. 모바일은 /groups/pay-result로 이동했다가 돌아오고,
   * PC는 결제 후 바로 completeGroupPayment로 확인한다.
   * @returns {Promise<{ ok: boolean, redirected?: boolean, error?: string }>}
   */
  async requestSessionPayment({ paymentId, amount, orderName, customer }) {
    if (typeof window === 'undefined' || !window.PortOne) return { ok: false, error: '결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.' };
    if (!PORTONE_IMP_CODE || !PORTONE_CHANNEL_KEY) return { ok: false, error: '결제 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요.' };
    const request = {
      storeId: PORTONE_IMP_CODE,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: orderName || '그룹 참가비',
      totalAmount: amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      customer: {
        fullName: customer?.fullName || '구매자',
        ...(customer?.phoneNumber ? { phoneNumber: customer.phoneNumber } : {}),
        ...(customer?.email ? { email: customer.email } : {}),
      },
    };
    if (useRedirectPayment()) {
      request.redirectUrl = `${window.location.origin}/groups/pay-result`;
      request.forceRedirect = true;
      await window.PortOne.requestPayment(request);
      return { ok: true, redirected: true };
    }
    const res = await window.PortOne.requestPayment(request);
    if (res?.code != null) return { ok: false, error: res.message || '결제가 취소되었습니다.' };
    // 포트원 반영 지연 대비 짧게 재확인
    for (let i = 0; i < 4; i++) {
      const r = await groupService.completeGroupPayment(paymentId);
      if (r?.ok) return { ok: true };
      if (r?.error && !['not_paid', 'verify_error'].includes(r.error)) return { ok: false, error: r.error };
      await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
    }
    return { ok: false, error: 'pending' };
  },
};

export default groupService;
