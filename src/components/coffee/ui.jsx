import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ModalPortal from '../ModalPortal';

/**
 * 커피챗 창 공통 부품 — 「먼저가본」 개편 결(검정·흰색·하늘 #e8f1fd·로얄블루 #2d4fe0, Presentation 글꼴).
 * 휴대폰: 아래에서 올라오는 판(높이 꽉), PC: 가운데 판(폭 560). 그림자·그라데이션 없음.
 */
/**
 * 창 하나에 단계별 안내(툴팁)를 붙인다.
 *  tour = { id: '창 이름(처음 한 번 자동으로 보여 줄 때 기억하는 키)', steps: [{ target: 'data-tour 값', title, body }] }
 *  화면 안에서 data-tour="값" 을 단 요소를 차례로 비추고 옆에 설명 말풍선을 띄운다. 지금 화면에 없는 단계(조건부 버튼 등)는 건너뛴다.
 *  처음 여는 창이면 한 번 자동으로 시작하고, 머리줄 「단계별 안내」 버튼으로 언제든 다시 본다.
 */
export function CcModal({ title, onClose, onBack, depth = 0, children, footer, wide = false, labelId, tour }) {
    const ref = useRef(null);
    const [touring, setTouring] = useState(false);
    const hasTour = !!(tour && tour.steps && tour.steps.length);
    useEffect(() => {
        if (!hasTour || !tour.id) return undefined;
        let seen = true;
        try { seen = localStorage.getItem(`cc_tour_${tour.id}`) === '1'; } catch (_) { seen = true; }
        if (seen) return undefined;
        const t = setTimeout(() => setTouring(true), 700); // 창 내용이 그려진 뒤 시작
        return () => clearTimeout(t);
    }, [hasTour, tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const endTour = useCallback(() => {
        setTouring(false);
        try { if (tour?.id) localStorage.setItem(`cc_tour_${tour.id}`, '1'); } catch (_) { /* 기억 못 해도 동작엔 지장 없음 */ }
    }, [tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        // 겹친 창마다 키를 듣기 때문에, 화면 맨 위(마지막) 창만 닫는다
        const onKey = (e) => {
            if (e.key !== 'Escape' || touring) return; // 안내 중이면 ESC 는 안내만 닫는다(CcTour 가 처리)
            const all = document.querySelectorAll('[role="dialog"]');
            if (all[all.length - 1] === ref.current) onClose?.();
        };
        window.addEventListener('keydown', onKey);
        ref.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, touring]);
    const id = labelId || `cc-title-${depth}`;
    return (
        <ModalPortal>
            <div className="fixed inset-0 flex items-end justify-center bg-black/50 md:items-center md:p-6" style={{ zIndex: 1200 + depth }}
                onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
                <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id}
                    className={`flex max-h-[100dvh] w-full min-w-0 flex-col bg-white outline-none md:max-h-[90vh] md:rounded-[18px] ${wide ? 'md:max-w-[760px]' : 'md:max-w-[560px]'} h-[100dvh] md:h-auto`}>
                    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:h-16 md:px-5">
                        {onBack ? <button type="button" onClick={onBack} aria-label="뒤로" className="flex h-11 w-11 items-center justify-center text-[22px] text-ink">←</button> : null}
                        <h2 id={id} className="min-w-0 flex-1 truncate text-[18px] font-bold text-ink md:text-[20px]">{title}</h2>
                        {hasTour ? (
                            <button type="button" onClick={() => setTouring(true)} aria-label="이 화면 단계별 안내 보기"
                                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-line2 px-2.5 text-[14px] font-semibold text-royal">
                                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-royal text-[12px] font-bold text-white">?</span>
                                <span className="hidden sm:inline">단계별 안내</span><span className="sm:hidden">안내</span>
                            </button>
                        ) : null}
                        <button type="button" onClick={onClose} aria-label="닫기" className="flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink">×</button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">{children}</div>
                    {footer ? <div className="shrink-0 border-t border-line bg-white px-4 py-3 md:px-6" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>{footer}</div> : null}
                </div>
            </div>
            {touring && hasTour ? <CcTour root={ref} steps={tour.steps} onEnd={endTour} zIndex={1200 + depth + 1} /> : null}
        </ModalPortal>
    );
}

/** 단계별 안내: 대상 요소를 비추고(주변 어둡게) 말풍선으로 설명. 이전·다음·그만 보기, 키보드 ←/→/Esc */
export function CcTour({ root, steps, onEnd, zIndex = 1300 }) {
    const [list, setList] = useState([]);
    const [i, setI] = useState(0);
    const [rect, setRect] = useState(null);
    const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
    const bubbleRef = useRef(null);
    const [bh, setBh] = useState(180);
    const find = useCallback((st) => root.current?.querySelector(`[data-tour="${st.target}"]`), [root]);

    // 지금 화면에 있는 단계만 추린다(조건부 버튼은 없으면 건너뜀). 대상이 없는 「소개」 단계(target 없음)는 가운데에 띄운다
    useEffect(() => {
        const l = steps.filter((st) => !st.target || find(st));
        if (!l.length) { onEnd(); return; }
        setList(l); setI(0);
    }, [steps, find]); // eslint-disable-line react-hooks/exhaustive-deps

    const measure = useCallback(() => {
        setVw(window.innerWidth); setVh(window.innerHeight);
        const st = list[i];
        const el = st && st.target ? find(st) : null;
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [list, i, find]);

    useEffect(() => {
        const st = list[i];
        const el = st && st.target ? find(st) : null;
        if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
        const t = setTimeout(measure, 60);
        return () => clearTimeout(t);
    }, [list, i, find, measure]);
    useEffect(() => {
        const on = () => measure();
        window.addEventListener('resize', on);
        const body = root.current?.querySelector('.overflow-y-auto');
        body?.addEventListener('scroll', on, { passive: true });
        return () => { window.removeEventListener('resize', on); body?.removeEventListener('scroll', on); };
    }, [measure, root]);
    useLayoutEffect(() => { if (bubbleRef.current) setBh(bubbleRef.current.offsetHeight); }, [i, list, rect]);

    const last = i >= list.length - 1;
    const next = useCallback(() => (last ? onEnd() : setI((x) => x + 1)), [last, onEnd]);
    const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); onEnd(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [next, prev, onEnd]);

    const st = list[i];
    if (!st) return null;
    const pad = 6;
    const W = Math.min(340, vw - 24);
    let bTop; let bLeft; let arrow = null;
    if (rect) {
        const below = rect.top + rect.height + pad + 12;
        const fitsBelow = below + bh < vh - 8;
        bTop = fitsBelow ? below : Math.max(8, rect.top - pad - 12 - bh);
        bLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12);
        const ax = Math.min(Math.max(rect.left + rect.width / 2, bLeft + 18), bLeft + W - 18);
        arrow = { left: ax - bLeft - 8, top: fitsBelow ? -8 : bh - 8, rot: fitsBelow ? 'rotate(45deg)' : 'rotate(225deg)' };
    } else {
        bTop = Math.max(12, vh / 2 - bh / 2); bLeft = vw / 2 - W / 2;
    }
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex }} aria-live="polite">
            {/* 클릭은 막고(안내 중 실수로 누르는 것 방지), 비춘 곳 주변만 어둡게 */}
            <div style={{ position: 'fixed', inset: 0 }} onMouseDown={(e) => e.preventDefault()} />
            {rect ? (
                <div aria-hidden="true" style={{
                    position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
                    borderRadius: 10, outline: '3px solid #2d4fe0', boxShadow: '0 0 0 9999px rgba(12,12,14,.55)', pointerEvents: 'none', transition: 'all .2s ease',
                }} />
            ) : <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(12,12,14,.55)' }} />}
            <div ref={bubbleRef} role="dialog" aria-modal="true" aria-label={`단계별 안내 ${i + 1}/${list.length}: ${st.title}`} data-cc-tour="bubble"
                style={{ position: 'fixed', top: bTop, left: bLeft, width: W, transition: 'top .2s ease, left .2s ease' }}
                className="rounded-xl border border-[#0c0c0e] bg-white px-4 pb-3 pt-3.5 text-ink">
                {arrow ? <span aria-hidden="true" style={{ position: 'absolute', left: arrow.left, top: arrow.top, width: 16, height: 16, background: '#fff', borderLeft: '1px solid #0c0c0e', borderTop: '1px solid #0c0c0e', transform: arrow.rot }} /> : null}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-royal">{i + 1} / {list.length} 단계</span>
                    <button type="button" onClick={onEnd} className="h-8 px-1 text-[13px] text-sub underline underline-offset-2">그만 보기</button>
                </div>
                <p className="text-[17px] font-bold leading-snug">{st.title}</p>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-[#333]">{st.body}</p>
                <div className="mt-3 flex gap-2">
                    <button type="button" onClick={prev} disabled={i === 0} className="h-11 flex-1 rounded-lg border border-line2 text-[15px] font-semibold disabled:opacity-30">이전</button>
                    <button type="button" onClick={next} autoFocus className="h-11 flex-[2] rounded-lg bg-[#0c0c0e] text-[15px] font-bold text-white">{last ? '안내 끝' : '다음 →'}</button>
                </div>
            </div>
        </div>
    );
}

export const ccBtn = {
    primary: 'inline-flex h-[52px] w-full items-center justify-center rounded-lg bg-[#0c0c0e] px-5 text-[16px] font-bold text-white disabled:opacity-40',
    royal: 'inline-flex h-[52px] w-full items-center justify-center rounded-lg bg-royal px-5 text-[16px] font-bold text-white disabled:opacity-40',
    line: 'inline-flex h-[52px] w-full items-center justify-center rounded-lg border border-line2 bg-white px-5 text-[16px] font-semibold text-ink disabled:opacity-40',
    small: 'inline-flex h-11 items-center justify-center rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink disabled:opacity-40',
    smallDark: 'inline-flex h-11 items-center justify-center rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white disabled:opacity-40',
    danger: 'inline-flex h-11 items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-[15px] font-semibold text-red-600 disabled:opacity-40',
};
export const ccInput = 'w-full rounded-lg border border-line2 bg-white px-3.5 text-[16px] text-ink placeholder:text-[#9a9a9a] focus:border-royal focus:outline-none';

/** 작은 네모 표시. tone: royal | ink | muted | alert | sky */
export function CcTag({ tone = 'sky', children, className = '' }) {
    const t = {
        royal: 'bg-royal text-white', ink: 'bg-[#0c0c0e] text-white', muted: 'bg-[#e9e9e9] text-[#555]',
        alert: 'bg-red-50 text-red-600 border border-red-200', sky: 'bg-sky text-royal',
    }[tone] || '';
    return <span className={`inline-flex h-6 shrink-0 items-center px-2 text-[12.5px] font-semibold ${t} ${className}`}>{children}</span>;
}

/** 선택 칩(여러 개 고르기). 운영 규칙상 작은 칩만 rounded-full 허용 */
export function CcChip({ on, onClick, children, disabled }) {
    return (
        <button type="button" aria-pressed={!!on} onClick={onClick} disabled={disabled}
            className={`inline-flex h-11 items-center rounded-full border px-4 text-[15px] ${on ? 'border-[#0c0c0e] bg-[#0c0c0e] font-semibold text-white' : 'border-line2 bg-white text-ink'} disabled:opacity-40`}>
            {children}
        </button>
    );
}

/** 칸 나눔 선택(같은 너비·높이 칸). items: [[value,label]] */
export function CcSegment({ items, value, onChange, cols, label }) {
    return (
        <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols || items.length}, minmax(0,1fr))` }}>
            {items.map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
                    className={`h-12 truncate rounded-lg border px-2 text-[15px] ${value === v ? 'border-[#0c0c0e] bg-[#0c0c0e] font-semibold text-white' : 'border-line2 bg-white text-ink'}`}>{l}</button>
            ))}
        </div>
    );
}

export function CcField({ label, required, hint, counter, children, htmlFor }) {
    return (
        <div className="mb-5">
            <div className="mb-2 flex items-end justify-between gap-2">
                <label htmlFor={htmlFor} className="text-[15px] font-semibold text-ink">{label}{required ? <span className="ml-0.5 text-red-600">*</span> : null}</label>
                {counter ? <span className="text-[13px] text-sub">{counter}</span> : null}
            </div>
            {children}
            {hint ? <p className="mt-1.5 text-[13px] leading-relaxed text-sub">{hint}</p> : null}
        </div>
    );
}

/** 안내 칸(하늘 바탕) */
export function CcNote({ title, children, tone = 'sky' }) {
    return (
        <div className={`rounded-xl px-4 py-3.5 text-[14px] leading-relaxed ${tone === 'alert' ? 'bg-red-50 text-red-700' : 'bg-sky text-[#1d2a55]'}`}>
            {title ? <p className="mb-1 font-bold">{title}</p> : null}
            {children}
        </div>
    );
}

export function CcError({ children }) {
    return children ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3.5 py-3 text-[14px] text-red-700">{children}</p> : null;
}

/** 선배 사진(없으면 이름 첫 글자) */
export function CcAvatar({ src, name, size = 56 }) {
    return src ? (
        <img src={src} alt="" className="shrink-0 border border-line object-cover" style={{ width: size, height: size }} />
    ) : (
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center bg-sky font-bold text-royal" style={{ width: size, height: size, fontSize: size * 0.4 }}>{String(name || '?').slice(0, 1)}</span>
    );
}
