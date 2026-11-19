/**
 * 선배 커피챗 서버 로직 (2026-11-20, 운영자가 보낸 웹앱 화면 18장 기준)
 *
 * 데이터 (Firestore)
 * - seniors/{uid}: 선배 프로필(공개). 본인이 쓰고, status(pending|approved|rejected)·통계는 운영진/서버만
 *     통계: completedCount(완료 커피챗) · ratingSum/ratingCount(평점) · connectedCount(연결된 후배 수)
 * - seniors/{uid}/private/contact: 카카오 오픈채팅 주소 — 본인·운영진만 읽음. 확정된 신청에만 서버가 복사해 준다
 * - seniors/{uid}/reviews/{chatId}: 공개 후기(서버만 씀)
 * - coffeeChats/{chatId}: 신청(서버만 씀, 후배·선배·운영진만 읽음). chatId = 포트원 paymentId(cc_…)
 *
 * 흐름 (결제는 신청할 때 미리 받아 둔다 — 화면의 「예치 결제액」·「거절 시 100% 자동 환불」)
 *   pending_payment → (결제 확인) requested → 선배가 24시간 안에 일정 1개 골라 수락: confirmed / 거절: declined(전액 환불)
 *   24시간 무응답: expired(전액 환불) · 후배 취소: 확정 전 언제나, 확정 후엔 약속 24시간 전까지 전액 환불
 *   희망 일정은 48시간 뒤부터 → 선배가 24시간 안에 답해도 확정 일정은 늘 24시간 이상 남아 후배가 취소할 기회가 있다
 * 동시 처리 안전: 상태를 바꾸는 모든 동작은 트랜잭션으로 「지금 상태」를 확인하고 바꾼다. 환불은 먼저 refunding 으로 선점한 뒤 포트원 환불.
 *   약속 시간이 지나면 선배가 「진행 완료」(또는 2시간 뒤 자동) → completed → 후배 후기·평점
 * 수수료 10%: fee = 가격의 10%, payout = 가격 − fee. 정산(매월 10일)은 운영진이 관리자 화면에서 settled 표시.
 */
import crypto from 'crypto';
import { HttpsError } from 'firebase-functions/v2/https';

export const CC_TYPES = {
  online30: { label: '30분 비대면 커피챗', min: 20000, max: 50000 },
  visit60: { label: '60분 매장 방문 상담', min: 50000, max: 100000 },
};
export const CC_UNLOCKED_MAX = 100000; // 커피챗 10회 + 평점 4.5 이상이면 30분 상한도 10만 원
export const CC_PRICE_STEP = 5000;
export const CC_FEE_RATE = 0.1;
const RESPOND_MS = 24 * 60 * 60 * 1000;
const MIN_SLOT_AHEAD_MS = 48 * 60 * 60 * 1000; // 신청 일정 하한(응답 24시간 + 취소 가능 24시간)
const MIN_ACCEPT_AHEAD_MS = 24 * 60 * 60 * 1000; // 수락 가능한 일정 하한
const CANCEL_LIMIT_MS = 24 * 60 * 60 * 1000;
const AUTO_COMPLETE_MS = 2 * 60 * 60 * 1000;
const PENDING_PAYMENT_TTL_MS = 60 * 60 * 1000;
const MAX_OPEN_REQUESTS = 3;
const REVIEW_TAGS = ['실전 경험 풍부', '현실적인 피드백', '질문에 꼼꼼한 답변', '친절하고 편안함', '상권 인사이트'];
const OPEN_STATUSES = ['pending_payment', 'requested', 'confirmed'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const maskName = (n) => {
  const s = String(n || '').trim();
  if (s.length <= 1) return s || '후배';
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${'*'.repeat(s.length - 2)}${s[s.length - 1]}`;
};

export function seniorPriceMax(type, senior) {
  const base = CC_TYPES[type]?.max || 0;
  const cnt = Number(senior?.ratingCount) || 0;
  const unlocked = (Number(senior?.completedCount) || 0) >= 10 && cnt > 0 && (Number(senior?.ratingSum) || 0) / cnt >= 4.5;
  return unlocked ? Math.max(base, CC_UNLOCKED_MAX) : base;
}

export function createCoffeeChatHandlers({ db, admin, verifyPortOnePayment, cancelPortOnePayment, isCallerAdmin, notify }) {
  /**
   * 알림 메일(서버 메일 설정이 있을 때만). 실패해도 커피챗 처리는 막지 않는다.
   * 선배가 사이트에 들어오지 않으면 24시간 뒤 자동 취소되므로, 새 신청은 꼭 알린다.
   */
  async function mailTo(uid, subject, lines) {
    if (!notify) return;
    try {
      const u = (await db.collection('users').doc(String(uid)).get()).data() || {};
      const to = String(u.email || '').trim();
      if (!to || !/@/.test(to)) return;
      const text = `${lines.join('\n')}\n\n▶ 확인하기: https://bcsa.co.kr/my (마이페이지 → 선배 커피챗 → 내 커피챗)\n\n먼저가본`;
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#0c0c0b">${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}<p style="margin:16px 0"><a href="https://bcsa.co.kr/my" style="display:inline-block;background:#0c0c0e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">내 커피챗 확인하기</a></p><p style="color:#5b5a56">먼저가본</p></div>`;
      await notify({ to, subject: `[먼저가본] ${subject}`, text, html });
    } catch (e) {
      console.warn('[CoffeeChat] mail fail', e.message);
    }
  }
  const slotText = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const FV = admin.firestore.FieldValue;
  const chatRef = (id) => db.collection('coffeeChats').doc(String(id));
  const seniorRef = (uid) => db.collection('seniors').doc(String(uid));
  const requireAuth = (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    return request.auth.uid;
  };
  const callerIsAdmin = (request) => isCallerAdmin({ uid: request.auth.uid, admin: request.auth.token?.admin });

  async function loadChat(id) {
    const snap = await chatRef(id).get();
    if (!snap.exists) throw new HttpsError('not-found', '신청 정보를 찾을 수 없습니다.');
    return snap.data();
  }

  /**
   * 상태를 바꾸며 전액 환불. fromStatuses 중 하나일 때만 진행(동시에 수락·취소·만료가 겹쳐도 한쪽만 이긴다).
   * 1) 트랜잭션으로 refunding 선점 → 2) 포트원 환불 → 3) 최종 상태. 환불 실패면 원래 상태로 되돌리고 오류.
   * 확정 뒤 취소면 오픈채팅 주소도 지운다(환불받고 선배와 직접 연락하는 것 방지).
   */
  async function refundAndSet(id, fromStatuses, status, extra = {}) {
    const ref = chatRef(id);
    let before = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', '신청 정보를 찾을 수 없습니다.');
      const c = snap.data();
      if (!fromStatuses.includes(c.status)) throw new HttpsError('failed-precondition', '이미 처리된 신청입니다. 화면을 새로 고쳐 주세요.');
      before = c;
      tx.set(ref, { status: 'refunding', prevStatus: c.status, updatedAt: FV.serverTimestamp() }, { merge: true });
    });
    const { refundReason, ...rest } = extra;
    const fields = { ...rest, status, updatedAt: FV.serverTimestamp(), openChatUrl: FV.delete() };
    if (before.paid === true && before.refunded !== true) {
      const amount = Number(before.amount) || 0;
      let r;
      try {
        r = await cancelPortOnePayment({ paymentId: id, reason: refundReason || '커피챗 취소 환불', paidAmount: amount, refundAmount: amount, cancellableAmount: amount });
      } catch (e) {
        r = { ok: false, message: e.message };
      }
      if (!r.ok) {
        await ref.set({ status: before.status, refundError: String(r.message || 'refund_failed').slice(0, 200), updatedAt: FV.serverTimestamp() }, { merge: true });
        throw new HttpsError('internal', '환불을 처리하지 못해 취소되지 않았습니다. 잠시 후 다시 시도해 주세요. 계속되면 운영진에게 알려 주세요.');
      }
      Object.assign(fields, { refunded: true, refundedAt: FV.serverTimestamp(), refundAmount: amount });
    }
    await ref.set(fields, { merge: true });
    const msg = {
      declined: ['커피챗이 거절됐어요 (전액 환불)', `${before.seniorName} 선배가 이번 신청을 수락하지 못했어요.${rest.declineReason ? ` 사유: ${rest.declineReason}` : ''}`],
      expired: ['선배가 답하지 않아 커피챗이 취소됐어요 (전액 환불)', `${before.seniorName} 선배가 24시간 안에 답하지 않아 자동 취소됐어요.`],
    }[status] || (status === 'cancelled' && rest.cancelledBy === 'senior' ? ['선배 사정으로 커피챗이 취소됐어요 (전액 환불)', `${before.seniorName} 선배가 약속을 취소했어요.${rest.cancelReason ? ` 사유: ${rest.cancelReason}` : ''}`] : null);
    if (msg && before.paid) {
      await mailTo(before.juniorUid, msg[0], [`${before.juniorName}님,`, msg[1], `결제하신 ${Number(before.amount).toLocaleString('ko-KR')}원은 전액 환불돼요(카드사에 따라 3~5일 걸릴 수 있어요). 다른 선배에게도 신청해 보세요.`]);
    }
    if (status === 'cancelled' && rest.cancelledBy === 'junior' && before.status === 'confirmed') {
      await mailTo(before.seniorUid, '후배가 커피챗을 취소했어요', [`${before.seniorName} 선배님, ${before.juniorName}님이 ${slotText(before.chosenSlot)} 커피챗을 취소했어요(약속 24시간 전 취소라 전액 환불).`]);
    }
  }
  /** 포트원 조회: 결제 건이 없으면(404) 미결제로 본다 */
  async function verify(id, amount) {
    try {
      return await verifyPortOnePayment({ paymentId: id, expectedAmount: amount });
    } catch (e) {
      if (e.response?.status === 404) return { verified: false, reason: 'not_paid' };
      throw e;
    }
  }

  // ── 1. 신청(결제 건 만들기) ──
  async function requestCoffeeChat(request) {
    const uid = requireAuth(request);
    const d = request.data || {};
    const seniorUid = str(d.seniorUid, 128);
    const type = str(d.type, 20);
    if (!CC_TYPES[type]) throw new HttpsError('invalid-argument', '진행 방식을 골라 주세요.');
    if (seniorUid === uid) throw new HttpsError('failed-precondition', '나에게는 신청할 수 없어요.');
    const sSnap = await seniorRef(seniorUid).get();
    const senior = sSnap.exists ? sSnap.data() : null;
    if (!senior || senior.status !== 'approved') throw new HttpsError('failed-precondition', '지금 신청할 수 없는 선배입니다.');
    if (senior.accepting === false) throw new HttpsError('failed-precondition', '선배가 지금은 신청을 받지 않고 있어요.');
    const price = Math.floor(Number(senior.prices?.[type]) || 0);
    if (!(price >= CC_TYPES[type].min && price <= seniorPriceMax(type, senior) && price % CC_PRICE_STEP === 0)) {
      throw new HttpsError('failed-precondition', '선배의 가격 설정이 올바르지 않아 신청할 수 없어요. 운영진에게 알려 주세요.');
    }
    const now = Date.now();
    const slots = (Array.isArray(d.slots) ? d.slots : []).map((s) => str(s, 40));
    const ms = slots.map((s) => Date.parse(s));
    if (slots.length !== 3 || ms.some((m) => !Number.isFinite(m)) || new Set(ms).size !== 3) {
      throw new HttpsError('invalid-argument', '희망 일정 3개를 서로 다르게 골라 주세요.');
    }
    if (ms.some((m) => m < now + MIN_SLOT_AHEAD_MS || m > now + 60 * 24 * 60 * 60 * 1000)) {
      throw new HttpsError('invalid-argument', '희망 일정은 지금부터 48시간 뒤부터 60일 안으로 골라 주세요. (선배가 24시간 안에 답해요)');
    }
    const question = str(d.question, 300);
    if (question.length < 10) throw new HttpsError('invalid-argument', '선배에게 묻고 싶은 내용을 10자 이상 써 주세요.');

    const mine = await db.collection('coffeeChats').where('juniorUid', '==', uid).get();
    const open = mine.docs.map((x) => x.data()).filter((x) => OPEN_STATUSES.includes(x.status) && x.status !== 'confirmed');
    if (open.some((x) => x.seniorUid === seniorUid && x.status === 'requested')) throw new HttpsError('failed-precondition', '이 선배에게 보낸 신청이 아직 답을 기다리고 있어요.');
    if (open.filter((x) => x.status === 'requested').length >= MAX_OPEN_REQUESTS) throw new HttpsError('failed-precondition', `답을 기다리는 신청은 ${MAX_OPEN_REQUESTS}건까지예요.`);

    const uSnap = await db.collection('users').doc(uid).get();
    const u = uSnap.exists ? uSnap.data() : {};
    const j = d.junior || {};
    const fee = Math.round(price * CC_FEE_RATE);
    const id = `cc_${now.toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    await chatRef(id).set({
      juniorUid: uid,
      juniorName: str(u.name || u.nickname || '회원', 40),
      junior: { stage: str(j.stage, 60), industry: str(j.industry, 40), area: str(j.area, 40) },
      seniorUid,
      seniorName: str(senior.name, 40),
      seniorBiz: str(senior.bizName, 60),
      seniorArea: str(senior.area, 40),
      seniorPhoto: str(senior.photoUrl, 1000),
      type, typeLabel: CC_TYPES[type].label,
      amount: price, fee, payout: price - fee,
      slots, question, postId: str(d.postId, 128),
      status: 'pending_payment', paid: false, settled: false,
      createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
    });
    return { chatId: id, paymentId: id, amount: price, orderName: `${CC_TYPES[type].label} · ${str(senior.name, 20)} 선배`.slice(0, 50) };
  }

  // ── 2. 결제 확인(결제 직후·모바일 복귀·웹훅) ──
  async function finalizeCoffeeChatPayment(id) {
    const ref = chatRef(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not_found' };
    const chat = snap.data();
    if (chat.paid === true) return { ok: true, already: true, status: chat.status };
    if (chat.status !== 'pending_payment') {
      // 결제 대기가 끝난(결제 안 함 정리·취소된) 뒤에 결제가 승인된 경우: 돈만 빠지지 않게 자동 환불
      if (chat.lateRefunded) return { ok: false, error: 'not_payable' };
      const late = await verify(id, chat.amount);
      if (late.verified) {
        const amount = Number(chat.amount) || 0;
        const r = await cancelPortOnePayment({ paymentId: id, reason: '신청이 이미 정리된 뒤 결제되어 자동 환불', paidAmount: amount, refundAmount: amount, cancellableAmount: amount });
        await ref.set(r.ok ? { lateRefunded: true, refundAmount: amount, refundedAt: FV.serverTimestamp() } : { refundError: 'late_refund_failed', updatedAt: FV.serverTimestamp() }, { merge: true });
        return { ok: false, error: r.ok ? 'late_refunded' : 'late_refund_failed' };
      }
      return { ok: false, error: 'not_payable' };
    }
    const v = await verify(id, chat.amount);
    if (!v.verified) {
      if (v.reason === 'amount_mismatch' && Number(v.actual) > 0) {
        await cancelPortOnePayment({ paymentId: id, reason: '결제 금액 불일치로 인한 자동 환불', paidAmount: Number(v.actual), refundAmount: Number(v.actual) });
        await ref.set({ status: 'payment_failed', failReason: 'amount_mismatch', updatedAt: FV.serverTimestamp() }, { merge: true });
      }
      return { ok: false, error: v.reason || 'not_paid' };
    }
    // 동시에 두 번 신청해 둘 다 결제한 경우 등: 결제 확인 순간 다시 검사해 넘치면 자동 환불
    const mine = await db.collection('coffeeChats').where('juniorUid', '==', chat.juniorUid).get();
    const waiting = mine.docs.filter((x) => x.id !== id && x.data().status === 'requested');
    const dup = waiting.some((x) => x.data().seniorUid === chat.seniorUid) || waiting.length >= MAX_OPEN_REQUESTS;
    const now = Date.now();
    let outcome = 'requested';
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data();
      if (fresh.paid === true) { outcome = fresh.status; return; }
      if (fresh.status !== 'pending_payment') { outcome = 'late'; return; }
      tx.set(ref, dup ? {
        paid: true, paidAt: FV.serverTimestamp(), status: 'refunding', prevStatus: 'pending_payment', updatedAt: FV.serverTimestamp(),
      } : {
        paid: true, paidAt: FV.serverTimestamp(), status: 'requested',
        respondBy: admin.firestore.Timestamp.fromMillis(now + RESPOND_MS), updatedAt: FV.serverTimestamp(),
      }, { merge: true });
      outcome = dup ? 'dup' : 'requested';
    });
    if (outcome === 'late') return finalizeCoffeeChatPayment(id); // 그 사이 정리됐으면 늦은 결제 환불로
    if (outcome === 'requested') {
      await mailTo(chat.seniorUid, '새 커피챗 신청이 왔어요 (24시간 안에 답해 주세요)', [
        `${chat.seniorName} 선배님, ${chat.juniorName}님이 ${chat.typeLabel}(${Number(chat.amount).toLocaleString('ko-KR')}원)을 신청했어요.`,
        `희망 일정: ${(chat.slots || []).map(slotText).join(' / ')}`,
        '24시간 안에 일정 1개를 골라 수락하거나 거절해 주세요. 답이 없으면 자동 취소·환불돼요.',
      ]);
    }
    if (outcome === 'dup') {
      const amount = Number(chat.amount) || 0;
      const r = await cancelPortOnePayment({ paymentId: id, reason: '중복 신청 자동 환불', paidAmount: amount, refundAmount: amount, cancellableAmount: amount });
      await ref.set(r.ok
        ? { status: 'payment_failed', failReason: 'duplicate', refunded: true, refundAmount: amount, refundedAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() }
        : { status: 'payment_failed', failReason: 'duplicate', refundError: 'dup_refund_failed', updatedAt: FV.serverTimestamp() }, { merge: true });
      return { ok: false, error: 'duplicate' };
    }
    return { ok: true, status: outcome };
  }
  async function completeCoffeeChatPayment(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const chat = await loadChat(id);
    if (chat.juniorUid !== uid) throw new HttpsError('permission-denied', '내 신청만 확인할 수 있어요.');
    try {
      return await finalizeCoffeeChatPayment(id);
    } catch (e) {
      console.warn('[CoffeeChat] verify error', e.response?.status || e.message);
      return { ok: false, error: 'verify_error' };
    }
  }

  // ── 3. 선배 응답(일정 골라 수락 / 거절) ──
  async function respondCoffeeChat(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const action = str(request.data?.action, 10);
    const chat = await loadChat(id);
    if (chat.seniorUid !== uid) throw new HttpsError('permission-denied', '나에게 온 신청만 답할 수 있어요.');
    if (chat.status !== 'requested') throw new HttpsError('failed-precondition', '이미 처리된 신청입니다.');
    if (chat.respondBy && chat.respondBy.toMillis() < Date.now()) {
      await refundAndSet(id, ['requested'], 'expired', { refundReason: '선배 미응답(24시간) 자동 환불' });
      throw new HttpsError('failed-precondition', '응답 시간(24시간)이 지나 자동 취소·환불되었습니다.');
    }
    if (action === 'decline') {
      await refundAndSet(id, ['requested'], 'declined', { declineReason: str(request.data?.reason, 200), refundReason: '선배 거절 자동 환불' });
      return { ok: true, status: 'declined' };
    }
    if (action !== 'accept') throw new HttpsError('invalid-argument', '수락 또는 거절을 골라 주세요.');
    const idx = Number(request.data?.slotIndex);
    if (![0, 1, 2].includes(idx)) throw new HttpsError('invalid-argument', '진행할 일정 1개를 골라 주세요.');
    const slot = chat.slots[idx];
    if (Date.parse(slot) < Date.now() + MIN_ACCEPT_AHEAD_MS) throw new HttpsError('failed-precondition', '24시간 안에 시작하는 일정은 수락할 수 없어요(후배가 취소할 시간이 없어요). 다른 일정을 고르거나 거절해 주세요.');
    const contact = await seniorRef(uid).collection('private').doc('contact').get();
    const openChatUrl = contact.exists ? str(contact.data().openChatUrl, 300) : '';
    if (!openChatUrl) throw new HttpsError('failed-precondition', '수락하려면 먼저 내 선배 프로필에 카카오 오픈채팅 주소를 넣어 주세요.');
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(chatRef(id))).data();
      if (fresh.status !== 'requested') throw new HttpsError('failed-precondition', '그 사이 후배가 취소했거나 이미 처리된 신청입니다.');
      if (fresh.respondBy && fresh.respondBy.toMillis() < Date.now()) throw new HttpsError('failed-precondition', '응답 시간(24시간)이 지났습니다.');
      tx.set(chatRef(id), {
        status: 'confirmed', chosenSlot: slot, chosenIndex: idx, openChatUrl,
        confirmedAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
      }, { merge: true });
    });
    await mailTo(chat.juniorUid, '커피챗이 확정됐어요', [
      `${chat.juniorName}님, ${chat.seniorName} 선배가 커피챗을 수락했어요.`,
      `확정 일시: ${slotText(slot)} · ${chat.typeLabel}`,
      '사이트의 「내 커피챗」에서 카카오톡 오픈채팅으로 입장해 주세요. 약속 24시간 전까지는 취소하면 전액 환불돼요.',
    ]);
    return { ok: true, status: 'confirmed', chosenSlot: slot };
  }

  // ── 4. 취소 ──
  async function cancelCoffeeChat(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const chat = await loadChat(id);
    const isAdmin = await callerIsAdmin(request);
    const byJunior = chat.juniorUid === uid;
    const bySenior = chat.seniorUid === uid;
    if (!byJunior && !bySenior && !isAdmin) throw new HttpsError('permission-denied', '취소할 수 없는 신청입니다.');
    const reason = str(request.data?.reason, 200);
    if (chat.status === 'pending_payment') {
      if (!byJunior && !isAdmin) throw new HttpsError('failed-precondition', '취소할 수 없는 상태입니다.');
      await refundAndSet(id, ['pending_payment'], 'cancelled', {});
      return { ok: true, refunded: false };
    }
    if (chat.status === 'requested') {
      if (bySenior && !isAdmin) throw new HttpsError('failed-precondition', '받은 신청은 「거절」로 답해 주세요.');
      await refundAndSet(id, ['requested'], 'cancelled', { cancelledBy: isAdmin && !byJunior ? 'admin' : 'junior', cancelReason: reason, refundReason: '후배 신청 취소 환불' });
      return { ok: true, refunded: true };
    }
    if (chat.status === 'confirmed') {
      if (byJunior && !isAdmin && Date.parse(chat.chosenSlot) - Date.now() < CANCEL_LIMIT_MS) {
        throw new HttpsError('failed-precondition', '약속 24시간 전부터는 취소·환불이 안 돼요. 꼭 필요하면 선배와 오픈채팅으로 상의해 주세요.');
      }
      const by = byJunior ? 'junior' : bySenior ? 'senior' : 'admin';
      await refundAndSet(id, ['confirmed'], 'cancelled', { cancelledBy: by, cancelReason: reason, refundReason: by === 'senior' ? '선배 사정으로 취소 환불' : '커피챗 취소 환불' });
      return { ok: true, refunded: true };
    }
    throw new HttpsError('failed-precondition', '이미 끝났거나 취소된 신청입니다.');
  }

  // ── 5. 진행 완료 ──
  async function markCompleted(id, chat) {
    const sRef = seniorRef(chat.seniorUid);
    const before = await db.collection('coffeeChats').where('seniorUid', '==', chat.seniorUid).where('juniorUid', '==', chat.juniorUid).get();
    const firstWithJunior = !before.docs.some((x) => x.id !== id && x.data().status === 'completed');
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(chatRef(id));
      if (fresh.data().status !== 'confirmed' || fresh.data().refunded === true) return;
      tx.set(chatRef(id), { status: 'completed', completedAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() }, { merge: true });
      tx.set(sRef, { completedCount: FV.increment(1), ...(firstWithJunior ? { connectedCount: FV.increment(1) } : {}) }, { merge: true });
    });
  }
  async function completeCoffeeChat(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const chat = await loadChat(id);
    if (chat.seniorUid !== uid && !(await callerIsAdmin(request))) throw new HttpsError('permission-denied', '선배 또는 운영진만 완료 처리할 수 있어요.');
    if (chat.status !== 'confirmed') throw new HttpsError('failed-precondition', '확정된 커피챗만 완료할 수 있어요.');
    if (Date.parse(chat.chosenSlot) > Date.now()) throw new HttpsError('failed-precondition', '약속 시간이 지난 뒤에 완료할 수 있어요.');
    await markCompleted(id, chat);
    return { ok: true };
  }

  // ── 6. 후기·평점 ──
  async function reviewCoffeeChat(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const chat = await loadChat(id);
    if (chat.juniorUid !== uid) throw new HttpsError('permission-denied', '내가 신청한 커피챗만 후기를 남길 수 있어요.');
    if (chat.status !== 'completed') throw new HttpsError('failed-precondition', '진행 완료된 커피챗에만 후기를 남길 수 있어요.');
    if (chat.review) throw new HttpsError('already-exists', '이미 후기를 남겼어요.');
    const rating = Math.round(Number(request.data?.rating));
    if (!(rating >= 1 && rating <= 5)) throw new HttpsError('invalid-argument', '별점을 골라 주세요.');
    const text = str(request.data?.text, 200);
    if (text.length < 10) throw new HttpsError('invalid-argument', '한 줄 후기를 10자 이상 써 주세요.');
    const tags = (Array.isArray(request.data?.tags) ? request.data.tags : []).map((t) => str(t, 20)).filter((t) => REVIEW_TAGS.includes(t)).slice(0, 5);
    const review = { rating, text, tags, createdAt: admin.firestore.Timestamp.now() };
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(chatRef(id));
      if (fresh.data().review) throw new HttpsError('already-exists', '이미 후기를 남겼어요.');
      tx.set(chatRef(id), { review, updatedAt: FV.serverTimestamp() }, { merge: true });
      tx.set(seniorRef(chat.seniorUid), { ratingSum: FV.increment(rating), ratingCount: FV.increment(1) }, { merge: true });
      tx.set(seniorRef(chat.seniorUid).collection('reviews').doc(id), {
        rating, text, tags, type: chat.type, juniorName: maskName(chat.juniorName), createdAt: FV.serverTimestamp(),
      });
    });
    return { ok: true };
  }

  // ── 7. 정기 점검(1시간마다): 무응답 만료·자동 완료·버려진 결제 건 정리 ──
  async function sweep() {
    const now = Date.now();
    const out = { expired: 0, completed: 0, abandoned: 0 };
    const req = await db.collection('coffeeChats').where('status', '==', 'requested').get();
    for (const d of req.docs) {
      const c = d.data();
      if (c.respondBy && c.respondBy.toMillis() < now) {
        try { await refundAndSet(d.id, ['requested'], 'expired', { refundReason: '선배 미응답(24시간) 자동 환불' }); out.expired += 1; } catch (e) { console.warn('[CoffeeChat] expire fail', d.id, e.message); }
      }
    }
    const conf = await db.collection('coffeeChats').where('status', '==', 'confirmed').get();
    for (const d of conf.docs) {
      const c = d.data();
      if (Date.parse(c.chosenSlot) + AUTO_COMPLETE_MS < now) {
        try { await markCompleted(d.id, c); out.completed += 1; } catch (e) { console.warn('[CoffeeChat] complete fail', d.id, e.message); }
      }
    }
    const pend = await db.collection('coffeeChats').where('status', '==', 'pending_payment').get();
    for (const d of pend.docs) {
      const c = d.data();
      const created = c.createdAt?.toMillis ? c.createdAt.toMillis() : 0;
      if (created && created + PENDING_PAYMENT_TTL_MS < now) {
        try {
          const r = await finalizeCoffeeChatPayment(d.id); // 결제는 됐는데 확인이 늦은 건 살린다
          if (!r.ok && ['not_paid', 'no_payment_id'].includes(r.error)) {
            let marked = false;
            await db.runTransaction(async (tx) => {
              const fresh = (await tx.get(d.ref)).data();
              if (fresh.status !== 'pending_payment' || fresh.paid === true) return;
              tx.set(d.ref, { status: 'abandoned', updatedAt: FV.serverTimestamp() }, { merge: true });
              marked = true;
            });
            if (marked) out.abandoned += 1;
          }
        } catch (e) { console.warn('[CoffeeChat] pending check fail', d.id, e.message); }
      }
    }
    // 정리된(결제 안 함·취소) 뒤 늦게 결제된 건 찾아 자동 환불: 최근 2일 안의 정리 건만 확인
    const late = await db.collection('coffeeChats').where('status', 'in', ['abandoned', 'cancelled']).get();
    for (const d of late.docs) {
      const c = d.data();
      const created = c.createdAt?.toMillis ? c.createdAt.toMillis() : 0;
      if (c.paid || c.lateRefunded || c.lateChecked || !created || created + 2 * 24 * 60 * 60 * 1000 < now) continue;
      try {
        const r = await finalizeCoffeeChatPayment(d.id);
        if (r.error === 'late_refunded') out.lateRefunded = (out.lateRefunded || 0) + 1;
        if (created + 24 * 60 * 60 * 1000 < now) await d.ref.set({ lateChecked: true }, { merge: true });
      } catch (e) { console.warn('[CoffeeChat] late check fail', d.id, e.message); }
    }
    return out;
  }
  /** 시험용: 운영진이 정기 점검을 바로 돌린다 */
  async function runCoffeeChatSweep(request) {
    requireAuth(request);
    if (!(await callerIsAdmin(request))) throw new HttpsError('permission-denied', '운영진만 실행할 수 있어요.');
    return sweep();
  }

  /**
   * 로컬 시험 전용(가짜 Firebase + 가짜 결제일 때만 index.js 가 연결): 기다려야 하는 단계를 바로 볼 수 있게 시간을 앞당긴다.
   *  what = 'respond'  → 선배 응답 기한(24시간)이 지난 것으로 하고 정기 점검 실행(자동 취소·환불)
   *         'meeting'  → 약속 시간이 1시간 전에 지난 것으로(선배가 「진행 완료로 표시」 가능)
   *         'autodone' → 약속이 3시간 전에 끝난 것으로 하고 정기 점검 실행(자동 진행 완료)
   */
  async function testCoffeeTimeTravel(request) {
    const uid = requireAuth(request);
    const id = str(request.data?.chatId, 80);
    const what = str(request.data?.what, 20);
    const chat = await loadChat(id);
    if (![chat.juniorUid, chat.seniorUid].includes(uid) && !(await callerIsAdmin(request))) throw new HttpsError('permission-denied', '내 신청만 바꿀 수 있어요.');
    const now = Date.now();
    if (what === 'respond') {
      if (chat.status !== 'requested') throw new HttpsError('failed-precondition', '「선배 수락 대기 중」인 신청만 됩니다.');
      await chatRef(id).set({ respondBy: admin.firestore.Timestamp.fromMillis(now - 60 * 1000) }, { merge: true });
    } else if (what === 'meeting' || what === 'autodone') {
      if (chat.status !== 'confirmed') throw new HttpsError('failed-precondition', '「커피챗 확정」인 신청만 됩니다.');
      const back = what === 'meeting' ? 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
      await chatRef(id).set({ chosenSlot: new Date(now - back).toISOString() }, { merge: true });
    } else {
      throw new HttpsError('invalid-argument', '알 수 없는 시험 동작');
    }
    const swept = what === 'meeting' ? null : await sweep();
    return { ok: true, swept };
  }

  return {
    finalizeCoffeeChatPayment,
    sweep,
    callables: { requestCoffeeChat, completeCoffeeChatPayment, respondCoffeeChat, cancelCoffeeChat, completeCoffeeChat, reviewCoffeeChat, runCoffeeChatSweep },
    testCallables: { testCoffeeTimeTravel },
  };
}
