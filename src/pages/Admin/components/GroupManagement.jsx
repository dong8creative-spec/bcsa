import React, { useEffect, useState } from 'react';
import { Icons } from '../../../components/Icons';
import { groupService, GROUP_TYPE_LABEL, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, JOIN_POLICY_LABEL } from '../../../services/groupService';
import { firestoreLikeToMillis } from '../../../appHelpers';
import { GROUP_POSTERS, HOUSE_AD_POSTER } from '../../../constants/groupPosters';

/**
 * 운영진만: 포스터에 딸린 모집 그룹을 한 번에 연다(개설 → 승인 → 포스터 지정). 그룹장은 누른 운영진.
 * 이미 그 포스터를 단 그룹이 있으면 버튼 대신 「열려 있음」을 보여 준다.
 */
const QuickRecruitGroups = ({ groups }) => {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const templates = Object.entries(GROUP_POSTERS).filter(([, p]) => p.createDefaults && !p.imagesPending);
  const create = async (key, p) => {
    if (!confirm(`「${p.createDefaults.title}」 그룹을 만들고 바로 공개할까요? 그룹장은 지금 로그인한 운영진 계정이 됩니다.`)) return;
    setBusy(key); setMsg('');
    try {
      const { groupId } = await groupService.createGroupRequest(p.createDefaults);
      await groupService.setGroupStatusAdmin(groupId, 'approved');
      await groupService.setGroupPosterAdmin(groupId, key);
      setMsg(`「${p.createDefaults.title}」을 열었어요. 소모임·스터디 목록 맨 위에 보입니다.`);
    } catch (e) { setMsg(`만들지 못했습니다: ${e.message}`); }
    finally { setBusy(''); }
  };
  if (!templates.length) return null;
  return (
    <div className="bg-white rounded-2xl p-5 border border-blue-100">
      <h3 className="font-bold text-dark">모집 그룹 바로 만들기</h3>
      <p className="text-sm text-gray-500 mt-1">포스터·소개가 미리 채워진 그룹을 한 번에 열어요. 일정·참가비는 그룹 화면의 회차·설정에서 넣으세요.</p>
      <ul className="mt-3 space-y-2">
        {templates.map(([key, p]) => {
          const existing = (groups || []).find((g) => g.poster === key && g.status !== 'closed' && g.status !== 'rejected');
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-4 py-3">
              <span className="text-sm font-semibold text-dark">{p.createDefaults.title}</span>
              {existing ? (
                <a href={`/groups/${existing.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-emerald-700">열려 있음 · 보기</a>
              ) : (
                <button type="button" disabled={!!busy} onClick={() => create(key, p)} className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">
                  {busy === key ? '만드는 중…' : '만들고 공개하기'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {msg ? <p role="status" className="mt-2 text-sm font-semibold text-dark">{msg}</p> : null}
    </div>
  );
};

/** 홈에서 이 모임을 「모집중 / 모집예정 / 숨김」 중 어디에 보일지 (groups/{id}.recruit) */
const RecruitPicker = ({ group }) => {
  const [saving, setSaving] = useState(false);
  const change = async (e) => {
    setSaving(true);
    try { await groupService.setGroupRecruitAdmin(group.id, e.target.value); }
    catch (err) { alert(`바꾸지 못했습니다: ${err.message}`); }
    finally { setSaving(false); }
  };
  return (
    <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-gray-700">홈 표시</span>
      <select value={group.recruit || 'open'} onChange={change} disabled={saving} className="rounded-lg border border-black/10 bg-soft px-2.5 py-1.5 text-sm">
        <option value="open">모집중</option>
        <option value="soon">모집예정</option>
        <option value="hidden">홈에서 숨김</option>
      </select>
    </label>
  );
};

/** 홈 「찾는 모임이 없으셨나요?」 알림 신청 목록 (interestAlerts, 관리자만 읽음) */
const InterestAlerts = () => {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => (open ? groupService.subscribeInterestAlerts(setRows) : undefined), [open]);
  const WHO = { owner: '사업 중', pre: '예비창업' };
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.06]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span><b className="text-dark">모임 알림 신청</b> <span className="text-sm text-gray-500">홈 「찾는 모임이 없으셨나요?」로 들어온 신청</span></span>
        <span className="text-sm font-semibold text-brand">{open ? '접기' : '보기'}</span>
      </button>
      {open ? (rows === null ? <p className="mt-3 text-sm text-gray-400">불러오는 중…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-gray-500">아직 신청이 없어요.</p> : (
        <ul className="mt-3 divide-y divide-black/[0.05] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <b>{WHO[r.who] || r.who}</b> · {r.phone}{r.email ? ` · ${r.email}` : ''}
                <span className="block text-gray-600">{(r.topics || []).join(', ') || '분야 선택 없음'}{r.wish ? ` — ${r.wish}` : ''}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-gray-400">{firestoreLikeToMillis(r.createdAt) ? new Date(firestoreLikeToMillis(r.createdAt)).toLocaleDateString('ko-KR') : ''}</span>
                <button type="button" onClick={() => { if (confirm('이 신청을 지울까요? (알림을 그만 받길 원하는 경우 등)')) groupService.deleteInterestAlert(r.id).catch((e) => alert(e.message)); }} className="rounded-lg bg-soft px-2.5 py-1 font-semibold text-red-600">지우기</button>
              </span>
            </li>
          ))}
        </ul>
      )) : null}
    </div>
  );
};

/** 운영진만: 그룹에 모집 포스터 붙이기/떼기. 붙인 그룹은 화면 맨 위 포스터·목록 「지금 모집 중」, 광고 자리 모집 광고로 이어진다 */
const PosterPicker = ({ group }) => {
  const [saving, setSaving] = useState(false);
  const change = async (e) => {
    const poster = e.target.value;
    setSaving(true);
    try { await groupService.setGroupPosterAdmin(group.id, poster); }
    catch (err) { alert(`포스터를 바꾸지 못했습니다: ${err.message}`); }
    finally { setSaving(false); }
  };
  return (
    <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-gray-700">모집 포스터</span>
      <select value={group.poster || ''} onChange={change} disabled={saving} className="rounded-lg border border-black/10 bg-soft px-2.5 py-1.5 text-sm">
        <option value="">없음</option>
        {Object.entries(GROUP_POSTERS).filter(([k, p]) => !p.imagesPending || group.poster === k).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
      </select>
      {group.poster === HOUSE_AD_POSTER && group.status === 'approved' ? <span className="text-xs font-semibold text-emerald-700">사이트 광고 자리에 모집 광고가 나가는 중</span> : null}
    </label>
  );
};

const STATUS_CLASS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-gray-200 text-gray-600',
};

/**
 * 관리자: 소모임·스터디 개설 승인 / 반려 / 운영 종료
 * 승인 후 운영(일정·참가비·가입 방식 등)은 그룹장이 직접 한다.
 */
export const GroupManagement = () => {
  const [groups, setGroups] = useState(null);
  const [filter, setFilter] = useState('pending');

  const [reports, setReports] = useState([]);
  useEffect(() => groupService.subscribeAllGroupsAdmin(setGroups), []);
  useEffect(() => groupService.subscribeOpenReports(setReports), []);

  const setStatus = async (g, status) => {
    const labels = { approved: '승인', rejected: '반려', closed: '운영 종료' };
    let extra = {};
    if (status === 'rejected') {
      const reason = prompt('반려 사유를 입력해 주세요 (그룹장에게 보입니다).', '');
      if (reason === null) return;
      extra = { rejectReason: reason.slice(0, 300) };
    } else if (!confirm(`"${g.title}" 그룹을 ${labels[status]}할까요?`)) {
      return;
    }
    try {
      await groupService.setGroupStatusAdmin(g.id, status, extra);
    } catch (e) {
      alert(`처리하지 못했습니다: ${e.message}`);
    }
  };

  const list = (groups || []).filter((g) => filter === 'all' || g.status === filter);
  const counts = (groups || []).reduce((m, g) => ({ ...m, [g.status]: (m[g.status] || 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-dark">소모임·스터디 관리</h2>
          <p className="text-sm text-gray-500 mt-1">회원이 신청한 그룹을 승인하면 목록에 공개됩니다. 운영은 그룹장이 직접 합니다.</p>
        </div>
        <div className="flex gap-2">
          {[['pending', '승인 대기'], ['approved', '운영 중'], ['rejected', '반려'], ['closed', '종료'], ['all', '전체']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filter === k ? 'bg-brand text-white' : 'bg-white text-gray-600 border border-black/10'}`}>
              {label}{k !== 'all' && counts[k] ? ` ${counts[k]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {reports.length > 0 ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <h3 className="font-bold text-red-700 mb-3">처리하지 않은 신고 {reports.length}건</h3>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="bg-white rounded-xl p-3 flex flex-wrap items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-dark">{r.targetTitle || r.targetId} <span className="text-xs text-gray-400">· 신고자 {r.reporterName || '-'}</span></p>
                  <p className="text-gray-700 whitespace-pre-wrap break-keep">{r.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.targetType === 'group' ? <a href={`/groups/${r.targetId}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-soft text-xs font-semibold">그룹 보기</a> : null}
                  <button type="button" onClick={() => groupService.resolveReport(r.id).catch((e) => alert(e.message))} className="px-3 py-1.5 rounded-lg bg-dark text-white text-xs font-semibold">처리 완료</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <QuickRecruitGroups groups={groups} />
      <InterestAlerts />

      {groups === null ? <p className="text-gray-400">불러오는 중…</p> : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-gray-500">해당하는 그룹이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl p-5 border border-black/[0.06]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${STATUS_CLASS[g.status] || 'bg-gray-100'}`}>{GROUP_STATUS_LABEL[g.status] || g.status}</span>
                    <span className="text-xs font-semibold text-gray-500">{GROUP_TYPE_LABEL[g.type]}</span>
                    <span className="text-xs text-gray-400">{firestoreLikeToMillis(g.createdAt) ? new Date(firestoreLikeToMillis(g.createdAt)).toLocaleDateString('ko-KR') : ''} 신청</span>
                  </div>
                  <h3 className="text-lg font-bold text-dark">{g.title}</h3>
                  <p className="text-sm text-gray-500">그룹장 {g.leaderName} · {[g.region, GROUP_MODE_LABEL[g.mode], g.schedule, JOIN_POLICY_LABEL[g.joinPolicy], Number(g.capacity) > 0 ? `정원 ${g.capacity}명` : '정원 제한 없음'].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap line-clamp-4">{g.description}</p>
                  {g.rejectReason ? <p className="text-xs text-red-600 mt-1">반려 사유: {g.rejectReason}</p> : null}
                  <PosterPicker group={g} />
                  {g.status === 'approved' ? <RecruitPicker group={g} /> : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <a href={`/groups/${g.id}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg bg-soft text-sm font-semibold inline-flex items-center gap-1"><Icons.ExternalLink size={14} />보기</a>
                  {g.status !== 'approved' ? <button type="button" onClick={() => setStatus(g, 'approved')} className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-semibold">승인</button> : null}
                  {g.status === 'pending' ? <button type="button" onClick={() => setStatus(g, 'rejected')} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold">반려</button> : null}
                  {g.status === 'approved' ? <button type="button" onClick={() => setStatus(g, 'closed')} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold">운영 종료</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
