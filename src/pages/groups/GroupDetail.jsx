import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { isAdminUser } from '../../utils/adminAccess';
import {
    groupService, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, JOIN_POLICY_LABEL, groupCoverUrl,
} from '../../services/groupService';
import { PageShell, TypeBadge, Field, inputClass, REGIONS, CoverPicker } from './GroupsPage';
import GroupQrModal from './GroupQrModal';
import GroupReportModal from './GroupReportModal';
import { PosterHero, PosterText, JoinDialog, StickyJoinBar } from './GroupPoster';
import { groupPoster } from '../../constants/groupPosters';
import { MgTabs, MgInfoTable, HEADER_OFFSET_CLASS } from '../../components/mg/Mg';

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
    // 마이페이지 '운영하는 모임'에서 ?tab=sessions 처럼 관리 탭으로 바로 들어올 수 있다
    const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'info');
    const [busy, setBusy] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    const [joinMsg, setJoinMsg] = useState('');

    useEffect(() => groupService.subscribeGroup(groupId, setGroup), [groupId]);
    useEffect(() => (currentUser ? groupService.subscribeMembers(groupId, setMembers) : undefined), [groupId, currentUser]);
    useEffect(() => groupService.subscribeSessions(groupId, setSessions), [groupId]);

    const isLeader = !!group && group.leaderUid === uid;
    const canManage = isLeader || isAdminUser(currentUser);
    const me = members.find((m) => m.uid === uid);
    const activeMembers = members.filter((m) => m.status === 'active');
    const pendingMembers = members.filter((m) => m.status === 'pending');

    if (group === undefined) return <div className={`min-h-[60vh] text-center text-[15px] text-sub ${HEADER_OFFSET_CLASS}`}><p className="py-24">불러오는 중…</p></div>;
    if (group === null) {
        return (
            <PageShell title="그룹을 찾을 수 없어요" desc="삭제되었거나 아직 승인되지 않은 그룹입니다.">
                <button type="button" onClick={() => navigate('/groups')} className="h-12 rounded-lg bg-[#1a1a1a] px-7 text-[16px] font-bold text-white">그룹 목록으로</button>
            </PageShell>
        );
    }

    const poster = groupPoster(group);
    const sendJoin = async (note) => {
        const r = await groupService.joinGroup(groupId, note);
        setJoinOpen(false);
        setJoinMsg(r.status === 'active' ? '가입되었어요. 환영합니다!' : '가입 신청을 보냈어요. 그룹장이 승인하면 멤버가 됩니다.');
    };
    const join = async () => {
        if (!currentUser) { onRequireLogin(); return; }
        // 승인제 그룹은 그룹장이 보고 판단할 수 있게 사업 분야·고민을 함께 받는다
        if (group.joinPolicy !== 'open') { setJoinOpen(true); return; }
        setBusy(true);
        try { await sendJoin(null); } catch (e) { setJoinMsg(e.message); } finally { setBusy(false); }
    };
    const leave = async () => {
        if (!confirm('그룹에서 나갈까요?')) return;
        try { await groupService.setMemberStatus(groupId, uid, 'left'); } catch (e) { alert(e.message); }
    };

    const tabs = [['info', '소개·일정'], ...(canManage ? [['sessions', '회차·출석'], ['members', `멤버${pendingMembers.length ? ` (${pendingMembers.length})` : ''}`], ['payments', '결제·정산'], ['settings', '설정']] : [])];
    // 로그인 정보가 늦게 오면 관리 탭이 잠시 없으므로 state는 그대로 두고 보이는 탭만 소개로 대체
    const shownTab = tabs.some(([k]) => k === tab) ? tab : 'info';

    return (
        <PageShell
            crumbs={<nav aria-label="현재 위치" className="text-[14px]"><button type="button" onClick={() => navigate('/groups')} className="py-2 underline-offset-4 hover:text-white hover:underline">소모임·스터디</button><span className="mx-1.5" aria-hidden="true">/</span><span aria-current="page">{group.title}</span></nav>}
            eyebrow={<span className="inline-flex items-center gap-2"><TypeBadge type={group.type} />{group.status !== 'approved' ? <span className="text-white">{GROUP_STATUS_LABEL[group.status]}</span> : null}</span>}
            title={group.title}
            desc={[group.region, GROUP_MODE_LABEL[group.mode], group.schedule, `그룹장 ${group.leaderName || ''}`].filter(Boolean).join(' · ')}
        >
            {poster && group.status === 'approved' ? (
                <PosterHero group={group} poster={poster}
                    joinAction={<JoinAction group={group} me={me} isLeader={isLeader} busy={busy} onJoin={join} onLeave={leave} message={joinMsg} large />} />
            ) : (
                <img src={groupCoverUrl(group)} alt="" className="mb-8 aspect-[16/9] w-full border border-line object-cover md:aspect-[21/8]" decoding="async" />
            )}
            {group.status === 'pending' ? (
                <div className="mb-6 break-keep rounded-xl bg-sky px-5 py-4 text-[15px] text-ink">
                    운영진 승인을 기다리고 있어요. 승인되면 목록에 공개되고 가입·출석을 받을 수 있습니다.
                </div>
            ) : null}
            {group.status === 'rejected' ? (
                <div role="alert" className="mb-6 break-keep rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[15px] text-red-700">
                    개설이 반려되었습니다.{group.rejectReason ? ` 사유: ${group.rejectReason}` : ''}
                </div>
            ) : null}

            {/* 관리 탭이 있을 때만 직사각형 탭을 보인다(일반 회원은 「소개·일정」 하나뿐이라 탭 줄을 생략). 휴대폰은 가로로 밀어 본다 */}
            {tabs.length > 1 ? (
                <div className="-mx-5 mb-8 overflow-x-auto px-5 md:mx-0 md:px-0">
                    <MgTabs className={tabs.length > 3 ? 'min-w-[560px] md:min-w-0' : ''} label="그룹 메뉴" value={shownTab} onChange={setTab} items={tabs} />
                </div>
            ) : null}

            {shownTab === 'info' ? (
                <InfoTab
                    group={group} sessions={sessions} me={me} isLeader={isLeader} uid={uid} poster={poster}
                    activeCount={activeMembers.length} onJoin={join} onLeave={leave} busy={busy} currentUser={currentUser} joinMsg={joinMsg}
                />
            ) : null}
            {shownTab === 'sessions' && canManage ? <SessionsTab group={group} sessions={sessions} members={activeMembers} /> : null}
            {shownTab === 'members' && canManage ? <MembersTab group={group} members={members} /> : null}
            {shownTab === 'payments' && canManage ? <PaymentsTab group={group} sessions={sessions} /> : null}
            {shownTab === 'settings' && canManage ? <SettingsTab group={group} /> : null}
            {joinOpen ? <JoinDialog group={group} poster={poster} onSubmit={sendJoin} onClose={() => setJoinOpen(false)} /> : null}
            {poster && group.status === 'approved' && !isLeader && !me ? (
                <>
                    <div className="h-24 md:hidden" aria-hidden="true" />
                    <StickyJoinBar><JoinAction group={group} me={me} isLeader={isLeader} busy={busy} onJoin={join} onLeave={leave} /></StickyJoinBar>
                </>
            ) : null}
        </PageShell>
    );
}

/** 가입 버튼(상태별): 그룹장이면 없음, 멤버면 나가기, 신청했으면 대기, 아니면 가입(신청) */
function JoinAction({ group, me, isLeader, busy, onJoin, onLeave, message, large = false }) {
    if (group.status !== 'approved' || isLeader) return null;
    const status = me?.status;
    return (
        <div>
            {status === 'active' ? (
                large ? <p className="flex h-[53px] w-full items-center justify-center rounded-lg bg-sky text-center text-[17px] font-bold text-royal">이 그룹 멤버예요</p>
                    : <button type="button" onClick={onLeave} className="h-12 w-full rounded-lg border border-line2 bg-white text-[15px] font-semibold text-[#333] hover:border-ink">그룹 나가기</button>
            ) : status === 'pending' ? (
                <p className="flex h-12 w-full items-center justify-center rounded-lg bg-card text-center text-[16px] font-semibold text-ink">가입 승인 대기 중</p>
            ) : (
                <button type="button" disabled={busy} onClick={onJoin}
                    className={`w-full rounded-lg bg-royal font-bold text-white hover:bg-royalDark disabled:opacity-60 ${large ? 'h-[53px] text-[17px]' : 'h-12 text-[16px]'}`}>
                    {group.joinPolicy === 'open' ? '가입하기' : '가입 신청하기'}
                </button>
            )}
            {message ? <p role="status" aria-live="polite" className="mt-2 break-keep text-[15px] font-semibold text-ink">{message}</p> : null}
        </div>
    );
}

function InfoTab({ group, sessions, me, isLeader, uid, activeCount, onJoin, onLeave, busy, currentUser, poster, joinMsg }) {
    const [myAttendance, setMyAttendance] = useState({});
    // 신고 창 상태는 이 조각 안에 둔다(예전에 바깥에만 있어 그룹 화면이 흰 화면이 되던 문제)
    const [reportOpen, setReportOpen] = useState(false);
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
        <div data-layout="page" className="grid gap-8 md:grid-cols-[1fr_300px] md:gap-10">
            <div className="min-w-0 space-y-10">
                {poster ? <PosterText poster={poster} /> : null}
                {group.notice ? (
                    <div className="rounded-xl bg-sky px-5 py-4">
                        <p className="mb-1 text-[14px] font-semibold text-royal">공지</p>
                        <p className="whitespace-pre-wrap break-keep text-[15px] text-ink">{group.notice}</p>
                    </div>
                ) : null}
                <div>
                    <h2 className="mb-3 text-[20px] font-bold text-ink md:text-[23px]">소개</h2>
                    <p className="whitespace-pre-wrap break-keep text-[16px] leading-relaxed text-[#333]">{group.description}</p>
                </div>
                <div>
                    <h2 className="mb-3 text-[20px] font-bold text-ink md:text-[23px]">일정</h2>
                    {sessions.length === 0 ? <p className="text-[15px] text-sub">아직 등록된 회차가 없어요.</p> : (
                        <ul className="divide-y divide-line border-y border-line">
                            {sessions.map((s, i) => (
                                <li key={s.id} className="flex min-h-[96px] items-start justify-between gap-3 py-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] text-sub">{group.type === 'study' ? `${i + 1}회차 · ` : ''}{fmtDate(s.startsAt) || '\u00a0'}</p>
                                        <p className="mt-0.5 truncate text-[16px] font-semibold text-ink" title={s.title}>{s.title || '\u00a0'}</p>
                                        <p className="mt-1 truncate text-[14px] text-sub">{[s.location, Number(s.fee) > 0 ? `참가비 ${won(s.fee)}` : '참가비 없음'].filter(Boolean).join(' · ')}</p>
                                        {s.onlineUrl && me?.status === 'active' ? <a href={s.onlineUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-[15px] font-semibold text-royal underline underline-offset-4">온라인 참여 링크<span className="sr-only"> (새 창)</span></a> : null}
                                    </div>
                                    {myAttendance[s.id] ? <span className="inline-flex h-7 shrink-0 items-center bg-royal px-2.5 text-[13px] font-semibold text-white">출석</span> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <aside className="space-y-4">
                <MgInfoTable rows={[
                    ['가입 방식', <b className="font-semibold">{JOIN_POLICY_LABEL[group.joinPolicy] || '\u00a0'}</b>],
                    ['멤버', <><b className="font-semibold">{currentUser ? `${activeCount}명` : '로그인 후 확인'}</b>{Number(group.capacity) > 0 ? ` / 정원 ${group.capacity}명` : ''}</>],
                    ['내 출석', group.type === 'study' && me?.status === 'active' ? <><b className="font-semibold">{attendedCount}</b> / {pastCount || sessions.length}회</> : null],
                ]} />
                {/* 포스터 그룹은 위 포스터 옆에 큰 가입 버튼이 있다. 멤버의 「그룹 나가기」만 여기 둔다 */}
                {!poster || me?.status === 'active' ? (
                    <JoinAction group={group} me={me} isLeader={isLeader} busy={busy} onJoin={onJoin} onLeave={onLeave} message={poster ? '' : joinMsg} />
                ) : null}
                <p className="break-keep text-[14px] leading-relaxed text-sub">모임 현장에서는 그룹장 화면의 QR을 휴대폰 카메라로 찍으면 출석(참가비가 있으면 결제까지)이 됩니다.</p>
                {currentUser && !isLeader ? (
                    <button type="button" onClick={() => setReportOpen(true)} className="min-h-[44px] text-[14px] text-sub underline underline-offset-4 hover:text-ink">이 그룹 신고하기</button>
                ) : null}
            </aside>
            {reportOpen ? <GroupReportModal group={group} currentUser={currentUser} uid={uid} onClose={() => setReportOpen(false)} /> : null}
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
            <form onSubmit={add} className="space-y-4 rounded-xl bg-card p-5 md:p-6">
                <p className="text-[17px] font-semibold text-ink">회차 추가</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="제목"><input className={inputClass} value={form.title} onChange={set('title')} placeholder={group.type === 'study' ? '예: 3주차 · 상세페이지 분석' : '예: 10월 정기 모임'} /></Field>
                    <Field label="참가비 (원)" hint="0이면 무료. 유료면 QR 출석 때 결제까지 진행돼요."><input type="number" min={0} className={inputClass} value={form.fee} onChange={set('fee')} /></Field>
                    <Field label="날짜"><input type="date" className={inputClass} value={form.date} onChange={set('date')} /></Field>
                    <Field label="시작 시간"><input type="time" className={inputClass} value={form.time} onChange={set('time')} /></Field>
                    <Field label="장소"><input className={inputClass} value={form.location} onChange={set('location')} placeholder="예: 서면 ○○카페 2층" /></Field>
                    <Field label="온라인 링크 (선택)" hint="멤버에게만 보여요"><input className={inputClass} value={form.onlineUrl} onChange={set('onlineUrl')} placeholder="https://" /></Field>
                </div>
                <button type="submit" className="h-12 rounded-lg bg-[#1a1a1a] px-7 text-[16px] font-bold text-white hover:bg-black">회차 추가</button>
            </form>

            {sessions.length === 0 ? <p className="text-[15px] text-sub">등록된 회차가 없어요.</p> : (
                <ul className="space-y-3">
                    {sessions.map((s) => (
                        <li key={s.id} className="border border-line p-4 md:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 basis-[220px]">
                                    <p className="truncate text-[13px] text-sub">{fmtDate(s.startsAt) || '\u00a0'}</p>
                                    <p className="mt-0.5 truncate text-[16px] font-semibold text-ink" title={s.title}>{s.title || '\u00a0'}</p>
                                    <p className="mt-0.5 truncate text-[14px] text-sub">{[s.location, Number(s.fee) > 0 ? `참가비 ${won(s.fee)}` : '무료'].filter(Boolean).join(' · ')}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" disabled={!approved || s.attendanceOpen === false} onClick={() => setQrSession(s)}
                                        className="h-11 rounded-lg bg-[#1a1a1a] px-4 text-[14px] font-semibold text-white disabled:opacity-40" title={approved ? '' : '운영진 승인 후 사용할 수 있어요'}>출석 QR 띄우기</button>
                                    <button type="button" onClick={() => setOpenRoster(openRoster === s.id ? null : s.id)} aria-expanded={openRoster === s.id} className="h-11 rounded-lg border border-line2 bg-white px-4 text-[14px] font-semibold text-[#333] hover:border-ink">출석부</button>
                                    <button type="button" onClick={() => groupService.updateSession(group.id, s.id, { attendanceOpen: s.attendanceOpen === false })}
                                        className="h-11 rounded-lg border border-line2 bg-white px-4 text-[14px] font-semibold text-[#333] hover:border-ink">{s.attendanceOpen === false ? '출석 받기' : '출석 마감'}</button>
                                    <button type="button" onClick={() => { if (confirm('이 회차를 삭제할까요?')) groupService.deleteSession(group.id, s.id).catch((e) => alert(e.message)); }}
                                        className="h-11 rounded-lg px-3 text-[14px] font-semibold text-red-600 hover:bg-red-50">삭제</button>
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
        <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[14px] text-sub">출석 {att.length}명 / 멤버 {members.length}명{fee > 0 ? ` · 결제 완료 ${att.filter((a) => a.paid).length}명` : ''}</p>
            <ul className="divide-y divide-line">
                {rows.map((r) => {
                    const a = byUid[r.uid];
                    return (
                        <li key={r.uid} className="flex min-h-[56px] items-center justify-between gap-2 py-1.5 text-[15px]">
                            <span className="min-w-0 truncate">{r.name || '회원'}</span>
                            <span className="flex items-center gap-2 shrink-0">
                                {a ? (
                                    <>
                                        <span className="text-[13px] font-semibold text-royal">{a.method === 'qr' ? 'QR 출석' : '수동 출석'}</span>
                                        {fee > 0 ? (a.paid ? <span className="text-[13px] font-semibold text-royal">결제 완료</span> : (
                                            <button type="button" onClick={() => groupService.setCashPaid(group.id, session.id, r.uid, !a.cashPaid)} aria-pressed={!!a.cashPaid} className={`min-h-[44px] rounded-lg border px-3 text-[13px] font-semibold ${a.cashPaid ? 'border-royal bg-sky text-royal' : 'border-line2 bg-white text-sub'}`}>
                                                {a.cashPaid ? '현장 결제 ✓' : '현장 결제 표시'}
                                            </button>
                                        )) : null}
                                        {!a.paid ? <button type="button" onClick={() => groupService.removeAttendance(group.id, session.id, r.uid)} className="min-h-[44px] px-2 text-[13px] text-sub hover:text-ink">취소</button> : null}
                                    </>
                                ) : (
                                    <button type="button" onClick={() => groupService.markManualAttendance(group.id, session.id, r).catch((e) => alert(e.message))} className="min-h-[44px] rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-[#333] hover:border-ink">출석 처리</button>
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
    const [notes, setNotes] = useState({});
    useEffect(() => { groupService.getJoinNotes(group.id).then(setNotes).catch(() => setNotes({})); }, [group.id, members.length]);
    const Note = ({ uid }) => (notes[uid] && (notes[uid].field || notes[uid].concern) ? (
        <dl className="mt-1.5 space-y-0.5 break-keep text-[14px] text-[#333]">
            {notes[uid].field ? <div><dt className="inline text-sub">사업 분야 </dt><dd className="inline">{notes[uid].field}</dd></div> : null}
            {notes[uid].concern ? <div><dt className="inline text-sub">지금 고민 </dt><dd className="inline whitespace-pre-wrap">{notes[uid].concern}</dd></div> : null}
        </dl>
    ) : null);
    const act = (uid, status) => groupService.setMemberStatus(group.id, uid, status).catch((e) => alert(e.message));
    return (
        <div className="space-y-8">
            <div>
                <h3 className="mb-3 text-[18px] font-semibold text-ink">가입 신청 {pending.length}명</h3>
                {pending.length === 0 ? <p className="text-[15px] text-sub">대기 중인 신청이 없어요.</p> : (
                    <ul className="space-y-2">
                        {pending.map((m) => (
                            <li key={m.uid} className="flex min-h-[68px] items-start justify-between gap-3 rounded-xl bg-card px-4 py-3 text-[15px]">
                                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.name}</span><Note uid={m.uid} /></span>
                                <span className="flex shrink-0 gap-2">
                                    <button type="button" onClick={() => act(m.uid, 'active')} className="h-11 rounded-lg bg-royal px-4 text-[14px] font-semibold text-white hover:bg-royalDark">승인</button>
                                    <button type="button" onClick={() => act(m.uid, 'rejected')} className="h-11 rounded-lg border border-line2 bg-white px-4 text-[14px] font-semibold text-[#333] hover:border-ink">거절</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <h3 className="mb-3 text-[18px] font-semibold text-ink">멤버 {active.length}명</h3>
                <ul className="divide-y divide-line border-y border-line">
                    {active.map((m) => (
                        <li key={m.uid} className="flex min-h-[60px] items-start justify-between gap-3 py-2 text-[15px]">
                            <span className="min-w-0 flex-1 py-2.5">{m.name}{m.role === 'leader' ? <span className="ml-2 text-[13px] font-semibold text-royal">그룹장</span> : null}<Note uid={m.uid} /></span>
                            {m.role !== 'leader' ? <button type="button" onClick={() => { if (confirm(`${m.name}님을 내보낼까요?`)) act(m.uid, 'left'); }} className="min-h-[44px] shrink-0 px-2 text-[14px] text-sub hover:text-red-600">내보내기</button> : null}
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
            <div className="rounded-xl bg-card p-5 md:p-6">
                <p className="text-[14px] text-sub">QR로 결제된 참가비 합계</p>
                <p className="mt-1 text-[30px] font-bold text-ink">{won(total)}</p>
                <p className="mt-2 break-keep text-[14px] text-sub">결제 금액은 운영사(부산청년사업가 포럼)가 받아 두었다가 그룹장에게 정산합니다. 정산 방식은 운영진이 안내드려요.</p>
            </div>
            {rows === null ? <p className="text-[15px] text-sub">불러오는 중…</p> : rows.length === 0 ? <p className="text-[15px] text-sub">결제 내역이 없어요.</p> : (
                <ul className="divide-y divide-line border-y border-line text-[15px]">
                    {rows.map((r) => (
                        <li key={r.id} className="flex min-h-[56px] items-center justify-between gap-3 py-2.5">
                            <span className="min-w-0 truncate">{r.name} · {title(r.sessionId) || r.sessionTitle}</span>
                            <span className="shrink-0 text-[14px]">
                                <b>{won(r.amount)}</b>{' '}
                                <span className={r.status === 'paid' ? 'text-royal' : 'text-sub'}>{({ paid: '결제', pending: '미결제', refunded: '환불' })[r.status] || r.status}</span>
                                {r.status === 'paid' ? <span className="text-sub"> · {r.settled ? '정산 완료' : '정산 전'}</span> : null}
                                {r.status === 'paid' && !r.settled ? (
                                    <button type="button" onClick={async () => {
                                        const reason = prompt(`${r.name}님의 ${won(r.amount)}을 전액 환불할까요? 환불 사유를 적어 주세요.`, '회차 취소');
                                        if (reason === null) return;
                                        try {
                                            await groupService.refundGroupPayment(r.id, reason);
                                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'refunded' } : x)));
                                            alert('환불했습니다. 카드사에 따라 3~5영업일 걸릴 수 있어요.');
                                        } catch (e) { alert(e.message); }
                                    }} className="ml-2 min-h-[44px] rounded-lg border border-line2 bg-white px-3 font-semibold text-red-600 hover:border-red-600">환불</button>
                                ) : null}
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
        cover: group.cover || (group.type === 'study' ? 'study' : 'meetup'),
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
                cover: form.cover,
            });
            alert('저장했어요.');
        } catch (err) { alert(`저장하지 못했어요: ${err.message}`); } finally { setSaving(false); }
    };
    return (
        <form onSubmit={save} className="max-w-2xl space-y-5">
            {!approved ? <p className="rounded-xl bg-sky px-5 py-4 text-[15px] text-ink">설정 변경은 운영진 승인 후에 할 수 있어요.</p> : null}
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
            <Field label="커버 이미지"><CoverPicker value={form.cover} type={group.type} onChange={(cover) => setForm((f) => ({ ...f, cover }))} /></Field>
            <button type="submit" disabled={!approved || saving} className="h-[52px] rounded-lg bg-[#1a1a1a] px-10 text-[16px] font-bold text-white hover:bg-black disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </form>
    );
}
