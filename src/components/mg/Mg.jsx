import React from 'react';

/**
 * 먼저가본 개편(2026-11) 공통 부품 — 가안(관리자 「개선」 버튼으로 보는 화면)의 결을 그대로 옮긴다.
 * 규칙(참고 사이트 실측값을 따름, 새 장치를 더하지 않는다):
 *  - 본문 폭 1100px, 좌우 여백 20px
 *  - 구역 제목 28/700, 설명 17 회색(#5b5a56)
 *  - 탭은 직사각형(둥글림 없음), 17/700, 높이 48, 선택은 검정 바탕
 *  - 모집 카드: 3:2 그림, 모서리 0, 1px 연한 테두리, 그림 아래 로얄블루 상태 띠, 제목 16/600, 정보 14
 *  - 안내 카드: 연한 바탕(#f3f5f8), 둥글림 12, 영문 라벨 14/600 로얄블루, 제목 18/600, 오른쪽 위 ↗
 *  - 첫 화면: 검은 띠 + 1100 폭 사진 위 왼쪽 글씨(머리말 18/600 · 제목 46/700 · 부제 22/400)
 */

/** 고정 머리글 높이만큼 비워 두는 값(PC 32+72, 휴대폰 60) */
export const HEADER_OFFSET_CLASS = 'pt-[60px] md:pt-[104px]';

export const MgWrap = ({ className = '', children, as: Tag = 'div', ...rest }) => (
    <Tag className={`mx-auto w-full max-w-[1140px] px-5 ${className}`} {...rest}>{children}</Tag>
);

export function MgHero({ image, eyebrow, title, lede, imagePosition = '70% 55%', children }) {
    return (
        <section className={`bg-[#0c0c0e] text-white ${HEADER_OFFSET_CLASS}`} aria-label={typeof title === 'string' ? title : undefined}>
            <div className="relative mx-auto h-[340px] max-w-[1100px] overflow-hidden bg-[#111] md:h-[430px]">
                {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: imagePosition }} decoding="async" /> : null}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(0,0,0,.74) 0%,rgba(0,0,0,.48) 45%,rgba(0,0,0,.12) 75%)' }} aria-hidden="true" />
                <div className="relative z-10 flex h-full flex-col justify-center px-5 md:px-14">
                    {eyebrow ? <p className="mb-2.5 text-[14px] font-semibold md:mb-3.5 md:text-[18px]">{eyebrow}</p> : null}
                    <h1 className="text-[27px] font-bold leading-[1.4] md:text-[46px] md:leading-[1.36]">{title}</h1>
                    {lede ? <p className="mt-3.5 text-[15px] md:mt-5 md:text-[22px]">{lede}</p> : null}
                    {children}
                </div>
            </div>
        </section>
    );
}

/** 안쪽 화면 머리부분: 검은 띠에 제목·설명(사진 없음). 가안의 첫 화면과 같은 글자 규칙 */
export function MgPageHead({ eyebrow, title, desc, crumbs, children }) {
    return (
        <section className={`bg-[#0c0c0e] text-white ${HEADER_OFFSET_CLASS}`}>
            <MgWrap className="py-12 md:py-16">
                {crumbs ? <div className="mb-4 text-[13px] text-white/60">{crumbs}</div> : null}
                {eyebrow ? <p className="mb-3 text-[14px] font-semibold text-royalOnBlack md:text-[16px]">{eyebrow}</p> : null}
                <h1 className="text-[28px] font-bold leading-[1.35] md:text-[40px]">{title}</h1>
                {desc ? <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-white/75 md:text-[18px]">{desc}</p> : null}
                {children}
            </MgWrap>
        </section>
    );
}

export function MgSectionHead({ title, desc, extra, id, tag = 'h2' }) {
    const T = tag;
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                <T id={id} className="text-[23px] font-bold leading-[1.4] text-ink md:text-[28px]">{title}</T>
                {desc ? <p className="mt-2 text-[15px] leading-relaxed text-sub md:text-[17px]">{desc}</p> : null}
            </div>
            {extra}
        </div>
    );
}

/** 직사각형 탭. items: [[value, label]] */
export function MgTabs({ items, value, onChange, label, className = '' }) {
    return (
        <div role="tablist" aria-label={label} className={`grid border border-[#0c0c0e] ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
            {items.map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
                    className={`h-12 px-2 text-[15px] font-bold tracking-tight md:text-[17px] ${value === v ? 'bg-[#0c0c0e] text-white' : 'bg-white text-[#666] hover:text-ink'}`}>
                    {l}
                </button>
            ))}
        </div>
    );
}

/** 모집·프로그램 카드: 3:2 그림 + 아래 상태 띠 + 제목 + 정보 줄 */
export function MgCard({ image, imagePosition, state, stateTone = 'royal', title, meta, onClick, href }) {
    const Tag = href ? 'a' : 'button';
    const tone = stateTone === 'muted' ? 'bg-[#0c0c0e]/90' : stateTone === 'alert' ? 'bg-red-600' : 'bg-royal';
    return (
        <Tag {...(href ? { href } : { type: 'button', onClick })} className="group flex h-full w-full flex-col text-left">
            <div className="relative aspect-[3/2] overflow-hidden border border-line bg-[#f6f6f6]">
                {image ? <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" style={imagePosition ? { objectPosition: imagePosition } : undefined} /> : null}
            </div>
            {state ? <span className={`block px-2.5 py-1.5 text-center text-[12px] text-white ${tone}`}>{state}</span> : null}
            <h3 className="mb-1 mt-3.5 line-clamp-2 min-h-[2.75em] text-[14px] font-semibold leading-[1.375] text-[#444] md:text-[16px]">{title}</h3>
            <div className="line-clamp-2 min-h-[3.2em] text-[12.5px] leading-[1.6] text-[#333] md:text-[14px]">{meta || '\u00a0'}</div>
        </Tag>
    );
}

/** 안내 카드: 연한 바탕 · 영문 라벨 · 제목 · (설명) · (아래 한 줄) · ↗ */
export function MgInfoCard({ en, title, desc, foot, onClick, href, newTab = false, arrow = true, image }) {
    const clickable = !!(onClick || href);
    const Tag = href ? 'a' : clickable ? 'button' : 'div';
    return (
        <Tag {...(href ? { href, ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } : clickable ? { type: 'button', onClick } : {})}
            className={`relative flex h-full min-h-[132px] w-full flex-col rounded-xl bg-card px-4 pb-5 pt-5 text-left text-ink md:min-h-[150px] md:px-6 md:pb-[30px] md:pt-[26px] ${clickable ? 'transition-colors hover:bg-[#e9edf3]' : ''}`}>
            {/* 일러스트(선택): 흰 바탕 그림을 카드 색에 곱하기로 섞어 바탕이 안 보이게 한다 */}
            {image ? <span className="-mx-1 mb-3 flex h-[96px] items-end justify-center md:mb-4 md:h-[132px]" aria-hidden="true"><img src={image} alt="" loading="lazy" decoding="async" className="h-full w-auto max-w-full object-contain mix-blend-multiply" /></span> : null}
            {en ? <span className="mb-2.5 text-[13px] font-semibold text-royal md:text-[14px]">{en}</span> : null}
            {clickable && arrow ? <span className="absolute right-4 top-[18px] text-[15px] text-royal md:right-[22px] md:top-6" aria-hidden="true">↗</span> : null}
            <span className="line-clamp-2 min-h-[3em] pr-4 text-[15.5px] font-semibold leading-[1.5] md:text-[18px]">{title}</span>
            {desc ? <span className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-sub md:text-[14px]">{desc}</span> : null}
            {foot ? <span className="mt-auto pt-4 text-[14px] font-semibold md:text-[15px]">{foot}</span> : null}
        </Tag>
    );
}

export function MgWordmark({ className = '', ...rest }) {
    return <span className={`font-logo leading-none tracking-[-0.01em] ${className}`} {...rest}>먼저가본</span>;
}

/**
 * 정보 표: [이름, 값] 줄 목록. 이름 칸 너비·줄 높이·여백이 글 양과 상관없이 같다(운영자 지시 2026-11-20).
 * rows: [[label, value]] — 값이 없으면 그 줄은 뺀다.
 */
export function MgInfoTable({ rows, className = '' }) {
    const list = (rows || []).filter(([, v]) => v !== null && v !== undefined && v !== '');
    return (
        <dl className={`border-t border-ink text-[15px] ${className}`}>
            {list.map(([k, v]) => (
                <div key={k} className="grid min-h-[52px] grid-cols-[96px_1fr] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[120px_1fr]">
                    <dt className="text-sub">{k}</dt>
                    <dd className="m-0 min-w-0 break-keep text-ink">{v}</dd>
                </div>
            ))}
        </dl>
    );
}
