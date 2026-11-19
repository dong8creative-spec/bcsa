import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdSlot from '../components/AdSlot';
import ContentDetailModal from '../components/ContentDetailModal';
import { firestoreLikeToMillis, getSupportProgramDdayInfo } from '../appHelpers';
import { isPreFounderItem, regionsOf, PRE_FOUNDER_LINKS } from '../constants/preFounder';
import { groupService, groupCoverUrl, GROUP_TYPE_LABEL } from '../services/groupService';
import { groupPoster } from '../constants/groupPosters';
import { MgPageHead, MgWrap, MgSectionHead, MgCard, MgInfoCard } from '../components/mg/Mg';

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

/** 먼저가본 개편: 작은 선택 칩(rounded-full 허용), 선택 = 검정 바탕 */
function Chip({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-[15px] font-semibold transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-line2 bg-white text-[#333] hover:border-ink'}`}>
            {children}
        </button>
    );
}

/** 지원사업 D-day 띠 색을 4색 규칙에 맞춘다(마감 임박 빨강·마감 회색은 그대로) */
const badgeTone = (c) => ({ 'bg-emerald-600': 'bg-royal', 'bg-orange-500': 'bg-ink', 'bg-brand': 'bg-royal' })[c] || c;

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
        title: p.title || '', badgeLabel: dday.label, badgeClass: badgeTone(dday.badgeClass), org: p.org || '',
        dateLabel: p.isRolling ? '상시 모집' : (firestoreLikeToMillis(p.deadlineAt) ? `마감 ${fmtDate(firestoreLikeToMillis(p.deadlineAt))}` : ''),
        tags: [...regionsOf(p), ...(p.industry || [])], summary: p.summary || '', description: p.description || '',
        externalUrl: p.applyUrl || p.sourceUrl || '',
    });
    const openNews = ({ n, ms }) => setSelected({
        title: n.title || '', badgeLabel: '창업 소식', badgeClass: 'bg-royal', org: n.source || '', dateExact: fmtDate(ms),
        tags: regionsOf(n), summary: n.summary || '', keySentence: n.keySentence || '', description: n.description || '', externalUrl: n.url || '',
    });

    return (
        <div className="min-h-screen bg-white">
            <MgPageHead eyebrow="Pre-founders" title={<>예비창업자를 위한<br className="md:hidden" /> 창업지원 찾기</>}
                desc="청년창업사관학교, 예비창업패키지처럼 창업을 준비하는 분이 신청할 수 있는 지원사업과 소식을 매일 모아 둡니다. 부산·경남 것부터 전국 것까지 한곳에서 찾아보세요." />

            <MgWrap className="space-y-14 pb-20 pt-10 md:space-y-[70px] md:pb-[100px] md:pt-14">
                <section aria-label="지원사업 찾기">
                    {/* 낱말을 치면 바로 걸러진다. 「찾기」는 휴대폰 자판을 닫는 용도 */}
                    <form role="search" onSubmit={(e) => { e.preventDefault(); document.activeElement?.blur?.(); }}>
                        <label htmlFor="pf-search" className="mb-2 block text-[15px] font-semibold text-ink">무엇을 찾으세요?</label>
                        <div className="flex gap-2">
                            <input id="pf-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
                                placeholder="예: 청년창업사관학교, 예비창업패키지, 교육, 자금"
                                className="h-[52px] min-w-0 flex-1 rounded-lg border border-line2 bg-white px-4 text-[16px] text-ink outline-none focus:border-royal" />
                            <button type="submit" className="h-[52px] shrink-0 rounded-lg bg-[#1a1a1a] px-5 text-[16px] font-bold text-white hover:bg-black md:px-[26px]">찾기</button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="지역">
                            {REGION_FILTERS.map(([k, l]) => <Chip key={k} active={region === k} onClick={() => setRegion(k)}>{l}</Chip>)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="종류">
                            {KIND_FILTERS.map(([k, l]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}
                            <label className="ml-1 inline-flex min-h-[44px] cursor-pointer items-center gap-2 px-2 text-[15px] font-semibold text-[#333]">
                                <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-5 w-5 accent-[#2d4fe0]" />
                                지금 신청할 수 있는 것만
                            </label>
                        </div>
                    </form>
                    <p className="mt-4 text-[15px] text-sub" role="status" aria-live="polite">
                        {showPrograms ? `지원사업 ${programRows.length}건` : ''}{showPrograms && showNews ? ' · ' : ''}{showNews ? `소식 ${newsRows.length}건` : ''}
                    </p>
                </section>

                {groups.length > 0 ? (
                    <section aria-labelledby="pf-groups">
                        <MgSectionHead id="pf-groups" title="예비창업자를 위한 모임" />
                        <div className="mt-[26px] grid grid-cols-2 gap-x-2.5 gap-y-6 md:grid-cols-3 md:gap-x-3">
                            {groups.map((g) => {
                                const poster = groupPoster(g);
                                return (
                                    <MgCard key={g.id}
                                        image={(poster && (poster.card || poster.image)) || groupCoverUrl(g)}
                                        imagePosition={poster && !poster.card ? 'top' : undefined}
                                        state={g.recruit === 'soon' ? '모집예정' : '모집중'}
                                        title={g.title}
                                        meta={<><span className="block truncate">{[GROUP_TYPE_LABEL[g.type] || '그룹', g.region].filter(Boolean).join(' ㅣ ')}</span><span className="block truncate text-sub">{(poster ? poster.tagline : g.description) || '\u00a0'}</span></>}
                                        onClick={() => navigate(`/groups/${g.id}`)} />
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {showPrograms ? (
                    <section aria-labelledby="pf-programs">
                        <MgSectionHead id="pf-programs" title="창업 지원사업" />
                        <div className="mt-[26px]">
                            {programRows.length === 0 ? (
                                <p className="break-keep rounded-xl bg-card p-6 text-[15px] text-sub">
                                    조건에 맞는 지원사업이 아직 없어요. {openOnly ? '「지금 신청할 수 있는 것만」을 끄거나 ' : ''}지역을 「전체 지역」으로 바꿔 보세요. 아래 「처음 찾아볼 곳」에서 직접 찾아볼 수도 있어요.
                                </p>
                            ) : (
                                <>
                                    <ul className="divide-y divide-line border-y border-line">
                                        {programRows.slice(0, shownPrograms).map((x) => (
                                            <li key={x.p.id}>
                                                <button type="button" onClick={() => openProgram(x)} className="flex w-full items-start gap-3 px-1 py-4 text-left hover:bg-card">
                                                    {/* 띠 자리는 늘 같은 너비로 비워 둬서 제목 시작점이 줄마다 같다 */}
                                                    <span className={`mt-0.5 inline-flex h-6 w-[60px] shrink-0 items-center justify-center whitespace-nowrap px-1 text-[13px] font-semibold text-white ${x.dday.label ? badgeTone(x.dday.badgeClass) : ''}`}>{x.dday.label || ''}</span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="line-clamp-2 min-h-[2.75em] break-keep text-[16px] font-semibold leading-snug text-ink">{x.p.title}</span>
                                                        <span className="mt-1 block truncate text-[14px] text-sub">{[x.p.org, x.regions.filter((r) => r !== '기타지역').join('·'), x.p.isRolling ? '상시 모집' : (x.deadlineMs ? `마감 ${fmtDate(x.deadlineMs)}` : '')].filter(Boolean).join(' · ') || '\u00a0'}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {programRows.length > shownPrograms ? (
                                        <button type="button" onClick={() => setShownPrograms((n) => n + STEP)} className="mt-4 h-12 w-full rounded-lg border border-line2 bg-white text-[15px] font-semibold text-ink hover:border-ink">
                                            지원사업 더 보기 ({programRows.length - shownPrograms}건 남음)
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </section>
                ) : null}

                <AdSlot slotId="startup-mid-banner" content={content} />

                {showNews ? (
                    <section aria-labelledby="pf-news">
                        <MgSectionHead id="pf-news" title="창업 지원 소식" />
                        <div className="mt-[26px]">
                            {newsRows.length === 0 ? (
                                <p className="break-keep rounded-xl bg-card p-6 text-[15px] text-sub">조건에 맞는 소식이 아직 없어요. 매일 아침 새 소식을 모아 와요.</p>
                            ) : (
                                <>
                                    <ul className="divide-y divide-line border-y border-line">
                                        {newsRows.slice(0, shownNews).map((x) => (
                                            <li key={x.n.id}>
                                                <button type="button" onClick={() => openNews(x)} className="w-full px-1 py-4 text-left hover:bg-card">
                                                    <span className="line-clamp-2 min-h-[2.75em] break-keep text-[16px] font-semibold leading-snug text-ink">{x.n.title}</span>
                                                    <span className="mt-1 block truncate text-[14px] text-sub">{[fmtDate(x.ms), x.n.source].filter(Boolean).join(' · ') || '\u00a0'}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {newsRows.length > shownNews ? (
                                        <button type="button" onClick={() => setShownNews((n) => n + STEP)} className="mt-4 h-12 w-full rounded-lg border border-line2 bg-white text-[15px] font-semibold text-ink hover:border-ink">
                                            소식 더 보기 ({newsRows.length - shownNews}건 남음)
                                        </button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </section>
                ) : null}

                <section aria-labelledby="pf-links">
                    <MgSectionHead id="pf-links" title="처음 찾아볼 곳" desc="공식 창업지원 사이트예요. 누르면 새 창으로 열려요." />
                    <div className="mt-[26px] grid gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
                        {PRE_FOUNDER_LINKS.map((l) => (
                            // 새 창 링크: MgInfoCard 의 newTab 으로 다른 안내 카드와 같은 모양·같은 높이
                            <MgInfoCard key={l.url} href={l.url} newTab en={l.org} title={<>{l.name}<span className="sr-only"> (새 창)</span></>} desc={l.desc} />
                        ))}
                    </div>
                </section>
            </MgWrap>
            <ContentDetailModal item={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
