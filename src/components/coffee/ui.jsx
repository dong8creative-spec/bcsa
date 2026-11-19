import React, { useEffect, useRef } from 'react';
import ModalPortal from '../ModalPortal';

/**
 * 커피챗 창 공통 부품 — 「먼저가본」 개편 결(검정·흰색·하늘 #e8f1fd·로얄블루 #2d4fe0, Presentation 글꼴).
 * 휴대폰: 아래에서 올라오는 판(높이 꽉), PC: 가운데 판(폭 560). 그림자·그라데이션 없음.
 */
export function CcModal({ title, onClose, onBack, depth = 0, children, footer, wide = false, labelId }) {
    const ref = useRef(null);
    useEffect(() => {
        // 겹친 창마다 키를 듣기 때문에, 화면 맨 위(마지막) 창만 닫는다
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            const all = document.querySelectorAll('[role="dialog"]');
            if (all[all.length - 1] === ref.current) onClose?.();
        };
        window.addEventListener('keydown', onKey);
        ref.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
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
                        <button type="button" onClick={onClose} aria-label="닫기" className="flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink">×</button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">{children}</div>
                    {footer ? <div className="shrink-0 border-t border-line bg-white px-4 py-3 md:px-6" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>{footer}</div> : null}
                </div>
            </div>
        </ModalPortal>
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
