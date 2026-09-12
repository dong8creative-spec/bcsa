import React, { useMemo, useState } from 'react';
import AdSlot, { hasAdSlot } from '../components/AdSlot';
import { firestoreLikeToMillis } from '../appHelpers';
import Pager from '../components/Pager';
import ContentDetailModal from '../components/ContentDetailModal';

/**
 * NewsView — 뉴스 페이지
 *
 * newsItems 컬렉션(관리자 수동 등록 + 매일 07:00 언론사 RSS 자동 수집)만 보여준다.
 *
 * 지원사업 공고(supportPrograms)는 전용 "지원사업" 페이지(SupportProgramsView)에서만 노출한다.
 * 예전에는 이 페이지에도 supportPrograms를 "지원사업 · 공고" 탭으로 함께 보여줬는데, 그러면 같은
 * 공고가 지원사업 페이지와 뉴스 페이지 두 군데에 동시에 노출돼 헷갈리므로, 뉴스 페이지는 이제
 * newsItems만 다룬다. newsItems 문서의 category 필드가 'notice'면 "공고" 배지, 그 외에는
 * "경제" 배지로 구분해서 보여준다(둘 다 같은 newsItems 컬렉션 안에서만 구분되는 것이라 중복이 아니다).
 *
 * 정책: 발행일(publishedAt) 후 1년이 지난 항목은 자동으로 목록에서 숨긴다(ONE_YEAR_MS).
 * 노출: 한 페이지에 10개씩만 보여주고, 10개를 넘으면 페이지 번호를 눌러 넘겨볼 수 있다(PAGE_SIZE).
 * 클릭 시: 외부 사이트로 이동하지 않고, 이미 저장해둔 요약/내용을 사이트 안 모달로 보여준다
 * (ContentDetailModal) — 원문이 필요하면 모달 안의 "원문 보기"로 나갈 수 있다.
 */

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

function NewsRow({ item, isLast, onOpen }) {
    const badgeClass = item.badge === '공고' ? 'bg-sky-500' : 'bg-orange-500';
    return (
        <button
            type="button"
            onClick={() => onOpen(item.detail)}
            className={`w-full flex items-center justify-between gap-4 py-5 px-2 -mx-2 rounded-xl hover:bg-soft/70 transition-colors text-left ${isLast ? '' : 'border-b border-black/[0.06]'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white shrink-0 whitespace-nowrap ${badgeClass}`}>{item.badge}</span>
                <p className="text-sm md:text-base font-semibold text-dark truncate">{item.title}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 ml-4">{item.meta}</span>
        </button>
    );
}

export default function NewsView({ content, onBack, newsItems }) {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'news-sidebar-1') || hasAdSlot(content, 'news-sidebar-1b') || hasAdSlot(content, 'news-sidebar-2');

    const now = Date.now();

    const NEWS_ITEMS = useMemo(() => {
        const rows = Array.isArray(newsItems) ? newsItems : [];
        return rows
            .filter((n) => n.enabled !== false && (n.status || 'published') === 'published')
            .filter((n) => {
                const publishedMs = firestoreLikeToMillis(n.publishedAt);
                return publishedMs == null || now - publishedMs <= ONE_YEAR_MS; // 발행 1년 경과 시 자동 숨김
            })
            .slice()
            .sort((a, b) => (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0))
            .map((n) => {
                const isNotice = n.category === 'notice';
                const dateLabel = relativeTime(firestoreLikeToMillis(n.publishedAt));
                return {
                    title: n.title || '',
                    badge: isNotice ? '공고' : '경제',
                    meta: [n.source, dateLabel].filter(Boolean).join(' · '),
                    detail: {
                        title: n.title || '',
                        badgeLabel: isNotice ? '공고' : '경제',
                        badgeClass: isNotice ? 'bg-sky-500' : 'bg-orange-500',
                        org: n.source || '',
                        dateLabel,
                        tags: [],
                        amountText: '',
                        summary: n.summary || '',
                        description: n.description || '',
                        externalUrl: n.url || '',
                    },
                };
            })
            .filter((item) => item.title);
    }, [newsItems, now]);

    const totalPages = Math.max(1, Math.ceil(NEWS_ITEMS.length / PAGE_SIZE));
    const pageClamped = Math.min(page, totalPages);
    const pageItems = NEWS_ITEMS.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

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
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="xl:flex xl:gap-10 xl:items-start">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg md:text-xl font-bold text-dark">창업 · 경제뉴스</h2>
                                <span className="text-xs text-gray-400">최신순</span>
                            </div>
                            {pageItems.length > 0 ? (
                                <>
                                    <div className="border-t border-black/[0.06]">
                                        {pageItems.map((item, i) => (
                                            <React.Fragment key={`${item.title}-${i}`}>
                                                <NewsRow item={item} isLast={i === pageItems.length - 1} onOpen={setSelected} />
                                                {i === 3 ? <AdSlot slotId="news-list-native" content={content} className="my-1" /> : null}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <Pager page={pageClamped} totalPages={totalPages} onChange={setPage} />
                                </>
                            ) : (
                                <p className="text-sm text-gray-400 border-t border-black/[0.06] pt-6">등록된 뉴스가 아직 없습니다.</p>
                            )}
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

            <ContentDetailModal item={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
