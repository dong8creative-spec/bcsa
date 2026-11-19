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
    <div className="rounded-xl bg-card p-4 md:p-5">
      <h3 className="text-[18px] font-bold text-ink">모집 그룹 바로 만들기</h3>
      <p className="text-[15px] text-sub mt-1">포스터·소개가 미리 채워진 그룹을 한 번에 열어요. 일정·참가비는 그룹 화면의 회차·설정에서 넣으세요.</p>
      <ul className="mt-3 border-t border-ink bg-white">
        {templates.map(([key, p]) => {
          const existing = (groups || []).find((g) => g.poster === key && g.status !== 'closed' && g.status !== 'rejected');
          return (
            <li key={key} className="flex min-h-[60px] flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <span className="min-w-0 truncate text-[15px] font-semibold text-ink" title={p.createDefaults.title}>{p.createDefaults.title}</span>
              {existing ? (
                <a href={`/groups/${existing.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center text-[15px] font-semibold text-royal hover:underline">열려 있음 · 보기</a>
              ) : (
                <button type="button" disabled={!!busy} onClick={() => create(key, p)} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white hover:bg-black disabled:opacity-50">
                  {busy === key ? '만드는 중…' : '만들고 공개하기'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {msg ? <p role="status" className="mt-2 text-[15px] font-semibold text-dark">{msg}</p> : null}
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
    <label className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
      <span className="font-semibold text-ink">홈 표시</span>
      <select value={group.recruit || 'open'} onChange={change} disabled={saving} className="h-10 rounded-lg border border-line2 bg-white px-2.5 text-[15px] focus:border-royal focus:outline-none">
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
    <div className="rounded-xl border border-line bg-white p-4 md:p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left">
        <span><b className="text-[17px] font-bold text-ink">모임 알림 신청</b> <span className="text-[15px] text-sub">홈 「찾는 모임이 없으셨나요?」로 들어온 신청</span></span>
        <span className="shrink-0 text-[15px] font-semibold text-royal">{open ? '접기' : '보기'}</span>
      </button>
      {open ? (rows === null ? <p className="mt-3 text-[15px] text-sub">불러오는 중…</p> : rows.length === 0 ? <p className="mt-3 text-[15px] text-sub">아직 신청이 없어요.</p> : (
        <ul className="mt-3 border-t border-ink text-[15px]">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 border-b border-line py-3">
              <span className="min-w-0">
                <b>{WHO[r.who] || r.who}</b> · {r.phone}{r.email ? ` · ${r.email}` : ''}
                <span className="block text-sub">{(r.topics || []).join(', ') || '분야 선택 없음'}{r.wish ? ` — ${r.wish}` : ''}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[13px]">
                <span className="text-sub">{firestoreLikeToMillis(r.createdAt) ? new Date(firestoreLikeToMillis(r.createdAt)).toLocaleDateString('ko-KR') : ''}</span>
                <button type="button" onClick={() => { if (confirm('이 신청을 지울까요? (알림을 그만 받길 원하는 경우 등)')) groupService.deleteInterestAlert(r.id).catch((e) => alert(e.message)); }} className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-3 text-[14px] font-semibold text-red-600 hover:border-red-600">지우기</button>
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
    <label className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
      <span className="font-semibold text-ink">모집 포스터</span>
      <select value={group.poster || ''} onChange={change} disabled={saving} className="h-10 rounded-lg border border-line2 bg-white px-2.5 text-[15px] focus:border-royal focus:outline-none">
        <option value="">없음</option>
        {Object.entries(GROUP_POSTERS).filter(([k, p]) => !p.imagesPending || group.poster === k).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
      </select>
      {group.poster === HOUSE_AD_POSTER && group.status === 'approved' ? <span className="text-[13px] font-semibold text-royal">사이트 광고 자리에 모집 광고가 나가는 중</span> : null}
    </label>
  );
};

const STATUS_CLASS = {
  pending: 'bg-sky text-royal',
  approved: 'bg-royal text-white',
  rejected: 'bg-red-50 text-red-600',
  closed: 'bg-card text-sub',
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
          <h2 className="text-[22px] font-bold text-ink md:text-[24px]">소모임·스터디 관리</h2>
          <p className="text-[15px] text-sub mt-1">회원이 신청한 그룹을 승인하면 목록에 공개됩니다. 운영은 그룹장이 직접 합니다.</p>
        </div>
        <div className="flex max-w-full overflow-x-auto border border-[#0c0c0e]" role="tablist" aria-label="그룹 상태">
          {[['pending', '승인 대기'], ['approved', '운영 중'], ['rejected', '반려'], ['closed', '종료'], ['all', '전체']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`h-11 shrink-0 whitespace-nowrap border-r border-[#0c0c0e] px-3.5 text-[15px] font-semibold last:border-r-0 ${filter === k ? 'bg-[#0c0c0e] text-white' : 'bg-white text-[#555] hover:text-ink'}`}>
              {label}{k !== 'all' && counts[k] ? ` ${counts[k]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {reports.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 md:p-5">
          <h3 className="mb-3 text-[17px] font-bold text-red-700">처리하지 않은 신고 {reports.length}건</h3>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 text-[15px]">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.targetTitle || r.targetId} <span className="text-[13px] font-normal text-sub">· 신고자 {r.reporterName || '-'}</span></p>
                  <p className="text-gray-700 whitespace-pre-wrap break-keep">{r.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.targetType === 'group' ? <a href={`/groups/${r.targetId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-line2 bg-white px-3 text-[15px] font-semibold text-ink hover:border-ink">그룹 보기</a> : null}
                  <button type="button" onClick={() => groupService.resolveReport(r.id).catch((e) => alert(e.message))} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white hover:bg-black disabled:opacity-50">처리 완료</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <QuickRecruitGroups groups={groups} />
      <InterestAlerts />

      {groups === null ? <p className="text-[15px] text-sub">불러오는 중…</p> : list.length === 0 ? (
        <div className="rounded-xl bg-card p-10 text-center text-[15px] text-sub">해당하는 그룹이 없습니다.</div>
      ) : (
        <div className="border-t border-ink">
          {list.map((g) => (
            <div key={g.id} className="border-b border-line py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-7 items-center rounded-none px-2 text-[13px] font-semibold ${STATUS_CLASS[g.status] || 'bg-card text-sub'}`}>{GROUP_STATUS_LABEL[g.status] || g.status}</span>
                    <span className="text-[13px] font-semibold text-sub">{GROUP_TYPE_LABEL[g.type]}</span>
                    <span className="text-[13px] text-sub">{firestoreLikeToMillis(g.createdAt) ? new Date(firestoreLikeToMillis(g.createdAt)).toLocaleDateString('ko-KR') : ''} 신청</span>
                  </div>
                  <h3 className="line-clamp-2 text-[18px] font-semibold text-ink" title={g.title}>{g.title}</h3>
                  <p className="mt-0.5 text-[15px] text-sub">그룹장 {g.leaderName} · {[g.region, GROUP_MODE_LABEL[g.mode], g.schedule, JOIN_POLICY_LABEL[g.joinPolicy], Number(g.capacity) > 0 ? `정원 ${g.capacity}명` : '정원 제한 없음'].filter(Boolean).join(' · ')}</p>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[15px] text-[#333]">{g.description}</p>
                  {g.rejectReason ? <p className="mt-1 text-[14px] text-red-600">반려 사유: {g.rejectReason}</p> : null}
                  <PosterPicker group={g} />
                  {g.status === 'approved' ? <RecruitPicker group={g} /> : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <a href={`/groups/${g.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-line2 bg-white px-3 text-[15px] font-semibold text-ink hover:border-ink"><Icons.ExternalLink size={14} />보기</a>
                  {g.status !== 'approved' ? <button type="button" onClick={() => setStatus(g, 'approved')} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white hover:bg-black disabled:opacity-50">승인</button> : null}
                  {g.status === 'pending' ? <button type="button" onClick={() => setStatus(g, 'rejected')} className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-3 text-[15px] font-semibold text-red-600 hover:border-red-600">반려</button> : null}
                  {g.status === 'approved' ? <button type="button" onClick={() => setStatus(g, 'closed')} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-line2 bg-white px-3 text-[15px] font-semibold text-ink hover:border-ink">운영 종료</button> : null}
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
