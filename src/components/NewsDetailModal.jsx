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
                className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className="bg-white rounded-[28px] border border-black/[0.06] max-w-3xl w-full flex flex-col max-h-[90vh] max-md:scale-[0.97] origin-center shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-7 py-8 md:px-12 md:py-10">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            {item.badgeLabel ? (
                                <span className={`inline-flex items-center justify-center h-6 px-3 rounded-full text-xs font-bold text-white whitespace-nowrap ${item.badgeClass || 'bg-brand'}`}>
                                    {item.badgeLabel}
                                </span>
                            ) : <span />}
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-soft hover:bg-[#eceef2] transition-colors"
                                aria-label="닫기"
                            >
                                <Icons.X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        {/* 목록 줄에서는 제목을 한 줄로 줄였지만, 여기서는 안 잘리고 전부 보여준다 —
                            목록의 "요약 미리보기"를 없앤 대신, 여기서 제목 자체를 크고 분명하게 읽게 한다. */}
                        <h1 className="text-2xl md:text-4xl font-bold text-dark leading-[1.3] break-keep mb-3">{item.title}</h1>
                        {metaLine ? <p className="text-sm text-gray-400 mb-8">{metaLine}</p> : null}

                        {item.amountText ? (
                            <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 mb-6">
                                <p className="text-sm font-semibold text-brand">{item.amountText}</p>
                            </div>
                        ) : null}

                        {tags.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap mb-6">
                                {tags.map((t, i) => (
                                    <span key={i} className="text-[11px] font-semibold text-gray-500 bg-soft rounded-full px-2.5 py-1">{t}</span>
                                ))}
                            </div>
                        ) : null}

                        {item.keySentence ? (
                            <div className="mb-6 pl-5 border-l-[3px] border-brand/30">
                                <p className="text-xs font-bold text-gray-400 tracking-wide mb-2">핵심 문장</p>
                                <p className="text-base md:text-lg text-dark leading-relaxed break-keep whitespace-pre-line font-medium">{item.keySentence}</p>
                            </div>
                        ) : item.summary ? (
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-400 tracking-wide mb-2">요약</p>
                                <p className="text-base md:text-lg text-dark leading-relaxed break-keep whitespace-pre-line">{item.summary}</p>
                            </div>
                        ) : null}

                        {item.description && item.description !== item.summary ? (
                            <p className="text-sm md:text-base text-gray-600 leading-relaxed break-keep whitespace-pre-line">{item.description}</p>
                        ) : null}

                        {!item.keySentence && !item.summary && !item.description ? (
                            <p className="text-sm text-gray-400">등록된 상세 내용이 없습니다.</p>
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

                    <div className="shrink-0 border-t border-black/[0.06] p-5 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-semibold rounded-full px-5 py-2.5 bg-soft text-gray-600 hover:bg-[#eceef2] transition-colors"
                        >
                            닫기
                        </button>
                        {safeExternalUrl(item.externalUrl) ? (
                            <a
                                href={safeExternalUrl(item.externalUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-5 py-2.5 bg-brand text-white hover:bg-[#00327a] transition-colors"
                            >
                                원문 보기
                                <Icons.ExternalLink size={15} />
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
