import React, { useMemo, useState } from 'react';
import AdSlot, { hasAdSlot } from '../components/AdSlot';
import { firestoreLikeToMillis } from '../appHelpers';
import Pager from '../components/Pager';
import ContentDetailModal from '../components/ContentDetailModal';

/**
 * NewsView — 뉴스 페이지
 *
 * newsItems 컬렉션(관리자 수동 등록 + 매일 07:00 네이버 뉴스검색 API 자동 수집)만 보여준다.
 *
 * 지원사업 공고(supportPrograms)는 전용 "지원사업" 페이지(SupportProgramsView)에서만 노출한다.
 * 예전에는 이 페이지에도 supportPrograms를 "지원사업 · 공고" 탭으로 함께 보여줬는데, 그러면 같은
 * 공고가 지원사업 페이지와 뉴스 페이지 두 군데에 동시에 노출돼 헷갈리므로, 뉴스 페이지는 이제
 * newsItems만 다룬다.
 *
 * 카테고리: 자동수집 스크립트(scripts/ingest-daily-feed.mjs)가 검색어 그룹에 따라 8개 카테고리
 * (지원사업/창업·투자/모집·행사/상권·소비/판로·마케팅/세무·노무/기술·트렌드/위기·대응) 중 하나를
 * category 필드에 저장한다 — CATEGORY_META가 배지 색을 정의한다. 예전 방식(notice/econ 두 종류)으로
 * 저장된 문서도 있을 수 있어 하위 호환으로 같이 처리한다(legacy 항목).
 *
 * 정책: 발행일(publishedAt) 후 1년이 지난 항목은 자동으로 목록에서 숨긴다(ONE_YEAR_MS).
 * 노출: 한 페이지에 10개씩만 보여주고, 10개를 넘으면 페이지 번호를 눌러 넘겨볼 수 있다(PAGE_SIZE).
 * 클릭 시: 외부 사이트로 이동하지 않고, 이미 저장해둔 요약/내용을 사이트 안 모달로 보여준다
 * (ContentDetailModal) — 원문이 필요하면 모달 안의 "원문 보기"로 나갈 수 있다.
 */

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 카테고리별 배지 라벨/색 — scripts/ingest-daily-feed.mjs의 NEWS_KEYWORD_GROUPS 카테고리와 1:1로 맞춘다.
// notice/econ은 이전 수집 방식으로 저장된 문서를 위한 하위 호환 항목.
const CATEGORY_META = {
    '지원사업': { label: '지원사업', badgeClass: 'bg-blue-600' },
    '창업·투자': { label: '창업·투자', badgeClass: 'bg-indigo-500' },
    '모집·행사': { label: '모집·행사', badgeClass: 'bg-sky-500' },
    '상권·소비': { label: '상권·소비', badgeClass: 'bg-amber-500' },
    '판로·마케팅': { label: '판로·마케팅', badgeClass: 'bg-emerald-500' },
    '세무·노무': { label: '세무·노무', badgeClass: 'bg-slate-500' },
    '기술·트렌드': { label: '기술·트렌드', badgeClass: 'bg-purple-500' },
    '위기·대응': { label: '위기·대응', badgeClass: 'bg-red-500' },
    notice: { label: '공고', badgeClass: 'bg-sky-500' },
    econ: { label: '경제', badgeClass: 'bg-orange-500' },
};
const DEFAULT_CATEGORY_META = { label: '뉴스', badgeClass: 'bg-gray-400' };

function categoryMetaFor(category) {
    return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}

function formatExactDate(ms) {
    if (ms == null || !Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

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
    return (
        <button
            type="button"
            onClick={() => onOpen(item.detail)}
            className={`w-full flex items-center justify-between gap-4 py-5 px-2 -mx-2 rounded-xl hover:bg-soft/70 transition-colors text-left ${isLast ? '' : 'border-b border-black/[0.06]'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white shrink-0 whitespace-nowrap ${item.badgeClass}`}>{item.badge}</span>
                <p className="text-sm md:text-base font-semibold text-dark truncate">{item.title}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 ml-4">{item.meta}</span>
        </button>
    );
}

export default function NewsView({ content, onBack, newsItems }) {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const [sourceFilter, setSourceFilter] = useState('all'); // 신문사 필터 — '전체' 또는 특정 언론사명
    const [sortMode, setSortMode] = useState('date'); // 'date'(최신순, 기본) | 'source'(신문사순)
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'news-sidebar-1') || hasAdSlot(content, 'news-sidebar-1b') || hasAdSlot(content, 'news-sidebar-2');

    const now = Date.now();

    // 필터/정렬과 무관한 전체 목록. 여기서 신문사 옵션 목록을 뽑고, 아래서 필터/정렬을 적용한다.
    const ALL_NEWS_ITEMS = useMemo(() => {
        const rows = Array.isArray(newsItems) ? newsItems : [];
        return rows
            .filter((n) => n.enabled !== false && (n.status || 'published') === 'published')
            .filter((n) => {
                const publishedMs = firestoreLikeToMillis(n.publishedAt);
                return publishedMs == null || now - publishedMs <= ONE_YEAR_MS; // 발행 1년 경과 시 자동 숨김
            })
            .map((n) => {
                const meta = categoryMetaFor(n.category);
                const publishedMs = firestoreLikeToMillis(n.publishedAt);
                const dateLabel = relativeTime(publishedMs);
                const dateExact = formatExactDate(publishedMs);
                const source = n.source || '';
                const targets = String(n.target || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                return {
                    title: n.title || '',
                    source,
                    publishedMs,
                    sortOrder: Number(n.sortOrder) || 0,
                    badge: meta.label,
                    badgeClass: meta.badgeClass,
                    meta: [source, dateExact, dateLabel].filter(Boolean).join(' · '),
                    detail: {
                        title: n.title || '',
                        badgeLabel: meta.label,
                        badgeClass: meta.badgeClass,
                        org: source,
                        dateLabel,
                        tags: targets,
                        amountText: n.deadlineText ? `신청기한: ${n.deadlineText}` : '',
                        summary: n.summary || '',
                        description: n.description || '',
                        externalUrl: n.url || '',
                    },
                };
            })
            .filter((item) => item.title);
    }, [newsItems, now]);

    // 실제 존재하는 신문사만 옵션으로 노출 (가나다순).
    const sourceOptions = useMemo(() => {
        const set = new Set();
        ALL_NEWS_ITEMS.forEach((item) => { if (item.source) set.add(item.source); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [ALL_NEWS_ITEMS]);

    const NEWS_ITEMS = useMemo(() => {
        let rows = ALL_NEWS_ITEMS;
        if (sourceFilter !== 'all') rows = rows.filter((item) => item.source === sourceFilter);
        rows = rows.slice();
        if (sortMode === 'source') {
            rows.sort((a, b) => {
                const sc = a.source.localeCompare(b.source, 'ko');
                if (sc !== 0) return sc;
                return (b.publishedMs || 0) - (a.publishedMs || 0); // 같은 신문사끼리는 최신순
            });
        } else {
            rows.sort((a, b) => b.sortOrder - a.sortOrder); // 최신순(기본)
        }
        return rows;
    }, [ALL_NEWS_ITEMS, sourceFilter, sortMode]);

    // 필터/정렬을 바꾸면 이전 페이지 번호가 남아 빈 페이지가 보일 수 있어 1페이지로 되돌린다.
    React.useEffect(() => { setPage(1); }, [sourceFilter, sortMode]);

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
                            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                                <h2 className="text-lg md:text-xl font-bold text-dark">창업 · 경제뉴스</h2>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={sourceFilter}
                                        onChange={(e) => setSourceFilter(e.target.value)}
                                        className="text-xs md:text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-white text-dark focus:outline-none focus:ring-1 focus:ring-brand"
                                    >
                                        <option value="all">전체 신문사</option>
                                        {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <select
                                        value={sortMode}
                                        onChange={(e) => setSortMode(e.target.value)}
                                        className="text-xs md:text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-white text-dark focus:outline-none focus:ring-1 focus:ring-brand"
                                    >
                                        <option value="date">최신순</option>
                                        <option value="source">신문사순</option>
                                    </select>
                                </div>
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
