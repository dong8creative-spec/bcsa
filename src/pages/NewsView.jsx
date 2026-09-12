import React, { useMemo, useState } from 'react';
import AdSlot, { hasAdSlot } from '../components/AdSlot';
import { firestoreLikeToMillis } from '../appHelpers';

/**
 * NewsView — 뉴스 페이지
 *
 * "지원사업 · 공고" 탭은 supportPrograms 컬렉션(관리자 수동 등록 + 매일 07:00 자동 수집)을 그대로 보여주고,
 * "경제뉴스" 탭은 newsItems 컬렉션(관리자 수동 등록 + 매일 07:00 언론사 RSS 자동 수집)을 보여준다.
 * 둘 다 App.jsx에서 실시간 구독(subscribeSupportPrograms / subscribeNewsItems)한 데이터를 props로 받는다.
 *
 * 정책: 등록(공고 생성일 / 기사 발행일) 후 1년이 지난 항목은 자동으로 목록에서 숨긴다(ONE_YEAR_MS).
 * 노출: 한 페이지에 10개씩만 보여주고, 10개를 넘으면 페이지 번호를 눌러 넘겨볼 수 있다(PAGE_SIZE).
 */

const CATEGORIES = [
    { id: 'all', label: '전체' },
    { id: 'notice', label: '지원사업 · 공고' },
    { id: 'econ', label: '경제뉴스' },
];

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function relativeTime(ms) {
    if (ms == null || !Number.isFinite(ms)) return '';
    const diff = Date.now() - ms;
    if (diff < 0) return '오늘';
    const days = Math.floor(diff / 86400000);
    if (days <= 0) return '오늘';
    if (days === 1) return '1일 전';
    if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}주 전`;
    const months = Math.floor(days / 30);
    return `${months}개월 전`;
}

function NewsRow({ item, isLast }) {
    const badgeClass = item.badge === '공고' ? 'bg-sky-500' : 'bg-orange-500';
    return (
        <a
            href={item.href || '#'}
            target={item.href ? '_blank' : undefined}
            rel={item.href ? 'noopener noreferrer' : undefined}
            onClick={(e) => { if (!item.href) e.preventDefault(); }}
            className={`flex items-center justify-between gap-4 py-5 px-2 -mx-2 rounded-xl hover:bg-soft/70 transition-colors ${isLast ? '' : 'border-b border-black/[0.06]'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white shrink-0 whitespace-nowrap ${badgeClass}`}>{item.badge}</span>
                <p className="text-sm md:text-base font-semibold text-dark truncate">{item.title}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 ml-4">{item.meta}</span>
        </a>
    );
}

function Pager({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-6">
            <button
                type="button"
                onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="text-xs font-semibold rounded-full px-3 py-2 bg-soft text-gray-600 hover:bg-[#eceef2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                이전
            </button>
            {pages.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onChange(p)}
                    className={`text-xs font-semibold rounded-full w-8 h-8 transition-colors ${p === page ? 'bg-brand text-white' : 'bg-soft text-gray-600 hover:bg-[#eceef2]'}`}
                >
                    {p}
                </button>
            ))}
            <button
                type="button"
                onClick={() => onChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="text-xs font-semibold rounded-full px-3 py-2 bg-soft text-gray-600 hover:bg-[#eceef2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                다음
            </button>
        </div>
    );
}

export default function NewsView({ content, onBack, supportPrograms, newsItems }) {
    const [category, setCategory] = useState('all');
    const [noticePage, setNoticePage] = useState(1);
    const [econPage, setEconPage] = useState(1);
    const showNotice = category === 'all' || category === 'notice';
    const showEcon = category === 'all' || category === 'econ';
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'news-sidebar-1') || hasAdSlot(content, 'news-sidebar-1b') || hasAdSlot(content, 'news-sidebar-2');

    const now = Date.now();

    const NOTICE_ITEMS = useMemo(() => {
        const rows = Array.isArray(supportPrograms) ? supportPrograms : [];
        return rows
            .filter((p) => p.enabled !== false && (p.status || 'published') === 'published')
            .filter((p) => {
                const createdMs = firestoreLikeToMillis(p.createdAt);
                return createdMs == null || now - createdMs <= ONE_YEAR_MS; // 등록 1년 경과 시 자동 숨김
            })
            .slice()
            .sort((a, b) => (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0))
            .map((p) => ({
                title: p.title || '',
                badge: '공고',
                meta: [p.org, relativeTime(firestoreLikeToMillis(p.createdAt))].filter(Boolean).join(' · '),
                href: p.applyUrl || p.sourceUrl || '',
            }))
            .filter((item) => item.title);
    }, [supportPrograms, now]);

    const ECON_ITEMS = useMemo(() => {
        const rows = Array.isArray(newsItems) ? newsItems : [];
        return rows
            .filter((n) => n.enabled !== false && (n.status || 'published') === 'published' && (n.category || 'econ') === 'econ')
            .filter((n) => {
                const publishedMs = firestoreLikeToMillis(n.publishedAt);
                return publishedMs == null || now - publishedMs <= ONE_YEAR_MS; // 발행 1년 경과 시 자동 숨김
            })
            .slice()
            .sort((a, b) => (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0))
            .map((n) => ({
                title: n.title || '',
                badge: '경제',
                meta: [n.source, relativeTime(firestoreLikeToMillis(n.publishedAt))].filter(Boolean).join(' · '),
                href: n.url || '',
            }))
            .filter((item) => item.title);
    }, [newsItems, now]);

    const noticeTotalPages = Math.max(1, Math.ceil(NOTICE_ITEMS.length / PAGE_SIZE));
    const econTotalPages = Math.max(1, Math.ceil(ECON_ITEMS.length / PAGE_SIZE));
    const noticePageClamped = Math.min(noticePage, noticeTotalPages);
    const econPageClamped = Math.min(econPage, econTotalPages);
    const noticePageItems = NOTICE_ITEMS.slice((noticePageClamped - 1) * PAGE_SIZE, noticePageClamped * PAGE_SIZE);
    const econPageItems = ECON_ITEMS.slice((econPageClamped - 1) * PAGE_SIZE, econPageClamped * PAGE_SIZE);

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 뉴스
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">NEWS</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">뉴스</h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">부산 창업가들이 놓치기 쉬운 소식을 한곳에 모았습니다.</p>
                    <div className="flex items-center gap-2 flex-wrap mt-8">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCategory(c.id)}
                                className={`text-xs font-semibold rounded-full px-3.5 py-2 transition-colors ${category === c.id ? 'text-white bg-brand' : 'text-gray-500 bg-soft hover:bg-[#eceef2]'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="xl:flex xl:gap-10 xl:items-start">
                        <div className="flex-1 min-w-0">
                            {showNotice ? (
                                <div className="pb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg md:text-xl font-bold text-dark">지원사업 · 공고 소식</h2>
                                        <span className="text-xs text-gray-400">최신순</span>
                                    </div>
                                    {noticePageItems.length > 0 ? (
                                        <>
                                            <div className="border-t border-black/[0.06]">
                                                {noticePageItems.map((item, i) => (
                                                    <React.Fragment key={`${item.title}-${i}`}>
                                                        <NewsRow item={item} isLast={i === noticePageItems.length - 1} />
                                                        {i === 3 ? <AdSlot slotId="news-list-native" content={content} className="my-1" /> : null}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <Pager page={noticePageClamped} totalPages={noticeTotalPages} onChange={setNoticePage} />
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-400 border-t border-black/[0.06] pt-6">등록된 지원사업 공고가 아직 없습니다.</p>
                                    )}
                                </div>
                            ) : null}

                            {showEcon ? (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg md:text-xl font-bold text-dark">창업 · 경제뉴스</h2>
                                        <span className="text-xs text-gray-400">최신순</span>
                                    </div>
                                    {econPageItems.length > 0 ? (
                                        <>
                                            <div className="border-t border-black/[0.06]">
                                                {econPageItems.map((item, i) => (
                                                    <NewsRow key={`${item.title}-${i}`} item={item} isLast={i === econPageItems.length - 1} />
                                                ))}
                                            </div>
                                            <Pager page={econPageClamped} totalPages={econTotalPages} onChange={setEconPage} />
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-400 border-t border-black/[0.06] pt-6">등록된 경제뉴스가 아직 없습니다.</p>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        {/* 우측 배너 광고 레일 — 구글 표준 300px 폭(300×250/300×600) 기준, 최대 3슬롯.
                            실제 광고 소재가 등록되기 전까지는 AdSlot이 아무것도 렌더링하지 않으므로
                            공간을 차지하지 않는다. xl(1280px) 미만에서는 본문 폭 확보를 위해 숨김. */}
                        {hasSidebarAd ? (
                            <aside className="hidden xl:block w-[300px] shrink-0 space-y-6">
                                <div className="flex items-start gap-3">
                                    <div className="sticky top-[76px]">
                                        <AdSlot slotId="news-sidebar-1" content={content} className="w-[160px] h-[600px]" showPlaceholder placeholderSize="160×600" />
                                    </div>
                                    <AdSlot slotId="news-sidebar-1b" content={content} className="w-[120px] h-[600px]" showPlaceholder placeholderSize="120×600" />
                                </div>
                                <AdSlot slotId="news-sidebar-2" content={content} className="w-[300px] h-[250px]" showPlaceholder placeholderSize="300×250" />
                            </aside>
                        ) : null}
                    </div>
                </div>
            </section>
        </div>
    );
}
