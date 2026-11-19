import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdSlot, { useAnyAdVisible } from '../components/AdSlot';
import { firestoreLikeToMillis, getSupportProgramDdayInfo, bucketSupportPrograms } from '../appHelpers';
import Pager from '../components/Pager';
import ContentDetailModal from '../components/ContentDetailModal';
import ModalPortal from '../components/ModalPortal';
import { Icons } from '../components/Icons';
import { MgPageHead, MgWrap, MgTabs } from '../components/mg/Mg';

const PAGE_SIZE = 10;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 기관별 "로고 자리" — 실제 기관 로고 이미지가 없으니(기업마당 API는 로고를 제공하지 않음),
// 기관 이름 앞 두 글자를 보여준다. 실제 로고 이미지는 관리자가 개별 공고에 thumbnailUrl을 직접
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

// 먼저가본 개편(2026-11): D-day 표시는 작은 네모 하나로 — 평소 로얄블루, 마감 임박(D-10 이내·오늘
// 마감)은 빨강, 마감은 회색, 상시는 로얄블루 테두리. 계산은 appHelpers.getSupportProgramDdayInfo 그대로.
function ddayTone(info) {
    if (!info || !info.label) return '';
    if (info.label === '마감') return 'bg-[#8a8a8a] text-white';
    if (info.label === '상시') return 'border border-royal bg-white text-royal';
    if (info.isUrgent) return 'bg-red-600 text-white';
    return 'bg-royal text-white';
}

function DdayMark({ info }) {
    if (!info || !info.label) return null;
    return (
        <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap px-2 text-[12.5px] font-semibold leading-none ${ddayTone(info)}`}>
            {info.label}
        </span>
    );
}

// 기관 로고 자리 — 관리자가 thumbnailUrl(실제 로고)을 등록하면 그 그림, 없으면 기관 이름 앞 두 글자.
// (예전 기관별 파스텔 색은 개편 색 규칙에 맞춰 하늘 바탕 + 로얄블루 글자 하나로 통일)
function OrgMark({ org, src, size = 'w-10 h-10', text = 'text-[12px]' }) {
    return (
        <div className={`relative ${size} shrink-0 overflow-hidden ${src ? 'border border-line bg-white' : 'bg-sky'}`} aria-hidden="true">
            {src ? (
                // 로고는 잘리지 않게(object-contain) — 모든 로고 칸이 같은 크기·같은 비율
                <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain p-0.5" loading="lazy" decoding="async" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`select-none font-bold tracking-tight text-royal ${text}`}>{orgMonogram(org)}</span>
                </div>
            )}
        </div>
    );
}

// 목록 한 줄: [로고] [D-day 네모 + 제목] / 아래 곁정보(기관 · 기업당 예산 · 마감일).
// 얇은 구분선 목록 — 제목 16/600, 곁정보 14 회색. 누르면 사이트 안 상세 창(ContentDetailModal).
function ProgramCard({ p, onOpen }) {
    const info = getSupportProgramDdayInfo(p);
    const orgLabel = p.org || '';
    const budget = extractPerCompanyBudget(p); // 명확할 때만 채워짐
    const deadline = formatDeadlineLabel(p);

    return (
        <li className="border-b border-line">
            <button
                type="button"
                onClick={() => onOpen(p)}
                className="flex min-h-[78px] w-full items-center gap-3.5 py-4 text-left transition-colors hover:bg-card md:gap-4 md:px-2"
            >
                <OrgMark org={orgLabel || p.id} src={p.thumbnailUrl} />
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <DdayMark info={info} />
                        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{p.title}</span>
                    </span>
                    {/* 곁정보는 늘 한 줄(넘치면 …) — 글 양과 상관없이 줄 높이가 같다 */}
                    <span className="mt-1 flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap text-[13.5px] text-sub md:text-[14px]">
                        {orgLabel ? <span className="min-w-0 truncate">{orgLabel}</span> : null}
                        {budget ? <>{orgLabel ? <span aria-hidden="true" className="shrink-0 text-line2">|</span> : null}<span className="min-w-0 truncate font-semibold text-royal">{budget}</span></> : null}
                        {deadline ? <>{(orgLabel || budget) ? <span aria-hidden="true" className="shrink-0 text-line2">|</span> : null}<span className="shrink-0">{deadline}</span></> : null}
                        {!(orgLabel || budget || deadline) ? '\u00a0' : null}
                    </span>
                </span>
            </button>
        </li>
    );
}

function ProgramRow({ title, hint, items, page, totalPages, onPageChange, onOpen, emptyText }) {
    return (
        <div className="pb-10 last:pb-0">
            <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="text-[20px] font-bold text-ink md:text-[22px]">{title}</h2>
                <span className="text-[13px] text-sub">{hint}</span>
            </div>
            {items.length > 0 ? (
                <>
                    <ul className="border-t border-ink">
                        {items.map((p) => <ProgramCard key={p.id} p={p} onOpen={onOpen} />)}
                    </ul>
                    <Pager page={page} totalPages={totalPages} onChange={onPageChange} />
                </>
            ) : (
                <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">
                    {emptyText || '현재 등록된 지원사업이 없습니다.'}
                </p>
            )}
        </div>
    );
}

// 기관별 보기 — 기관마다 타일 하나(이니셜 + 이름 + 공고 건수). 누르면 기관 안내 창(OrgDetailModal)이 뜬다.
function OrgTile({ org, count, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(org)}
            className="flex h-full min-h-[68px] w-full min-w-0 items-center gap-3 border border-line bg-white p-3 text-left transition-colors hover:border-ink hover:bg-card"
        >
            <OrgMark org={org} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink" title={org}>{org}</span>
                <span className="block truncate text-[13px] text-sub">{count}건</span>
            </span>
        </button>
    );
}

// 지자체(부산광역시 등)와 중앙부처·공공기관을 소제목으로 나눠 보여준다.
function OrgBrowser({ orgGroups, onSelect }) {
    if (orgGroups.length === 0) {
        return <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">등록된 공고가 없습니다.</p>;
    }
    const localGovs = orgGroups.filter((g) => g.isLocalGov);
    const agencies = orgGroups.filter((g) => !g.isLocalGov);
    return (
        <div className="space-y-8">
            {localGovs.length > 0 && (
                <div>
                    <h3 className="mb-3 text-[15px] font-semibold text-ink">지자체 <span className="font-normal text-sub">· {localGovs.length}곳</span></h3>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                        {localGovs.map(({ org, count }) => <OrgTile key={org} org={org} count={count} onSelect={onSelect} />)}
                    </div>
                </div>
            )}
            {agencies.length > 0 && (
                <div>
                    <h3 className="mb-3 text-[15px] font-semibold text-ink">중앙부처 · 공공기관 <span className="font-normal text-sub">· {agencies.length}곳</span></h3>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                        {agencies.map(({ org, count }) => <OrgTile key={org} org={org} count={count} onSelect={onSelect} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// 기관 타일을 누르면 바로 목록으로 넘어가지 않고, 이 창이 먼저 뜬다. 그 기관 공고가 지금
// 두 탭(부산 신규사업/마감임박 사업) 중 어디에 몇 건 있는지부터 보여주고, 실제 이동은
// 버튼을 눌렀을 때 일어난다(두 탭 다 0건인 기관이 빈 목록으로 튕기는 문제 방지).
function OrgDetailModal({ org, counts, onClose, onGoTo, onViewAll }) {
    if (!org) return null;
    const { total, busanFresh, urgent } = counts;
    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${org} 공고 보기`}
                    className="w-full max-w-sm rounded-[18px] bg-white p-6 md:p-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <OrgMark org={org} size="w-11 h-11" />
                            <div className="min-w-0">
                                <p className="truncate text-[18px] font-bold text-ink">{org}</p>
                                <p className="text-[13px] text-sub">등록된 공고 {total}건</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink"
                            aria-label="닫기"
                        >
                            <Icons.X size={18} />
                        </button>
                    </div>

                    {/* 조건과 무관하게 그 기관 공고를 전부 모아 보여주는 전용 페이지(/support?org=...)가 기본 동작 */}
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="mb-5 flex h-[52px] w-full items-center justify-between gap-3 rounded-lg bg-royal px-4 text-left text-white transition-colors hover:bg-royalDark"
                    >
                        <span className="text-[16px] font-bold">이 기관 공고 전체 모아보기</span>
                        <span className="text-[14px] font-semibold text-white/85">{total}건</span>
                    </button>

                    <p className="mb-2.5 text-[13px] font-semibold text-sub">지금 뜬 탭에서 바로 보기</p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => onGoTo('busanFresh')}
                            className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-line2 bg-white px-4 text-left transition-colors hover:border-ink"
                        >
                            <span className="text-[15px] font-semibold text-ink">부산 신규사업에서 보기</span>
                            <span className={`text-[14px] font-semibold ${busanFresh > 0 ? 'text-royal' : 'text-sub'}`}>{busanFresh}건</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onGoTo('urgent')}
                            className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-line2 bg-white px-4 text-left transition-colors hover:border-ink"
                        >
                            <span className="text-[15px] font-semibold text-ink">마감임박 사업에서 보기</span>
                            <span className={`text-[14px] font-semibold ${urgent > 0 ? 'text-royal' : 'text-sub'}`}>{urgent}건</span>
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
    const navigate = useNavigate();
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = useAnyAdVisible(content, ['support-sidebar-1', 'support-sidebar-1b', 'support-sidebar-2']);
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
        const info = getSupportProgramDdayInfo(p);
        setSelected({
            title: p.title || '',
            badgeLabel: info.label,
            badgeClass: ddayTone(info),
            org: p.org || '',
            dateLabel: formatDeadlineLabel(p),
            tags: [...(p.region || []), ...(p.industry || [])],
            amountText: extractPerCompanyBudget(p),
            summary: p.summary || '',
            description: p.description || '',
            externalUrl: p.applyUrl || p.sourceUrl || '',
        });
    }

    const crumbBtn = 'underline-offset-2 hover:text-white hover:underline';

    return (
        <div className="min-h-screen overflow-y-auto bg-white">
            {orgPageName ? (
                <MgPageHead
                    crumbs={(
                        <>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className={crumbBtn}>홈</button>
                            <span className="mx-1.5" aria-hidden="true">/</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeOrgPage(); }} className={crumbBtn}>지원사업</button>
                            <span className="mx-1.5" aria-hidden="true">/</span>{orgPageName}
                        </>
                    )}
                    eyebrow="SUPPORT PROGRAMS"
                    title={<span className="break-keep">{orgPageName}</span>}
                    desc={`이 기관이 올린 공고 ${orgPageAll.length}건을 조건 없이 전부 모았어요.`}
                />
            ) : (
                <MgPageHead
                    crumbs={(
                        <>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className={crumbBtn}>홈</button>
                            <span className="mx-1.5" aria-hidden="true">/</span>지원사업
                        </>
                    )}
                    eyebrow="SUPPORT PROGRAMS"
                    title={<span className="break-keep">놓치면 아까운 지원사업</span>}
                    desc="긴 공고문은 저희가 읽을게요. 대표님은 핵심만 보세요."
                />
            )}

            <section className="pb-16 pt-8 md:pb-[100px] md:pt-12">
                <MgWrap>
                    <AdSlot slotId="support-top-banner" content={content} className="mb-8" />
                    <a href="/startup" onClick={(e) => { e.preventDefault(); navigate('/startup'); }}
                        className="mb-10 flex flex-col gap-2 rounded-xl bg-card px-5 py-4 transition-colors hover:bg-[#e9edf3] sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6 md:py-5">
                        <span className="min-w-0">
                            <span className="block break-keep text-[16px] font-semibold text-ink md:text-[17px]">창업을 준비 중이신가요?</span>
                            <span className="mt-1 block break-keep text-[14px] text-sub md:text-[15px]">청년창업사관학교·예비창업패키지처럼 예비창업자가 신청할 수 있는 지원만 모아 봤어요.</span>
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold text-royal">예비창업 지원 찾기 ↗</span>
                    </a>

                    {!orgPageName ? (
                        <div className="mb-10">
                            {/* 탭 3개 — 한 번에 하나만 보여준다. 기본은 "부산 신규사업".
                                아래 "전체 기관" 고르기는 부산 신규사업·마감임박 사업 탭의 목록을 특정 기관으로 좁힐 때 쓴다. */}
                            <MgTabs
                                label="지원사업 보기 방식"
                                value={viewMode}
                                onChange={setViewMode}
                                items={TABS.map((tab) => [
                                    tab.key,
                                    <span key={tab.key} className="whitespace-nowrap">
                                        {tab.key === 'busanFresh' ? <>부산 신규<span className="hidden sm:inline">사업</span></> : tab.label}
                                        <span className="ml-1.5 hidden text-[14px] font-semibold opacity-60 sm:inline">
                                            {tab.key === 'busanFresh' ? busanFreshCount : tab.key === 'urgent' ? urgentCount : orgGroups.length}
                                        </span>
                                    </span>,
                                ])}
                            />
                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label htmlFor="support-org-filter" className="text-[15px] font-semibold text-ink">기관</label>
                                <select
                                    id="support-org-filter"
                                    value={orgFilter}
                                    onChange={(e) => setOrgFilter(e.target.value)}
                                    className="h-12 min-w-0 max-w-full flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] text-ink focus:border-royal focus:outline-none sm:max-w-[320px]"
                                >
                                    <option value="all">전체 기관</option>
                                    {orgOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                                {orgFilter !== 'all' ? (
                                    <p className="w-full text-[14px] text-sub">
                                        <span className="font-semibold text-royal">{orgFilter}</span> 기관 공고만 보는 중 ·{' '}
                                        <button type="button" onClick={() => setOrgFilter('all')} className="underline underline-offset-2 hover:text-ink">전체 기관 다시 보기</button>
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="xl:flex xl:items-start xl:gap-10">
                        <div className="min-w-0 flex-1">
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
                                            <div className="mb-4 flex items-end justify-between gap-3">
                                                <h2 className="text-[20px] font-bold text-ink md:text-[22px]">기관별 지원사업</h2>
                                                <span className="text-[13px] text-sub">{orgGroups.length}개 기관</span>
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
                </MgWrap>
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
