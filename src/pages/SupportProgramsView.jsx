import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdSlot, { hasAdSlot } from '../components/AdSlot';
import { firestoreLikeToMillis, getSupportProgramDdayInfo, bucketSupportPrograms } from '../appHelpers';
import Pager from '../components/Pager';
import ContentDetailModal from '../components/ContentDetailModal';
import ModalPortal from '../components/ModalPortal';
import { Icons } from '../components/Icons';

const THUMB_COLORS = ['#E7A6A0', '#EBBB8C', '#E9D48C', '#A9CB9B', '#9DC3E0', '#BFA8D9', '#C7C7CC'];

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function colorForId(id) {
    let hash = 0;
    const s = String(id || '');
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return THUMB_COLORS[hash % THUMB_COLORS.length];
}

// 기관별 "로고 자리" — 실제 기관 로고 이미지가 없으니(기업마당 API는 로고를 제공하지 않음), 같은
// 기관이면 항상 같은 색+이니셜이 나오도록 해서 카드들을 훑어볼 때 "이건 어느 기관 공고구나"를
// 색으로 먼저 구분할 수 있게 한다. 실제 로고 이미지는 관리자가 개별 공고에 thumbnailUrl을 직접
// 등록하면(관리자 화면 "지원사업 피드") 이 자리를 대체한다.
function orgMonogram(org) {
    const s = String(org || '').trim();
    if (!s) return '?';
    return s.slice(0, 2);
}

// 지자체(광역·기초단체)인지 중앙부처·공공기관인지 — 기관명 접미사로 판정한다. 긴 접미사부터
// 검사해야 "◯◯특별자치도"가 "도"로 먼저 걸려 오판되지 않는다. "부산광역시" 같은 지자체와
// "중소벤처기업부" 같은 중앙부처가 기관별 보기에 뒤섞여 있으면 "이게 지역 공고인지 전국
// 공고인지" 한눈에 안 들어온다는 지적이 있어, 둘을 구분해서 보여준다.
const LOCAL_GOV_SUFFIXES = ['특별자치시', '특별자치도', '광역시', '특별시', '도', '시', '군', '구'];
function isLocalGovOrg(org) {
    const s = String(org || '').trim();
    if (!s) return false;
    return LOCAL_GOV_SUFFIXES.some((suf) => s.endsWith(suf));
}

function formatDeadlineLabel(p) {
    if (p.isRolling) return '상시 모집';
    const dMs = firestoreLikeToMillis(p.deadlineAt);
    if (dMs == null) return '';
    const d = new Date(dMs);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 마감`;
}

// 기업당 예산 표시 — 기업마당 API는 지원금액을 별도 필드로 주지 않는다(amountText는 항상 빈
// 문자열로 수집된다). 대신 공고 요약문(summary/description)에 "기업당 최대 OOO만원"처럼
// 텍스트로 박혀 있는 경우가 실제로 있어서, 그 표현이 "명확하게" 있을 때만 뽑아서 보여준다.
// "연매출 10억원 이하" 같은 자격 요건 문구까지 예산으로 오인하지 않도록, 반드시
// "기업당/업체당/점포당/개소당/사업체당" 뒤에 금액이 바로 붙어 있는 경우만 인정한다 — 실제
// 데이터(159건) 샘플로 검증했을 때 10건(6%)에서 이 패턴이 잡혔고 오탐은 없었다. 나머지는
// 비율제·구간별 등 한 줄로 단정할 수 없는 방식이라 억지로 뽑지 않고 비워 둔다.
const PER_COMPANY_AMOUNT_RE = /((?:기업|업체|점포|개소|사업체)\s*당)\s*(최대\s*)?([\d,]+\s*(?:천만|백만|만|억)\s*원)(\s*(?:이내|한도))?/;
function extractPerCompanyBudget(p) {
    const manual = (p.amountText || '').trim();
    if (manual) return manual; // 관리자가 직접 입력해둔 값이 있으면 그걸 우선한다.
    const text = `${p.summary || ''} ${p.description || ''}`;
    const m = PER_COMPANY_AMOUNT_RE.exec(text);
    if (!m) return '';
    const unit = m[3].replace(/\s+/g, '');
    return `${m[1]} ${m[2] ? '최대 ' : ''}${unit}${m[4] ? ' ' + m[4].trim() : ''}`.replace(/\s+/g, ' ').trim();
}

// 예전에는 카드마다 aspect-[4/3] 큰 이미지 칸을 통째로 차지했는데, 실제로는 기관 로고 이미지가
// 거의 없어서(기업마당 API가 로고를 안 줌) 그 자리 대부분이 의미 없는 단색 배경 + 이니셜 두 글자
// 뿐이었다 — 화면 공간만 크게 쓰고 정보는 없는 "불필요한 썸네일 칸"이었던 셈이다. 뉴스 페이지의
// 목록 줄(NewsRow)과 같은 방식으로, 작은 48px 배지 하나만 남기고 나머지 자리에 정보(제목·기관·
// 마감일)를 더 넣었다 — 한 화면에 더 많은 공고가 보이고, 실제 로고를 등록했을 때도 잘 보인다.
// 한 줄에 제목·비용·마감기한이 전부 들어가도록 다시 짰다 — 예전에는 2번째 줄에 기관/태그를
// 따로 보여줬는데, 그러면서 오른쪽 비용·마감일도 2줄로 쌓여 카드 하나가 세로로 길었다. 지금은
// 제목이 길면 자리를 다 차지하지 못하고 말줄임(truncate)되더라도, 비용·마감일은 항상 같은
// 자리(오른쪽 끝)에 있어서 목록을 위아래로 훑을 때 제목→비용→마감일 순서가 줄마다 똑같이 반복된다.
function ProgramCard({ p, isLast, onOpen }) {
    const { label: ddayLabel, badgeClass } = getSupportProgramDdayInfo(p);
    const orgLabel = p.org || '';
    const budget = extractPerCompanyBudget(p); // 명확할 때만 채워짐 — 캡슐 배지로 표시
    const deadline = formatDeadlineLabel(p);

    return (
        <button
            type="button"
            onClick={() => onOpen(p)}
            className={`w-full flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl hover:bg-soft/70 transition-colors text-left ${isLast ? '' : 'border-b border-black/[0.06]'}`}
        >
            <div
                className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0"
                style={p.thumbnailUrl ? undefined : { background: colorForId(orgLabel || p.id) }}
            >
                {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white/90 font-extrabold text-[10px] tracking-tight select-none">{orgMonogram(orgLabel)}</span>
                    </div>
                )}
            </div>
            {ddayLabel ? (
                <span className={`inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-bold text-white shrink-0 whitespace-nowrap ${badgeClass}`}>
                    {ddayLabel}
                </span>
            ) : null}
            {/* 제목이 이 자리를 다 채우려 들지만, 아래 min-w-0 + truncate 덕에 필요하면 축약되고
                뒤(비용·마감일)는 절대 밀려나지 않는다. */}
            <p className="min-w-0 flex-1 text-base md:text-lg font-bold text-dark truncate">{p.title}</p>
            {budget ? (
                <span className="shrink-0 inline-flex items-center h-7 px-3 rounded-full bg-brand text-white text-xs font-bold whitespace-nowrap">
                    {budget}
                </span>
            ) : null}
            {deadline ? (
                <span className="shrink-0 text-xs font-semibold text-gray-500 whitespace-nowrap">{deadline}</span>
            ) : null}
        </button>
    );
}

function ProgramRow({ title, hint, items, page, totalPages, onPageChange, onOpen, emptyText }) {
    return (
        <div className="pb-10 last:pb-0">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-dark">{title}</h2>
                <span className="text-xs text-gray-400">{hint}</span>
            </div>
            {items.length > 0 ? (
                <>
                    <div className="border-t border-black/[0.06]">
                        {items.map((p, i) => <ProgramCard key={p.id} p={p} isLast={i === items.length - 1} onOpen={onOpen} />)}
                    </div>
                    <Pager page={page} totalPages={totalPages} onChange={onPageChange} />
                </>
            ) : (
                <div className="py-10 text-center text-gray-400 bg-soft rounded-2xl">
                    <p className="text-sm">{emptyText || '현재 등록된 지원사업이 없습니다.'}</p>
                </div>
            )}
        </div>
    );
}

// 기관별 보기 — "전체 기관" 드롭다운은 이름을 이미 아는 사람에게만 쓸모 있고, 어떤 기관들이
// 올라와 있는지 훑어보고 싶을 땐 도움이 안 된다. 기관마다 타일 하나(이니셜 + 이름 + 공고 건수)로
// 늘어놓고, 누르면 그 기관으로 필터가 걸린 채 기존 3단 목록(마감임박/신규/부산)으로 돌아간다 —
// 필터링·페이지네이션 로직은 그대로 재사용하고, "둘러보는 진입점"만 하나 더 생기는 구조.
function OrgTile({ org, count, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(org)}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-black/[0.06] hover:border-brand/30 hover:bg-soft/70 transition-colors text-left"
        >
            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: colorForId(org) }}>
                <span className="text-white/90 font-extrabold text-[10px]">{orgMonogram(org)}</span>
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-dark truncate">{org}</p>
                <p className="text-xs text-gray-400">{count}건</p>
            </div>
        </button>
    );
}

// 지자체(부산광역시·경상북도 등)와 중앙부처·공공기관(중소벤처기업부·산업통상부 등)을 한 줄에
// 섞어두면 "이게 지역 공고인지 전국 공고인지"가 한눈에 안 들어온다는 지적이 있어 소제목으로
// 나눴다 — "우리 동네(부산·지자체) 공고만 보고 싶다" / "업종·전국 단위 지원사업을 보고 싶다"는
// 서로 다른 탐색 의도라서, 묶어서 보여주는 것 자체가 더 정확한 분류다.
function OrgBrowser({ orgGroups, onSelect }) {
    if (orgGroups.length === 0) {
        return <p className="text-sm text-gray-400 py-10 text-center bg-soft rounded-2xl">등록된 공고가 없습니다.</p>;
    }
    const localGovs = orgGroups.filter((g) => g.isLocalGov);
    const agencies = orgGroups.filter((g) => !g.isLocalGov);
    return (
        <div className="space-y-8">
            {localGovs.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-gray-400 tracking-wide mb-3">지자체 · {localGovs.length}곳</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {localGovs.map(({ org, count }) => <OrgTile key={org} org={org} count={count} onSelect={onSelect} />)}
                    </div>
                </div>
            )}
            {agencies.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-gray-400 tracking-wide mb-3">중앙부처 · 공공기관 · {agencies.length}곳</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {agencies.map(({ org, count }) => <OrgTile key={org} org={org} count={count} onSelect={onSelect} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// 기관 타일을 누르면 바로 목록으로 넘어가지 않고, 이 모달이 먼저 뜬다. 그 기관 공고가 지금
// 두 탭(부산 신규사업/마감임박 사업) 중 어디에 몇 건 있는지부터 보여주고, 실제 "페이지 이동"은
// 사용자가 버튼을 눌렀을 때 일어난다 — 예전처럼 눌렀을 때 바로 탭이 바뀌면, 하필 그 기관이
// 두 탭 다 0건이어도(예: 오래된 상시공고만 있는 기관) 곧장 빈 목록 화면으로 튕겨가 버렸다.
function OrgDetailModal({ org, counts, onClose, onGoTo, onViewAll }) {
    if (!org) return null;
    const { total, busanFresh, urgent } = counts;
    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className="bg-white rounded-[28px] border border-black/[0.06] max-w-sm w-full p-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: colorForId(org) }}>
                                <span className="text-white/90 font-extrabold text-[11px]">{orgMonogram(org)}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-dark truncate">{org}</p>
                                <p className="text-xs text-gray-400">등록된 공고 {total}건</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-soft hover:bg-[#eceef2] transition-colors"
                            aria-label="닫기"
                        >
                            <Icons.X size={16} className="text-gray-500" />
                        </button>
                    </div>

                    {/* 예전에는 이 모달에 "부산 신규사업에서 보기 / 마감임박 사업에서 보기" 두 버튼만
                        있었는데, 두 탭 다 0건인 기관(상시모집만 있거나 최근 등록이 아닌 경우)은
                        눌러도 볼 게 없어 결국 이 기관 공고를 볼 방법이 없었다. 조건과 무관하게
                        전부 모아 보여주는 전용 페이지(/support?org=...)를 만들고, 그걸 기본 동작으로
                        올렸다. */}
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="w-full flex items-center justify-between gap-3 rounded-xl bg-brand hover:bg-[#00327a] transition-colors px-4 py-3.5 text-left mb-4"
                    >
                        <span className="text-sm font-bold text-white">이 기관 공고 전체 모아보기</span>
                        <span className="text-xs font-bold text-white/80">{total}건</span>
                    </button>

                    <p className="text-xs font-bold text-gray-400 tracking-wide mb-2.5">지금 뜬 탭에서 바로 보기</p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => onGoTo('busanFresh')}
                            className="w-full flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] hover:border-brand/30 hover:bg-soft/70 transition-colors px-4 py-3 text-left"
                        >
                            <span className="text-sm font-semibold text-dark">부산 신규사업에서 보기</span>
                            <span className={`text-xs font-bold ${busanFresh > 0 ? 'text-brand' : 'text-gray-300'}`}>{busanFresh}건</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onGoTo('urgent')}
                            className="w-full flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] hover:border-brand/30 hover:bg-soft/70 transition-colors px-4 py-3 text-left"
                        >
                            <span className="text-sm font-semibold text-dark">마감임박 사업에서 보기</span>
                            <span className={`text-xs font-bold ${urgent > 0 ? 'text-brand' : 'text-gray-300'}`}>{urgent}건</span>
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}

/**
 * SupportProgramsView — 지원사업 독립 페이지
 *
 * 화면 맨 위에 탭 3개가 있고, 한 번에 그중 하나만 보여준다(동시에 여러 목록을 늘어놓지 않는다):
 * ① 부산 신규사업 (기본 선택) — region에 '부산' 포함 + 등록 7일 이내. 최신 등록순.
 *    부청사는 부산 청년 사업가 커뮤니티라, 접속하면 가장 먼저 "우리 동네에 새로 뜬 공고"를 본다.
 * ② 마감임박 사업 — 마감일이 있고(상시 제외) 아직 지나지 않은 공고 중 D-0~10일 이내를 마감일이
 *    가까운 순으로.
 * ③ 기관별 보기 — 지자체/중앙부처·공공기관 타일로 전체 기관을 훑어보고, 누르면 그 기관 공고만
 *    걸러진 채 ① 탭으로 돌아간다.
 * 탭 옆에는 "전체 기관" 드롭다운이 항상 있어 ①·② 탭 목록을 특정 기관으로 바로 좁힐 수 있다.
 *
 * ①·②는 서로 배타적이다 — 같은 공고가 부산+신규이면서 동시에 마감임박이어도 ①에만 나오고
 * ②에서는 빠진다(claimed Set으로 먼저 차지한 탭이 가져가는 방식). 한 화면에 하나의 탭만 보이는
 * 구조라 화면 안에서 중복이 보일 일은 없지만, 그래도 "이미 ①에서 본 공고가 ②에도 또 나오는"
 * 낭비를 없앴다. ③ 기관별 보기는 모든 공고를 기관 단위로 집계하므로 이 배타 규칙과 무관하다.
 *
 * 정책: 등록(createdAt) 후 1년이 지난 공고는 자동으로 목록에서 숨긴다(ONE_YEAR_MS).
 * 노출: ①·② 탭은 10개씩 페이지네이션된다(PAGE_SIZE).
 * 클릭 시: 외부 사이트로 이동하지 않고, 저장된 요약/내용을 사이트 안 모달로 보여준다
 * (ContentDetailModal) — 원문이 필요하면 모달 안의 "원문 보기"로 나갈 수 있다.
 */
const TABS = [
    { key: 'busanFresh', label: '부산 신규사업' },
    { key: 'urgent', label: '마감임박 사업' },
    { key: 'byOrg', label: '기관별 보기' },
];

export default function SupportProgramsView({ supportPrograms, content, onBack }) {
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'support-sidebar-1') || hasAdSlot(content, 'support-sidebar-1b') || hasAdSlot(content, 'support-sidebar-2');
    const [selected, setSelected] = useState(null);
    const [orgModalOrg, setOrgModalOrg] = useState(null); // 기관별 보기에서 타일을 누르면 이 기관명이 들어가 모달이 뜬다
    const [busanFreshPage, setBusanFreshPage] = useState(1);
    const [urgentPage, setUrgentPage] = useState(1);
    const [orgFilter, setOrgFilter] = useState('all'); // 기관(주최/주관) 필터 — '전체' 또는 특정 기관명
    const [viewMode, setViewMode] = useState('busanFresh'); // 'busanFresh' | 'urgent' | 'byOrg' — 기본은 부산 신규사업

    // 기관 전체 공고 페이지 — /support?org=기관명 URL로 독립된 페이지다(북마크·공유 가능).
    // 부산신규·마감임박 탭은 각자 기준(최근 7일/마감 임박)에 맞는 공고만 보여줘서, 그 기준에
    // 안 걸리는 나머지 공고(상시모집인데 안 급한 것 등)는 탭 어디에서도 안 보이는 문제가 있었다.
    // 이 페이지는 조건 없이 그 기관의 공고를 전부 모아서 보여준다.
    const [searchParams, setSearchParams] = useSearchParams();
    const orgPageName = searchParams.get('org') || null;
    const [orgPagePage, setOrgPagePage] = useState(1);
    useEffect(() => { setOrgPagePage(1); }, [orgPageName]);

    // 기관 필터 옵션은 필터 적용 전 전체 목록 기준으로 뽑는다(필터를 걸어도 선택지가 줄어들지 않게).
    const orgOptions = useMemo(() => {
        const rows = Array.isArray(supportPrograms) ? supportPrograms : [];
        const nowMs = Date.now();
        const set = new Set();
        rows.forEach((p) => {
            if (!p || p.enabled === false || p.status !== 'published') return;
            const createdMs = firestoreLikeToMillis(p.createdAt);
            if (createdMs != null && (nowMs - createdMs) > ONE_YEAR_MS) return;
            if (p.org) set.add(p.org);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [supportPrograms]);

    const { busanFresh, urgent, busanFreshCount, urgentCount, orgGroups, orgCountsByTab } = useMemo(() => {
        // 탭 배정 기준은 홈 화면 숫자와 똑같이 맞추기 위해 appHelpers.bucketSupportPrograms로 공유한다.
        const { baseVisible, busanFreshAll, urgentAll } = bucketSupportPrograms(supportPrograms);

        // 기관별 보기용 집계 — orgFilter를 적용하기 "전" 전체 기준으로 세야, 특정 기관을 이미
        // 선택한 상태에서도 다른 기관 타일들이 계속 보인다(둘러보다 다른 기관으로 바로 옮겨갈 수 있게).
        const orgCounts = new Map();
        baseVisible.forEach((p) => {
            if (!p.org) return;
            orgCounts.set(p.org, (orgCounts.get(p.org) || 0) + 1);
        });
        const orgGroupsVal = Array.from(orgCounts, ([org, count]) => ({ org, count, isLocalGov: isLocalGovOrg(org) }))
            .sort((a, b) => b.count - a.count || a.org.localeCompare(b.org, 'ko'));

        // 기관별 보기 모달에서 "이 기관은 부산신규 O건 · 마감임박 O건"을 보여주기 위한 기관별 집계.
        const byTab = new Map();
        const bump = (org, key) => {
            if (!org) return;
            const cur = byTab.get(org) || { busanFresh: 0, urgent: 0 };
            cur[key] += 1;
            byTab.set(org, cur);
        };
        busanFreshAll.forEach((p) => bump(p.org, 'busanFresh'));
        urgentAll.forEach((p) => bump(p.org, 'urgent'));

        const filterByOrg = (list) => (orgFilter !== 'all' ? list.filter((p) => p.org === orgFilter) : list);

        return {
            busanFresh: filterByOrg(busanFreshAll),
            urgent: filterByOrg(urgentAll),
            busanFreshCount: filterByOrg(busanFreshAll).length,
            urgentCount: filterByOrg(urgentAll).length,
            orgGroups: orgGroupsVal,
            orgCountsByTab: byTab,
        };
    }, [supportPrograms, orgFilter]);

    // 기관 필터를 바꾸면 이전 페이지 번호가 남아 빈 페이지가 보일 수 있어 두 탭 모두 1페이지로 되돌린다.
    useEffect(() => {
        setBusanFreshPage(1);
        setUrgentPage(1);
    }, [orgFilter]);

    const busanFreshTotalPages = Math.max(1, Math.ceil(busanFresh.length / PAGE_SIZE));
    const urgentTotalPages = Math.max(1, Math.ceil(urgent.length / PAGE_SIZE));
    const busanFreshPageClamped = Math.min(busanFreshPage, busanFreshTotalPages);
    const urgentPageClamped = Math.min(urgentPage, urgentTotalPages);
    const busanFreshItems = busanFresh.slice((busanFreshPageClamped - 1) * PAGE_SIZE, busanFreshPageClamped * PAGE_SIZE);
    const urgentItems = urgent.slice((urgentPageClamped - 1) * PAGE_SIZE, urgentPageClamped * PAGE_SIZE);

    // 기관 전체 공고 페이지용 목록 — 탭 기준(부산+최근 7일 / 마감임박)과 무관하게, 그 기관의
    // 살아있는 공고를 전부 모은다. 마감일 있는 건 가까운 순으로 먼저, 상시모집은 뒤에 최신 등록순.
    const orgPageAll = useMemo(() => {
        if (!orgPageName) return [];
        const rows = Array.isArray(supportPrograms) ? supportPrograms : [];
        const nowMs = Date.now();
        const mine = rows.filter((p) => {
            if (!p || p.enabled === false || p.status !== 'published' || p.org !== orgPageName) return false;
            const createdMs = firestoreLikeToMillis(p.createdAt);
            return createdMs == null || (nowMs - createdMs) <= ONE_YEAR_MS;
        });
        const dated = [];
        const rolling = [];
        mine.forEach((p) => {
            if (p.isRolling) { rolling.push(p); return; }
            const dMs = firestoreLikeToMillis(p.deadlineAt);
            if (dMs != null && dMs < nowMs) return; // 마감 지난 건 제외
            dated.push(p);
        });
        dated.sort((a, b) => firestoreLikeToMillis(a.deadlineAt) - firestoreLikeToMillis(b.deadlineAt));
        rolling.sort((a, b) => firestoreLikeToMillis(b.createdAt) - firestoreLikeToMillis(a.createdAt));
        return [...dated, ...rolling];
    }, [supportPrograms, orgPageName]);
    const orgPageTotalPages = Math.max(1, Math.ceil(orgPageAll.length / PAGE_SIZE));
    const orgPagePageClamped = Math.min(orgPagePage, orgPageTotalPages);
    const orgPageItems = orgPageAll.slice((orgPagePageClamped - 1) * PAGE_SIZE, orgPagePageClamped * PAGE_SIZE);

    function openOrgPage(org) {
        setOrgModalOrg(null);
        setSearchParams(org ? { org } : {});
    }
    function closeOrgPage() {
        setSearchParams({});
    }

    function openDetail(p) {
        const { label: badgeLabel, badgeClass } = getSupportProgramDdayInfo(p);
        setSelected({
            title: p.title || '',
            badgeLabel,
            badgeClass,
            org: p.org || '',
            dateLabel: formatDeadlineLabel(p),
            tags: [...(p.region || []), ...(p.industry || [])],
            amountText: extractPerCompanyBudget(p),
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
                    {orgPageName ? (
                        <>
                            <p className="text-[12.5px] text-gray-500 mb-5">
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                                <span className="mx-1">/</span>
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeOrgPage(); }} className="hover:text-dark transition-colors">지원사업</button>
                                <span className="mx-1">/</span> {orgPageName}
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center" style={{ background: colorForId(orgPageName) }}>
                                    <span className="text-white/90 font-extrabold text-sm">{orgMonogram(orgPageName)}</span>
                                </div>
                                <div>
                                    <p className="text-[13px] font-bold text-brand tracking-wide">SUPPORT PROGRAMS</p>
                                    <h1 className="text-[26px] md:text-[36px] font-semibold tracking-tight text-dark break-keep">{orgPageName}</h1>
                                </div>
                            </div>
                            <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">
                                이 기관이 올린 공고 {orgPageAll.length}건을 조건 없이 전부 모았어요.
                            </p>
                        </>
                    ) : (
                        <>
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

                            {/* 화면 맨 위 탭 3개 — 한 번에 하나만 보여준다. 기본은 "부산 신규사업".
                                옆의 "전체 기관" 드롭다운은 부산 신규사업·마감임박 사업 탭의 목록을
                                특정 기관으로 좁힐 때 쓴다. */}
                            <div className="flex items-center justify-between gap-3 mt-8 flex-wrap">
                                <div className="inline-flex rounded-lg border border-black/10 p-0.5 bg-white">
                                    {TABS.map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setViewMode(tab.key)}
                                            className={`text-xs md:text-sm font-semibold rounded-md px-3.5 py-1.5 transition-colors whitespace-nowrap ${viewMode === tab.key ? 'bg-brand text-white' : 'text-gray-500 hover:text-dark'}`}
                                        >
                                            {tab.label}
                                            <span className={`ml-1.5 ${viewMode === tab.key ? 'text-white/70' : 'text-gray-400'}`}>
                                                {tab.key === 'busanFresh' ? busanFreshCount : tab.key === 'urgent' ? urgentCount : orgGroups.length}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <select
                                    value={orgFilter}
                                    onChange={(e) => setOrgFilter(e.target.value)}
                                    className="text-xs md:text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-white text-dark focus:outline-none focus:ring-1 focus:ring-brand"
                                >
                                    <option value="all">전체 기관</option>
                                    {orgOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            {orgFilter !== 'all' ? (
                                <p className="text-xs text-gray-400 mt-3">
                                    <span className="font-semibold text-brand">{orgFilter}</span> 기관 공고만 보는 중 ·{' '}
                                    <button type="button" onClick={() => setOrgFilter('all')} className="underline hover:text-dark">전체 기관 다시 보기</button>
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="xl:flex xl:gap-10 xl:items-start">
                        <div className="flex-1 min-w-0">
                            {orgPageName ? (
                                <ProgramRow
                                    title={`${orgPageName} 전체 공고`}
                                    hint={`총 ${orgPageAll.length}건`}
                                    items={orgPageItems}
                                    page={orgPagePageClamped}
                                    totalPages={orgPageTotalPages}
                                    onPageChange={setOrgPagePage}
                                    onOpen={openDetail}
                                    emptyText="등록된 공고가 없습니다."
                                />
                            ) : (
                                <>
                                    {viewMode === 'busanFresh' && (
                                        <ProgramRow
                                            title="부산 신규사업"
                                            hint="부산 · NEW"
                                            items={busanFreshItems}
                                            page={busanFreshPageClamped}
                                            totalPages={busanFreshTotalPages}
                                            onPageChange={setBusanFreshPage}
                                            onOpen={openDetail}
                                            emptyText="최근 7일 내 새로 올라온 부산 지원사업이 없습니다."
                                        />
                                    )}
                                    {viewMode === 'urgent' && (
                                        <ProgramRow
                                            title="마감임박 사업"
                                            hint="D-day 임박순"
                                            items={urgentItems}
                                            page={urgentPageClamped}
                                            totalPages={urgentTotalPages}
                                            onPageChange={setUrgentPage}
                                            onOpen={openDetail}
                                        />
                                    )}
                                    {viewMode === 'byOrg' && (
                                        <div className="pb-10">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-lg md:text-xl font-bold text-dark">기관별 지원사업</h2>
                                                <span className="text-xs text-gray-400">{orgGroups.length}개 기관</span>
                                            </div>
                                            <OrgBrowser
                                                orgGroups={orgGroups}
                                                onSelect={(org) => setOrgModalOrg(org)}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
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
            <OrgDetailModal
                org={orgModalOrg}
                counts={{
                    total: orgGroups.find((g) => g.org === orgModalOrg)?.count ?? 0,
                    busanFresh: orgCountsByTab.get(orgModalOrg)?.busanFresh ?? 0,
                    urgent: orgCountsByTab.get(orgModalOrg)?.urgent ?? 0,
                }}
                onClose={() => setOrgModalOrg(null)}
                onGoTo={(tab) => {
                    setOrgFilter(orgModalOrg);
                    setViewMode(tab);
                    setOrgModalOrg(null);
                }}
                onViewAll={() => openOrgPage(orgModalOrg)}
            />
        </div>
    );
}
