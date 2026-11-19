import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../../components/Icons';

/**
 * 포스터가 붙은 그룹 화면 조각들 (constants/groupPosters.js)
 * - PosterHero: 포스터 크게 + 핵심 정보 + 가입 버튼 + 공유
 * - PosterText: 포스터 내용을 글로 (화면 읽기 프로그램·확대가 필요한 분, 검색)
 * - PosterViewer: 포스터 원본 크기 보기 창
 * - JoinDialog: 가입 신청(사업 분야·지금 고민) 창
 * - StickyJoinBar: 휴대폰에서 화면 아래에 늘 보이는 가입 버튼
 */

/** 창(대화 상자) 공통: Esc 로 닫기, 열릴 때 창 안으로 초점, 닫으면 원래 자리로, Tab 이 창 밖으로 나가지 않게 */
function useDialog(onClose) {
    const ref = useRef(null);
    useEffect(() => {
        const before = document.activeElement;
        const box = ref.current;
        const focusables = () => [...box.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
        (box.querySelector('[data-autofocus]') || focusables()[0] || box).focus();
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
            if (e.key !== 'Tab') return;
            const list = focusables();
            if (!list.length) return;
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            if (before && before.focus) before.focus();
        };
    }, [onClose]);
    return ref;
}

export function PosterViewer({ poster, onClose }) {
    const ref = useDialog(onClose);
    return (
        <div className="fixed inset-0 z-[300] bg-black/85 overflow-y-auto" onClick={onClose}>
            <div ref={ref} role="dialog" aria-modal="true" aria-label={`${poster.label} 크게 보기`} tabIndex={-1}
                className="min-h-full flex flex-col items-center justify-start gap-3 p-4 pt-[max(16px,env(safe-area-inset-top))] outline-none">
                <button type="button" onClick={onClose} data-autofocus
                    className="inline-flex h-11 items-center gap-1.5 self-end rounded-lg bg-white px-4 text-[15px] font-semibold text-ink">
                    <Icons.X size={16} aria-hidden="true" /> 닫기
                </button>
                <img src={poster.image} alt={`${poster.headline}. ${poster.tagline}. 내용은 그룹 화면의 「모집 안내」에 글로도 있어요.`}
                    width={poster.width} height={poster.height} onClick={(e) => e.stopPropagation()}
                    className="h-auto w-full max-w-[794px] bg-white" />
            </div>
        </div>
    );
}

export function PosterHero({ group, poster, joinAction }) {
    const [viewer, setViewer] = useState(false);
    const [shareMsg, setShareMsg] = useState('');
    const share = async () => {
        const url = `${window.location.origin}/groups/${group.id}`;
        const data = { title: poster.headline, text: `${poster.headline} — ${poster.tagline}`, url };
        try {
            if (navigator.share) { await navigator.share(data); return; }
        } catch (e) { if (e?.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(url); setShareMsg('주소를 복사했어요. 카톡에 붙여 넣어 알려 주세요.'); }
        catch { setShareMsg(`이 주소를 알려 주세요: ${url}`); }
    };
    return (
        <section data-layout="page" aria-labelledby="poster-headline" className="mb-12 grid items-start gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
            <div>
                <button type="button" onClick={() => setViewer(true)}
                    className="relative block w-full overflow-hidden border border-line bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal">
                    <img src={poster.image} width={poster.width} height={poster.height} className="block w-full h-auto" decoding="async" fetchpriority="high"
                        alt={`${poster.label}. ${poster.headline}, ${poster.tagline}. 자세한 내용은 아래 「모집 안내」에 글로 있어요.`} />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-ink/85 px-3.5 py-2 text-[14px] font-semibold text-white">
                        <Icons.ZoomIn size={15} aria-hidden="true" /> 포스터 크게 보기
                    </span>
                </button>
            </div>
            <div className="md:sticky md:top-28">
                <p className="inline-block bg-royal px-3 py-1.5 text-[14px] font-semibold text-white">{group.recruit === 'soon' ? '모집예정' : '지금 모집 중'}</p>
                <h2 id="poster-headline" className="mt-4 break-keep text-[26px] font-bold leading-[1.35] text-ink md:text-[32px]">{poster.headline}</h2>
                <p className="mt-2 break-keep text-[17px] font-semibold text-royal md:text-[18px]">{poster.tagline}</p>
                <p className="mt-3 break-keep text-[16px] leading-relaxed text-[#333]">{poster.lead}</p>
                <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line">
                    {poster.facts.map(([k, v], i) => (
                        <div key={k} className={`flex min-h-[88px] flex-col bg-white px-4 py-3.5 ${i === poster.facts.length - 1 && poster.facts.length % 2 ? 'col-span-2' : ''}`}>
                            <dt className="truncate text-[13px] text-sub">{k}</dt>
                            <dd className="mt-0.5 line-clamp-2 min-h-[2.8em] break-keep text-[16px] font-semibold leading-[1.4] text-ink" title={typeof v === 'string' ? v : undefined}>{v}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 break-keep rounded-xl bg-sky px-4 py-3 text-[15px] text-ink">{poster.howTo}</p>
                <div className="mt-5 space-y-3">
                    {joinAction}
                    <button type="button" onClick={share}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line2 bg-white text-[15px] font-semibold text-ink hover:border-ink">
                        <Icons.Share2 size={17} aria-hidden="true" /> 이 모집 알리기
                    </button>
                    <p role="status" aria-live="polite" className="break-all text-[14px] text-sub">{shareMsg}</p>
                </div>
            </div>
            {viewer ? <PosterViewer poster={poster} onClose={() => setViewer(false)} /> : null}
        </section>
    );
}

export function PosterText({ poster }) {
    return (
        <section aria-labelledby="poster-text-title" className="rounded-xl bg-card p-5 md:p-6">
            <h2 id="poster-text-title" className="mb-4 text-[20px] font-bold text-ink md:text-[23px]">모집 안내</h2>
            <div className="grid gap-3 md:grid-cols-3">
                {poster.sections.map((s) => (
                    <div key={s.title} className="rounded-lg bg-white p-4">
                        <h3 className="mb-2.5 break-keep text-[16px] font-semibold text-ink">{s.title}</h3>
                        <ul className="space-y-2">
                            {s.items.map((it) => (
                                <li key={it} className="flex gap-2 break-keep text-[15px] leading-snug text-[#333]">
                                    <Icons.CheckCircle size={17} className="mt-0.5 shrink-0 text-royal" aria-hidden="true" />{it}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <p className="mt-4 break-keep text-[15px] font-semibold text-ink">{poster.closing}</p>
        </section>
    );
}

export function JoinDialog({ group, poster, onSubmit, onClose }) {
    const ref = useDialog(onClose);
    const [field, setField] = useState('');
    const [concern, setConcern] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const required = !!poster;
    const labels = { field: '사업 분야', concern: '지금 고민 1가지', concernPlaceholder: '예: 재구매 고객을 늘리고 싶은데 방법을 모르겠어요.', ...(poster?.joinLabels || {}) };
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (required && (!field.trim() || !concern.trim())) { setError(`${labels.field}와 ${labels.concern}를 적어 주세요.`); return; }
        setBusy(true);
        try { await onSubmit({ field: field.trim(), concern: concern.trim() }); }
        catch (err) { setError(err.message || '신청하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); setBusy(false); }
    };
    const input = 'w-full rounded-lg border border-line2 bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-royal';
    return (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="join-dialog-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}
                className="max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] bg-white p-6 pb-[max(24px,env(safe-area-inset-bottom))] outline-none sm:max-w-md sm:rounded-[18px]">
                <h2 id="join-dialog-title" className="break-keep text-[21px] font-bold text-ink">{group.title} 가입 신청</h2>
                <p className="mt-2 break-keep text-[15px] text-sub">그룹장이 보고 승인하면 멤버가 돼요. 적은 내용은 그룹장과 운영진만 봐요.</p>
                <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                    <label className="block">
                        <span className="text-[15px] font-semibold text-ink">{labels.field}{required ? '' : ' (선택)'}</span>
                        <input className={`${input} mt-2`} value={field} onChange={(e) => setField(e.target.value)} maxLength={60}
                            placeholder="예: 온라인 쇼핑몰(의류), 카페, 세무사무소" data-autofocus aria-required={required} autoComplete="organization-title" />
                    </label>
                    <label className="block">
                        <span className="text-[15px] font-semibold text-ink">{labels.concern}{required ? '' : ' (선택)'}</span>
                        <textarea className={`${input} mt-2 min-h-[110px]`} value={concern} onChange={(e) => setConcern(e.target.value)} maxLength={500}
                            placeholder={labels.concernPlaceholder} aria-required={required} />
                        <span className="mt-1 block text-right text-[13px] text-sub">{concern.length}/500</span>
                    </label>
                    <p role="alert" className="text-[14px] font-semibold text-red-600 min-h-[1px]">{error}</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="h-[52px] flex-1 rounded-lg border border-line2 bg-white text-[15px] font-semibold text-ink">닫기</button>
                        <button type="submit" disabled={busy} className="h-[52px] flex-[2] rounded-lg bg-royal text-[16px] font-bold text-white hover:bg-royalDark disabled:opacity-60">
                            {busy ? '보내는 중…' : '가입 신청 보내기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/** 휴대폰: 포스터 그룹 화면을 내려 읽는 동안에도 가입 버튼이 아래에 보이게 */
export function StickyJoinBar({ children }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-line bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:hidden">
            {children}
        </div>
    );
}
