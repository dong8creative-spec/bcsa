import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { groupService, GROUP_TYPE_LABEL, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, GROUP_COVERS, groupCoverUrl } from '../../services/groupService';
import { groupPoster, GROUP_POSTERS } from '../../constants/groupPosters';
import { MgPageHead, MgWrap, MgSectionHead, MgTabs, MgCard } from '../../components/mg/Mg';

const GroupDetail = lazy(() => import('./GroupDetail'));
const GroupCheckIn = lazy(() => import('./GroupCheckIn'));

export const REGIONS = ['부산', '서울', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '온라인'];

export const TypeBadge = ({ type }) => (
    <span className="inline-flex items-center rounded-full border border-current px-2.5 py-0.5 text-[13px] font-semibold">
        {GROUP_TYPE_LABEL[type] || '그룹'}
    </span>
);

// 먼저가본 개편: 검은 띠 머리부분(MgPageHead) → 흰 본문. narrow: 입력 폼처럼 한 줄 읽기 폭이 좋은 화면은 본문을 좁게
export const PageShell = ({ eyebrow, title, desc, crumbs, children, narrow = false }) => (
    <div className="min-h-screen bg-white">
        <MgPageHead eyebrow={eyebrow} title={title} desc={desc} crumbs={crumbs} />
        <MgWrap as="section" className="pb-20 pt-10 md:pb-[100px] md:pt-14">
            <div className={narrow ? 'mx-auto max-w-2xl' : ''}>{children}</div>
        </MgWrap>
    </div>
);

export const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        <div className="mt-2">{children}</div>
        {/* 도움말은 입력칸 아래에 둬서 나란히 놓인 칸끼리 높이가 어긋나지 않게 한다 */}
        {hint ? <span className="mt-1.5 block break-keep text-[13px] text-sub">{hint}</span> : null}
    </label>
);

/** 커버 이미지 선택 (그룹 만들기·설정 공용) */
export const CoverPicker = ({ value, type, onChange }) => {
    const current = value || (type === 'study' ? 'study' : 'meetup');
    return (
        <div className="grid grid-cols-3 gap-2">
            {GROUP_COVERS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={current === key} aria-label={`커버 ${label}`}
                    className={`relative overflow-hidden border-2 transition-colors ${current === key ? 'border-royal' : 'border-transparent'}`}>
                    <img src={`/assets/images/groups/cover-${key}.jpg`} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                    <span className="absolute bottom-0 left-0 bg-black/60 px-1.5 py-0.5 text-[12px] font-semibold text-white">{label}</span>
                </button>
            ))}
        </div>
    );
};

export const inputClass = 'w-full rounded-lg border border-line2 bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-royal';

/** 소모임·스터디 화면 묶음. /groups 아래 경로를 여기서 나눈다 */
export default function GroupsPage({ currentUser, onRequireLogin }) {
    const location = useLocation();
    const path = location.pathname.replace(/\/$/, '');
    const fallback = <div className="min-h-[60vh]" />;

    if (path === '/groups/new') return <GroupCreate currentUser={currentUser} onRequireLogin={onRequireLogin} />;
    if (path === '/groups/pay-result') {
        return <Suspense fallback={fallback}><GroupCheckIn mode="payResult" currentUser={currentUser} onRequireLogin={onRequireLogin} /></Suspense>;
    }
    const checkInMatch = path.match(/^\/groups\/([^/]+)\/checkin$/);
    if (checkInMatch) {
        return <Suspense fallback={fallback}><GroupCheckIn mode="checkIn" groupId={checkInMatch[1]} currentUser={currentUser} onRequireLogin={onRequireLogin} /></Suspense>;
    }
    const detailMatch = path.match(/^\/groups\/([^/]+)$/);
    if (detailMatch) {
        return <Suspense fallback={fallback}><GroupDetail groupId={detailMatch[1]} currentUser={currentUser} onRequireLogin={onRequireLogin} /></Suspense>;
    }
    return <GroupList currentUser={currentUser} onRequireLogin={onRequireLogin} />;
}

function GroupList({ currentUser, onRequireLogin }) {
    const navigate = useNavigate();
    const [groups, setGroups] = useState(null);
    const [myGroups, setMyGroups] = useState([]);
    const [filter, setFilter] = useState('all');
    const uid = currentUser?.uid || currentUser?.id;

    useEffect(() => groupService.subscribeApprovedGroups(setGroups), []);
    useEffect(() => {
        if (!uid) { setMyGroups([]); return; }
        groupService.getMyLedGroups(uid).then(setMyGroups).catch(() => setMyGroups([]));
    }, [uid]);

    // 먼저가본 개편: 포스터를 붙인 그룹(예전 「지금 모집 중」 큰 칸)은 카드 목록 맨 앞에 먼저 나오게 한다
    const visible = useMemo(() => (groups || [])
        .filter((g) => filter === 'all' || g.type === filter)
        .map((g, i) => ({ g, i, p: groupPoster(g) }))
        .sort((a, b) => (a.p ? 0 : 1) - (b.p ? 0 : 1) || a.i - b.i), [groups, filter]);
    const myPending = myGroups.filter((g) => g.status !== 'approved');

    const onCreate = () => {
        if (!currentUser) { onRequireLogin(); return; }
        navigate('/groups/new');
    };
    const open = (id) => { navigate(`/groups/${id}`); window.scrollTo({ top: 0 }); };

    return (
        <div className="min-h-screen bg-white">
            <MgPageHead eyebrow="Club" title="소모임·스터디"
                desc="먼저가본 회원이 직접 여는 소모임과 스터디예요. 마음 맞는 사장님들과 가볍게 시작해 보세요." />

            <section className="pb-20 pt-12 md:pb-[100px] md:pt-[70px]" aria-labelledby="groups-list">
                <MgWrap>
                    <MgSectionHead id="groups-list" title="지금 모집 중" desc="카드를 누르면 모집 안내와 가입 신청 화면으로 가요."
                        extra={(
                            <button type="button" onClick={onCreate}
                                className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-5 text-[16px] font-bold text-white hover:bg-black">
                                <Icons.Plus size={18} aria-hidden="true" /> 그룹 만들기
                            </button>
                        )} />

                    {myPending.length > 0 ? (
                        <div className="mt-6 rounded-xl bg-sky px-5 py-4">
                            <p className="mb-1 text-[15px] font-semibold text-royal">내가 신청한 그룹</p>
                            {myPending.map((g) => (
                                <button key={g.id} type="button" onClick={() => open(g.id)} className="flex min-h-[44px] w-full items-center justify-between text-left text-[15px] text-ink">
                                    <span className="truncate">{g.title}</span>
                                    <span className="ml-3 shrink-0 text-[14px] font-semibold text-royal">{GROUP_STATUS_LABEL[g.status] || g.status}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <MgTabs className="mb-[30px] mt-[26px]" label="그룹 종류" value={filter} onChange={setFilter}
                        items={[['all', '전체'], ['meetup', '소모임'], ['study', '스터디']]} />

                    {groups === null ? (
                        <p className="py-12 text-center text-[15px] text-sub">불러오는 중…</p>
                    ) : visible.length === 0 ? (
                        <div className="rounded-xl bg-card px-5 py-11 text-center">
                            <p className="text-[17px] font-semibold text-ink">아직 열린 그룹이 없어요</p>
                            <p className="mt-2 break-keep text-[15px] text-sub">첫 번째 소모임이나 스터디를 직접 만들어 보세요.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-2.5 gap-y-6 md:grid-cols-3 md:gap-x-3">
                            {visible.map(({ g, p }) => (
                                <MgCard key={g.id}
                                    image={(p && (p.card || p.image)) || groupCoverUrl(g)}
                                    imagePosition={p && !p.card ? 'top' : undefined}
                                    state={g.recruit === 'soon' ? '모집예정' : '모집중'}
                                    title={g.title}
                                    meta={(
                                        <>
                                            {/* 정보는 늘 2줄(줄마다 한 줄 고정) — 글 양과 상관없이 카드 높이가 같다. 그룹장·정원은 그룹 화면에 있음 */}
                                            <span className="block truncate">{[GROUP_TYPE_LABEL[g.type] || '그룹', g.region, GROUP_MODE_LABEL[g.mode], g.schedule].filter(Boolean).join(' ㅣ ')}</span>
                                            <span className="block truncate text-sub">{(p ? p.tagline : g.description) || '\u00a0'}</span>
                                        </>
                                    )}
                                    onClick={() => open(g.id)} />
                            ))}
                        </div>
                    )}
                </MgWrap>
            </section>
        </div>
    );
}

function GroupCreate({ currentUser, onRequireLogin }) {
    const navigate = useNavigate();
    const location = useLocation();
    // ?template=<포스터 키> 로 열면 그 포스터 내용으로 미리 채운다(운영진이 모집 그룹을 빨리 여는 용도)
    const [form, setForm] = useState(() => {
        const t = GROUP_POSTERS[new URLSearchParams(location.search).get('template') || '']?.createDefaults;
        return { type: 'meetup', title: '', description: '', region: '부산', mode: 'offline', schedule: '', capacity: 0, joinPolicy: 'approval', ...(t || {}) };
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    if (!currentUser) {
        return (
            <PageShell narrow eyebrow="New group" title="그룹 만들기">
                <div className="rounded-xl bg-card p-8 text-center">
                    <p className="text-[17px] font-semibold text-ink">로그인한 회원만 그룹을 만들 수 있어요.</p>
                    <button type="button" onClick={onRequireLogin} className="mt-5 h-12 rounded-lg bg-[#1a1a1a] px-8 text-[16px] font-bold text-white">로그인</button>
                </div>
            </PageShell>
        );
    }

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.title.trim().length < 2) return setError('그룹 이름을 2자 이상 입력해 주세요.');
        if (form.description.trim().length < 10) return setError('소개를 10자 이상 입력해 주세요.');
        setSubmitting(true);
        try {
            const { groupId } = await groupService.createGroupRequest({ ...form, capacity: Number(form.capacity) || 0 });
            alert('개설 신청이 접수되었습니다.\n운영진 승인 후 공개되며, 승인 전에도 그룹 화면에서 회차를 미리 준비할 수 있어요.');
            navigate(`/groups/${groupId}`, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const choice = (k, options) => (
        <div className={`grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {options.map(([v, label]) => (
                <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, [k]: v }))}
                    aria-pressed={form[k] === v}
                    className={`min-h-[48px] break-keep rounded-lg border px-3 py-2.5 text-[15px] font-semibold transition-colors ${form[k] === v ? 'border-ink bg-ink text-white' : 'border-line2 bg-white text-[#333] hover:border-ink'}`}>
                    {label}
                </button>
            ))}
        </div>
    );

    return (
        <PageShell narrow eyebrow="New group" title="그룹 만들기" desc="운영진이 확인한 뒤 공개됩니다. 일정·참가비·출석 방식은 개설 후 그룹장이 직접 정할 수 있어요.">
            <form onSubmit={submit} className="space-y-7">
                <Field label="종류">{choice('type', [['meetup', '소모임'], ['study', '스터디']])}</Field>
                <Field label="그룹 이름"><input className={inputClass} value={form.title} onChange={set('title')} maxLength={60} placeholder="예: 부산 1인 사장 마케팅 스터디" /></Field>
                <Field label="소개" hint="어떤 사람들이 모여 무엇을 하는지 적어 주세요.">
                    <textarea className={`${inputClass} min-h-[140px]`} value={form.description} onChange={set('description')} maxLength={3000} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="지역">
                        <select className={inputClass} value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
                    </Field>
                    <Field label="정원" hint="0이면 제한 없음">
                        <input type="number" min={0} max={500} className={inputClass} value={form.capacity} onChange={set('capacity')} />
                    </Field>
                </div>
                <Field label="진행 방식">{choice('mode', [['offline', '오프라인'], ['online', '온라인'], ['hybrid', '온·오프라인']])}</Field>
                <Field label="모임 주기" hint="예: 매주 화요일 저녁 7시 30분 / 격주 토요일 오전">
                    <input className={inputClass} value={form.schedule} onChange={set('schedule')} maxLength={200} />
                </Field>
                <Field label="가입 방식">{choice('joinPolicy', [['approval', '그룹장 승인 후 가입'], ['open', '바로 가입']])}</Field>
                <Field label="커버 이미지" hint="목록과 그룹 화면 맨 위에 보여요. 나중에 설정에서 바꿀 수 있어요.">
                    <CoverPicker value={form.cover} type={form.type} onChange={(cover) => setForm((f) => ({ ...f, cover }))} />
                </Field>
                {error ? <p role="alert" className="text-[15px] font-semibold text-red-600">{error}</p> : null}
                <button type="submit" disabled={submitting} className="h-[53px] w-full rounded-lg bg-royal px-8 text-[17px] font-bold text-white hover:bg-royalDark disabled:opacity-60">
                    {submitting ? '신청 중…' : '개설 신청하기'}
                </button>
            </form>
        </PageShell>
    );
}
