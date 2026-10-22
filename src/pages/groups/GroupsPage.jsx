import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { groupService, GROUP_TYPE_LABEL, GROUP_MODE_LABEL, GROUP_STATUS_LABEL } from '../../services/groupService';

const GroupDetail = lazy(() => import('./GroupDetail'));
const GroupCheckIn = lazy(() => import('./GroupCheckIn'));

export const REGIONS = ['부산', '서울', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '온라인'];

export const TypeBadge = ({ type }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${type === 'study' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {GROUP_TYPE_LABEL[type] || '그룹'}
    </span>
);

export const PageShell = ({ eyebrow, title, desc, crumbs, children }) => (
    <div className="min-h-screen bg-white">
        <section className="pt-32 pb-10 md:pt-40 md:pb-14 px-6" style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}>
            <div className="container mx-auto max-w-5xl">
                {crumbs}
                {eyebrow ? <p className="text-[13px] font-bold text-brand tracking-wide mb-3">{eyebrow}</p> : null}
                <h1 className="text-[28px] leading-[1.2] md:text-[44px] md:leading-[1.15] font-semibold tracking-tight text-dark break-keep">{title}</h1>
                {desc ? <p className="mt-4 text-base md:text-lg text-gray-500 max-w-2xl break-keep">{desc}</p> : null}
            </div>
        </section>
        <section className="pb-20 px-6">
            <div className="container mx-auto max-w-5xl">{children}</div>
        </section>
    </div>
);

export const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-sm font-semibold text-dark">{label}</span>
        {hint ? <span className="block text-xs text-gray-500 mt-0.5 break-keep">{hint}</span> : null}
        <div className="mt-2">{children}</div>
    </label>
);

export const inputClass = 'w-full border border-black/10 bg-soft text-dark rounded-xl px-3.5 py-3 text-[15px] outline-none focus:border-brand';

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

    const visible = useMemo(() => (groups || []).filter((g) => filter === 'all' || g.type === filter), [groups, filter]);
    const myPending = myGroups.filter((g) => g.status !== 'approved');

    const onCreate = () => {
        if (!currentUser) { onRequireLogin(); return; }
        navigate('/groups/new');
    };

    return (
        <PageShell
            eyebrow="SMALL GROUPS"
            title={<>함께 모이고,<br className="md:hidden" /> 같이 배우는 사업가들</>}
            desc="부청사 회원이 직접 여는 소모임과 스터디입니다. 운영진 승인을 거쳐 열리고, 운영은 그룹장이 자유롭게 정합니다."
        >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex gap-2">
                    {[['all', '전체'], ['meetup', '소모임'], ['study', '스터디']].map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setFilter(k)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${filter === k ? 'bg-dark text-white' : 'bg-soft text-gray-600 hover:bg-[#eceef2]'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={onCreate} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-[#00327a]">
                    <Icons.Plus size={16} /> 그룹 만들기
                </button>
            </div>

            {myPending.length > 0 ? (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800 mb-2">내가 신청한 그룹</p>
                    {myPending.map((g) => (
                        <button key={g.id} type="button" onClick={() => navigate(`/groups/${g.id}`)} className="flex w-full items-center justify-between py-1.5 text-left text-sm">
                            <span className="truncate">{g.title}</span>
                            <span className="ml-3 shrink-0 text-xs font-bold text-amber-700">{GROUP_STATUS_LABEL[g.status] || g.status}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {groups === null ? (
                <div className="py-20 text-center text-gray-400 text-sm">불러오는 중…</div>
            ) : visible.length === 0 ? (
                <div className="py-16 text-center rounded-[24px] bg-soft">
                    <p className="text-lg font-semibold text-dark">아직 열린 그룹이 없어요</p>
                    <p className="mt-2 text-sm text-gray-500 break-keep">첫 번째 소모임이나 스터디를 직접 만들어 보세요.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {visible.map((g) => (
                        <button key={g.id} type="button" onClick={() => navigate(`/groups/${g.id}`)}
                            className="text-left rounded-[24px] border border-black/[0.06] bg-white p-6 hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <TypeBadge type={g.type} />
                                <span className="text-xs text-gray-500">{[g.region, GROUP_MODE_LABEL[g.mode]].filter(Boolean).join(' · ')}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-dark break-keep">{g.title}</h3>
                            <p className="mt-2 text-sm text-gray-600 line-clamp-2 break-keep">{g.description}</p>
                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                {g.schedule ? <span className="inline-flex items-center gap-1"><Icons.Calendar size={13} />{g.schedule}</span> : null}
                                <span className="inline-flex items-center gap-1"><Icons.User size={13} />그룹장 {g.leaderName || '-'}</span>
                                {Number(g.capacity) > 0 ? <span className="inline-flex items-center gap-1"><Icons.Users size={13} />정원 {g.capacity}명</span> : null}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </PageShell>
    );
}

function GroupCreate({ currentUser, onRequireLogin }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ type: 'meetup', title: '', description: '', region: '부산', mode: 'offline', schedule: '', capacity: 0, joinPolicy: 'approval' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    if (!currentUser) {
        return (
            <PageShell eyebrow="NEW GROUP" title="그룹 만들기">
                <div className="rounded-[24px] bg-soft p-8 text-center">
                    <p className="text-dark font-semibold">로그인한 회원만 그룹을 만들 수 있어요.</p>
                    <button type="button" onClick={onRequireLogin} className="mt-4 px-6 py-3 rounded-full bg-brand text-white font-semibold">로그인</button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {options.map(([v, label]) => (
                <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, [k]: v }))}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${form[k] === v ? 'bg-brand text-white border-brand' : 'bg-soft text-gray-600 border-black/10'}`}>
                    {label}
                </button>
            ))}
        </div>
    );

    return (
        <PageShell eyebrow="NEW GROUP" title="그룹 만들기" desc="운영진이 확인한 뒤 공개됩니다. 일정·참가비·출석 방식은 개설 후 그룹장이 직접 정할 수 있어요.">
            <form onSubmit={submit} className="max-w-2xl space-y-6">
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
                {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                <button type="submit" disabled={submitting} className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-brand text-white font-semibold disabled:opacity-60">
                    {submitting ? '신청 중…' : '개설 신청하기'}
                </button>
            </form>
        </PageShell>
    );
}
