import React, { useState } from 'react';
import { Icons } from './Icons';
import {
    LEGAL_ARCHIVE,
    LEGAL_CHANGE_NOTICE,
    LEGAL_EFFECTIVE_DATE_TEXT,
    isLegalChangeNoticeActive,
} from '../constants/legal';

/**
 * 약관·처리방침·환불 규정 공용 페이지
 * - 현재 본문 + 「이전 버전 보기」(legalArchive.js의 원문)
 * - 시행일 30일 뒤까지 맨 위에 개정 안내 요약
 * docKey: 'terms' | 'privacy' | 'refund' (보관본에서 같은 문서를 찾는 열쇠)
 */
export default function LegalDocumentPage({ docKey, title, subtitle, sections, onBack, renderBody }) {
    const archived = LEGAL_ARCHIVE.filter((v) => v?.[docKey]?.sections?.length);
    const [selected, setSelected] = useState('current');
    const showingArchive = selected !== 'current';
    const archiveDoc = showingArchive ? archived.find((v) => v.version === selected)?.[docKey] : null;
    const shownTitle = archiveDoc?.title || title;
    const shownSections = archiveDoc?.sections || sections;
    const shownDate = showingArchive ? archived.find((v) => v.version === selected)?.effectiveDate : LEGAL_EFFECTIVE_DATE_TEXT;

    return (
        <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
            <div className="container mx-auto max-w-3xl">
                <div className="bg-white rounded-[28px] border border-black/[0.06] overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-black/[0.06] text-center">
                        <h1 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-dark break-keep">{shownTitle}</h1>
                        <p className="text-sm text-brand mt-2">* 시행일: {shownDate}</p>
                        {subtitle && !showingArchive ? <p className="text-sm text-gray-500 mt-1 break-keep">{subtitle}</p> : null}
                        {archived.length > 0 ? (
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                <label htmlFor={`legal-version-${docKey}`} className="text-sm text-gray-600">이전 버전 보기</label>
                                <select
                                    id={`legal-version-${docKey}`}
                                    value={selected}
                                    onChange={(e) => setSelected(e.target.value)}
                                    className="text-sm border border-black/10 rounded-full px-3 py-1.5 bg-white focus:outline-none focus:border-brand"
                                >
                                    <option value="current">현재 버전 ({LEGAL_EFFECTIVE_DATE_TEXT} 시행)</option>
                                    {archived.map((v) => (
                                        <option key={v.version} value={v.version}>{v.effectiveDate} 시행본</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                    </div>

                    {showingArchive ? (
                        <div className="mx-6 md:mx-8 mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 break-keep">
                            지금 보고 계신 것은 이전 버전이에요. 현재 적용되는 내용은 「현재 버전」을 선택해 주세요.
                        </div>
                    ) : isLegalChangeNoticeActive() ? (
                        <details className="mx-6 md:mx-8 mt-6 rounded-2xl bg-brand/5 border border-brand/10 p-4 text-sm text-gray-700">
                            <summary className="font-semibold text-dark cursor-pointer break-keep">{LEGAL_CHANGE_NOTICE.title}</summary>
                            <p className="mt-3 leading-relaxed break-keep">{LEGAL_CHANGE_NOTICE.intro}</p>
                            <ul className="mt-3 space-y-1.5">
                                {LEGAL_CHANGE_NOTICE.items.map((t) => (
                                    <li key={t} className="flex gap-2 leading-relaxed break-keep"><span className="text-brand shrink-0">·</span><span>{t}</span></li>
                                ))}
                            </ul>
                        </details>
                    ) : null}

                    <div className="p-6 md:p-8 space-y-8">
                        {shownSections.map((section, index) => (
                            <section key={`${selected}-${index}`}>
                                <h2 className="text-[15px] md:text-base font-semibold text-dark mb-3">{section.title}</h2>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-keep break-words">
                                    {renderBody ? renderBody(section) : section.body}
                                </div>
                            </section>
                        ))}
                    </div>
                    <div className="p-6 md:p-8 border-t border-black/[0.06] flex justify-center">
                        <button
                            type="button"
                            onClick={() => (onBack ? onBack() : window.history.back())}
                            className="px-6 py-3 bg-brand text-white font-semibold rounded-full hover:bg-[#00327a] transition-colors flex items-center gap-2"
                        >
                            <Icons.ArrowLeft size={20} />
                            이전으로
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
