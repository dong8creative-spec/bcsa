import React, { useEffect, useState } from 'react';
import coffeeChatService, { CC_REVIEW_TAGS, CC_TYPES, slotLabel } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcChip, CcField, CcNote, CcError, CcAvatar, ccBtn, ccInput } from './ui';

/** 커피챗 후기·평점 (창 이름 'review', 받는 값 {chatId}) */

const PHRASE = {
    5: '사업 방향 설정에 큰 도움이 되었어요',
    4: '실질적인 도움이 많이 되었어요',
    3: '무난하고 괜찮았어요',
    2: '조금 아쉬움이 남았어요',
    1: '기대에 많이 못 미쳤어요',
};

export default function ReviewModal({ chatId, onClose, depth }) {
    const cc = useCoffeeChat();
    const [mine, setMine] = useState(null);
    const [rating, setRating] = useState(0);
    const [text, setText] = useState('');
    const [tags, setTags] = useState([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => (cc.uid ? coffeeChatService.subscribeMyRequests(cc.uid, setMine) : undefined), [cc.uid]);

    if (!cc.uid) return null;

    const c = (mine || []).find((x) => x.id === chatId) || null;
    const len = text.trim().length;
    const canWrite = !!c && c.status === 'completed' && !c.review;

    const toggleTag = (t) => setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));
    const submit = async () => {
        if (!rating) { setErr('별점을 골라 주세요.'); return; }
        if (len < 10) { setErr('한 줄 후기를 10자 이상 써 주세요.'); return; }
        setBusy(true); setErr('');
        try {
            await coffeeChatService.review(chatId, { rating, text: text.trim(), tags });
            onClose?.();
        } catch (e) {
            setErr(e?.message || '후기를 등록하지 못했어요.');
            setBusy(false);
        }
    };

    return (
        <CcModal title="커피챗 후기 남기기" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth}
            footer={canWrite ? <button type="button" className={ccBtn.royal} onClick={submit} disabled={busy}>{busy ? '등록하는 중…' : '평점 등록하기'}</button> : null}>
            {mine === null ? <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p> : null}
            {mine !== null && !c ? <CcNote tone="alert">후기를 남길 신청을 찾을 수 없어요. 내가 신청한 커피챗에만 후기를 남길 수 있어요.</CcNote> : null}
            {c && c.review ? <CcNote>이미 후기를 남겼어요. 소중한 의견 감사해요.</CcNote> : null}
            {c && !c.review && c.status !== 'completed' ? <CcNote tone="alert">진행 완료된 커피챗에만 후기를 남길 수 있어요.</CcNote> : null}

            {canWrite ? (
                <div>
                    <section className="border border-line bg-white p-4">
                        <div className="flex items-center gap-3">
                            <CcAvatar src={c.seniorPhoto} name={c.seniorName} size={56} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <CcTag tone="muted">진행 완료</CcTag>
                                    <span className="truncate text-[13px] text-sub">{c.seniorArea}</span>
                                </div>
                                <p className="mt-0.5 truncate text-[17px] font-semibold text-ink">{c.seniorName} 선배</p>
                                <p className="truncate text-[15px] text-sub">{c.seniorBiz}</p>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1 bg-card px-3 py-3 text-[15px]">
                            <p className="truncate text-ink">{slotLabel(c.chosenSlot)} 진행 완료 · {CC_TYPES[c.type]?.short || c.typeLabel}</p>
                            <p className="line-clamp-1 text-sub">{c.question}</p>
                        </div>
                    </section>

                    <section className="mt-4 border border-line bg-white p-4 text-center">
                        <h3 className="text-[17px] font-bold text-ink">선배 사장님과의 커피챗은 어떠셨나요?</h3>
                        <p className="mt-1 text-[15px] text-sub">경험을 바탕으로 솔직한 만족도를 남겨 주세요</p>
                        <div role="group" aria-label="별점" className="mt-3 flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" aria-label={`별점 ${n}점`} aria-pressed={rating === n} onClick={() => { setRating(n); setErr(''); }}
                                    className={`flex h-11 w-11 items-center justify-center text-[32px] leading-none ${n <= rating ? 'text-royal' : 'text-[#cfd3da]'}`}>
                                    ★
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 min-h-[24px] text-[15px] font-semibold text-ink" aria-live="polite">
                            {rating ? `${rating}.0 – ${PHRASE[rating]}` : '별을 눌러 점수를 골라 주세요'}
                        </p>
                    </section>

                    <section className="mt-4 border border-line bg-white p-4">
                        <h3 className="mb-3 text-[17px] font-bold text-ink">한 줄 후기 작성</h3>
                        <CcField label="한 줄 후기" required htmlFor={`cc-review-text-${chatId}`} counter={`${text.length}/200자`} hint="10자 이상 써 주세요.">
                            <textarea id={`cc-review-text-${chatId}`} value={text} maxLength={200} rows={4} onChange={(e) => { setText(e.target.value); setErr(''); }}
                                placeholder="선배와의 대화에서 무엇이 도움이 되었는지 적어 주세요."
                                className={`${ccInput} min-h-[112px] py-3 leading-relaxed`} />
                        </CcField>
                        <p className="mb-2 text-[15px] font-semibold text-ink">어떤 점이 가장 유익했나요? (복수 선택)</p>
                        <div className="flex flex-wrap gap-2">
                            {CC_REVIEW_TAGS.map((t) => <CcChip key={t} on={tags.includes(t)} onClick={() => toggleTag(t)}>#{t}</CcChip>)}
                        </div>
                    </section>

                    <div className="mt-4"><CcNote>남겨주신 후기는 선배 프로필에 등록돼요(이름은 가려져요). 다른 후배 창업자들에게 큰 길잡이가 됩니다.</CcNote></div>
                    <CcError>{err}</CcError>
                </div>
            ) : null}
        </CcModal>
    );
}
