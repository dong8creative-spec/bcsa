import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, {
    CC_STATUS, CC_OPEN, CC_DONE, CC_SETTLE, CC_TYPES, won, payoutOf, ratingOf, slotLabel, seniorBadges, toMs,
} from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcSegment, CcNote, CcError, CcAvatar, ccBtn } from './ui';

/**
 * 내 커피챗 (창 이름 'center', 받는 값 {tab})
 * 탭: 신청 내역(누구나) / 선배면 받은 신청 · 선배 활동 · 정산. 승인 전 선배는 선배 활동만 더한다.
 */

const TAB_LABEL = { mine: '신청 내역', received: '받은 신청', senior: '선배 활동', settle: '정산' };
const SENIOR_STATE = { pending: ['심사 중', 'royal'], approved: ['인증 선배', 'ink'], rejected: ['반려됨', 'alert'] };

/** 단계별 안내 — 탭마다 따로. 탭을 처음 열면 그 탭 안내가 한 번 자동으로 뜬다 */
const TOURS = {
    mine: {
        id: 'center-mine',
        steps: [
            { title: '신청 내역', body: '내가 선배에게 낸 커피챗 신청이 모두 모여 있어요. 선배라면 위쪽 탭에서 받은 신청과 정산도 볼 수 있어요.' },
            { target: 'mine-filter', title: '골라 보기', body: '전체, 진행 중(수락 대기·확정), 완료·종료(완료·거절·취소)로 나눠 볼 수 있어요.' },
            { target: 'mine-card', title: '신청 한 건', body: '카드를 누르면 상세 화면이 열려요. 오른쪽 위 표시가 지금 상태예요(수락 대기, 확정, 진행 완료 등).' },
            { target: 'mine-cancel', title: '확정 전 취소', body: '선배가 수락하기 전에는 언제든 취소할 수 있고, 결제 금액은 전액 환불돼요.' },
            { target: 'mine-open', title: '확정되면', body: '「상세보기 & 오픈채팅 입장」에서 카카오 오픈채팅 주소를 확인하세요. 약속 24시간 전까지 취소하면 전액 환불돼요.' },
            { target: 'mine-saved', title: '저장한 글', body: '노하우 글에서 「저장」을 누른 글이 여기 모여요. 누르면 다시 읽을 수 있어요.' },
            { target: 'mine-review', title: '마친 뒤 후기', body: '선배가 「진행 완료」를 누르면(아니면 약속 2시간 뒤 자동) 「평점 남기기」가 생겨요. 별점과 한 줄 후기를 남겨 주세요.' },
            { target: 'mine-find', title: '다음에 할 일', body: '「선배 찾아보기」를 눌러 나와 맞는 선배를 고르고 커피챗을 신청해 보세요.' },
        ],
    },
    received: {
        id: 'center-received',
        steps: [
            { title: '받은 신청', body: '후배가 나에게 낸 커피챗 신청이에요. 24시간 안에 일정을 골라 수락하거나 거절해 주세요.' },
            { target: 'recv-banner', title: '답변 대기', body: '답하지 않고 24시간이 지나면 신청은 자동 취소되고 후배에게 전액 환불돼요. 대기 건수를 자주 확인해 주세요.' },
            { target: 'recv-filter', title: '골라 보기', body: '대기(답할 신청), 확정(약속 잡힌 건), 종료(완료·거절·취소)로 나눠 볼 수 있어요.' },
            { target: 'recv-card', title: '신청 한 건', body: '후배의 준비 단계·희망 업종·상권, 정산 예정액(수수료 10%를 뺀 금액), 남은 응답 시간이 보여요.' },
            { target: 'recv-card', title: '다음에 할 일', body: '카드를 누르면 상세 화면이 열려요. 질문을 읽고 희망 일정 3개 중 1개를 골라 「일정 선택 및 수락하기」를 누르세요.' },
        ],
    },
    senior: {
        id: 'center-senior',
        steps: [
            { title: '선배 활동', body: '내 선배 프로필, 커피챗 가격, 신청 받기 켜고 끄기, 활동 뱃지, 내가 쓴 글을 한곳에서 관리해요.' },
            { target: 'sen-profile', title: '내 프로필 상태', body: '오른쪽 위 표시가 심사 상태예요. 「심사 중」이면 운영진 승인을 기다리는 중이고, 승인되면 「인증 선배」가 돼요.' },
            { target: 'sen-edit', title: '프로필 고치기', body: '소개·주제·사진·카카오 오픈채팅 주소를 바꿀 수 있어요. 오픈채팅 주소가 있어야 신청을 수락할 수 있어요.' },
            { target: 'sen-price', title: '가격 수정', body: '30분은 2만~5만 원, 60분은 5만~10만 원에서 5천 원 단위로 정해요. 받는 금액은 수수료 10%를 뺀 금액이에요.' },
            { target: 'sen-accepting', title: '신청 받기', body: '바쁠 때는 「꺼짐」으로 바꾸면 새 신청을 받지 않아요. 이미 받은 신청은 그대로 진행돼요.' },
            { target: 'sen-badges', title: '활동 뱃지', body: '커피챗 10회와 평점 4.5를 모두 채우면 30분 커피챗 가격을 10만 원까지 올릴 수 있어요.' },
            { target: 'sen-write', title: '노하우 글 쓰기', body: '「새 글 쓰기」로 문제→해결→결과 3단계 글을 올리세요. 글을 읽은 후배가 바로 커피챗을 신청할 수 있어요.' },
        ],
    },
    settle: {
        id: 'center-settle',
        steps: [
            { title: '정산', body: '커피챗으로 받을 돈과 받은 돈을 확인하는 화면이에요. 정산은 매월 10일, 운영진이 확인한 뒤 지급해요.' },
            { target: 'settle-summary', title: '이번 달 정산 예정액', body: '이번 달 확정·완료된 커피챗에서 수수료 10%를 뺀 금액의 합계예요. 아직 지급 전인 금액만 더해요.' },
            { target: 'settle-filter', title: '골라 보기', body: '정산 완료(지급됨), 정산 대기(지급 전), 취소됨(후배에게 환불)으로 나눠 볼 수 있어요.' },
            { target: 'settle-list', title: '정산 내역', body: '한 줄에 후배, 진행 방식, 일정, 결제 금액이 보여요. 취소된 건은 금액에 줄이 그어져요.' },
            { target: 'settle-refund', title: '환불 규칙', body: '후배가 약속 24시간 전까지 취소하거나 선배 사정으로 취소하면 전액 환불돼요. 일정 변경은 오픈채팅으로 미리 조율해 주세요.' },
            { target: 'settle-help', title: '다음에 할 일', body: '정산 금액이 이상하거나 영수증이 필요하면 아래 고객센터 전화나 메일로 문의해 주세요.' },
        ],
    },
};

function useNow(step = 30000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), step);
        return () => clearInterval(t);
    }, [step]);
    return now;
}

const remainText = (until, now) => {
    const left = toMs(until) - now;
    if (!toMs(until)) return '';
    if (left <= 0) return '응답 시간 지남';
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    return `${h}시간 ${m}분 남음`;
};

const dday = (iso, now) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const t = new Date(now);
    const n = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
    if (n > 0) return `D-${n}`;
    return n === 0 ? 'D-DAY' : '지난 일정';
};

const refundLine = (c) => {
    if (c.refunded) return `결제 금액(${won(c.refundAmount || c.amount)}) 100% 환불 완료`;
    return c.paid ? '환불 처리 중이에요' : '결제되지 않은 신청이에요';
};

const typeShort = (t) => CC_TYPES[t]?.short || '커피챗';

/** 같은 모양 표 줄: 이름표 + 값 */
function Row({ label, children }) {
    return (
        <div className="flex min-h-[28px] items-center justify-between gap-3 text-[15px]">
            <span className="shrink-0 text-sub">{label}</span>
            <span className="min-w-0 truncate text-right font-semibold text-ink">{children}</span>
        </div>
    );
}

function SectionTitle({ children, right }) {
    return (
        <div className="mb-3 mt-8 flex items-center justify-between gap-2 first:mt-0">
            <h3 className="text-[17px] font-bold text-ink">{children}</h3>
            {right}
        </div>
    );
}

function Empty({ children }) {
    return <p className="border border-line bg-card px-4 py-8 text-center text-[15px] text-sub">{children}</p>;
}

function Loading() {
    return <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p>;
}

// ───────── 신청 내역(후배) ─────────
function MineCard({ c, now, cc, confirming, setConfirming, busy, onCancel, error }) {
    const st = CC_STATUS[c.status] || { label: c.status, tone: 'muted' };
    const fixed = !!c.chosenSlot && ['confirmed', 'completed'].includes(c.status);
    const slots = Array.isArray(c.slots) ? c.slots : [];
    return (
        <article data-tour="mine-card" className="border border-line bg-white">
            <button type="button" onClick={() => cc.open('chat', { chatId: c.id })}
                aria-label={`${c.seniorName || ''} 선배 커피챗 상세 보기 (${st.label})`}
                className="block w-full px-4 pb-3 pt-4 text-left">
                <div className="flex items-center justify-between gap-2">
                    <CcTag tone="sky" className="max-w-[60%] truncate">{c.seniorArea || '상권 미정'}</CcTag>
                    <CcTag tone={st.tone}>{st.label}</CcTag>
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <CcAvatar src={c.seniorPhoto} name={c.seniorName} size={48} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold text-ink">{c.seniorName} 선배</p>
                        <p className="truncate text-[15px] text-sub">{c.seniorBiz || ' '}</p>
                    </div>
                </div>
                <div className="mt-3 bg-card px-3 py-3">
                    <p className="line-clamp-1 text-[15px] font-semibold text-ink">{c.question}</p>
                    <div className="mt-2 space-y-0.5">
                        <Row label={fixed ? '확정 일정' : `신청 일정(희망 ${slots.length}건)`}>
                            {fixed ? slotLabel(c.chosenSlot) : `${slotLabel(slots[0])}${slots.length > 1 ? ` 외 ${slots.length - 1}개` : ''}`}
                        </Row>
                        <Row label="결제액">{won(c.amount)}</Row>
                    </div>
                </div>
            </button>
            <div className="border-t border-line px-4 py-3">
                {c.status === 'requested' ? (
                    confirming ? (
                        <div>
                            <p className="text-[15px] text-ink">신청을 취소할까요? 결제 금액은 전액 환불돼요.</p>
                            <div className="mt-2 flex gap-2">
                                <button type="button" className={ccBtn.small} onClick={() => setConfirming(null)} disabled={busy}>그대로 두기</button>
                                <button type="button" className={ccBtn.danger} onClick={() => onCancel(c.id)} disabled={busy}>{busy ? '취소하는 중…' : '취소 확정'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[15px] text-sub">24시간 내 수락 응답 예정</p>
                            <button type="button" data-tour="mine-cancel" className={ccBtn.small} onClick={() => setConfirming(c.id)}>신청 취소</button>
                        </div>
                    )
                ) : null}
                {c.status === 'confirmed' ? (
                    <div className="flex items-center gap-2">
                        <CcTag tone="royal">{dday(c.chosenSlot, now)}</CcTag>
                        <button type="button" data-tour="mine-open" className={`${ccBtn.smallDark} flex-1`} onClick={() => cc.open('chat', { chatId: c.id })}>상세보기 &amp; 오픈채팅 입장</button>
                    </div>
                ) : null}
                {c.status === 'completed' ? (
                    c.review ? (
                        <p className="text-[15px] text-sub">내 평점 <span className="font-semibold text-royal">{'★'.repeat(c.review.rating)}</span> {c.review.rating}점 · 후기를 남겼어요</p>
                    ) : (
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[15px] text-sub">선배와의 대화는 어떠셨나요?</p>
                            <button type="button" data-tour="mine-review" className={ccBtn.smallDark} onClick={() => cc.open('review', { chatId: c.id })}>평점 남기기</button>
                        </div>
                    )
                ) : null}
                {c.status === 'declined' ? (
                    <div className="text-[15px]">
                        <p className="font-semibold text-red-700">선배 남김 사유</p>
                        <p className="line-clamp-2 text-ink">{c.declineReason ? `“${c.declineReason}”` : '사유를 남기지 않았어요.'}</p>
                        <p className="mt-1 text-sub">{c.refunded ? `결제 금액 100% 자동 환불 완료 (${won(c.refundAmount || c.amount)})` : '환불 처리 중이에요'}</p>
                    </div>
                ) : null}
                {c.status === 'expired' ? (
                    <div className="text-[15px]">
                        <p className="text-ink">선배가 24시간 안에 답하지 않아 자동 취소됐어요.</p>
                        <p className="mt-1 text-sub">{refundLine(c)}</p>
                    </div>
                ) : null}
                {c.status === 'cancelled' ? (
                    <div className="text-[15px]">
                        <p className="text-ink">{c.cancelledBy === 'senior' ? '선배 사정으로 취소됐어요.' : c.cancelledBy === 'admin' ? '운영진이 취소했어요.' : '신청을 취소했어요.'}</p>
                        <p className="mt-1 text-sub">{refundLine(c)}</p>
                    </div>
                ) : null}
                {c.status === 'payment_failed' ? <p className="text-[15px] text-sub">결제가 확인되지 않아 신청이 접수되지 않았어요.</p> : null}
                <CcError>{error}</CcError>
            </div>
        </article>
    );
}

function SavedPosts({ uid, cc, small }) {
    const [ids, setIds] = useState(null);
    const [posts, setPosts] = useState([]);
    useEffect(() => {
        let alive = true;
        coffeeChatService.getSavedPostIds(uid).then((r) => { if (alive) setIds(r || []); }).catch(() => { if (alive) setIds([]); });
        return () => { alive = false; };
    }, [uid]);
    useEffect(() => coffeeChatService.subscribePublishedPosts(setPosts), []);
    const list = useMemo(() => (ids ? posts.filter((p) => ids.includes(p.id)) : []), [ids, posts]);
    return (
        <section aria-label="저장한 글">
            <SectionTitle right={<span className="text-[15px] text-sub">{ids ? `${list.length}건` : ''}</span>}>
                {small ? <span className="text-[16px]">저장한 글</span> : '저장한 글'}
            </SectionTitle>
            {ids === null ? <Loading /> : list.length === 0 ? <Empty>저장한 노하우 글이 아직 없어요.</Empty> : (
                <ul className="divide-y divide-line border border-line">
                    {list.map((p) => (
                        <li key={p.id}>
                            <button type="button" onClick={() => cc.open('post', { postId: p.id })} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left">
                                <CcTag tone="sky">{p.topic}</CcTag>
                                <span className="line-clamp-1 min-w-0 flex-1 text-[15px] font-semibold text-ink">{p.title}</span>
                                <span aria-hidden="true" className="text-sub">›</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function MineTab({ cc, mine, now, showSaved }) {
    const [filter, setFilter] = useState('all');
    const [confirmId, setConfirmId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [err, setErr] = useState({});
    const list = mine || [];
    const openN = list.filter((c) => CC_OPEN.includes(c.status)).length;
    const doneN = list.filter((c) => CC_DONE.includes(c.status)).length;
    const shown = list.filter((c) => (filter === 'open' ? CC_OPEN.includes(c.status) : filter === 'done' ? CC_DONE.includes(c.status) : true));
    const onCancel = async (id) => {
        setBusyId(id);
        setErr((e) => ({ ...e, [id]: '' }));
        try {
            await coffeeChatService.cancel(id, '');
            setConfirmId(null);
        } catch (e) {
            setErr((x) => ({ ...x, [id]: e.message }));
        } finally {
            setBusyId(null);
        }
    };
    return (
        <div>
            <CcNote title="선배와의 미팅 팁">대화 전 고민 질문 3가지를 미리 적어 두면 30분이 2시간처럼 유익해져요.</CcNote>
            <div data-tour="mine-filter" className="mt-4">
                <CcSegment label="신청 내역 거르기" value={filter} onChange={setFilter}
                    items={[['all', `전체 ${list.length}`], ['open', `진행 중 ${openN}`], ['done', `완료·종료 ${doneN}`]]} />
            </div>
            <div className="mt-4 space-y-3">
                {mine === null ? <Loading /> : shown.length === 0 ? (
                    <div>
                        <Empty>{filter === 'all' ? '아직 신청한 커피챗이 없어요.' : '해당하는 신청이 없어요.'}</Empty>
                        {filter === 'all' ? <button type="button" data-tour="mine-find" className={`${ccBtn.line} mt-3`} onClick={() => cc.open('hub', { tab: 'seniors' })}>선배 찾아보기</button> : null}
                    </div>
                ) : shown.map((c) => (
                    <MineCard key={c.id} c={c} now={now} cc={cc}
                        confirming={confirmId === c.id} setConfirming={setConfirmId}
                        busy={busyId === c.id} onCancel={onCancel} error={err[c.id]} />
                ))}
            </div>
            {showSaved ? <div data-tour="mine-saved" className="mt-8"><SavedPosts uid={cc.uid} cc={cc} small /></div> : null}
        </div>
    );
}

// ───────── 받은 신청(선배) ─────────
function ReceivedTab({ cc, received, now }) {
    const [filter, setFilter] = useState('all');
    const list = received || [];
    const waiting = list.filter((c) => c.status === 'requested').length;
    const shown = list.filter((c) => (filter === 'wait' ? c.status === 'requested' : filter === 'open' ? c.status === 'confirmed' : filter === 'done' ? CC_DONE.includes(c.status) : true));
    return (
        <div>
            <div data-tour="recv-banner" className="flex items-center justify-between gap-2 border border-line bg-card px-4 py-3">
                <p className="text-[15px] text-ink">받은 신청은 24시간 안에 답해 주세요.</p>
                <CcTag tone={waiting ? 'royal' : 'muted'}>답변 대기 {waiting}건</CcTag>
            </div>
            <div data-tour="recv-filter" className="mt-4">
                <CcSegment label="받은 신청 거르기" value={filter} onChange={setFilter} cols={4}
                    items={[['all', '전체'], ['wait', `대기 ${waiting}`], ['open', '확정'], ['done', '종료']]} />
            </div>
            <div className="mt-4 space-y-3">
                {received === null ? <Loading /> : shown.length === 0 ? <Empty>받은 신청이 없어요.</Empty> : shown.map((c) => {
                    const st = CC_STATUS[c.status] || { label: c.status, tone: 'muted' };
                    const j = c.junior || {};
                    return (
                        <button key={c.id} type="button" data-tour="recv-card" onClick={() => cc.open('chat', { chatId: c.id })}
                            aria-label={`${c.juniorName || '후배'} 후배 신청 상세 보기 (${st.label})`}
                            className="block w-full border border-line bg-white p-4 text-left">
                            <div className="flex items-center justify-between gap-2">
                                <CcTag tone="sky">{typeShort(c.type)}</CcTag>
                                <CcTag tone={st.tone}>{st.label}</CcTag>
                            </div>
                            <div className="mt-3 flex items-baseline gap-2">
                                <p className="truncate text-[17px] font-semibold text-ink">{c.juniorName || '후배'} 후배</p>
                                <p className="truncate text-[15px] text-sub">{j.stage || ''}</p>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 bg-card px-3 py-3 text-[15px]">
                                <div className="min-w-0"><p className="text-[13px] text-sub">희망 업종</p><p className="truncate font-semibold text-ink">{j.industry || '적지 않음'}</p></div>
                                <div className="min-w-0"><p className="text-[13px] text-sub">타깃 상권</p><p className="truncate font-semibold text-ink">{j.area || '적지 않음'}</p></div>
                            </div>
                            <div className="mt-2 space-y-0.5">
                                <Row label="정산 예정액">{won(Number(c.payout) || payoutOf(c.amount))}</Row>
                                {c.status === 'requested' ? <Row label="남은 응답 시간">{remainText(c.respondBy, now)}</Row> : null}
                                {c.chosenSlot && ['confirmed', 'completed'].includes(c.status) ? <Row label="확정 일정">{slotLabel(c.chosenSlot)}</Row> : null}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ───────── 선배 활동 ─────────
function SeniorTab({ cc, senior }) {
    const approved = senior.status === 'approved';
    const [posts, setPosts] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => coffeeChatService.subscribeMyPosts(cc.uid, setPosts), [cc.uid]);
    const r = ratingOf(senior);
    const badges = seniorBadges(senior);
    const earned = badges.filter((b) => b.earned).length;
    const [stateLabel, stateTone] = SENIOR_STATE[senior.status] || ['확인 중', 'muted'];
    const accepting = senior.accepting !== false;
    const toggle = async () => {
        setBusy(true); setErr('');
        try { await coffeeChatService.updateSeniorFields(cc.uid, { accepting: !accepting }); } catch (e) { setErr(e.message || '바꾸지 못했어요.'); } finally { setBusy(false); }
    };
    return (
        <div>
            <section data-tour="sen-profile" aria-label="내 선배 프로필" className="border border-line bg-white p-4">
                <div className="flex items-start gap-3">
                    <CcAvatar src={senior.photoUrl} name={senior.name} size={64} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-[17px] font-semibold text-ink">{senior.area} {senior.years}년차 {senior.name} 선배</p>
                            <CcTag tone={stateTone}>{stateLabel}</CcTag>
                        </div>
                        <p className="truncate text-[15px] text-sub">{senior.bizName}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <CcTag tone="sky">{senior.industry}</CcTag>
                            {(senior.topics || []).map((t) => <CcTag key={t} tone="sky">{t}</CcTag>)}
                        </div>
                    </div>
                </div>
                {approved ? (
                    <dl className="mt-4 grid grid-cols-4 border border-line text-center">
                        {[['완료 커피챗', `${Number(senior.completedCount) || 0}회`], ['평점', r === null ? '-' : r.toFixed(1)], ['연결된 후배', `${Number(senior.connectedCount) || 0}명`], ['후기', `${Number(senior.ratingCount) || 0}개`]].map(([k, v], i) => (
                            <div key={k} className={`px-1 py-3 ${i ? 'border-l border-line' : ''}`}>
                                <dt className="text-[13px] text-sub">{k}</dt>
                                <dd className="mt-0.5 text-[17px] font-bold text-ink">{v}</dd>
                            </div>
                        ))}
                    </dl>
                ) : null}
            </section>
            {senior.status === 'pending' ? <div className="mt-3"><CcNote title="심사 중이에요">운영진이 프로필을 확인하고 있어요. 승인되면 신청 받기와 노하우 글쓰기를 시작할 수 있어요.</CcNote></div> : null}
            {senior.status === 'rejected' ? (
                <div className="mt-3"><CcNote tone="alert" title="등록이 반려됐어요">{senior.rejectReason ? `사유: ${senior.rejectReason}. ` : ''}프로필을 고쳐 저장하면 다시 심사를 받아요.</CcNote></div>
            ) : null}
            <button type="button" data-tour="sen-edit" className={`${ccBtn.line} mt-3`} onClick={() => cc.open('register')}>프로필 고치기</button>

            <SectionTitle right={<button type="button" data-tour="sen-price" className={ccBtn.small} onClick={() => cc.open('prices')}>가격 수정</button>}>내 커피챗 가격</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
                {['online30', 'visit60'].map((k) => (
                    <div key={k} className="border border-line bg-card px-3 py-3">
                        <p className="truncate text-[15px] text-sub">{CC_TYPES[k].short}</p>
                        <p className="mt-1 text-[20px] font-bold text-ink">{won(senior.prices?.[k])}</p>
                        <p className="truncate text-[13px] text-sub">받는 금액 {won(payoutOf(senior.prices?.[k]))}</p>
                    </div>
                ))}
            </div>

            {approved ? (
                <>
                    <div data-tour="sen-accepting" className="mt-3 flex items-center justify-between gap-3 border border-line px-4 py-3">
                        <div className="min-w-0">
                            <p id="cc-accepting-label" className="text-[15px] font-semibold text-ink">신청 받기</p>
                            <p className="text-[15px] text-sub">{accepting ? '지금 후배의 신청을 받고 있어요.' : '지금은 신청을 받지 않아요.'}</p>
                        </div>
                        <button type="button" role="switch" aria-checked={accepting} aria-labelledby="cc-accepting-label" onClick={toggle} disabled={busy}
                            className={`inline-flex h-11 min-w-[88px] items-center justify-center rounded-lg px-4 text-[15px] font-bold disabled:opacity-40 ${accepting ? 'bg-royal text-white' : 'border border-line2 bg-white text-ink'}`}>
                            {accepting ? '켜짐' : '꺼짐'}
                        </button>
                    </div>
                    <CcError>{err}</CcError>

                    <SectionTitle right={<span className="text-[15px] text-sub">수집 {earned}/4</span>}>활동 뱃지</SectionTitle>
                    <div data-tour="sen-badges" className="grid grid-cols-2 gap-2">
                        {badges.map((b) => (
                            <div key={b.key} className={`flex min-h-[128px] flex-col border px-3 py-3 ${b.earned ? 'border-[#0c0c0e] bg-white' : 'border-line bg-card'}`}>
                                <div className="flex items-center justify-between gap-1">
                                    <p className="truncate text-[15px] font-semibold text-ink">{b.label}</p>
                                    <CcTag tone={b.earned ? 'ink' : 'muted'}>{b.earned ? '획득' : '진행 중'}</CcTag>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-sub">{b.desc}</p>
                                {b.goal && !b.earned ? (
                                    <div className="mt-auto pt-2">
                                        <div role="progressbar" aria-label={`${b.label} 진행`} aria-valuemin={0} aria-valuemax={b.goal} aria-valuenow={b.progress} className="h-2 w-full bg-[#dfe3ea]">
                                            <div className="h-2 bg-royal" style={{ width: `${Math.round((b.progress / b.goal) * 100)}%` }} />
                                        </div>
                                        <p className="mt-1 text-[13px] text-sub">{b.key === 'rating' ? `후기 ${b.progress}/${b.goal}개${b.rating !== null && b.rating !== undefined ? ` · 평점 ${b.rating}` : ''}` : `${b.progress}/${b.goal}회`}</p>
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    <div className="mt-3"><CcNote title="다음 레벨 혜택">커피챗 10회와 평점 4.5를 모두 달성하면 30분 상한이 100,000원으로 열려요</CcNote></div>

                    <SectionTitle right={<button type="button" data-tour="sen-write" className={ccBtn.smallDark} onClick={() => cc.open('editor', {})}>새 글 쓰기</button>}>내가 쓴 글</SectionTitle>
                    {posts === null ? <Loading /> : posts.length === 0 ? <Empty>아직 쓴 노하우 글이 없어요.</Empty> : (
                        <ul className="divide-y divide-line border border-line">
                            {posts.map((p) => (
                                <li key={p.id}>
                                    <button type="button" onClick={() => cc.open('editor', { postId: p.id })} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left">
                                        <CcTag tone={p.status === 'published' ? 'ink' : 'muted'}>{p.status === 'published' ? '공개' : '임시저장'}</CcTag>
                                        <span className="line-clamp-1 min-w-0 flex-1 text-[15px] font-semibold text-ink">{p.title || '(제목 없음)'}</span>
                                        <span aria-hidden="true" className="text-sub">›</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : null}

            <div className="mt-8"><SavedPosts uid={cc.uid} cc={cc} /></div>
        </div>
    );
}

// ───────── 정산(선배) ─────────
const settleState = (c) => {
    if (!CC_SETTLE.includes(c.status)) return 'cancelled';
    return c.settled ? 'settled' : 'waiting';
};
const SETTLE_LABEL = { settled: ['정산 완료', 'ink'], waiting: ['정산 대기', 'royal'], cancelled: ['취소됨(환불 완료)', 'alert'] };

function SettleTab({ received, now }) {
    const [filter, setFilter] = useState('all');
    const rows = (received || []).filter((c) => CC_SETTLE.includes(c.status) || c.refunded);
    const rowMs = (c) => Date.parse(c.chosenSlot || c.slots?.[0] || '') || toMs(c.createdAt);
    const nd = new Date(now);
    const inMonth = (ms) => { const d = new Date(ms); return d.getFullYear() === nd.getFullYear() && d.getMonth() === nd.getMonth(); };
    const monthLive = rows.filter((c) => CC_SETTLE.includes(c.status) && inMonth(rowMs(c)));
    const monthDue = monthLive.filter((c) => !c.settled).reduce((s, c) => s + (Number(c.payout) || payoutOf(c.amount)), 0);
    const monthCancelled = rows.filter((c) => !CC_SETTLE.includes(c.status) && inMonth(rowMs(c))).length;
    const count = (k) => rows.filter((c) => settleState(c) === k).length;
    const shown = rows.filter((c) => filter === 'all' || settleState(c) === filter);
    return (
        <div>
            <section data-tour="settle-summary" aria-label="이번 달 정산 요약" className="border border-[#0c0c0e] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] text-sub">이번 달 정산 예정액</p>
                    <CcTag tone="sky">정산일 매월 10일</CcTag>
                </div>
                <p className="mt-1 text-[28px] font-bold text-ink">{won(monthDue)}</p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[15px]">
                    <span className="text-sub">이번 달 성사 건수</span>
                    <span className="font-semibold text-ink">{monthLive.length}건 <span className="text-[13px] font-normal text-sub">(취소 {monthCancelled}건 제외)</span></span>
                </div>
            </section>
            <div data-tour="settle-filter" className="mt-4">
                <CcSegment label="정산 내역 거르기" value={filter} onChange={setFilter} cols={4}
                    items={[['all', `전체 ${rows.length}`], ['settled', `정산 완료 ${count('settled')}`], ['waiting', `정산 대기 ${count('waiting')}`], ['cancelled', `취소됨 ${count('cancelled')}`]]} />
            </div>
            <div className="mt-4">
                {received === null ? <Loading /> : shown.length === 0 ? <Empty>정산 내역이 없어요.</Empty> : (
                    <ul className="divide-y divide-line border border-line">
                        {shown.map((c, n) => {
                            const s = settleState(c);
                            const [lab, tone] = SETTLE_LABEL[s];
                            const j = c.junior || {};
                            return (
                                <li key={c.id} data-tour={n === 0 ? 'settle-list' : undefined} className={`grid h-[132px] grid-rows-[auto_auto_1fr] px-4 py-3 ${s === 'cancelled' ? 'bg-card' : 'bg-white'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <CcTag tone="sky">{typeShort(c.type)}</CcTag>
                                            <span className="truncate text-[15px] font-semibold text-ink">{c.juniorName || '후배'} 후배</span>
                                        </div>
                                        <CcTag tone={tone}>{lab}</CcTag>
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-[15px] text-sub">{[j.industry, j.stage].filter(Boolean).join(' · ') || '준비 상황 미입력'}</p>
                                    <div className="mt-2 flex items-end justify-between gap-2">
                                        <span className="truncate text-[15px] text-sub">{slotLabel(c.chosenSlot || c.slots?.[0]) || '-'}</span>
                                        <span className={`shrink-0 text-[17px] font-bold ${s === 'cancelled' ? 'text-sub line-through' : 'text-ink'}`}>{won(c.amount)}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="mt-6 space-y-3">
                <div data-tour="settle-refund"><CcNote title="신뢰 환불 보장제">
                    후배가 약속 24시간 전까지 취소하면 결제 금액은 100% 전액 환불돼요. 선배 사정으로 취소해도 전액 환불되니, 일정 변경이 필요하면 오픈채팅으로 미리 조율해 주세요. 정산 금액은 결제 금액에서 수수료 10%를 뺀 금액이에요.
                </CcNote></div>
                <div data-tour="settle-help" className="border border-line px-4 py-3.5">
                    <p className="text-[15px] font-semibold text-ink">도움이 필요하신가요? 1:1 문의</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-sub">정산 내역에 오류가 있거나 영수증이 필요하면 고객센터 070-8064-7238 또는 pujar@naver.com 으로 문의해 주세요.</p>
                </div>
            </div>
        </div>
    );
}

export default function CenterModal({ tab, onClose, depth }) {
    const cc = useCoffeeChat();
    const now = useNow(30000);
    const [cur, setCur] = useState(tab || 'mine');
    const [mine, setMine] = useState(null);
    const [received, setReceived] = useState(null);
    const senior = cc.mySenior || null;
    const approved = senior?.status === 'approved';

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => (cc.uid ? coffeeChatService.subscribeMyRequests(cc.uid, setMine) : undefined), [cc.uid]);
    useEffect(() => (cc.uid && approved ? coffeeChatService.subscribeReceived(cc.uid, setReceived) : undefined), [cc.uid, approved]);

    if (!cc.uid) return null;

    const tabs = ['mine', ...(approved ? ['received', 'senior', 'settle'] : senior ? ['senior'] : [])];
    const active = tabs.includes(cur) ? cur : 'mine';
    const waiting = (received || []).filter((c) => c.status === 'requested').length;
    // 목록을 다 불러온 뒤에 안내를 시작해야 카드·버튼 단계가 빠지지 않는다
    const tourReady = active === 'mine' ? mine !== null : active === 'senior' ? !!senior : received !== null;
    const tour = tourReady ? TOURS[active] : undefined;

    return (
        <CcModal title="내 커피챗" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} wide tour={tour}>
            <div role="tablist" aria-label="내 커피챗" className="-mt-1 mb-5 grid border-b border-line" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
                {tabs.map((t) => (
                    <button key={t} type="button" role="tab" id={`cc-center-tab-${t}`} aria-controls="cc-center-panel" aria-selected={active === t}
                        onClick={() => setCur(t)}
                        className={`-mb-px h-12 truncate border-b-2 px-1 text-[15px] ${active === t ? 'border-[#0c0c0e] font-bold text-ink' : 'border-transparent text-sub'}`}>
                        {TAB_LABEL[t]}
                        {t === 'received' && waiting ? <span aria-hidden="true" className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center bg-royal px-1 text-[12px] text-white">{waiting}</span> : null}
                    </button>
                ))}
            </div>
            <div id="cc-center-panel" role="tabpanel" aria-labelledby={`cc-center-tab-${active}`}>
                {active === 'mine' ? <MineTab cc={cc} mine={mine} now={now} showSaved={!senior} /> : null}
                {active === 'received' ? <ReceivedTab cc={cc} received={received} now={now} /> : null}
                {active === 'senior' && senior ? <SeniorTab cc={cc} senior={senior} /> : null}
                {active === 'settle' ? <SettleTab received={received} now={now} /> : null}
            </div>
        </CcModal>
    );
}
