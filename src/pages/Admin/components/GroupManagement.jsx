import React, { useEffect, useState } from 'react';
import { Icons } from '../../../components/Icons';
import { groupService, GROUP_TYPE_LABEL, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, JOIN_POLICY_LABEL } from '../../../services/groupService';
import { firestoreLikeToMillis } from '../../../appHelpers';

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
