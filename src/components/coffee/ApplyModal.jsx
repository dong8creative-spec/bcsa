import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_TYPES, CC_STAGES, CC_INDUSTRIES, won, ratingOf, slotLabel } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcAvatar, CcNote, CcError, CcSegment, CcField, ccBtn, ccInput } from './ui';

const DAY = 24 * 60 * 60 * 1000;
const p2 = (n) => String(n).padStart(2, '0');
/** Date → datetime-local 값(내 시간대) */
const toLocalInput = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const STAGE_SHORT = { '창업 준비 중(예비)': '예비 창업', '창업 1년 미만': '1년 미만', '창업 1~3년': '1~3년' };
const PRICE_OK = (t, s) => {
    const v = Number(s?.prices?.[t]) || 0;
    return v >= CC_TYPES[t].min;
};

function SeniorSummary({ s }) {
    const r = ratingOf(s);
    return (
        <div className="bg-card px-4 py-4">
            <div className="flex items-center gap-3">
                <CcAvatar src={s.photoUrl} name={s.name} size={56} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold text-ink">{s.name} 선배</p>
                    <p className="truncate text-[14px] text-sub">{[s.bizName, s.area, s.years ? `${s.years}년차` : ''].filter(Boolean).join(' · ')}</p>
                    <p className="text-[14px] text-ink">
                        <span aria-hidden="true" className="text-royal">★</span> 평점 {r !== null ? r.toFixed(1) : '-'}
                        <span className="text-sub"> · 후기 {Number(s.ratingCount) || 0}개 · 완료 {Number(s.completedCount) || 0}회</span>
                    </p>
                </div>
            </div>
            {(s.topics || []).length ? <div className="mt-2.5 flex flex-wrap gap-1.5">{s.topics.map((t) => <CcTag key={t}>#{t}</CcTag>)}</div> : null}
        </div>
    );
}

function Heading({ children, aside, id }) {
    return (
        <div className="mb-2.5 mt-7 flex items-end justify-between gap-2">
            <h3 id={id} className="text-[17px] font-semibold text-ink">{children}</h3>
            {aside ? <span className="text-[13px] text-sub">{aside}</span> : null}
        </div>
    );
}

/** 단계별 안내 — 신청서 / 신청 완료 따로. 머리줄 「단계별 안내」 버튼, 처음 한 번 자동 */
const TOUR_FORM = {
    id: 'apply-form',
    steps: [
        { title: '커피챗 신청서', body: '방식과 희망 일정 3개, 내 상황과 질문을 쓰고 결제하면 신청이 끝나요. 선배가 24시간 안에 답해요.\n답을 기다리는 신청은 3건까지 낼 수 있어요.' },
        { target: 'apply-type', title: '미팅 방식 고르기', body: '30분 비대면(오픈채팅 보이스톡·화상)과 60분 매장 방문 중 하나를 고르세요. 오른쪽 숫자가 가격이에요.' },
        { target: 'apply-slots', title: '희망 일정 3개', body: '서로 다른 날짜·시간 3개를 고르세요. 지금부터 48시간 뒤~60일 안에서 고를 수 있고, 선배가 이 중 1개를 골라요.' },
        { target: 'apply-stage', title: '내 상황 알려 주기', body: '준비 단계는 꼭 골라 주세요. 희망 업종과 타깃 상권도 적으면 선배가 미리 보고 준비해요.' },
        { target: 'apply-question', title: '미리 묻고 싶은 내용', body: '10~300자로 지금 상황과 꼭 듣고 싶은 조언을 써 주세요. 구체적일수록 답이 알차져요.' },
        { target: 'apply-note', title: '환불 규칙', body: '거절되거나 24시간 안에 답이 없으면 전액 환불돼요. 확정 전엔 언제든, 확정 후엔 약속 24시간 전까지 취소해도 전액 환불이에요.' },
        { target: 'apply-submit', title: '신청하고 결제하기', body: '누르면 결제창이 열려요. 결제가 끝나면 신청이 선배에게 전달되고 「신청 완료」 화면이 나와요.' },
    ],
};
const TOUR_DONE = {
    id: 'apply-done',
    steps: [
        { title: '신청이 끝났어요', body: '결제까지 마쳐 신청이 선배에게 전달됐어요. 이제 선배의 답을 기다리면 돼요.' },
        { target: 'done-status', title: '지금 상태', body: '「선배 수락 대기 중」이에요. 선배가 24시간 안에 내 일정 중 1개를 골라 수락하면 확정돼요.' },
        { target: 'done-slots', title: '내가 낸 후보 일정', body: '보낸 일정 3개예요. 선배가 이 중 하나를 고르면 그 시간으로 약속이 잡혀요.' },
        { target: 'done-note', title: '거절되거나 답이 없으면', body: '선배가 거절하거나 24시간 안에 답하지 않으면 결제 금액은 자동으로 전액 환불돼요.' },
        { target: 'done-center', title: '다음에 할 일', body: '「신청 내역 확인하기」에서 진행 상황을 볼 수 있어요. 확정되면 그곳에 카카오 오픈채팅 주소가 나타나요.' },
    ],
};

/** 커피챗 신청서 → 결제 → 신청 완료 — 창 이름 'apply' {seniorUid, postId?} */
export default function ApplyModal({ seniorUid, postId, onClose, depth }) {
    const cc = useCoffeeChat();
    const [s, setS] = useState(undefined);
    const [type, setType] = useState('');
    const [slots, setSlots] = useState(['', '', '']);
    const [stage, setStage] = useState('');
    const [industry, setIndustry] = useState('');
    const [area, setArea] = useState('');
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(null);

    // 로그인 안 했으면 로그인 창을 띄우고 이 창은 닫는다
    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => (seniorUid && cc.uid ? coffeeChatService.subscribeSenior(seniorUid, setS) : (setS(null), undefined)), [seniorUid, cc.uid]);

    const accepting = s?.accepting !== false;
    const available = (t) => !!s && accepting && PRICE_OK(t, s);
    // 처음 고를 진행 방식: 받을 수 있는 첫 방식
    useEffect(() => {
        if (!s || type) return;
        const first = ['online30', 'visit60'].find((t) => available(t));
        if (first) setType(first);
    }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

    const bounds = useMemo(() => {
        const now = Date.now();
        // 분 단위 올림(서버는 신청 시점 기준 48시간 뒤부터 받는다)
        const min = new Date(Math.ceil((now + 2 * DAY + 60 * 1000) / 60000) * 60000); // 선배 응답 24시간 + 확정 뒤 취소 가능 24시간
        const max = new Date(now + 60 * DAY);
        return { min: toLocalInput(min), max: toLocalInput(max) };
    }, []);

    const price = type ? Number(s?.prices?.[type]) || 0 : 0;
    const qLen = question.trim().length;

    const validate = () => {
        if (!type || !available(type)) return '미팅 방식을 골라 주세요.';
        if (slots.some((v) => !v)) return '희망 일정 1·2·3지망을 모두 골라 주세요.';
        const ms = slots.map((v) => new Date(v).getTime());
        if (ms.some((m) => !Number.isFinite(m))) return '희망 일정을 다시 골라 주세요.';
        if (new Set(ms).size !== 3) return '1·2·3지망 일정은 서로 달라야 해요.';
        const now = Date.now();
        if (ms.some((m) => m < now + 2 * DAY)) return '희망 일정은 지금부터 48시간 뒤부터 고를 수 있어요. (선배가 24시간 안에 답해요)';
        if (ms.some((m) => m > now + 60 * DAY)) return '희망 일정은 60일 안으로 골라 주세요.';
        if (!stage) return '내 상황의 「준비 단계」를 골라 주세요. 선배가 미리 보고 준비해요.';
        if (qLen < 10) return '선배 사장님께 묻고 싶은 내용을 10자 이상 써 주세요.';
        if (qLen > 300) return '묻고 싶은 내용은 300자까지 쓸 수 있어요.';
        return '';
    };

    const submit = async () => {
        if (busy) return;
        if (!cc.requireLogin()) return;
        const v = validate();
        if (v) { setErr(v); return; }
        setBusy(true); setErr('');
        const isoSlots = slots.map((x) => new Date(x).toISOString());
        try {
            const res = await coffeeChatService.request({
                seniorUid, type, slots: isoSlots, question: question.trim(), postId: postId || '',
                junior: { stage, industry, area: area.trim() },
            });
            const u = cc.currentUser || {};
            const r = await coffeeChatService.pay({
                chatId: res.chatId,
                amount: res.amount,
                orderName: res.orderName,
                customer: { fullName: u.name, phoneNumber: u.phone || u.phoneNumber, email: u.email },
            });
            if (r?.redirected) return; // 결제창 주소로 넘어간다(돌아오면 결제 확인 창이 이어서 연다)
            if (r?.ok) {
                setDone({ chatId: res.chatId, amount: res.amount, type, slots: isoSlots });
            } else {
                // 결제 대기 신청은 서버가 1시간 뒤 정리한다
                setErr(r?.error || '결제를 마치지 못했어요. 다시 시도해 주세요.');
            }
        } catch (e) {
            setErr(e?.message || '신청하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
        setBusy(false);
    };

    if (!cc.uid) return null;

    // ── 신청 완료 ──
    if (done) {
        return (
            <CcModal title="신청 완료" onClose={onClose} depth={depth} tour={TOUR_DONE}
                footer={(
                    <div className="grid gap-2">
                        <button type="button" data-tour="done-center" className={ccBtn.primary} onClick={() => cc.replace('center', { tab: 'mine' })}>신청 내역 확인하기</button>
                        <button type="button" className={ccBtn.line} onClick={() => { cc.closeAll(); cc.open('hub'); }}>노하우 더 보기</button>
                    </div>
                )}><div className="w-0 min-w-full">
                <div data-tour="done-status" className="mb-5 text-center">
                    <CcTag tone="royal">선배 수락 대기 중</CcTag>
                    <p className="mt-2.5 text-[16px] text-ink">선배 사장님이 일정을 살펴보고 있어요.</p>
                </div>
                {s ? <SeniorSummary s={s} /> : null}
                <dl className="mt-4 divide-y divide-line border-y border-line">
                    <div className="flex items-center justify-between gap-3 py-3">
                        <dt className="text-[15px] text-sub">진행 방식</dt>
                        <dd className="text-right text-[15px] font-semibold text-ink">{CC_TYPES[done.type]?.label}</dd>
                    </div>
                    <div data-tour="done-slots" className="py-3">
                        <dt className="text-[15px] text-sub">제안한 후보 일정 (3개)</dt>
                        <dd>
                            <ol className="mt-2 space-y-1.5">
                                {done.slots.map((x, i) => (
                                    <li key={x} className="flex items-center gap-2 bg-card px-3 py-2.5">
                                        <CcTag tone={i === 0 ? 'royal' : 'sky'}>{i + 1}순위</CcTag>
                                        <span className="text-[15px] text-ink">{slotLabel(x)}</span>
                                    </li>
                                ))}
                            </ol>
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-3">
                        <dt className="text-[15px] text-sub">결제 금액</dt>
                        <dd className="text-[20px] font-bold text-ink">{won(done.amount)}</dd>
                    </div>
                </dl>
                <div data-tour="done-note" className="mt-4">
                    <CcNote title="안내">선배가 24시간 안에 일정을 골라 수락하면 확정돼요. 거절하거나 답이 없으면 결제는 자동으로 전액 환불돼요.</CcNote>
                </div>
            </div></CcModal>
        );
    }

    const self = cc.uid === seniorUid;
    const canForm = s && s.status === 'approved' && !self;
    const setSlot = (i, v) => setSlots((arr) => arr.map((x, j) => (j === i ? v : x)));
    const dupIdx = (i) => slots[i] && slots.some((x, j) => j !== i && x === slots[i]);

    return (
        <CcModal title="커피챗 신청서" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} tour={canForm ? TOUR_FORM : undefined}
            footer={canForm ? (
                <>
                    <CcError>{err}</CcError>
                    <button type="button" data-tour="apply-submit" className={`${ccBtn.royal} ${err ? 'mt-2.5' : ''}`} onClick={submit} disabled={busy || !accepting || !type}>
                        {busy ? '신청하는 중…' : `커피챗 신청하기 (${won(price)})`}
                    </button>
                </>
            ) : null}><div className="w-0 min-w-full">
            {s === undefined ? <p className="py-10 text-center text-[15px] text-sub" role="status">불러오는 중…</p> : null}
            {s !== undefined && self ? <CcNote>나에게는 커피챗을 신청할 수 없어요.</CcNote> : null}
            {s !== undefined && !self && (!s || s.status !== 'approved') ? <CcNote>지금 신청할 수 없는 선배예요.</CcNote> : null}

            {canForm ? (
                <div>
                    <SeniorSummary s={s} />
                    {!accepting ? <div className="mt-3"><CcNote tone="alert">선배가 지금은 신청을 받지 않고 있어요.</CcNote></div> : null}

                    <Heading id="cc-apply-type">미팅 방식 선택</Heading>
                    <div data-tour="apply-type" role="radiogroup" aria-labelledby="cc-apply-type" className="grid gap-2">
                        {['online30', 'visit60'].map((t) => {
                            const ok = available(t);
                            const on = type === t;
                            return (
                                <label key={t} htmlFor={`cc-apply-type-${t}`}
                                    className={`flex min-h-[72px] items-center gap-3 rounded-lg border px-4 py-3 ${on ? 'border-royal bg-sky' : 'border-line2 bg-white'} ${ok ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                    <input id={`cc-apply-type-${t}`} type="radio" name="cc-apply-type" value={t} checked={on} disabled={!ok}
                                        onChange={() => setType(t)} className="h-5 w-5 shrink-0 accent-[#2d4fe0]" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[16px] font-semibold text-ink">{CC_TYPES[t].label}</span>
                                        <span className="block truncate text-[14px] text-sub">{ok ? CC_TYPES[t].desc : '지금은 받지 않아요'}</span>
                                    </span>
                                    <span className="shrink-0 text-[17px] font-bold text-ink">{s.prices?.[t] ? won(s.prices[t]) : '-'}</span>
                                </label>
                            );
                        })}
                    </div>

                    <Heading aside="필수 3지망 · 48시간 뒤부터 60일 안">희망 미팅 일정</Heading>
                    <div data-tour="apply-slots" className="grid gap-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${dupIdx(i) ? 'border-red-300' : 'border-line2'}`}>
                                <label htmlFor={`cc-apply-slot-${i}`} className="w-12 shrink-0 text-[15px] font-semibold text-ink">{i + 1}지망</label>
                                <input id={`cc-apply-slot-${i}`} type="datetime-local" required min={bounds.min} max={bounds.max}
                                    value={slots[i]} onChange={(e) => setSlot(i, e.target.value)}
                                    aria-invalid={dupIdx(i) ? true : undefined}
                                    className={`${ccInput} h-12 min-w-0 flex-1`} />
                            </div>
                        ))}
                    </div>
                    {slots.some((_, i) => dupIdx(i)) ? <p className="mt-2 text-[14px] text-red-600" role="alert">1·2·3지망 일정은 서로 달라야 해요.</p> : null}
                    <p className="mt-2 text-[13px] text-sub">선배가 이 가운데 1개를 골라 수락해요.</p>

                    <Heading aside="선배가 미리 보고 준비해요">내 상황</Heading>
                    <div data-tour="apply-stage" className="mb-5">
                        <p className="mb-2 text-[15px] font-semibold text-ink">준비 단계<span className="ml-0.5 text-red-600">*</span></p>
                        <CcSegment label="준비 단계" cols={3} value={stage} onChange={setStage} items={CC_STAGES.map((v) => [v, STAGE_SHORT[v] || v])} />
                    </div>
                    <div className="mb-5">
                        <p className="mb-2 text-[15px] font-semibold text-ink">희망 업종</p>
                        <CcSegment label="희망 업종" cols={3} value={industry} onChange={setIndustry} items={CC_INDUSTRIES.map((v) => [v, v])} />
                    </div>
                    <CcField label="타깃 상권" htmlFor="cc-apply-area">
                        <input id="cc-apply-area" className={`${ccInput} h-12`} maxLength={40} placeholder="예: 수영구 광안리 해변 뒷골목" value={area} onChange={(e) => setArea(e.target.value)} />
                    </CcField>

                    <div className="mb-2 mt-7 flex items-end justify-between gap-2">
                        <h3 className="text-[17px] font-semibold text-ink">
                            <label htmlFor="cc-apply-question">선배 사장님께 미리 묻고 싶은 내용</label>
                            <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
                        </h3>
                        <span className={`text-[13px] ${qLen > 300 ? 'text-red-600' : 'text-sub'}`} aria-live="polite">{qLen}/300자</span>
                    </div>
                    <textarea id="cc-apply-question" data-tour="apply-question" required rows={5} maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)}
                        placeholder="지금 상황과 꼭 듣고 싶은 조언을 구체적으로 써 주세요. (10자 이상)"
                        className={`${ccInput} min-h-[132px] resize-y py-3 leading-[1.6]`} />
                    <p className="mt-1.5 text-[13px] text-sub">구체적일수록 답변이 알차져요.</p>

                    <div data-tour="apply-note" className="mt-6">
                        <CcNote title="안심 매칭 안내">선배가 24시간 안에 일정을 골라 수락하면 확정돼요. 거절하거나 답이 없으면 결제는 자동으로 전액 환불돼요. 확정 후에는 약속 24시간 전까지 취소하면 전액 환불돼요.</CcNote>
                    </div>
                </div>
            ) : null}
        </div></CcModal>
    );
}
