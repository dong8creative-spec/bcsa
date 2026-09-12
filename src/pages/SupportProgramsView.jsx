import React, { useMemo, useState } from 'react';
import AdSlot, { hasAdSlot } from '../components/AdSlot';
import { firestoreLikeToMillis, getSupportProgramDdayInfo } from '../appHelpers';
import Pager from '../components/Pager';
import ContentDetailModal from '../components/ContentDetailModal';

const THUMB_COLORS = ['#E7A6A0', '#EBBB8C', '#E9D48C', '#A9CB9B', '#9DC3E0', '#BFA8D9', '#C7C7CC'];

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function colorForId(id) {
    let hash = 0;
    const s = String(id || '');
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return THUMB_COLORS[hash % THUMB_COLORS.length];
}

function formatDeadlineLabel(p) {
    if (p.isRolling) return '상시 모집';
    const dMs = firestoreLikeToMillis(p.deadlineAt);
    if (dMs == null) return '';
    const d = new Date(dMs);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 마감`;
}

function ProgramCard({ p, onOpen }) {
    const { label: ddayLabel, badgeClass } = getSupportProgramDdayInfo(p);
    const tags = [...(p.region || []), ...(p.industry || [])].slice(0, 2);
    const sub = p.amountText || tags.join(' · ') || p.org || '';

    return (
        <button
            type="button"
            onClick={() => onOpen(p)}
            className="group w-full text-left transition-transform duration-300 hover:-translate-y-1"
        >
            <div
                className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3"
                style={p.thumbnailUrl ? undefined : { background: colorForId(p.id) }}
            >
                {p.thumbnailUrl ? (
                    <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                    />
                ) : null}
                {ddayLabel ? (
                    <span className={`absolute top-3 left-3 inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap ${badgeClass}`}>
                        {ddayLabel}
                    </span>
                ) : null}
            </div>
            <p className="text-sm font-semibold leading-snug break-keep line-clamp-2 min-h-[2.5em] text-dark group-hover:text-brand transition-colors">{p.title}</p>
            {sub ? <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p> : null}
        </button>
    );
}

function ProgramRow({ title, hint, items, page, totalPages, onPageChange, onOpen }) {
    return (
        <div className="pb-10 last:pb-0">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-dark">{title}</h2>
                <span className="text-xs text-gray-400">{hint}</span>
            </div>
            {items.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                        {items.map((p) => <ProgramCard key={p.id} p={p} onOpen={onOpen} />)}
                    </div>
                    <Pager page={page} totalPages={totalPages} onChange={onPageChange} />
                </>
            ) : (
                <div className="py-10 text-center text-gray-400 bg-soft rounded-2xl">
                    <p className="text-sm">현재 등록된 지원사업이 없습니다.</p>
                </div>
            )}
        </div>
    );
}

/**
 * SupportProgramsView — 지원사업 독립 페이지
 *
 * 홈 화면에 인라인으로 있던 지원사업 전체 목록 섹션을 별도 페이지로 분리했다.
 * 데이터는 App.jsx에서 실시간 구독 중인 원본 supportPrograms 배열을 그대로 전달받아
 * 이 컴포넌트 내부에서 마감임박/신규/상시 세 그룹으로 가공한다(홈 화면용 8개 캡 없음).
 *
 * 정책: 등록(createdAt) 후 1년이 지난 공고는 자동으로 목록에서 숨긴다(ONE_YEAR_MS).
 * 노출: 각 그룹은 10개씩 페이지네이션된다(PAGE_SIZE).
 * 클릭 시: 외부 사이트로 이동하지 않고, 저장된 요약/내용을 사이트 안 모달로 보여준다
 * (ContentDetailModal) — 원문이 필요하면 모달 안의 "원문 보기"로 나갈 수 있다.
 */
export default function SupportProgramsView({ supportPrograms, content, onBack }) {
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'support-sidebar-1') || hasAdSlot(content, 'support-sidebar-1b') || hasAdSlot(content, 'support-sidebar-2');
    const [selected, setSelected] = useState(null);
    const [urgentPage, setUrgentPage] = useState(1);
    const [freshPage, setFreshPage] = useState(1);
    const [rollingPage, setRollingPage] = useState(1);

    const { urgent, fresh, rolling, urgentCount, freshCount } = useMemo(() => {
        const rows = Array.isArray(supportPrograms) ? supportPrograms : [];
        const nowMs = Date.now();
        const visible = rows.filter((p) => {
            if (!p || p.enabled === false || p.status !== 'published') return false;
            const createdMs = firestoreLikeToMillis(p.createdAt);
            return createdMs == null || (nowMs - createdMs) <= ONE_YEAR_MS; // 등록 1년 경과 시 자동 숨김
        });

        const dated = [];
        const rollingList = [];
        visible.forEach((p) => {
            if (p.isRolling) {
                rollingList.push(p);
                return;
            }
            const dMs = firestoreLikeToMillis(p.deadlineAt);
            if (dMs == null || dMs < nowMs) return;
            dated.push(p);
        });
        dated.sort((a, b) => firestoreLikeToMillis(a.deadlineAt) - firestoreLikeToMillis(b.deadlineAt));
        rollingList.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

        const freshList = visible
            .filter((p) => {
                const cMs = firestoreLikeToMillis(p.createdAt);
                return cMs != null && (nowMs - cMs) <= 7 * 86400000;
            })
            .sort((a, b) => firestoreLikeToMillis(b.createdAt) - firestoreLikeToMillis(a.createdAt));

        // "임박"은 D-10 이내(getSupportProgramDdayInfo와 동일 기준)로 통일한다.
        const urgentCountVal = dated.filter((p) => getSupportProgramDdayInfo(p).isUrgent).length;

        return {
            urgent: dated,
            fresh: freshList,
            rolling: rollingList,
            urgentCount: urgentCountVal,
            freshCount: freshList.length,
        };
    }, [supportPrograms]);

    const urgentTotalPages = Math.max(1, Math.ceil(urgent.length / PAGE_SIZE));
    const freshTotalPages = Math.max(1, Math.ceil(fresh.length / PAGE_SIZE));
    const rollingTotalPages = Math.max(1, Math.ceil(rolling.length / PAGE_SIZE));
    const urgentPageClamped = Math.min(urgentPage, urgentTotalPages);
    const freshPageClamped = Math.min(freshPage, freshTotalPages);
    const rollingPageClamped = Math.min(rollingPage, rollingTotalPages);
    const urgentItems = urgent.slice((urgentPageClamped - 1) * PAGE_SIZE, urgentPageClamped * PAGE_SIZE);
    const freshItems = fresh.slice((freshPageClamped - 1) * PAGE_SIZE, freshPageClamped * PAGE_SIZE);
    const rollingItems = rolling.slice((rollingPageClamped - 1) * PAGE_SIZE, rollingPageClamped * PAGE_SIZE);

    function openDetail(p) {
        const { label: badgeLabel, badgeClass } = getSupportProgramDdayInfo(p);
        setSelected({
            title: p.title || '',
            badgeLabel,
            badgeClass,
            org: p.org || '',
            dateLabel: formatDeadlineLabel(p),
            tags: [...(p.region || []), ...(p.industry || [])],
            amountText: p.amountText || '',
            summary: p.summary || '',
            description: p.description || '',
            externalUrl: p.applyUrl || p.sourceUrl || '',
        });
    }

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-7xl">
                    <AdSlot slotId="support-top-banner" content={content} className="mb-8" />
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 지원사업
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">SUPPORT PROGRAMS</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">
                        지금, 가장 뜨거운<br />지원사업
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">
                        긴 공고문 대신, 핵심만 요약해서 보여드립니다.
                    </p>
                    <div className="flex items-center gap-3 mt-8 flex-wrap">
                        <span className="text-gray-500 text-sm">신규 {freshCount}건 · 마감임박 {urgentCount}건</span>
                    </div>
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="xl:flex xl:gap-10 xl:items-start">
                        <div className="flex-1 min-w-0">
                            <ProgramRow title="마감임박 지원사업" hint="D-day 임박순" items={urgentItems} page={urgentPageClamped} totalPages={urgentTotalPages} onPageChange={setUrgentPage} onOpen={openDetail} />
                            <ProgramRow title="신규 지원사업" hint="NEW" items={freshItems} page={freshPageClamped} totalPages={freshTotalPages} onPageChange={setFreshPage} onOpen={openDetail} />
                            <ProgramRow title="상시 모집" hint="마감 없음" items={rollingItems} page={rollingPageClamped} totalPages={rollingTotalPages} onPageChange={setRollingPage} onOpen={openDetail} />
                        </div>

                        {/* 우측 배너 광고 레일 — 구글 표준 300px 폭(300×250/300×600) 기준, 최대 3슬롯.
                            실제 광고 소재가 등록되기 전까지는 AdSlot이 아무것도 렌더링하지 않으므로
                            공간을 차지하지 않는다. xl(1280px) 미만에서는 본문 폭 확보를 위해 숨김. */}
                        {/* 160×600(와이드 스카이스크래퍼) 기준 폭 300px 레일 구성.
                            160+120=280px로 300px 폭에 딱 맞아, 옆에 남는 폭에 120×600(스카이스크래퍼)을
                            하나 더 붙였다. 구글 정책상 "한 번에 하나의 sticky 광고만" 허용되므로,
                            둘 중 메인 광고(160×600)만 스크롤을 따라가게 하고 나머지는 일반 흐름으로 둔다.
                            실제 등록된 광고가 하나도 없으면(hasSidebarAd=false) 레일 자체를 렌더링하지
                            않아서, 옆 본문(flex-1)이 그 폭만큼 자연스럽게 넓어진다. */}
                        {hasSidebarAd ? (
                            <aside className="hidden xl:block w-[300px] shrink-0 space-y-6">
                                <div className="flex items-start gap-3">
                                    <div className="sticky top-[76px]">
                                        <AdSlot slotId="support-sidebar-1" content={content} className="w-[160px] h-[600px]" showPlaceholder placeholderSize="160×600" />
                                    </div>
                                    <AdSlot slotId="support-sidebar-1b" content={content} className="w-[120px] h-[600px]" showPlaceholder placeholderSize="120×600" />
                                </div>
                                <AdSlot slotId="support-sidebar-2" content={content} className="w-[300px] h-[250px]" showPlaceholder placeholderSize="300×250" />
                            </aside>
                        ) : null}
                    </div>
                </div>
            </section>

            <ContentDetailModal item={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
