import React from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { safeExternalUrl } from '../utils';

/**
 * NewsDetailModal — 뉴스 전용 상세 모달.
 *
 * 지원사업 카드와 함께 쓰던 공용 ContentDetailModal은 정보량이 적은 카드용이라, 뉴스처럼 제목이
 * 길고 읽을 내용이 많은 경우엔 좁고 답답했다. 뉴스만을 위한 더 크고 읽기 편한 모달을 따로 만들어
 * (지원사업 쪽 ContentDetailModal은 그대로 둔다 — 서로 영향 없음), 제목을 크게 보여주고 본문을
 * 여유 있게 읽을 수 있게 했다.
 *
 * 어디까지나 "사이트 안에서" 보여주는 뷰어다 — 실제 기사 원문(언론사 사이트)으로 자동으로
 * 넘어가지 않고, 하단 "원문 보기" 버튼을 직접 눌렀을 때만 새 탭으로 나간다.
 *
 * item: NewsView가 만드는 detail 객체 그대로 받는다
 *   { title, badgeLabel, badgeClass, org, dateLabel, dateExact, viewCount, tags, amountText,
 *     summary, keySentence, description, externalUrl, showCoinAnimation }
 */
export default function NewsDetailModal({ item, onClose }) {
    if (!item) return null;
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const metaLine = [item.org, item.dateExact, item.dateLabel, item.viewCount != null ? `조회 ${item.viewCount}` : null]
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
                    aria-labelledby="news-detail-title"
                    className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[18px] bg-white"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-5 md:px-10 md:pb-10 md:pt-8">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            {item.badgeLabel ? (
                                <span className={`mt-2.5 inline-flex h-6 items-center whitespace-nowrap px-2 text-[12.5px] font-semibold leading-none ${item.badgeClass || 'bg-royal text-white'} ${/\btext-/.test(item.badgeClass || '') ? '' : 'text-white'}`}>
                                    {item.badgeLabel}
                                </span>
                            ) : <span />}
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink"
                                aria-label="닫기"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>

                        {/* 목록 줄에서는 제목을 한 줄로 줄였지만, 여기서는 안 잘리고 전부 보여준다. */}
                        <h1 id="news-detail-title" className="mb-3 break-keep text-[22px] font-bold leading-[1.4] text-ink md:text-[24px]">{item.title}</h1>
                        {metaLine ? <p className="mb-7 text-[13px] text-sub md:text-[14px]">{metaLine}</p> : null}

                        {item.amountText ? (
                            <div className="mb-6 rounded-xl bg-sky px-4 py-3.5">
                                <p className="text-[15px] font-semibold text-royal">{item.amountText}</p>
                            </div>
                        ) : null}

                        {tags.length > 0 ? (
                            <div className="mb-6 flex flex-wrap items-center gap-1.5">
                                {tags.map((t, i) => (
                                    <span key={i} className="rounded-full border border-line px-2.5 py-1 text-[13px] text-sub">{t}</span>
                                ))}
                            </div>
                        ) : null}

                        {item.keySentence ? (
                            <div className="mb-6 border-l-[3px] border-royal pl-5">
                                <p className="mb-2 text-[13px] font-semibold text-sub">핵심 문장</p>
                                <p className="whitespace-pre-line break-keep text-[16px] font-semibold leading-relaxed text-ink md:text-[18px]">{item.keySentence}</p>
                            </div>
                        ) : item.summary ? (
                            <div className="mb-6">
                                <p className="mb-2 text-[13px] font-semibold text-sub">요약</p>
                                <p className="whitespace-pre-line break-keep text-[16px] leading-relaxed text-ink md:text-[18px]">{item.summary}</p>
                            </div>
                        ) : null}

                        {item.description && item.description !== item.summary ? (
                            <p className="whitespace-pre-line break-keep border-t border-line pt-6 text-[15px] leading-relaxed text-[#333] md:text-[16px]">{item.description}</p>
                        ) : null}

                        {!item.keySentence && !item.summary && !item.description ? (
                            <p className="text-[15px] text-sub">등록된 상세 내용이 없습니다.</p>
                        ) : null}

                        {item.showCoinAnimation ? (
                            <div className="flex items-center justify-center gap-1.5 pt-8 mt-2" aria-hidden="true">
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

                    <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-5 py-4 md:px-10">
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
