import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { isAdminUser } from '../../utils/adminAccess';
import {
    groupService, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, JOIN_POLICY_LABEL,
} from '../../services/groupService';
import { PageShell, TypeBadge, Field, inputClass, REGIONS } from './GroupsPage';
import GroupQrModal from './GroupQrModal';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function GroupDetail({ groupId, currentUser, onRequireLogin }) {
    const navigate = useNavigate();
    const uid = currentUser?.uid || currentUser?.id;
    const [group, setGroup] = useState(undefined);
    const [members, setMembers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [tab, setTab] = useState('info');
    const [busy, setBusy] = useState(false);

    useEffect(() => groupService.subscribeGroup(groupId, setGroup), [groupId]);
    useEffect(() => (currentUser ? groupService.subscribeMembers(groupId, setMembers) : undefined), [groupId, currentUser]);
    useEffect(() => groupService.subscribeSessions(groupId, setSessions), [groupId]);

    const isLeader = !!group && group.leaderUid === uid;
    const canManage = isLeader || isAdminUser(currentUser);
    const me = members.find((m) => m.uid === uid);
    const activeMembers = members.filter((m) => m.status === 'active');
    const pendingMembers = members.filter((m) => m.status === 'pending');

    if (group === undefined) return <div className="min-h-[60vh] pt-40 text-center text-gray-400 text-sm">불러오는 중…</div>;
    if (group === null) {
        return (
            <PageShell title="그룹을 찾을 수 없어요" desc="삭제되었거나 아직 승인되지 않은 그룹입니다.">
                <button type="button" onClick={() => navigate('/groups')} className="px-6 py-3 rounded-full bg-brand text-white font-semibold">그룹 목록으로</button>
            </PageShell>
        );
    }

    const join = async () => {
        if (!currentUser) { onRequireLogin(); return; }
        setBusy(true);
        try {
            const r = await groupService.joinGroup(groupId);
            alert(r.status === 'active' ? '가입되었습니다.' : '가입 신청을 보냈어요. 그룹장이 승인하면 멤버가 됩니다.');
        } catch (e) { alert(e.message); } finally { setBusy(false); }
    };
    const leave = async () => {
        if (!confirm('그룹에서 나갈까요?')) return;
        try { await groupService.setMemberStatus(groupId, uid, 'left'); } catch (e) { alert(e.message); }
    };

    const tabs = [['info', '소개·일정'], ...(canManage ? [['sessions', '회차·출석'], ['members', `멤버${pendingMembers.length ? ` (${pendingMembers.length})` : ''}`], ['payments', '결제·정산'], ['settings', '설정']] : [])];

    return (
        <PageShell
            crumbs={<p className="text-[12.5px] text-gray-500 mb-5"><button type="button" onClick={() => navigate('/groups')} className="hover:text-dark">소모임·스터디</button><span className="mx-1">/</span>{group.title}</p>}
            eyebrow={<span className="inline-flex items-center gap-2"><TypeBadge type={group.type} />{group.status !== 'approved' ? <span className="text-amber-600">{GROUP_STATUS_LABEL[group.status]}</span> : null}</span>}
            title={group.title}
            desc={[group.region, GROUP_MODE_LABEL[group.mode], group.schedule, `그룹장 ${group.leaderName || ''}`].filter(Boolean).join(' · ')}
        >
            {group.status === 'pending' ? (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 break-keep">
                    운영진 승인을 기다리고 있어요. 승인되면 목록에 공개되고 가입·출석을 받을 수 있습니다.
                </div>
            ) : null}
            {group.status === 'rejected' ? (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 break-keep">
                    개설이 반려되었습니다.{group.rejectReason ? ` 사유: ${group.rejectReason}` : ''}
                </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                {tabs.map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setTab(k)}
                        className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${tab === k ? 'bg-dark text-white' : 'bg-soft text-gray-600'}`}>{label}</button>
                ))}
            </div>

            {tab === 'info' ? (
                <InfoTab
                    group={group} sessions={sessions} me={me} isLeader={isLeader} uid={uid}
                    activeCount={activeMembers.length} onJoin={join} onLeave={leave} busy={busy} currentUser={currentUser}
                />
            ) : null}
            {tab === 'sessions' && canManage ? <SessionsTab group={group} sessions={sessions} members={activeMembers} /> : null}
            {tab === 'members' && canManage ? <MembersTab group={group} members={members} /> : null}
            {tab === 'payments' && canManage ? <PaymentsTab group={group} sessions={sessions} /> : null}
            {tab === 'settings' && canManage ? <SettingsTab group={group} /> : null}
        </PageShell>
    );
}

function InfoTab({ group, sessions, me, isLeader, uid, activeCount, onJoin, onLeave, busy, currentUser }) {
    const [myAttendance, setMyAttendance] = useState({});
    useEffect(() => {
        if (!uid || !me || me.status !== 'active') return;
        let alive = true;
        Promise.all(sessions.map((s) => groupService.getMyAttendance(group.id, s.id, uid).then((a) => [s.id, a]).catch(() => [s.id, null])))
            .then((rows) => { if (alive) setMyAttendance(Object.fromEntries(rows)); });
        return () => { alive = false; };
    }, [group.id, sessions, uid, me]);

    const attendedCount = Object.values(myAttendance).filter(Boolean).length;
    const pastCount = sessions.filter((s) => s.startsAt && new Date(s.startsAt) <= new Date()).length;

    return (
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <div className="space-y-6">
                {group.notice ? (
                    <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                        <p className="text-xs font-bold text-brand mb-1">공지</p>
                        <p className="text-sm text-dark whitespace-pre-wrap break-keep">{group.notice}</p>
                    </div>
                ) : null}
                <div>
                    <h2 className="text-lg font-semibold text-dark mb-2">소개</h2>
                    <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap break-keep">{group.description}</p>
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-dark mb-3">일정</h2>
                    {sessions.length === 0 ? <p className="text-sm text-gray-500">아직 등록된 회차가 없어요.</p> : (
                        <ul className="space-y-2">
                            {sessions.map((s, i) => (
                                <li key={s.id} className="rounded-2xl border border-black/[0.06] p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-500">{group.type === 'study' ? `${i + 1}회차 · ` : ''}{fmtDate(s.startsAt)}</p>
                                        <p className="font-semibold text-dark break-keep">{s.title}</p>
                                        <p className="text-xs text-gray-500 mt-1 break-keep">{[s.location, Number(s.fee) > 0 ? `참가비 ${won(s.fee)}` : '참가비 없음'].filter(Boolean).join(' · ')}</p>
                                        {s.onlineUrl && me?.status === 'active' ? <a href={s.onlineUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand font-semibold break-all">온라인 참여 링크</a> : null}
                                    </div>
                                    {myAttendance[s.id] ? <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">출석</span> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <aside className="space-y-4">
                <div className="rounded-[24px] bg-soft p-5 space-y-2 text-sm">
                    <p><span className="text-gray-500">가입 방식</span> · <b>{JOIN_POLICY_LABEL[group.joinPolicy]}</b></p>
                    <p><span className="text-gray-500">멤버</span> · <b>{currentUser ? `${activeCount}명` : '로그인 후 확인'}</b>{Number(group.capacity) > 0 ? ` / 정원 ${group.capacity}명` : ''}</p>
                    {group.type === 'study' && me?.status === 'active' ? (
                        <p><span className="text-gray-500">내 출석</span> · <b>{attendedCount}</b> / {pastCount || sessions.length}회</p>
                    ) : null}
                </div>
                {group.status === 'approved' && !isLeader ? (
                    me?.status === 'active' ? (
                        <button type="button" onClick={onLeave} className="w-full py-3 rounded-full border border-black/10 text-sm font-semibold text-gray-600">그룹 나가기</button>
                    ) : me?.status === 'pending' ? (
                        <div className="w-full py-3 rounded-full bg-amber-50 text-center text-sm font-semibold text-amber-700">가입 승인 대기 중</div>
                    ) : (
                        <button type="button" disabled={busy} onClick={onJoin} className="w-full py-3.5 rounded-full bg-brand text-white font-semibold disabled:opacity-60">
                            {group.joinPolicy === 'open' ? '가입하기' : '가입 신청하기'}
                        </button>
                    )
                ) : null}
                <p className="text-xs text-gray-500 break-keep">모임 현장에서는 그룹장 화면의 QR을 휴대폰 카메라로 찍으면 출석(참가비가 있으면 결제까지)이 됩니다.</p>
            </aside>
        </div>
    );
}

function SessionsTab({ group, sessions, members }) {
    const empty = { title: '', date: '', time: '19:30', location: '', onlineUrl: '', fee: 0 };
    const [form, setForm] = useState(empty);
    const [qrSession, setQrSession] = useState(null);
    const [openRoster, setOpenRoster] = useState(null);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const approved = group.status === 'approved';

    const add = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.date) { alert('회차 제목과 날짜를 입력해 주세요.'); return; }
        try {
            await groupService.addSession(group.id, {
                title: form.title.trim().slice(0, 80),
                startsAt: `${form.date}T${form.time || '00:00'}`,
                location: form.location.trim().slice(0, 120),
                onlineUrl: /^https?:\/\//i.test(form.onlineUrl.trim()) ? form.onlineUrl.trim() : '',
                fee: Math.max(0, Math.floor(Number(form.fee) || 0)),
            });
            setForm(empty);
        } catch (err) { alert(`저장하지 못했어요: ${err.message}`); }
    };

    return (
        <div className="space-y-8">
            <form onSubmit={add} className="rounded-[24px] bg-soft p-5 space-y-4">
                <p className="font-semibold text-dark">회차 추가</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="제목"><input className={inputClass} value={form.title} onChange={set('title')} placeholder={group.type === 'study' ? '예: 3주차 · 상세페이지 분석' : '예: 10월 정기 모임'} /></Field>
                    <Field label="참가비 (원)" hint="0이면 무료. 유료면 QR 출석 때 결제까지 진행돼요."><input type="number" min={0} className={inputClass} value={form.fee} onChange={set('fee')} /></Field>
                    <Field label="날짜"><input type="date" className={inputClass} value={form.date} onChange={set('date')} /></Field>
                    <Field label="시작 시간"><input type="time" className={inputClass} value={form.time} onChange={set('time')} /></Field>
                    <Field label="장소"><input className={inputClass} value={form.location} onChange={set('location')} placeholder="예: 서면 ○○카페 2층" /></Field>
                    <Field label="온라인 링크 (선택)" hint="멤버에게만 보여요"><input className={inputClass} value={form.onlineUrl} onChange={set('onlineUrl')} placeholder="https://" /></Field>
                </div>
                <button type="submit" className="px-6 py-3 rounded-full bg-brand text-white text-sm font-semibold">회차 추가</button>
            </form>

            {sessions.length === 0 ? <p className="text-sm text-gray-500">등록된 회차가 없어요.</p> : (
                <ul className="space-y-3">
                    {sessions.map((s) => (
                        <li key={s.id} className="rounded-2xl border border-black/[0.06] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-500">{fmtDate(s.startsAt)}</p>
                                    <p className="font-semibold text-dark break-keep">{s.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{[s.location, Number(s.fee) > 0 ? `참가비 ${won(s.fee)}` : '무료'].filter(Boolean).join(' · ')}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" disabled={!approved || s.attendanceOpen === false} onClick={() => setQrSession(s)}
                                        className="px-4 py-2 rounded-full bg-dark text-white text-xs font-semibold disabled:opacity-40" title={approved ? '' : '운영진 승인 후 사용할 수 있어요'}>출석 QR 띄우기</button>
                                    <button type="button" onClick={() => setOpenRoster(openRoster === s.id ? null : s.id)} className="px-4 py-2 rounded-full bg-soft text-xs font-semibold">출석부</button>
                                    <button type="button" onClick={() => groupService.updateSession(group.id, s.id, { attendanceOpen: s.attendanceOpen === false })}
                                        className="px-4 py-2 rounded-full bg-soft text-xs font-semibold">{s.attendanceOpen === false ? '출석 받기' : '출석 마감'}</button>
                                    <button type="button" onClick={() => { if (confirm('이 회차를 삭제할까요?')) groupService.deleteSession(group.id, s.id).catch((e) => alert(e.message)); }}
                                        className="px-3 py-2 rounded-full text-xs font-semibold text-red-600">삭제</button>
                                </div>
                            </div>
                            {openRoster === s.id ? <Roster group={group} session={s} members={members} /> : null}
                        </li>
                    ))}
                </ul>
            )}
            {qrSession ? <GroupQrModal group={group} session={qrSession} onClose={() => setQrSession(null)} /> : null}
        </div>
    );
}

function Roster({ group, session, members }) {
    const [att, setAtt] = useState([]);
    useEffect(() => groupService.subscribeAttendance(group.id, session.id, setAtt), [group.id, session.id]);
    const byUid = useMemo(() => Object.fromEntries(att.map((a) => [a.uid, a])), [att]);
    const fee = Number(session.fee) || 0;
    const extra = att.filter((a) => !members.some((m) => m.uid === a.uid));
    const rows = [...members.map((m) => ({ uid: m.uid, name: m.name })), ...extra.map((a) => ({ uid: a.uid, name: a.name }))];

    return (
        <div className="mt-4 border-t border-black/[0.06] pt-3">
            <p className="text-xs text-gray-500 mb-2">출석 {att.length}명 / 멤버 {members.length}명{fee > 0 ? ` · 결제 완료 ${att.filter((a) => a.paid).length}명` : ''}</p>
            <ul className="divide-y divide-black/[0.04]">
                {rows.map((r) => {
                    const a = byUid[r.uid];
                    return (
                        <li key={r.uid} className="flex items-center justify-between py-2 text-sm">
                            <span className="truncate">{r.name || '회원'}</span>
                            <span className="flex items-center gap-2 shrink-0">
                                {a ? (
                                    <>
                                        <span className="text-xs font-bold text-emerald-700">{a.method === 'qr' ? 'QR 출석' : '수동 출석'}</span>
                                        {fee > 0 ? (a.paid ? <span className="text-xs font-bold text-brand">결제 완료</span> : (
                                            <button type="button" onClick={() => groupService.setCashPaid(group.id, session.id, r.uid, !a.cashPaid)} className={`text-xs font-semibold rounded-full px-2 py-0.5 ${a.cashPaid ? 'bg-blue-50 text-brand' : 'bg-soft text-gray-500'}`}>
                                                {a.cashPaid ? '현장 결제 ✓' : '현장 결제 표시'}
                                            </button>
                                        )) : null}
                                        {!a.paid ? <button type="button" onClick={() => groupService.removeAttendance(group.id, session.id, r.uid)} className="text-xs text-gray-400">취소</button> : null}
                                    </>
                                ) : (
                                    <button type="button" onClick={() => groupService.markManualAttendance(group.id, session.id, r).catch((e) => alert(e.message))} className="text-xs font-semibold rounded-full bg-soft px-3 py-1">출석 처리</button>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function MembersTab({ group, members }) {
    const pending = members.filter((m) => m.status === 'pending');
    const active = members.filter((m) => m.status === 'active');
    const act = (uid, status) => groupService.setMemberStatus(group.id, uid, status).catch((e) => alert(e.message));
    return (
        <div className="space-y-8">
            <div>
                <h3 className="font-semibold text-dark mb-2">가입 신청 {pending.length}명</h3>
                {pending.length === 0 ? <p className="text-sm text-gray-500">대기 중인 신청이 없어요.</p> : (
                    <ul className="space-y-2">
                        {pending.map((m) => (
                            <li key={m.uid} className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3 text-sm">
                                <span>{m.name}</span>
                                <span className="flex gap-2">
                                    <button type="button" onClick={() => act(m.uid, 'active')} className="px-3 py-1.5 rounded-full bg-brand text-white text-xs font-semibold">승인</button>
                                    <button type="button" onClick={() => act(m.uid, 'rejected')} className="px-3 py-1.5 rounded-full bg-white text-xs font-semibold text-gray-600">거절</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <h3 className="font-semibold text-dark mb-2">멤버 {active.length}명</h3>
                <ul className="divide-y divide-black/[0.05]">
                    {active.map((m) => (
                        <li key={m.uid} className="flex items-center justify-between py-2.5 text-sm">
                            <span>{m.name}{m.role === 'leader' ? <span className="ml-2 text-xs font-bold text-brand">그룹장</span> : null}</span>
                            {m.role !== 'leader' ? <button type="button" onClick={() => { if (confirm(`${m.name}님을 내보낼까요?`)) act(m.uid, 'left'); }} className="text-xs text-gray-400">내보내기</button> : null}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function PaymentsTab({ group, sessions }) {
    const [rows, setRows] = useState(null);
    useEffect(() => { groupService.getGroupPayments(group.id, group.leaderUid).then(setRows).catch(() => setRows([])); }, [group.id, group.leaderUid]);
    const paid = (rows || []).filter((r) => r.status === 'paid');
    const total = paid.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const title = (sid) => sessions.find((s) => s.id === sid)?.title || '';
    return (
        <div className="space-y-4">
            <div className="rounded-[24px] bg-soft p-5">
                <p className="text-xs text-gray-500">QR로 결제된 참가비 합계</p>
                <p className="text-3xl font-semibold text-dark mt-1">{won(total)}</p>
                <p className="text-xs text-gray-500 mt-2 break-keep">결제 금액은 부청사가 받아 두었다가 그룹장에게 정산합니다. 정산 방식은 운영진이 안내드려요.</p>
            </div>
            {rows === null ? <p className="text-sm text-gray-400">불러오는 중…</p> : rows.length === 0 ? <p className="text-sm text-gray-500">결제 내역이 없어요.</p> : (
                <ul className="divide-y divide-black/[0.05] text-sm">
                    {rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                            <span className="min-w-0 truncate">{r.name} · {title(r.sessionId) || r.sessionTitle}</span>
                            <span className="shrink-0 text-xs">
                                <b>{won(r.amount)}</b>{' '}
                                <span className={r.status === 'paid' ? 'text-brand' : 'text-gray-400'}>{({ paid: '결제', pending: '미결제', refunded: '환불' })[r.status] || r.status}</span>
                                {r.status === 'paid' ? <span className="text-gray-400"> · {r.settled ? '정산 완료' : '정산 전'}</span> : null}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SettingsTab({ group }) {
    const [form, setForm] = useState({
        title: group.title || '', description: group.description || '', notice: group.notice || '', region: group.region || '부산',
        mode: group.mode || 'offline', schedule: group.schedule || '', capacity: group.capacity || 0, joinPolicy: group.joinPolicy || 'approval',
    });
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const approved = group.status === 'approved';
    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await groupService.updateGroupSettings(group.id, {
                title: form.title.trim().slice(0, 60), description: form.description.trim().slice(0, 3000), notice: form.notice.trim().slice(0, 1000),
                region: form.region, mode: form.mode, schedule: form.schedule.trim().slice(0, 200),
                capacity: Math.max(0, Math.min(500, Math.floor(Number(form.capacity) || 0))), joinPolicy: form.joinPolicy,
            });
            alert('저장했어요.');
        } catch (err) { alert(`저장하지 못했어요: ${err.message}`); } finally { setSaving(false); }
    };
    return (
        <form onSubmit={save} className="max-w-2xl space-y-5">
            {!approved ? <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">설정 변경은 운영진 승인 후에 할 수 있어요.</p> : null}
            <Field label="그룹 이름"><input className={inputClass} value={form.title} onChange={set('title')} /></Field>
            <Field label="소개"><textarea className={`${inputClass} min-h-[120px]`} value={form.description} onChange={set('description')} /></Field>
            <Field label="공지" hint="그룹 화면 맨 위에 보여요"><textarea className={`${inputClass} min-h-[80px]`} value={form.notice} onChange={set('notice')} /></Field>
            <div className="grid sm:grid-cols-2 gap-5">
                <Field label="지역"><select className={inputClass} value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
                <Field label="진행 방식"><select className={inputClass} value={form.mode} onChange={set('mode')}>{Object.entries(GROUP_MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="정원 (0 = 제한 없음)"><input type="number" min={0} max={500} className={inputClass} value={form.capacity} onChange={set('capacity')} /></Field>
                <Field label="가입 방식"><select className={inputClass} value={form.joinPolicy} onChange={set('joinPolicy')}>{Object.entries(JOIN_POLICY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </div>
            <Field label="모임 주기"><input className={inputClass} value={form.schedule} onChange={set('schedule')} /></Field>
            <button type="submit" disabled={!approved || saving} className="px-8 py-3 rounded-full bg-brand text-white font-semibold disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </form>
    );
}
