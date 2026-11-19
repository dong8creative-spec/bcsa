import React from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { safeExternalUrl } from '../utils';

/**
 * ContentDetailModal — 지원사업 공고 / 뉴스 기사를 클릭했을 때, 외부 사이트로 이동하는 대신
 * 사이트 안에서 내용(제목·출처·요약·설명·태그 등)만 보여주는 공용 상세 모달.
 *
 * 실제 외부 사이트를 iframe으로 그대로 띄우는 방식은 정부·언론사 사이트 다수가 보안 정책
 * (X-Frame-Options 등)으로 막아버려 빈 화면만 뜨는 경우가 많아 신뢰할 수 없다. 그래서 이미
 * Firestore에 저장해둔 요약/본문 데이터를 이 사이트 안에서 바로 보여주고, 원문이 필요한
 * 사람만 "원문 보기"를 눌러 실제 출처로 나가도록 했다.
 *
 * item: { title, badgeLabel, badgeClass, org, dateLabel, dateExact, viewCount, tags, amountText,
 *          summary, keySentence, description, externalUrl, showCoinAnimation }
 * dateExact/viewCount/keySentence/showCoinAnimation은 뉴스(NewsView)에서만 채워서 넘긴다 — 지원사업
 * 카드는 이 필드들 없이 넘어오므로 아래에서 값이 있을 때만 렌더링한다(공용 모달이라 도메인별 필드는
 * 선택적). keySentence가 있으면 그걸 "핵심 문장"으로 강조해서 보여주고, 없으면(지원사업이거나 아직
 * 예전 방식으로 수집된 뉴스) summary를 "요약"으로 대신 보여준다.
 */
export default function ContentDetailModal({ item, onClose }) {
    if (!item) return null;
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const metaLine = [item.dateExact, item.dateLabel, item.viewCount != null ? `조회 ${item.viewCount}` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="content-detail-title"
                    className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[18px] bg-white"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 md:px-8 md:pb-8 md:pt-7">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex min-h-[44px] flex-wrap items-center gap-2.5">
                                {item.badgeLabel ? (
                                    <span className={`inline-flex h-6 items-center whitespace-nowrap px-2 text-[12.5px] font-semibold leading-none ${item.badgeClass || 'bg-royal text-white'} ${/\btext-/.test(item.badgeClass || '') ? '' : 'text-white'}`}>
                                        {item.badgeLabel}
                                    </span>
                                ) : null}
                                {metaLine ? <span className="text-[13px] text-sub">{metaLine}</span> : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink"
                                aria-label="닫기"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <h3 id="content-detail-title" className="mb-2 break-keep text-[22px] font-bold leading-snug text-ink md:text-[24px]">{item.title}</h3>
                        {item.org ? <p className="mb-5 text-[14px] text-sub">{item.org}</p> : null}

                        {item.amountText ? (
                            <div className="mb-5 rounded-xl bg-sky px-4 py-3.5">
                                <p className="text-[15px] font-semibold text-royal">{item.amountText}</p>
                            </div>
                        ) : null}

                        {tags.length > 0 ? (
                            <div className="mb-5 flex flex-wrap items-center gap-1.5">
                                {tags.map((t, i) => (
                                    <span key={i} className="rounded-full border border-line px-2.5 py-1 text-[13px] text-sub">{t}</span>
                                ))}
                            </div>
                        ) : null}

                        {item.keySentence ? (
                            <div className="mb-5 border-l-[3px] border-royal pl-4">
                                <p className="mb-1.5 text-[13px] font-semibold text-sub">핵심 문장</p>
                                <p className="whitespace-pre-line break-keep text-[16px] font-semibold leading-relaxed text-ink">{item.keySentence}</p>
                            </div>
                        ) : item.summary ? (
                            <div className="mb-5">
                                <p className="mb-1.5 text-[13px] font-semibold text-sub">요약</p>
                                <p className="whitespace-pre-line break-keep text-[16px] leading-relaxed text-ink">{item.summary}</p>
                            </div>
                        ) : null}

                        {item.description && item.description !== item.summary ? (
                            <p className="whitespace-pre-line break-keep border-t border-line pt-5 text-[15px] leading-relaxed text-[#333]">{item.description}</p>
                        ) : null}

                        {!item.keySentence && !item.summary && !item.description ? (
                            <p className="text-[15px] text-sub">등록된 상세 내용이 없습니다.</p>
                        ) : null}

                        {item.showCoinAnimation ? (
                            <div className="flex items-center justify-center gap-1.5 pt-6 mt-2" aria-hidden="true">
                                <span className="bcsa-coin" style={{ animationDelay: '0ms' }}>🪙</span>
                                <span className="bcsa-coin" style={{ animationDelay: '160ms' }}>🪙</span>
                                <span className="bcsa-coin" style={{ animationDelay: '320ms' }}>🪙</span>
                                <style>{`
                                    .bcsa-coin {
                                        display: inline-block;
                                        font-size: 22px;
                                        line-height: 1;
                                        animation: bcsa-coin-bounce 1.2s ease-in-out infinite;
                                    }
                                    @keyframes bcsa-coin-bounce {
                                        0%, 100% { transform: translateY(0) rotate(0deg); }
                                        30% { transform: translateY(-10px) rotate(180deg); }
                                        55% { transform: translateY(0) rotate(360deg); }
                                    }
                                    @media (prefers-reduced-motion: reduce) {
                                        .bcsa-coin { animation: none; }
                                    }
                                `}</style>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-5 py-4 md:px-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-12 rounded-lg border border-line2 bg-white px-5 text-[15px] font-bold text-ink transition-colors hover:border-ink"
                        >
                            닫기
                        </button>
                        {safeExternalUrl(item.externalUrl) ? (
                            <a
                                href={safeExternalUrl(item.externalUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-12 items-center gap-1.5 rounded-lg bg-royal px-5 text-[15px] font-bold text-white transition-colors hover:bg-royalDark"
                            >
                                원문 보기
                                <Icons.ExternalLink size={16} />
                                <span className="sr-only">(새 창)</span>
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
