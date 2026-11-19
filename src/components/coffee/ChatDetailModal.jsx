import React, { useEffect, useState } from 'react';
import coffeeChatService, { CC_STATUS, CC_TYPES, won, payoutOf, slotLabel, toMs } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcNote, CcError, CcAvatar, ccBtn, ccInput } from './ui';

/**
 * 커피챗 한 건 상세 (창 이름 'chat', 받는 값 {chatId})
 * 서비스에 단건 구독이 없어 내 신청(후배)·받은 신청(선배)을 모두 구독해 id 로 찾는다.
 */

const CANCEL_LIMIT_MS = 24 * 60 * 60 * 1000;

function useNow(step = 30000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), step);
        return () => clearInterval(t);
    }, [step]);
    return now;
}

const remainText = (until, now) => {
    const ms = toMs(until);
    if (!ms) return '';
    const left = ms - now;
    if (left <= 0) return '응답 시간이 지났어요';
    return `${Math.floor(left / 3600000)}시간 ${Math.floor((left % 3600000) / 60000)}분 남았어요`;
};

const minutesOf = (type) => (type === 'visit60' ? 60 : 30);

/** 구글 캘린더 일정 추가 주소(UTC YYYYMMDDTHHMMSSZ) */
const calendarUrl = (c, isSeniorSide) => {
    const start = Date.parse(c.chosenSlot);
    if (!Number.isFinite(start)) return '';
    const f = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const who = isSeniorSide ? `${c.juniorName || '후배'} 후배` : `${c.seniorName || ''} 선배`;
    const text = `먼저가본 커피챗 · ${who}`;
    const details = `${c.typeLabel || CC_TYPES[c.type]?.label || '커피챗'} · 오픈채팅 주소는 먼저가본 「내 커피챗」에서 확인하세요.`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${f(start)}/${f(start + minutesOf(c.type) * 60000)}&details=${encodeURIComponent(details)}`;
};

function Row({ label, children }) {
    return (
        <div className="flex min-h-[32px] items-center justify-between gap-3 text-[15px]">
            <span className="shrink-0 text-sub">{label}</span>
            <span className="min-w-0 text-right font-semibold text-ink">{children}</span>
        </div>
    );
}

function Block({ title, children, right }) {
    return (
        <section className="mt-4 border border-line bg-white p-4">
            {title ? (
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-[16px] font-bold text-ink">{title}</h3>
                    {right}
                </div>
            ) : null}
            {children}
        </section>
    );
}

function SeniorBox({ c }) {
    return (
        <div className="flex items-center gap-3">
            <CcAvatar src={c.seniorPhoto} name={c.seniorName} size={56} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-sub">{c.seniorArea}</p>
                <p className="truncate text-[17px] font-semibold text-ink">{c.seniorName} 선배</p>
                <p className="truncate text-[15px] text-sub">{c.seniorBiz}</p>
            </div>
        </div>
    );
}

function JuniorBox({ c }) {
    const j = c.junior || {};
    return (
        <div>
            <div className="flex items-baseline gap-2">
                <p className="truncate text-[17px] font-semibold text-ink">{c.juniorName || '후배'} 후배</p>
                {j.stage ? <CcTag tone="sky">{j.stage}</CcTag> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 bg-card px-3 py-3 text-[15px]">
                <div className="min-w-0"><p className="text-[13px] text-sub">희망 업종</p><p className="truncate font-semibold text-ink">{j.industry || '적지 않음'}</p></div>
                <div className="min-w-0"><p className="text-[13px] text-sub">타깃 상권</p><p className="truncate font-semibold text-ink">{j.area || '적지 않음'}</p></div>
                <div className="col-span-2 min-w-0"><p className="text-[13px] text-sub">준비 단계</p><p className="truncate font-semibold text-ink">{j.stage || '적지 않음'}</p></div>
            </div>
        </div>
    );
}

function Question({ c, title }) {
    return (
        <Block title={title}>
            <p className="whitespace-pre-wrap break-words bg-card px-3 py-3 text-[15px] leading-relaxed text-ink">
                <span className="mr-1 font-bold text-royal">Q.</span>{c.question}
            </p>
        </Block>
    );
}

function Stars({ n }) {
    return <span role="img" className="text-royal" aria-label={`평점 ${n}점`}>{'★'.repeat(n)}<span className="text-[#cfd3da]">{'★'.repeat(5 - n)}</span></span>;
}

/** 창 안 확인 칸 */
function Confirm({ text, children, onCancel, onOk, okLabel, busy }) {
    return (
        <div className="mt-4 border border-red-200 bg-red-50 p-4">
            <p className="text-[15px] text-red-700">{text}</p>
            {children}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className={ccBtn.line} onClick={onCancel} disabled={busy}>돌아가기</button>
                <button type="button" className={ccBtn.primary} onClick={onOk} disabled={busy}>{busy ? '처리 중…' : okLabel}</button>
            </div>
        </div>
    );
}

export default function ChatDetailModal({ chatId, onClose, depth }) {
    const cc = useCoffeeChat();
    const now = useNow(30000);
    const [mine, setMine] = useState(null);
    const [received, setReceived] = useState(null);
    const [slot, setSlot] = useState(null);
    const [mode, setMode] = useState(''); // '' | 'decline' | 'cancel'
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => (cc.uid ? coffeeChatService.subscribeMyRequests(cc.uid, setMine) : undefined), [cc.uid]);
    useEffect(() => (cc.uid ? coffeeChatService.subscribeReceived(cc.uid, setReceived) : undefined), [cc.uid]);

    if (!cc.uid) return null;

    const c = (mine || []).find((x) => x.id === chatId) || (received || []).find((x) => x.id === chatId) || null;
    const loading = !c && (mine === null || received === null);
    const isSeniorSide = !!c && c.seniorUid === cc.uid;
    const st = c ? (CC_STATUS[c.status] || { label: c.status, tone: 'muted' }) : null;

    const run = async (fn) => {
        setBusy(true); setErr('');
        try {
            await fn();
            setMode(''); setReason('');
        } catch (e) {
            setErr(e?.message || '요청을 처리하지 못했어요.');
        } finally {
            setBusy(false);
        }
    };
    const accept = () => {
        if (slot === null) { setErr('진행할 일정 1개를 골라 주세요.'); return; }
        run(() => coffeeChatService.respond(chatId, 'accept', { slotIndex: slot }));
    };
    const decline = () => run(() => coffeeChatService.respond(chatId, 'decline', { reason: reason.trim() }));
    const cancel = () => run(() => coffeeChatService.cancel(chatId, reason.trim()));
    const complete = () => run(() => coffeeChatService.complete(chatId));

    const seniorRequested = c && isSeniorSide && c.status === 'requested';
    const title = !c ? '커피챗 상세' : seniorRequested ? '받은 신청 상세' : c.status === 'confirmed' ? '커피챗 확정' : '커피챗 상세';
    const slotMs = c?.chosenSlot ? Date.parse(c.chosenSlot) : NaN;
    const slots = Array.isArray(c?.slots) ? c.slots : [];
    const needContact = /오픈채팅 주소/.test(err);

    let footer = null;
    if (seniorRequested) {
        footer = mode === 'decline' ? (
            <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" className={ccBtn.line} onClick={() => { setMode(''); setErr(''); }} disabled={busy}>돌아가기</button>
                <button type="button" className={ccBtn.primary} onClick={decline} disabled={busy}>{busy ? '처리 중…' : '거절 확정'}</button>
            </div>
        ) : (
            <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" className={ccBtn.line} onClick={() => { setMode('decline'); setErr(''); }} disabled={busy}>거절하기</button>
                <button type="button" className={ccBtn.royal} onClick={accept} disabled={busy}>{busy ? '처리 중…' : '일정 선택 및 수락하기'}</button>
            </div>
        );
    }

    return (
        <CcModal title={title} onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} footer={footer}>
            {loading ? <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p> : null}
            {!loading && !c ? <CcNote tone="alert">신청 정보를 찾을 수 없어요. 내 신청이나 받은 신청만 볼 수 있어요.</CcNote> : null}

            {c && seniorRequested ? (
                <div>
                    <div className="flex items-center justify-between gap-2 border border-line bg-card px-4 py-3">
                        <p className="text-[15px] text-ink">응답 마감까지 <span className="font-semibold">{remainText(c.respondBy, now)}</span></p>
                        <CcTag tone="royal">답변 대기중</CcTag>
                    </div>
                    <Block><JuniorBox c={c} /></Block>
                    <section className="mt-4 bg-[#0c0c0e] p-4 text-white">
                        <p className="text-[17px] font-bold">{c.typeLabel || CC_TYPES[c.type]?.label}</p>
                        <p className="mt-0.5 text-[15px] text-[#c9ccd4]">수락하면 카카오톡 오픈채팅으로 연결돼요</p>
                        <div className="mt-3 flex items-center justify-between border-t border-[#33343a] pt-3">
                            <span className="text-[15px] text-[#c9ccd4]">정산 예정액(수수료 10% 차감)</span>
                            <span className="text-[20px] font-bold">{won(Number(c.payout) || payoutOf(c.amount))}</span>
                        </div>
                    </section>
                    <Question c={c} title="후배의 사전 질문" />
                    <Block title="희망 일정 선택 · 택1 필수">
                        <fieldset>
                            <legend className="mb-2 text-[15px] text-sub">선배님이 참여 가능한 일정 1개를 고르고 수락해 주세요.</legend>
                            <div className="space-y-2">
                                {slots.map((s, i) => {
                                    const tooClose = Date.parse(s) < now + 60 * 60 * 1000;
                                    const id = `cc-slot-${chatId}-${i}`;
                                    return (
                                        <label key={id} htmlFor={id}
                                            className={`flex min-h-[60px] cursor-pointer items-center gap-3 border px-3 py-2 ${slot === i ? 'border-[#0c0c0e] bg-sky' : 'border-line bg-white'} ${tooClose ? 'opacity-50' : ''}`}>
                                            <input id={id} type="radio" name={`cc-slot-${chatId}`} checked={slot === i} disabled={tooClose || busy}
                                                onChange={() => { setSlot(i); setErr(''); }} className="h-5 w-5 shrink-0 accent-[#2d4fe0]" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-semibold text-royal">{i + 1}순위 희망</span>
                                                <span className="block truncate text-[16px] font-semibold text-ink">{slotLabel(s)}</span>
                                                {tooClose ? <span className="block text-[13px] text-sub">지났거나 너무 가까운 일정이에요</span> : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </Block>
                    {mode === 'decline' ? (
                        <div className="mt-4 border border-line bg-card p-4">
                            <label htmlFor={`cc-decline-${chatId}`} className="text-[15px] font-semibold text-ink">거절 사유(선택)</label>
                            <textarea id={`cc-decline-${chatId}`} value={reason} maxLength={200} rows={3} onChange={(e) => setReason(e.target.value)}
                                placeholder="예: 매장 공사 일정으로 기간 내 수락이 어려워요. 다음 기회에 봬요!"
                                className={`${ccInput} mt-2 min-h-[96px] py-3`} />
                            <p className="mt-1 text-[13px] text-sub">{reason.length}/200자 · 거절하면 후배의 결제 금액은 100% 자동 환불돼요. 아래 「거절 확정」을 눌러 주세요.</p>
                        </div>
                    ) : null}
                    <CcError>{err}</CcError>
                    {needContact ? (
                        <div className="mt-2"><button type="button" className={ccBtn.line} onClick={() => cc.open('register')}>프로필 고치기</button></div>
                    ) : null}
                </div>
            ) : null}

            {c && !seniorRequested ? (
                <div>
                    <div className="flex items-center justify-between gap-2">
                        <CcTag tone={st.tone}>{c.status === 'confirmed' ? '매칭 완료' : st.label}</CcTag>
                        <span className="text-[15px] text-sub">예약번호 #{String(c.id).slice(-6).toUpperCase()}</span>
                    </div>

                    {c.status === 'confirmed' ? (
                        <div className="mt-3"><CcNote title={isSeniorSide ? '커피챗이 확정되었어요' : '선배 사장님이 수락하셨어요!'}>약속된 시간에 맞춰 오픈채팅으로 대화를 시작해 주세요.</CcNote></div>
                    ) : null}
                    {c.status === 'requested' ? (
                        <div className="mt-3"><CcNote title="선배 수락 대기 중">선배가 24시간 안에 일정 1개를 골라 답해 드려요. 응답 마감까지 {remainText(c.respondBy, now)}</CcNote></div>
                    ) : null}
                    {c.status === 'completed' ? (
                        <div className="mt-3"><CcNote title="진행 완료">{slotLabel(c.chosenSlot)} 커피챗을 마쳤어요.</CcNote></div>
                    ) : null}
                    {['declined', 'expired', 'cancelled', 'payment_failed'].includes(c.status) ? (
                        <div className="mt-3">
                            <CcNote tone="alert" title={st.label}>
                                {c.status === 'declined' ? <span className="block">선배 남김 사유: {c.declineReason ? `“${c.declineReason}”` : '사유를 남기지 않았어요.'}</span> : null}
                                {c.status === 'expired' ? <span className="block">선배가 24시간 안에 답하지 않아 자동 취소됐어요.</span> : null}
                                {c.status === 'cancelled' ? <span className="block">{c.cancelledBy === 'senior' ? '선배 사정으로 취소됐어요.' : c.cancelledBy === 'admin' ? '운영진이 취소했어요.' : '후배가 신청을 취소했어요.'}{c.cancelReason ? ` 사유: ${c.cancelReason}` : ''}</span> : null}
                                {c.status === 'payment_failed' ? <span className="block">결제가 확인되지 않아 신청이 접수되지 않았어요.</span> : null}
                                <span className="mt-1 block font-semibold">{c.refunded ? `결제 금액(${won(c.refundAmount || c.amount)}) 100% 환불 완료` : c.paid ? '환불 처리 중이에요' : '결제되지 않은 신청이에요'}</span>
                            </CcNote>
                        </div>
                    ) : null}

                    <Block>
                        {isSeniorSide ? <JuniorBox c={c} /> : <SeniorBox c={c} />}
                        {c.status === 'confirmed' || c.status === 'completed' ? (
                            <div className="mt-4 bg-sky px-4 py-3">
                                <p className="text-[15px] text-sub">확정 일시</p>
                                <p className="mt-0.5 text-[19px] font-bold text-ink">{slotLabel(c.chosenSlot)}</p>
                                <p className="mt-1 text-[15px] text-royal">총 {minutesOf(c.type)}분 진행</p>
                            </div>
                        ) : null}
                        <div className="mt-3 space-y-0.5">
                            <Row label="진행 방식">{c.typeLabel || CC_TYPES[c.type]?.label}</Row>
                            <Row label="진행 시간">{minutesOf(c.type)}분</Row>
                            <Row label={c.paid ? '결제 완료 금액' : '결제 금액'}>{won(c.amount)}</Row>
                            {isSeniorSide ? <Row label="정산 예정액(수수료 10% 차감)">{won(Number(c.payout) || payoutOf(c.amount))}</Row> : null}
                        </div>
                    </Block>

                    {c.status === 'requested' ? (
                        <Block title="제안한 희망 일정">
                            <ol className="space-y-1.5">
                                {slots.map((s, i) => (
                                    <li key={s + i} className="flex min-h-[40px] items-center gap-3 bg-card px-3 text-[15px]">
                                        <CcTag tone="sky">{i + 1}순위 희망</CcTag>
                                        <span className="truncate font-semibold text-ink">{slotLabel(s)}</span>
                                    </li>
                                ))}
                            </ol>
                        </Block>
                    ) : null}

                    <Question c={c} title={isSeniorSide ? '후배의 사전 질문' : '내가 보낸 질문'} />

                    {c.status === 'confirmed' ? (
                        <>
                            <Block title="선배와 대화방 입장하기">
                                {/^https:\/\//.test(c.openChatUrl || '') ? (
                                    <a href={c.openChatUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex h-[52px] w-full items-center justify-center rounded-lg bg-[#FEE500] px-5 text-[16px] font-bold text-[#191919]">
                                        1:1 카카오톡 오픈채팅 시작하기
                                    </a>
                                ) : <p className="text-[15px] text-sub">오픈채팅 주소를 불러오지 못했어요. 운영진에게 문의해 주세요.</p>}
                                <p className="mt-2 text-[15px] text-sub">오픈채팅방에서 인사를 나누고 링크와 세부 안내를 전달받으세요.</p>
                            </Block>
                            <div className="mt-4">
                                <CcNote tone="alert" title="취소 및 환불 안내">커피챗 확정 후 약속 24시간 전까지 취소하면 100% 전액 환불돼요. 이후에는 멘토 노쇼 방지를 위해 취소·환불이 안 돼요.</CcNote>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2">
                                {calendarUrl(c, isSeniorSide) ? (
                                    <a href={calendarUrl(c, isSeniorSide)} target="_blank" rel="noopener noreferrer" className={ccBtn.line}>캘린더에 일정 등록</a>
                                ) : null}
                                {isSeniorSide && Number.isFinite(slotMs) && slotMs <= now ? (
                                    <button type="button" className={ccBtn.primary} onClick={complete} disabled={busy}>{busy ? '처리 중…' : '진행 완료로 표시'}</button>
                                ) : null}
                                {mode !== 'cancel' ? (
                                    isSeniorSide ? (
                                        <button type="button" className={ccBtn.line} onClick={() => { setMode('cancel'); setErr(''); }} disabled={busy}>선배 사정으로 취소(전액 환불)</button>
                                    ) : Number.isFinite(slotMs) && slotMs - now >= CANCEL_LIMIT_MS ? (
                                        <button type="button" className={ccBtn.line} onClick={() => { setMode('cancel'); setErr(''); }} disabled={busy}>신청 취소</button>
                                    ) : (
                                        <p className="text-[15px] text-sub">약속 24시간 전부터는 취소·환불이 안 돼요. 꼭 필요하면 선배와 오픈채팅으로 상의해 주세요.</p>
                                    )
                                ) : null}
                            </div>
                        </>
                    ) : null}

                    {c.status === 'requested' && !isSeniorSide && mode !== 'cancel' ? (
                        <div className="mt-4">
                            <button type="button" className={ccBtn.line} onClick={() => { setMode('cancel'); setErr(''); }} disabled={busy}>신청 취소(전액 환불)</button>
                        </div>
                    ) : null}

                    {mode === 'cancel' ? (
                        <Confirm busy={busy} okLabel="취소 확정" onOk={cancel} onCancel={() => { setMode(''); setErr(''); }}
                            text={isSeniorSide ? '선배 사정으로 이 커피챗을 취소할까요? 후배의 결제 금액은 전액 환불돼요.' : '신청을 취소할까요? 결제 금액은 전액 환불돼요.'}>
                            <label htmlFor={`cc-cancel-${chatId}`} className="mt-3 block text-[15px] font-semibold text-ink">취소 사유(선택)</label>
                            <input id={`cc-cancel-${chatId}`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={`${ccInput} mt-2 h-12`} />
                        </Confirm>
                    ) : null}

                    {c.status === 'completed' ? (
                        c.review ? (
                            <Block title={isSeniorSide ? '받은 후기' : '내가 남긴 후기'}>
                                <p className="text-[18px]"><Stars n={c.review.rating} /> <span className="text-[15px] font-semibold text-ink">{c.review.rating}점</span></p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{c.review.text}</p>
                                {c.review.tags?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{c.review.tags.map((t) => <CcTag key={t} tone="sky">{t}</CcTag>)}</div> : null}
                            </Block>
                        ) : !isSeniorSide ? (
                            <div className="mt-4">
                                <button type="button" className={ccBtn.royal} onClick={() => cc.open('review', { chatId })}>평점 남기기</button>
                            </div>
                        ) : <p className="mt-4 text-[15px] text-sub">후배가 아직 후기를 남기지 않았어요.</p>
                    ) : null}

                    <CcError>{err}</CcError>
                </div>
            ) : null}
        </CcModal>
    );
}
