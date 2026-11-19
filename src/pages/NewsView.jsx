import React, { useMemo, useState } from 'react';
import AdSlot, { useAnyAdVisible } from '../components/AdSlot';
import { firestoreLikeToMillis } from '../appHelpers';
import Pager from '../components/Pager';
import NewsDetailModal from '../components/NewsDetailModal';
import firebaseService from '../services/firebaseService';
import { MgPageHead, MgWrap } from '../components/mg/Mg';

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
 * (NewsDetailModal — 뉴스 전용 상세 모달, 지원사업 카드의 ContentDetailModal과는 별개) —
 * 원문이 필요하면 모달 안의 "원문 보기"로 나갈 수 있다. 어느 경우든 사이트를 벗어나지 않고
 * 모달 안에서 제목·본문을 다 읽을 수 있고, "원문 보기"를 직접 눌렀을 때만 새 탭으로 나간다.
 *
 * 필터: "카테고리"(지원사업 등 8종 + 실제 존재하는 것만 노출), "신문사", "정렬"(최신순/신문사순)을
 * 목록 위에서 고를 수 있다 — 지원금(지원사업) 관련 기사만 따로 보고 싶으면 카테고리에서 "지원사업"을
 * 고르면 된다.
 * 모달의 "핵심 문장"은 별도 필드(newsItems.keySentence)로, 수집 스크립트가 네이버 요약 스니펫을
 * 문장 단위로 쪼개 가장 완결되고 핵심 정보가 많은 한 문장을 규칙 기반으로 골라둔 것이다 — Claude 등
 * LLM이 새로 문장을 써주는 "진짜 AI 요약"은 아니다(그러려면 별도 API 키와 비용 필요, 우선 보류).
 *
 * 조회수: newsItems.viewCount를 목록/모달에 노출한다. 기사를 열 때(openNewsDetail)
 * firebaseService.incrementNewsViewCount를 호출해 "이 사이트 안에서" 실제로 열어본 횟수만
 * +1씩 쌓는다(원문 언론사 사이트의 조회수가 아니라 우리 사이트 자체 집계) — firestore.rules가
 * viewCount 필드 하나만 정확히 +1씩 올리는 요청은 비로그인 사용자에게도 허용해준다. 모달을 여는
 * 순간 화면에 보이는 숫자는 실제 저장 결과를 기다리지 않고 +1을 미리 더해 보여준다(낙관적 갱신) —
 * Firestore 왕복을 기다리면 클릭 직후 잠깐 옛 숫자가 보이는 게 더 어색하다.
 *
 * 동전 애니메이션: 지원금/정책자금/대출 관련 기사(카테고리가 "지원사업"이거나 본문에 해당
 * 키워드가 있으면)는 모달 맨 아래에 작은 동전 애니메이션이 뜬다(showCoinAnimation → NewsDetailModal).
 */

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 카테고리별 배지 라벨/색 — scripts/ingest-daily-feed.mjs의 NEWS_KEYWORD_GROUPS 카테고리와 1:1로 맞춘다.
// notice/econ은 이전 수집 방식으로 저장된 문서를 위한 하위 호환 항목.
// 먼저가본 개편(2026-11): 색 규칙(검정·흰색·하늘·로얄블루)에 맞춰 카테고리 표시는 작은 네모 하나로 통일 —
// 「지원사업」만 로얄블루 바탕으로 눈에 띄게, 나머지는 하늘 바탕 + 로얄블루 글자.
const CAT_STRONG = 'bg-royal text-white';
const CAT_SOFT = 'bg-sky text-royal';
const CATEGORY_META = {
    '지원사업': { label: '지원사업', badgeClass: CAT_STRONG },
    '창업·투자': { label: '창업·투자', badgeClass: CAT_SOFT },
    '모집·행사': { label: '모집·행사', badgeClass: CAT_SOFT },
    '상권·소비': { label: '상권·소비', badgeClass: CAT_SOFT },
    '판로·마케팅': { label: '판로·마케팅', badgeClass: CAT_SOFT },
    '세무·노무': { label: '세무·노무', badgeClass: CAT_SOFT },
    '기술·트렌드': { label: '기술·트렌드', badgeClass: CAT_SOFT },
    '위기·대응': { label: '위기·대응', badgeClass: CAT_SOFT },
    notice: { label: '공고', badgeClass: CAT_SOFT },
    econ: { label: '경제', badgeClass: CAT_SOFT },
};
const DEFAULT_CATEGORY_META = { label: '뉴스', badgeClass: 'bg-card text-sub' };

function categoryMetaFor(category) {
    return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}

// 신문사 이름 — 네이버 뉴스검색 API는 언론사명을 별도 필드로 주지 않아서(title/link/description/
// pubDate뿐), 수집 스크립트가 링크 주소의 도메인을 "출처"로 대신 저장해왔다(예: yna.co.kr).
// 실제 수집된 도메인 중 자신 있게 아는 주요 언론사만 이름으로 바꿔 보여준다 — 모르는 도메인까지
// 억지로 이름을 지어 붙이면 틀린 언론사명을 보여줄 위험이 있어서, 매핑에 없는 도메인은 예전처럼
// 도메인 그대로 보여준다(틀리느니 안전한 쪽).
const PRESS_NAMES = {
    'yna.co.kr': '연합뉴스', 'news1.kr': '뉴스1', 'newsis.com': '뉴시스', 'newspim.com': '뉴스핌',
    'sedaily.com': '서울경제', 'mt.co.kr': '머니투데이', 'fnnews.com': '파이낸셜뉴스', 'mk.co.kr': '매일경제',
    'hankyung.com': '한국경제', 'edaily.co.kr': '이데일리', 'etnews.com': '전자신문', 'zdnet.co.kr': '지디넷코리아',
    'dt.co.kr': '디지털타임스', 'inews24.com': '아이뉴스24', 'thebell.co.kr': '더벨', 'newstomato.com': '뉴스토마토',
    'chosun.com': '조선일보', 'donga.com': '동아일보', 'joongang.co.kr': '중앙일보', 'hani.co.kr': '한겨레',
    'khan.co.kr': '경향신문', 'seoul.co.kr': '서울신문', 'segye.com': '세계일보', 'munhwa.com': '문화일보',
    'hankookilbo.com': '한국일보', 'kmib.co.kr': '국민일보', 'nocutnews.co.kr': '노컷뉴스', 'pressian.com': '프레시안',
    'kukinews.com': '쿠키뉴스', 'ajunews.com': '아주경제', 'view.asiae.co.kr': '아시아경제', 'asiatoday.co.kr': '아시아투데이',
    'biz.heraldcorp.com': '헤럴드경제', 'etoday.co.kr': '이투데이', 'viva100.com': '브릿지경제', 'ekn.kr': '에너지경제',
    'news.kbs.co.kr': 'KBS뉴스', 'news.sbs.co.kr': 'SBS뉴스', 'biz.sbs.co.kr': 'SBS Biz', 'imnews.imbc.com': 'MBC뉴스',
    'ytn.co.kr': 'YTN', 'mbn.co.kr': 'MBN', 'news.mtn.co.kr': 'MTN', 'wowtv.co.kr': '한국경제TV',
    'busan.com': '부산일보', 'kookje.co.kr': '국제신문', 'news.knn.co.kr': 'KNN', 'busanmbc.co.kr': '부산MBC',
    'yeongnam.com': '영남일보', 'imaeil.com': '매일신문', 'kado.net': '강원도민일보', 'kyeonggi.com': '경기일보',
    'naeil.com': '내일신문', 'nongmin.com': '농민신문', 'venturesquare.net': '벤처스퀘어', 'platum.kr': '플래텀',
    'techm.kr': '테크M', 'ddaily.co.kr': '디지털데일리', 'businesskorea.co.kr': 'Business Korea',
    'metroseoul.co.kr': '메트로신문', 'sentv.co.kr': '서울경제TV', 'cnbnews.com': 'CNB뉴스', 'tbc.co.kr': 'TBC',
};
function pressName(source) {
    return PRESS_NAMES[source] || source;
}

function formatExactDate(ms) {
    if (ms == null || !Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 지원금/정책자금/대출 관련 기사인지 — 동전 애니메이션을 붙일지 판단하는 기준.
const FUNDING_KEYWORD_RE = /지원금|정책자금|대출/;

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

// 요청에 따라 한 줄 요약 미리보기(item.preview)는 목록에서 뺐다 — 대신 제목을 크게 키워서
// 목록을 "훑어보기" 쉽게 하고, 실제 내용은 눌렀을 때 NewsDetailModal에서 여유 있게 보여준다.
function NewsRow({ item, onOpen }) {
    return (
        <div className="border-b border-line">
            <button
                type="button"
                onClick={() => onOpen(item.detail)}
                className="flex min-h-[76px] w-full flex-col justify-center gap-1.5 py-4 text-left transition-colors hover:bg-card md:min-h-[62px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-2 md:py-[18px]"
            >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className={`inline-flex h-6 w-[92px] shrink-0 items-center justify-center whitespace-nowrap px-1 text-[12.5px] font-semibold leading-none ${item.badgeClass}`}>{item.badge}</span>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{item.title}</span>
                </span>
                <span className="min-w-0 truncate text-[13px] text-sub md:max-w-[340px] md:shrink-0 md:whitespace-nowrap md:text-[14px]">{item.meta || '\u00a0'}</span>
            </button>
        </div>
    );
}

const selectCls = 'h-12 min-w-0 rounded-lg border border-line2 bg-white px-3 text-[15px] text-ink focus:border-royal focus:outline-none';

export default function NewsView({ content, onBack, newsItems }) {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const [sourceFilter, setSourceFilter] = useState('all'); // 신문사 필터 — '전체' 또는 특정 언론사명
    const [categoryFilter, setCategoryFilter] = useState('all'); // 카테고리 필터 — '전체' 또는 지원사업 등 특정 카테고리
    const [sortMode, setSortMode] = useState('date'); // 'date'(최신순, 기본) | 'source'(신문사순)
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = useAnyAdVisible(content, ['news-sidebar-1', 'news-sidebar-1b', 'news-sidebar-2']);

    // "1년 지난 기사 숨기기" 기준 시각 — 마운트 시 한 번만 고정한다.
    // 예전에는 매 렌더마다 Date.now()를 새로 읽어 useMemo 의존성 배열에 넣었는데, 밀리초 단위로
    // 거의 항상 값이 달라지다 보니 아래 ALL_NEWS_ITEMS의 useMemo가 사실상 매번 다시 계산되고
    // 있었다(캐시 효과가 없었음) — 필터를 바꾸거나 페이지만 넘겨도 전체 목록을 다시 필터링·정렬.
    // "1년 지났는지" 판정은 초 단위로 정확할 필요가 없으므로 한 번만 고정해도 충분하다.
    const now = useMemo(() => Date.now(), []);

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
                const categoryKey = n.category || '';
                const meta = categoryMetaFor(categoryKey);
                const publishedMs = firestoreLikeToMillis(n.publishedAt);
                const dateLabel = relativeTime(publishedMs);
                const dateExact = formatExactDate(publishedMs);
                const source = n.source || '';
                const viewCount = Number(n.viewCount) || 0;
                const targets = String(n.target || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                const showCoinAnimation = categoryKey === '지원사업' || FUNDING_KEYWORD_RE.test(`${n.title || ''} ${n.summary || ''}`);
                return {
                    id: n.id || '',
                    title: n.title || '',
                    source,
                    categoryKey,
                    publishedMs,
                    sortOrder: Number(n.sortOrder) || 0,
                    badge: meta.label,
                    badgeClass: meta.badgeClass,
                    meta: [pressName(source), dateExact, dateLabel, viewCount > 0 ? `조회 ${viewCount}` : null].filter(Boolean).join(' · '),
                    detail: {
                        id: n.id || '',
                        title: n.title || '',
                        badgeLabel: meta.label,
                        badgeClass: meta.badgeClass,
                        org: pressName(source),
                        dateLabel,
                        dateExact,
                        viewCount,
                        tags: targets,
                        amountText: n.deadlineText ? `신청기한: ${n.deadlineText}` : '',
                        summary: n.summary || '',
                        keySentence: n.keySentence || '',
                        description: n.description || '',
                        externalUrl: n.url || '',
                        showCoinAnimation,
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

    // 실제 존재하는 카테고리만 옵션으로 노출 — CATEGORY_META 정의 순서(지원사업이 맨 앞)를 그대로 따른다.
    const categoryOptions = useMemo(() => {
        const present = new Set();
        ALL_NEWS_ITEMS.forEach((item) => { present.add(item.categoryKey); });
        return Object.keys(CATEGORY_META).filter((key) => present.has(key));
    }, [ALL_NEWS_ITEMS]);

    const NEWS_ITEMS = useMemo(() => {
        let rows = ALL_NEWS_ITEMS;
        if (sourceFilter !== 'all') rows = rows.filter((item) => item.source === sourceFilter);
        if (categoryFilter !== 'all') rows = rows.filter((item) => item.categoryKey === categoryFilter);
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
    }, [ALL_NEWS_ITEMS, sourceFilter, categoryFilter, sortMode]);

    // 필터/정렬을 바꾸면 이전 페이지 번호가 남아 빈 페이지가 보일 수 있어 1페이지로 되돌린다.
    React.useEffect(() => { setPage(1); }, [sourceFilter, categoryFilter, sortMode]);

    const totalPages = Math.max(1, Math.ceil(NEWS_ITEMS.length / PAGE_SIZE));
    const pageClamped = Math.min(page, totalPages);
    const pageItems = NEWS_ITEMS.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

    // 기사를 열 때 "이 사이트에서 본 조회수"를 +1 올린다. 실제 저장은 백그라운드로 보내고,
    // 화면에는 바로 +1된 숫자를 보여준다(낙관적 갱신) — Firestore 응답을 기다리면 클릭 직후
    // 잠깐 옛 숫자가 보이는 게 더 어색해서다. 실패해도(firebaseService가 에러를 삼킴) 열람
    // 자체는 막지 않는다.
    function openNewsDetail(detail) {
        if (!detail) return;
        if (detail.id) {
            firebaseService.incrementNewsViewCount(detail.id);
            setSelected({ ...detail, viewCount: (Number(detail.viewCount) || 0) + 1 });
        } else {
            setSelected(detail);
        }
    }

    const filterBtn = (active) => `h-11 border px-3.5 text-[15px] font-semibold transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-[#555] hover:border-ink hover:text-ink'}`;

    return (
        <div className="min-h-screen overflow-y-auto bg-white">
            <MgPageHead
                crumbs={(
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="underline-offset-2 hover:text-white hover:underline">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span>뉴스
                    </>
                )}
                eyebrow="NEWS"
                title="뉴스"
                desc="바쁜 하루, 놓치기 쉬운 사업 소식을 대신 모아 두었어요."
            />

            <section className="pb-16 pt-10 md:pb-[100px] md:pt-14">
                <MgWrap>
                    <div className="xl:flex xl:items-start xl:gap-10">
                        <div className="min-w-0 flex-1">
                            <h2 className="text-[23px] font-bold leading-[1.4] text-ink md:text-[28px]">창업 · 경제뉴스</h2>

                            {/* 거르기 — 카테고리는 직사각형 버튼 줄(넘치면 다음 줄로), 신문사·정렬은 고르기 칸 */}
                            <div role="group" aria-label="카테고리" className="mt-5 flex flex-wrap gap-1.5">
                                <button type="button" aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} className={filterBtn(categoryFilter === 'all')}>전체</button>
                                {categoryOptions.map((key) => (
                                    <button key={key} type="button" aria-pressed={categoryFilter === key} onClick={() => setCategoryFilter(key)} className={filterBtn(categoryFilter === key)}>
                                        {categoryMetaFor(key).label}
                                    </button>
                                ))}
                            </div>
                            <div className="mb-6 mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                                <label className="min-w-0">
                                    <span className="sr-only">신문사</span>
                                    <select
                                        value={sourceFilter}
                                        onChange={(e) => setSourceFilter(e.target.value)}
                                        className={`${selectCls} w-full sm:w-[220px]`}
                                    >
                                        <option value="all">전체 신문사</option>
                                        {sourceOptions.map((s) => <option key={s} value={s}>{pressName(s)}</option>)}
                                    </select>
                                </label>
                                <label className="min-w-0">
                                    <span className="sr-only">정렬</span>
                                    <select
                                        value={sortMode}
                                        onChange={(e) => setSortMode(e.target.value)}
                                        className={`${selectCls} w-full sm:w-[150px]`}
                                    >
                                        <option value="date">최신순</option>
                                        <option value="source">신문사순</option>
                                    </select>
                                </label>
                            </div>

                            {pageItems.length > 0 ? (
                                <>
                                    <div className="border-t border-ink">
                                        {pageItems.map((item, i) => (
                                            // key는 제목이 아니라 id로 — 같은 날 비슷한 제목의 기사가 여러 신문사에서
                                            // 동시에 실리는 일이 흔해서, 제목 기준 key는 다른 기사인데 같은 key로
                                            // 잡혀 React가 잘못된 항목을 재사용할 수 있었다.
                                            <React.Fragment key={item.id || `${item.title}-${i}`}>
                                                <NewsRow item={item} onOpen={openNewsDetail} />
                                                {i === 3 ? <AdSlot slotId="news-list-native" content={content} className="my-1" /> : null}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <Pager page={pageClamped} totalPages={totalPages} onChange={setPage} />
                                </>
                            ) : (
                                <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">등록된 뉴스가 아직 없습니다.</p>
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
                </MgWrap>
            </section>

            <NewsDetailModal item={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
