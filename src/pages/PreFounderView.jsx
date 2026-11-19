import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdSlot from '../components/AdSlot';
import ContentDetailModal from '../components/ContentDetailModal';
import { Icons } from '../components/Icons';
import { firestoreLikeToMillis, getSupportProgramDdayInfo } from '../appHelpers';
import { isPreFounderItem, regionsOf, PRE_FOUNDER_LINKS } from '../constants/preFounder';
import { groupService, groupCoverUrl, GROUP_TYPE_LABEL } from '../services/groupService';
import { groupPoster } from '../constants/groupPosters';

/**
 * 예비창업 지원 찾기 (/startup)
 * 이미 사업을 하는 분이 아니라 창업을 준비하는 분을 위한 화면.
 * 사이트가 매일 모으는 지원사업(supportPrograms)·뉴스(newsItems) 가운데 예비·초기 창업 관련만 골라
 * 지역(부산·경남·울산·전국)·종류로 거르고 낱말로 찾는다. 예비창업자 대상 스터디도 위에 보여 준다.
 */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const STEP = 10;
const REGION_FILTERS = [['all', '전체 지역'], ['busan', '부산'], ['dongnam', '경남·울산'], ['nation', '전국']];
const KIND_FILTERS = [['all', '전체'], ['program', '지원사업'], ['news', '소식']];

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
const matchRegion = (regions, f) => f === 'all'
    || (f === 'busan' && regions.includes('부산'))
    || (f === 'dongnam' && (regions.includes('경남') || regions.includes('울산')))
    || (f === 'nation' && regions.includes('전국'));

function Chip({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={`shrink-0 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${active ? 'bg-dark text-white' : 'bg-soft text-gray-700 hover:bg-[#eceef2]'}`}>
            {children}
        </button>
    );
}

export default function PreFounderView({ supportPrograms, newsItems, content }) {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [region, setRegion] = useState('all');
    const [kind, setKind] = useState('all');
    const [openOnly, setOpenOnly] = useState(true);
    const [shownPrograms, setShownPrograms] = useState(STEP);
    const [shownNews, setShownNews] = useState(STEP);
    const [selected, setSelected] = useState(null);
    const [groups, setGroups] = useState([]);
    const now = useMemo(() => Date.now(), []);

    useEffect(() => groupService.subscribeApprovedGroups((rows) => setGroups(
        (rows || []).filter((g) => isPreFounderItem({ title: g.title, summary: g.description })),
    )), []);
    useEffect(() => { setShownPrograms(STEP); setShownNews(STEP); }, [q, region, kind, openOnly]);

    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (text) => words.every((w) => text.toLowerCase().includes(w));

    const programs = useMemo(() => (Array.isArray(supportPrograms) ? supportPrograms : [])
        .filter((p) => p && p.enabled !== false && (p.status || 'published') === 'published')
        .filter((p) => { const c = firestoreLikeToMillis(p.createdAt); return c == null || now - c <= ONE_YEAR_MS; })
        .filter(isPreFounderItem)
        .map((p) => ({ p, dday: getSupportProgramDdayInfo(p), regions: regionsOf(p), deadlineMs: firestoreLikeToMillis(p.deadlineAt) }))
        .sort((a, b) => {
            const closedA = a.dday.label === '마감', closedB = b.dday.label === '마감';
            if (closedA !== closedB) return closedA ? 1 : -1;
            if (a.deadlineMs != null && b.deadlineMs != null) return a.deadlineMs - b.deadlineMs;
            if (a.deadlineMs != null) return -1;
            if (b.deadlineMs != null) return 1;
            return (firestoreLikeToMillis(b.p.createdAt) || 0) - (firestoreLikeToMillis(a.p.createdAt) || 0);
        }), [supportPrograms, now]);

    const news = useMemo(() => (Array.isArray(newsItems) ? newsItems : [])
        .filter((n) => n && n.enabled !== false && (n.status || 'published') === 'published')
        .map((n) => ({ n, ms: firestoreLikeToMillis(n.publishedAt) }))
        .filter(({ ms }) => ms == null || now - ms <= ONE_YEAR_MS)
        .filter(({ n }) => isPreFounderItem(n))
        .map((x) => ({ ...x, regions: regionsOf(x.n) }))
        .sort((a, b) => (b.ms || 0) - (a.ms || 0)), [newsItems, now]);

    const programRows = programs
        .filter((x) => !openOnly || x.dday.label !== '마감')
        .filter((x) => matchRegion(x.regions, region))
        .filter((x) => !words.length || hit(`${x.p.title} ${x.p.org} ${x.p.summary} ${x.p.description || ''}`));
    const newsRows = news
        .filter((x) => matchRegion(x.regions, region))
        .filter((x) => !words.length || hit(`${x.n.title} ${x.n.summary || ''} ${x.n.source || ''}`));
    const showPrograms = kind !== 'news';
    const showNews = kind !== 'program';

    const openProgram = ({ p, dday }) => setSelected({
        title: p.title || '', badgeLabel: dday.label, badgeClass: dday.badgeClass, org: p.org || '',
        dateLabel: p.isRolling ? '상시 모집' : (firestoreLikeToMillis(p.deadlineAt) ? `마감 ${fmtDate(firestoreLikeToMillis(p.deadlineAt))}` : ''),
        tags: [...regionsOf(p), ...(p.industry || [])], summary: p.summary || '', description: p.description || '',
        externalUrl: p.applyUrl || p.sourceUrl || '',
    });
    const openNews = ({ n, ms }) => setSelected({
        title: n.title || '', badgeLabel: '창업 소식', badgeClass: 'bg-brand', org: n.source || '', dateExact: fmtDate(ms),
        tags: regionsOf(n), summary: n.summary || '', keySentence: n.keySentence || '', description: n.description || '', externalUrl: n.url || '',
    });

    return (
        <div className="min-h-screen bg-white">
            <section className="pt-32 pb-10 md:pt-40 md:pb-12 px-6" style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,140,120,.12), transparent 55%), #ffffff' }}>
                <div className="container mx-auto max-w-5xl">
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-3">PRE-FOUNDERS</p>
                    <h1 className="text-[28px] leading-[1.2] md:text-[44px] md:leading-[1.15] font-semibold tracking-tight text-dark break-keep">
                        예비창업자를 위한<br className="md:hidden" /> 창업지원 찾기
                    </h1>
                    <p className="mt-4 text-base md:text-lg text-gray-600 max-w-2xl break-keep">
                        청년창업사관학교, 예비창업패키지처럼 창업을 준비하는 분이 신청할 수 있는 지원사업과 소식을 매일 모아 둡니다. 부산·경남 것부터 전국 것까지 한곳에서 찾아보세요.
                    </p>
                    <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-8">
                        <label htmlFor="pf-search" className="block text-[15px] font-semibold text-dark mb-2">무엇을 찾으세요?</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1 min-w-0">
                                <Icons.Search size={20} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input id="pf-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
                                    placeholder="예: 청년창업사관학교, 예비창업패키지, 교육, 자금"
                                    className="w-full rounded-2xl border border-black/15 bg-white py-4 pl-12 pr-4 text-[17px] text-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="지역">
                            {REGION_FILTERS.map(([k, l]) => <Chip key={k} active={region === k} onClick={() => setRegion(k)}>{l}</Chip>)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="종류">
                            {KIND_FILTERS.map(([k, l]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}
                            <label className="ml-1 inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-[15px] font-semibold text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-5 w-5 accent-[#0046A5]" />
                                지금 신청할 수 있는 것만
                            </label>
                        </div>
                    </form>
                    <p className="mt-4 text-[15px] text-gray-600" role="status" aria-live="polite">
                        {showPrograms ? `지원사업 ${programRows.length}건` : ''}{showPrograms && showNews ? ' · ' : ''}{showNews ? `소식 ${newsRows.length}건` : ''}
                    </p>
                </div>
            </section>

            <div className="px-6 pb-20">
                <div className="container mx-auto max-w-5xl space-y-12">
                    {groups.length > 0 ? (
                        <section aria-labelledby="pf-groups">
                            <h2 id="pf-groups" className="text-xl md:text-2xl font-semibold text-dark mb-4">예비창업자 스터디·워크숍</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {groups.map((g) => {
                                    const poster = groupPoster(g);
                                    return (
                                        <button key={g.id} type="button" onClick={() => navigate(`/groups/${g.id}`)}
                                            className="group text-left flex gap-4 rounded-[24px] border border-black/[0.06] bg-white p-4 hover:shadow-md transition-shadow">
                                            <img src={poster ? poster.image : groupCoverUrl(g)} alt="" loading="lazy" decoding="async"
                                                className={`shrink-0 rounded-xl object-cover ${poster ? 'w-24 aspect-[794/1123]' : 'w-28 aspect-[16/10]'}`} />
                                            <span className="min-w-0 flex flex-col">
                                                <span className="text-[13px] font-bold text-violet-700">{GROUP_TYPE_LABEL[g.type] || '그룹'}{poster ? ' · 모집 중' : ''}</span>
                                                <span className="mt-1 text-[17px] font-semibold leading-snug text-dark break-keep">{g.title}</span>
                                                <span className="mt-1 text-[14px] text-gray-600 line-clamp-2 break-keep">{g.description}</span>
                                                <span className="mt-auto pt-2 text-[14px] font-semibold text-brand">자세히 보기 →</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    {showPrograms ? (
                        <section aria-labelledby="pf-programs">
                            <h2 id="pf-programs" className="text-xl md:text-2xl font-semibold text-dark mb-4">창업 지원사업</h2>
                            {programRows.length === 0 ? (
                                <p className="rounded-2xl bg-soft p-6 text-[15px] text-gray-600 break-keep">
                                    조건에 맞는 지원사업이 아직 없어요. {openOnly ? '「지금 신청할 수 있는 것만」을 끄거나 ' : ''}지역을 「전체 지역」으로 바꿔 보세요. 아래 「처음 찾아볼 곳」에서 직접 찾아볼 수도 있어요.
                                </p>
                            ) : (
                                <>
                                    <ul className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
                                        {programRows.slice(0, shownPrograms).map((x) => (
                                            <li key={x.p.id}>
                                                <button type="button" onClick={() => openProgram(x)} className="w-full text-left flex items-start gap-3 py-4 hover:bg-soft/60 px-1">
                                                    {x.dday.label ? <span className={`mt-0.5 shrink-0 inline-flex h-6 min-w-[52px] items-center justify-center rounded-full px-2 text-[12px] font-bold text-white ${x.dday.badgeClass}`}>{x.dday.label}</span> : null}
                                                    <span className="min-w-0">
                                                        <span className="block text-[16px] font-semibold leading-snug text-dark break-keep">{x.p.title}</span>
                                                        <span className="mt-1 block text-[14px] text-gray-600 break-keep">{[x.p.org, x.regions.filter((r) => r !== '기타지역').join('·'), x.p.isRolling ? '상시 모집' : (x.deadlineMs ? `마감 ${fmtDate(x.deadlineMs)}` : '')].filter(Boolean).join(' · ')}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {programRows.length > shownPrograms ? (
                                        <button type="button" onClick={() => setShownPrograms((n) => n + STEP)} className="mt-4 w-full rounded-full bg-soft py-3.5 text-[15px] font-semibold text-dark">
                                            지원사업 더 보기 ({programRows.length - shownPrograms}건 남음)
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </section>
                    ) : null}

                    <AdSlot slotId="startup-mid-banner" content={content} />

                    {showNews ? (
                        <section aria-labelledby="pf-news">
                            <h2 id="pf-news" className="text-xl md:text-2xl font-semibold text-dark mb-4">창업 지원 소식</h2>
                            {newsRows.length === 0 ? (
                                <p className="rounded-2xl bg-soft p-6 text-[15px] text-gray-600 break-keep">조건에 맞는 소식이 아직 없어요. 매일 아침 새 소식을 모아 와요.</p>
                            ) : (
                                <>
                                    <ul className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
                                        {newsRows.slice(0, shownNews).map((x) => (
                                            <li key={x.n.id}>
                                                <button type="button" onClick={() => openNews(x)} className="w-full text-left py-4 px-1 hover:bg-soft/60">
                                                    <span className="block text-[16px] font-semibold leading-snug text-dark break-keep">{x.n.title}</span>
                                                    <span className="mt-1 block text-[14px] text-gray-600">{[fmtDate(x.ms), x.n.source].filter(Boolean).join(' · ')}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {newsRows.length > shownNews ? (
                                        <button type="button" onClick={() => setShownNews((n) => n + STEP)} className="mt-4 w-full rounded-full bg-soft py-3.5 text-[15px] font-semibold text-dark">
                                            소식 더 보기 ({newsRows.length - shownNews}건 남음)
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </section>
                    ) : null}

                    <section aria-labelledby="pf-links">
                        <h2 id="pf-links" className="text-xl md:text-2xl font-semibold text-dark mb-1">처음 찾아볼 곳</h2>
                        <p className="text-[15px] text-gray-600 mb-4 break-keep">공식 창업지원 사이트예요. 누르면 새 창으로 열려요.</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {PRE_FOUNDER_LINKS.map((l) => (
                                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                                    className="flex flex-col rounded-[20px] border border-black/[0.06] bg-white p-5 hover:shadow-md transition-shadow">
                                    <span className="text-[13px] font-semibold text-gray-500">{l.org}</span>
                                    <span className="mt-1 inline-flex items-center gap-1.5 text-[17px] font-bold text-dark">
                                        {l.name} <Icons.ExternalLink size={15} aria-hidden="true" className="text-gray-400" />
                                        <span className="sr-only">(새 창)</span>
                                    </span>
                                    <span className="mt-2 text-[14px] leading-relaxed text-gray-600 break-keep">{l.desc}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
            <ContentDetailModal item={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
