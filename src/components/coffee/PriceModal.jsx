import React, { useEffect, useState } from 'react';
import coffeeChatService, { CC_TYPES, CC_PRICE_STEP, CC_UNLOCKED_MAX, won, payoutOf, priceMax, ratingOf, ratingAtLeast } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcNote, CcError, ccBtn } from './ui';

/** 커피챗 가격 설정 (창 이름 'prices') */

const CARDS = [
    ['online30', '30분 온라인 커피챗', '30분', '화상 또는 전화로 진행하는 압축 상담'],
    ['visit60', '60분 매장 방문 상담', '60분', '선배 매장 현장에서 직접 전수하는 노하우'],
];

const clamp = (v, min, max) => {
    const n = Math.round((Number(v) || 0) / CC_PRICE_STEP) * CC_PRICE_STEP;
    return Math.min(Math.max(n, min), max);
};

export default function PriceModal({ onClose, depth }) {
    const cc = useCoffeeChat();
    const senior = cc.mySenior;
    const [prices, setPrices] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (prices || !senior) return;
        const init = {};
        CARDS.forEach(([k]) => { init[k] = clamp(senior.prices?.[k] || CC_TYPES[k].recommended, CC_TYPES[k].min, priceMax(k, senior)); });
        setPrices(init);
    }, [senior, prices]);

    if (!cc.uid) return null;

    const done = Number(senior?.completedCount) || 0;
    const rating = ratingOf(senior);
    const unlocked = !!senior && priceMax('online30', senior) >= CC_UNLOCKED_MAX;

    const change = (k, v) => {
        setPrices((p) => ({ ...p, [k]: clamp(v, CC_TYPES[k].min, priceMax(k, senior)) }));
        setErr('');
    };
    const save = async () => {
        setBusy(true); setErr('');
        try {
            await coffeeChatService.updateSeniorFields(cc.uid, { prices: { online30: prices.online30, visit60: prices.visit60 } });
            onClose?.();
        } catch (x) {
            setErr(x?.message || '저장하지 못했어요.');
            setBusy(false);
        }
    };

    return (
        <CcModal title="커피챗 가격 설정" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth}
            footer={senior && prices ? <button type="button" className={ccBtn.primary} onClick={save} disabled={busy}>{busy ? '저장하는 중…' : '저장하기'}</button> : null}>
            {senior === undefined ? <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p> : null}
            {senior === null ? (
                <div className="space-y-3">
                    <CcNote>선배로 등록한 뒤 커피챗 가격을 정할 수 있어요.</CcNote>
                    <button type="button" className={ccBtn.line} onClick={() => cc.replace('register')}>선배로 등록하기</button>
                </div>
            ) : null}
            {senior && prices ? (
                <div>
                    <CcNote>선배 사장님의 소중한 경험과 시간 가치에 맞게 가격을 정해 주세요. 5,000원 단위로 바꿀 수 있어요.</CcNote>
                    {CARDS.map(([k, label, shortLabel, desc]) => {
                        const t = CC_TYPES[k];
                        const max = priceMax(k, senior);
                        const v = prices[k];
                        return (
                            <section key={k} aria-labelledby={`cc-price-h-${k}`} className="mt-4 border border-line p-4">
                                <h3 id={`cc-price-h-${k}`} className="text-[17px] font-bold text-ink">{label}</h3>
                                <p className="mt-0.5 text-[15px] text-sub">{desc}</p>
                                <div className="mt-3 bg-card px-3 py-4">
                                    <p className="text-center text-[30px] font-bold text-ink" aria-live="polite">{v.toLocaleString('ko-KR')}<span className="ml-1 text-[17px]">원</span></p>
                                    <div className="mt-3 flex items-center gap-3">
                                        <button type="button" aria-label={`${shortLabel} 가격 내리기`} onClick={() => change(k, v - CC_PRICE_STEP)} disabled={v <= t.min}
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-[24px] text-ink disabled:opacity-40">−</button>
                                        <input type="range" aria-label={`${shortLabel} 가격`} min={t.min} max={max} step={CC_PRICE_STEP} value={v}
                                            onChange={(e) => change(k, e.target.value)} className="h-11 min-w-0 flex-1 accent-[#2d4fe0]" />
                                        <button type="button" aria-label={`${shortLabel} 가격 올리기`} onClick={() => change(k, v + CC_PRICE_STEP)} disabled={v >= max}
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-[24px] text-ink disabled:opacity-40">+</button>
                                    </div>
                                    <div className="mt-2 grid grid-cols-3 text-[13px] text-sub">
                                        <span>최저 {won(t.min)}</span>
                                        <span className="text-center font-semibold text-royal">권장 {won(t.recommended)}</span>
                                        <span className="text-right">최대 {won(max)}</span>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2 border border-line px-3 py-3">
                                    <span className="text-[15px] text-sub">내가 받는 금액(수수료 10% 차감)</span>
                                    <span className="text-[18px] font-bold text-ink">{won(payoutOf(v))}</span>
                                </div>
                            </section>
                        );
                    })}

                    <section aria-labelledby="cc-price-unlock" className="mt-4 border border-line bg-sky p-4">
                        <h3 id="cc-price-unlock" className="text-[17px] font-bold text-ink">가격 상한 해금 조건</h3>
                        <p className="mt-0.5 text-[15px] text-[#1d2a55]">커피챗 10회 + 평점 4.5 달성 시 30분 커피챗도 최대 100,000원까지 정할 수 있어요.</p>
                        <div className="mt-3 bg-white px-3 py-3">
                            <div className="flex items-center justify-between text-[15px]">
                                <span className="font-semibold text-ink">커피챗 진행 횟수</span>
                                <span className="font-semibold text-royal">{Math.min(done, 10)} / 10회</span>
                            </div>
                            <div role="progressbar" aria-label="커피챗 진행 횟수" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(done, 10)} className="mt-2 h-2 w-full bg-[#dfe3ea]">
                                <div className="h-2 bg-royal" style={{ width: `${Math.min(done, 10) * 10}%` }} />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 text-[15px]">
                                <span className="text-ink">현재 평균 평점 {rating === null ? '-' : `${rating.toFixed(1)}점`}</span>
                                <CcTag tone={ratingAtLeast(senior, 4.5) ? 'ink' : 'muted'}>{ratingAtLeast(senior, 4.5) ? '평점 달성' : '평점 미달성'}</CcTag>
                            </div>
                            <p className="mt-2 text-[15px] font-semibold text-ink">{unlocked ? '조건 달성 — 30분 커피챗 상한이 100,000원으로 열렸어요.' : '아직 조건 전이에요. 두 조건을 모두 채우면 상한이 열려요.'}</p>
                        </div>
                    </section>
                    <CcError>{err}</CcError>
                </div>
            ) : null}
        </CcModal>
    );
}
