/**
 * 선배 커피챗 데이터 서비스 (2026-11-20)
 * - 선배 프로필·노하우 글·좋아요·저장은 Firestore 직접(firestore.rules가 권한 확인)
 * - 신청·결제 확인·수락/거절·취소·완료·후기는 Cloud Functions(functions/coffeechat.js)
 * 서버 규칙(가격 범위·수수료·환불)은 functions/coffeechat.js 와 같은 값을 쓴다.
 */
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, writeBatch, increment,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase';
import { PORTONE_IMP_CODE, PORTONE_CHANNEL_KEY } from '../constants';
import { useRedirectPayment } from '../utils/paymentEnv';

export const CC_TYPES = {
  online30: { label: '30분 비대면 커피챗', short: '30분 비대면', desc: '카카오톡 오픈채팅 · 보이스톡/화상', min: 20000, max: 50000, recommended: 30000 },
  visit60: { label: '60분 매장 방문 상담', short: '60분 매장 방문', desc: '선배 매장에서 1:1 현장 대면', min: 50000, max: 100000, recommended: 60000 },
};
export const CC_UNLOCKED_MAX = 100000;
export const CC_PRICE_STEP = 5000;
export const CC_FEE_RATE = 0.1;
export const CC_TOPICS = ['마케팅·브랜딩', 'AI·업무효율화', '재무·세무', '위기극복'];
export const CC_INDUSTRIES = ['카페', '음식점', '뷰티', '소매', '서비스', '기타'];
export const CC_REVIEW_TAGS = ['실전 경험 풍부', '현실적인 피드백', '질문에 꼼꼼한 답변', '친절하고 편안함', '상권 인사이트'];
export const CC_STAGES = ['창업 준비 중(예비)', '창업 1년 미만', '창업 1~3년'];
export const CC_STATUS = {
  pending_payment: { label: '결제 대기', tone: 'muted' },
  requested: { label: '선배 수락 대기 중', tone: 'royal' },
  confirmed: { label: '커피챗 확정', tone: 'ink' },
  completed: { label: '진행 완료', tone: 'muted' },
  declined: { label: '정중히 거절됨', tone: 'alert' },
  expired: { label: '응답 없음 · 자동 환불', tone: 'alert' },
  cancelled: { label: '취소됨', tone: 'alert' },
  payment_failed: { label: '결제 실패', tone: 'alert' },
  refunding: { label: '환불 처리 중', tone: 'muted' },
  abandoned: { label: '결제 안 함', tone: 'muted' },
};
/** 「진행 중」 묶음 / 「완료·종료」 묶음 (화면 탭) */
export const CC_OPEN = ['requested', 'confirmed'];
export const CC_DONE = ['completed', 'declined', 'expired', 'cancelled', 'payment_failed'];
/** 정산 대상: 결제가 살아 있는 건(확정·완료) */
export const CC_SETTLE = ['confirmed', 'completed'];

const PAY_RETURN_KEY = 'bcsa_cc_last_payment';
const withId = (d) => ({ id: d.id, ...d.data() });
export const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (v ? new Date(v).getTime() : 0)));
export const won = (n) => `${(Number(n) || 0).toLocaleString('ko-KR')}원`;
export const feeOf = (price) => Math.round((Number(price) || 0) * CC_FEE_RATE);
export const payoutOf = (price) => (Number(price) || 0) - feeOf(price);
export const ratingOf = (s) => (Number(s?.ratingCount) > 0 ? Math.round((Number(s.ratingSum) / Number(s.ratingCount)) * 10) / 10 : null);
/** 평균 평점 4.5 이상인지: 화면 표시는 반올림하지만 판단은 서버·규칙과 같이 반올림 전 값(합계 ≥ 4.5×개수)으로 */
export const ratingAtLeast = (s, min) => Number(s?.ratingCount) > 0 && Number(s?.ratingSum) >= min * Number(s.ratingCount);
export const priceMax = (type, senior) => {
  const base = CC_TYPES[type]?.max || 0;
  return (Number(senior?.completedCount) || 0) >= 10 && ratingAtLeast(senior, 4.5) ? Math.max(base, CC_UNLOCKED_MAX) : base;
};
/** 「2027년 10월 24일(목) 19:30」 */
export const slotLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const w = '일월화수목금토'[d.getDay()];
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${w}) ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 활동 뱃지 4개 (마이페이지·선배 프로필). 값은 서버가 쓰는 통계에서 계산한다.
 * 창립 멤버: 2026년 안에 승인된 선배(파일럿 1기)
 */
export function seniorBadges(s) {
  const done = Number(s?.completedCount) || 0;
  const rc = Number(s?.ratingCount) || 0;
  const r = ratingOf(s);
  const approvedMs = toMs(s?.approvedAt);
  return [
    { key: 'founding', label: '창립 멤버', desc: '먼저가본 초기부터 함께한 1기 선배', earned: !!approvedMs && approvedMs < Date.UTC(2027, 0, 1) },
    { key: 'first', label: '첫 커피챗', desc: '후배와 첫 1:1 대화를 마침', earned: done >= 1 },
    { key: 'ten', label: '커피챗 10회', desc: '후배 10명에게 실전 노하우 전수', earned: done >= 10, progress: Math.min(done, 10), goal: 10 },
    { key: 'rating', label: '평점 4.5 이상', desc: '후기 5개 이상, 평점 4.5 유지', earned: rc >= 5 && ratingAtLeast(s, 4.5), progress: Math.min(rc, 5), goal: 5, rating: r },
  ];
}

const call = async (name, data) => {
  const fn = httpsCallable(getFunctions(app, 'asia-northeast3'), name);
  try {
    return (await fn(data)).data;
  } catch (e) {
    throw new Error(e?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
};

export const coffeeChatService = {
  // ── 선배 프로필 ──
  subscribeApprovedSeniors(cb) {
    return onSnapshot(query(collection(db, 'seniors'), where('status', '==', 'approved')), (s) => cb(s.docs.map(withId)), () => cb([]));
  },
  subscribeSenior(uid, cb) {
    return onSnapshot(doc(db, 'seniors', uid), (d) => cb(d.exists() ? withId(d) : null), () => cb(null));
  },
  async getMyContact(uid) {
    const d = await getDoc(doc(db, 'seniors', uid, 'private', 'contact'));
    return d.exists() ? d.data() : {};
  },
  /** 선배 등록·수정. contact.openChatUrl 은 본인·운영진만 읽는 곳에 따로 저장 */
  async saveSenior(uid, data, { isNew, contact } = {}) {
    const body = {
      name: String(data.name || '').trim().slice(0, 40),
      bizName: String(data.bizName || '').trim().slice(0, 60),
      industry: data.industry,
      area: String(data.area || '').trim().slice(0, 40),
      years: Math.floor(Number(data.years) || 0),
      topics: (data.topics || []).slice(0, 4),
      intro: String(data.intro || '').trim().slice(0, 300),
      photoUrl: String(data.photoUrl || '').slice(0, 1000),
      prices: { online30: Math.floor(Number(data.prices?.online30) || 0), visit60: Math.floor(Number(data.prices?.visit60) || 0) },
      accepting: data.accepting !== false,
      updatedAt: serverTimestamp(),
    };
    if (isNew) await setDoc(doc(db, 'seniors', uid), { ...body, uid, status: 'pending', createdAt: serverTimestamp() });
    else await updateDoc(doc(db, 'seniors', uid), data.resubmit ? { ...body, status: 'pending' } : body);
    if (contact) await setDoc(doc(db, 'seniors', uid, 'private', 'contact'), { openChatUrl: String(contact.openChatUrl || '').trim().slice(0, 300), updatedAt: serverTimestamp() }, { merge: true });
  },
  updateSeniorFields(uid, patch) {
    return updateDoc(doc(db, 'seniors', uid), { ...patch, updatedAt: serverTimestamp() });
  },
  subscribeReviews(uid, cb) {
    return onSnapshot(collection(db, 'seniors', uid, 'reviews'), (s) => cb(s.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },

  // ── 노하우 글(지식피드) ──
  subscribePublishedPosts(cb) {
    return onSnapshot(query(collection(db, 'seniorPosts'), where('status', '==', 'published')), (s) => cb(s.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },
  subscribeMyPosts(uid, cb) {
    return onSnapshot(query(collection(db, 'seniorPosts'), where('authorUid', '==', uid)), (s) => cb(s.docs.map(withId).sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt))), () => cb([]));
  },
  subscribePost(id, cb) {
    return onSnapshot(doc(db, 'seniorPosts', id), (d) => cb(d.exists() ? withId(d) : null), () => cb(null));
  },
  /** 글 저장: author 는 선배 프로필에서 복사(목록 카드용) */
  async savePost(id, data, senior) {
    const body = {
      topic: data.topic,
      title: String(data.title || '').trim().slice(0, 50),
      problem: String(data.problem || '').trim().slice(0, 1500),
      solution: String(data.solution || '').trim().slice(0, 1500),
      result: String(data.result || '').trim().slice(0, 1500),
      imageUrl: String(data.imageUrl || '').slice(0, 1000),
      status: data.status === 'draft' ? 'draft' : 'published',
      author: { name: senior.name, bizName: senior.bizName, area: senior.area, industry: senior.industry, years: senior.years, photoUrl: senior.photoUrl || '' },
      authorPrice: Number(senior.prices?.online30) || 0,
      updatedAt: serverTimestamp(),
    };
    if (id) { await updateDoc(doc(db, 'seniorPosts', id), body); return id; }
    const ref = await addDoc(collection(db, 'seniorPosts'), { ...body, authorUid: senior.uid, likeCount: 0, viewCount: 0, createdAt: serverTimestamp() });
    return ref.id;
  },
  deletePost(id) { return deleteDoc(doc(db, 'seniorPosts', id)); },
  addView(id) { return updateDoc(doc(db, 'seniorPosts', id), { viewCount: increment(1) }).catch(() => {}); },
  async isLiked(postId, uid) { return (await getDoc(doc(db, 'seniorPosts', postId, 'likes', uid))).exists(); },
  async setLike(postId, uid, on) {
    const b = writeBatch(db);
    const likeRef = doc(db, 'seniorPosts', postId, 'likes', uid);
    if (on) b.set(likeRef, { createdAt: serverTimestamp() }); else b.delete(likeRef);
    b.update(doc(db, 'seniorPosts', postId), { likeCount: increment(on ? 1 : -1) });
    await b.commit();
  },
  async isSaved(postId, uid) { return (await getDoc(doc(db, 'postSaves', `${uid}_${postId}`))).exists(); },
  async setSaved(postId, uid, on) {
    const ref = doc(db, 'postSaves', `${uid}_${postId}`);
    if (on) await setDoc(ref, { uid, postId, createdAt: serverTimestamp() }); else await deleteDoc(ref);
  },
  async getSavedPostIds(uid) {
    const s = await getDocs(query(collection(db, 'postSaves'), where('uid', '==', uid)));
    return s.docs.map((d) => d.data().postId);
  },

  // ── 커피챗 신청 ──
  subscribeMyRequests(uid, cb) {
    return onSnapshot(query(collection(db, 'coffeeChats'), where('juniorUid', '==', uid)), (s) => cb(s.docs.map(withId).filter((c) => !['pending_payment', 'abandoned'].includes(c.status) && !(c.status === 'payment_failed' && c.failReason === 'duplicate')).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },
  subscribeReceived(uid, cb) {
    return onSnapshot(query(collection(db, 'coffeeChats'), where('seniorUid', '==', uid)), (s) => cb(s.docs.map(withId).filter((c) => !['pending_payment', 'abandoned', 'payment_failed'].includes(c.status)).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },
  subscribeAllChatsAdmin(cb) {
    return onSnapshot(collection(db, 'coffeeChats'), (s) => cb(s.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },
  subscribeAllSeniorsAdmin(cb) {
    return onSnapshot(collection(db, 'seniors'), (s) => cb(s.docs.map(withId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))), () => cb([]));
  },
  setSeniorStatusAdmin(uid, status, reason = '') {
    return updateDoc(doc(db, 'seniors', uid), { status, rejectReason: String(reason).slice(0, 200), ...(status === 'approved' ? { approvedAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
  },
  setSettledAdmin(chatId, settled) {
    return updateDoc(doc(db, 'coffeeChats', chatId), { settled, settledAt: settled ? serverTimestamp() : null });
  },
  request: (data) => call('requestCoffeeChat', data),
  completePayment: (chatId) => call('completeCoffeeChatPayment', { chatId }),
  respond: (chatId, action, { slotIndex, reason } = {}) => call('respondCoffeeChat', { chatId, action, slotIndex, reason }),
  cancel: (chatId, reason) => call('cancelCoffeeChat', { chatId, reason }),
  complete: (chatId) => call('completeCoffeeChat', { chatId }),
  review: (chatId, { rating, text, tags }) => call('reviewCoffeeChat', { chatId, rating, text, tags }),
  runSweepAdmin: () => call('runCoffeeChatSweep', {}),

  /**
   * 포트원 결제창. 모바일은 같은 화면 주소에 ?ccpay=1 로 돌아오고(CoffeeChatProvider 가 이어서 확인),
   * PC는 결제 직후 completePayment 로 확인한다.
   */
  async pay({ chatId, amount, orderName, customer }) {
    if (typeof window === 'undefined' || !window.PortOne) return { ok: false, error: '결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.' };
    if (!PORTONE_IMP_CODE || !PORTONE_CHANNEL_KEY) return { ok: false, error: '결제 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요.' };
    const req = {
      storeId: PORTONE_IMP_CODE, channelKey: PORTONE_CHANNEL_KEY, paymentId: chatId,
      orderName: orderName || '선배 커피챗', totalAmount: amount, currency: 'CURRENCY_KRW', payMethod: 'CARD',
      customer: { fullName: customer?.fullName || '구매자', ...(customer?.phoneNumber ? { phoneNumber: customer.phoneNumber } : {}), ...(customer?.email ? { email: customer.email } : {}) },
    };
    if (useRedirectPayment()) {
      try { sessionStorage.setItem(PAY_RETURN_KEY, chatId); } catch (_) { /* 저장 안 돼도 주소의 paymentId 로 이어진다 */ }
      req.redirectUrl = `${window.location.origin}${window.location.pathname}?ccpay=1`;
      req.forceRedirect = true;
      await window.PortOne.requestPayment(req);
      return { ok: true, redirected: true };
    }
    const res = await window.PortOne.requestPayment(req);
    if (res?.code != null) return { ok: false, error: res.message || '결제가 취소되었습니다.' };
    return coffeeChatService.confirmPaid(chatId);
  },
  /** 결제 확인(포트원 반영 지연 대비 몇 번 재시도) */
  async confirmPaid(chatId) {
    for (let i = 0; i < 5; i++) {
      try {
        const r = await coffeeChatService.completePayment(chatId);
        if (r?.ok) return { ok: true };
        if (r?.error && !['not_paid', 'verify_error'].includes(r.error)) {
          const msg = {
            amount_mismatch: '결제 금액이 달라 자동 취소(환불)되었어요.',
            duplicate: '이미 답을 기다리는 같은 선배 신청(또는 3건)이 있어 이번 결제는 자동 환불되었어요.',
            late_refunded: '결제가 늦어 신청이 이미 정리되어, 결제는 자동 환불되었어요. 다시 신청해 주세요.',
          }[r.error] || '결제를 확인하지 못했어요. 「내 커피챗」에서 다시 확인해 주세요.';
          return { ok: false, error: msg };
        }
      } catch (e) { if (i === 4) return { ok: false, error: e.message }; }
      await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
    }
    return { ok: false, error: '결제 확인이 늦어지고 있어요. 잠시 뒤 「내 커피챗」에서 확인해 주세요.' };
  },
};

export default coffeeChatService;
