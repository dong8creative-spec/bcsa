import React from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';

/**
 * ContentDetailModal — 지원사업 공고 / 뉴스 기사를 클릭했을 때, 외부 사이트로 이동하는 대신
 * 사이트 안에서 내용(제목·출처·요약·설명·태그 등)만 보여주는 공용 상세 모달.
 *
 * 실제 외부 사이트를 iframe으로 그대로 띄우는 방식은 정부·언론사 사이트 다수가 보안 정책
 * (X-Frame-Options 등)으로 막아버려 빈 화면만 뜨는 경우가 많아 신뢰할 수 없다. 그래서 이미
 * Firestore에 저장해둔 요약/본문 데이터를 이 사이트 안에서 바로 보여주고, 원문이 필요한
 * 사람만 "원문 보기"를 눌러 실제 출처로 나가도록 했다.
 *
 * item: { title, badgeLabel, badgeClass, org, dateLabel, tags, amountText, summary, description, externalUrl }
 */
export default function ContentDetailModal({ item, onClose }) {
    if (!item) return null;
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className="bg-white rounded-[28px] border border-black/[0.06] max-w-2xl w-full flex flex-col max-h-[85vh] max-md:scale-[0.94] origin-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-7 md:p-8">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                {item.badgeLabel ? (
                                    <span className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap ${item.badgeClass || 'bg-brand'}`}>
                                        {item.badgeLabel}
                                    </span>
                                ) : null}
                                {item.dateLabel ? <span className="text-xs text-gray-400">{item.dateLabel}</span> : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-soft hover:bg-[#eceef2] transition-colors"
                                aria-label="닫기"
                            >
                                <Icons.X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <h3 className="text-xl md:text-2xl font-bold text-dark leading-snug break-keep mb-2">{item.title}</h3>
                        {item.org ? <p className="text-sm text-gray-500 mb-5">{item.org}</p> : null}

                        {item.amountText ? (
                            <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 mb-5">
                                <p className="text-sm font-semibold text-brand">{item.amountText}</p>
                            </div>
                        ) : null}

                        {tags.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap mb-5">
                                {tags.map((t, i) => (
                                    <span key={i} className="text-[11px] font-semibold text-gray-500 bg-soft rounded-full px-2.5 py-1">{t}</span>
                                ))}
                            </div>
                        ) : null}

                        {item.summary ? (
                            <p className="text-sm md:text-base text-dark leading-relaxed break-keep whitespace-pre-line mb-4">{item.summary}</p>
                        ) : null}

                        {item.description && item.description !== item.summary ? (
                            <p className="text-sm text-gray-600 leading-relaxed break-keep whitespace-pre-line">{item.description}</p>
                        ) : null}

                        {!item.summary && !item.description ? (
                            <p className="text-sm text-gray-400">등록된 상세 내용이 없습니다.</p>
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
                        {item.externalUrl ? (
                            <a
                                href={item.externalUrl}
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
