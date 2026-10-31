import React, { useEffect, useState } from 'react';
import { Icons } from '../../../components/Icons';
import { groupService, GROUP_TYPE_LABEL, GROUP_MODE_LABEL, GROUP_STATUS_LABEL, JOIN_POLICY_LABEL } from '../../../services/groupService';
import { firestoreLikeToMillis } from '../../../appHelpers';
import { AdminPageHeader, CARD, LoadError, adminAlert, adminConfirm, adminPrompt, btn, chip } from './ui';

const STATUS_CLASS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-slate-200 text-slate-600',
};

/**
 * 관리자: 소모임·스터디 개설 승인 / 반려 / 운영 종료
 * 승인 후 운영(일정·참가비·가입 방식 등)은 그룹장이 직접 한다.
 */
export const GroupManagement = () => {
  const [groups, setGroups] = useState(null);
  const [filter, setFilter] = useState('pending');

  const [loadError, setLoadError] = useState(false);
  useEffect(() => groupService.subscribeAllGroupsAdmin((list) => { setGroups(list); setLoadError(false); }, () => setLoadError(true)), []);

  const setStatus = async (g, status) => {
    const labels = { approved: '승인', rejected: '반려', closed: '운영 종료' };
    let extra = {};
    if (status === 'rejected') {
      const reason = await adminPrompt(`"${g.title}" 개설 신청을 반려할게요.\n반려 사유를 적어 주세요. 그룹장에게 그대로 보여요.`, {
        title: '개설 반려', multiline: true, required: true, maxLength: 300, okText: '반려하기', danger: true,
        placeholder: '예: 모임 소개에 참가비 사용처가 없어요. 보완해서 다시 신청해 주세요.',
      });
      if (reason === null) return;
      extra = { rejectReason: reason.trim().slice(0, 300) };
    } else if (!(await adminConfirm(`"${g.title}" 그룹을 ${labels[status]}할까요?${status === 'approved' ? '\n승인하면 소모임 목록에 바로 공개돼요.' : '\n운영을 종료하면 소모임 목록에서 내려가요.'}`, { okText: labels[status], danger: status === 'closed' }))) {
      return;
    }
    try {
      await groupService.setGroupStatusAdmin(g.id, status, extra);
    } catch (e) {
      adminAlert(`처리하지 못했어요. ${e?.message || ''}`);
    }
  };

  const list = (groups || []).filter((g) => filter === 'all' || g.status === filter);
  const counts = (groups || []).reduce((m, g) => ({ ...m, [g.status]: (m[g.status] || 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <AdminPageHeader title="소모임 · 스터디" description="회원이 신청한 그룹을 승인하면 목록에 공개돼요. 운영은 그룹장이 직접 해요. 신고는 '신고 처리' 메뉴에서 봐요." />
      <div className="flex flex-wrap gap-2 -mt-2">
          {[['pending', '승인 대기'], ['approved', '운영 중'], ['rejected', '반려'], ['closed', '종료'], ['all', '전체']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={chip(filter === k)}>
              {label}{k !== 'all' && counts[k] ? ` ${counts[k]}` : ''}
            </button>
          ))}
      </div>

      {loadError ? <LoadError what="그룹 목록" /> : groups === null ? <p className="text-sm text-slate-500">불러오는 중…</p> : list.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-500`}>해당하는 그룹이 없어요.</div>
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <div key={g.id} className={`${CARD} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${STATUS_CLASS[g.status] || 'bg-slate-100'}`}>{GROUP_STATUS_LABEL[g.status] || g.status}</span>
                    <span className="text-xs font-semibold text-slate-500">{GROUP_TYPE_LABEL[g.type]}</span>
                    <span className="text-xs text-slate-400">{firestoreLikeToMillis(g.createdAt) ? new Date(firestoreLikeToMillis(g.createdAt)).toLocaleDateString('ko-KR') : ''} 신청</span>
                  </div>
                  <h3 className="text-lg font-bold text-dark">{g.title}</h3>
                  <p className="text-sm text-slate-500">그룹장 {g.leaderName} · {[g.region, GROUP_MODE_LABEL[g.mode], g.schedule, JOIN_POLICY_LABEL[g.joinPolicy], Number(g.capacity) > 0 ? `정원 ${g.capacity}명` : '정원 제한 없음'].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap line-clamp-4">{g.description}</p>
                  {g.rejectReason ? <p className="text-xs text-red-600 mt-1">반려 사유: {g.rejectReason}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <a href={`/groups/${g.id}`} target="_blank" rel="noopener noreferrer" className={btn('secondary', 'sm')}><Icons.ExternalLink size={14} />보기</a>
                  {g.status !== 'approved' ? <button type="button" onClick={() => setStatus(g, 'approved')} className={btn('primary', 'sm')}>승인</button> : null}
                  {g.status === 'pending' ? <button type="button" onClick={() => setStatus(g, 'rejected')} className={btn('danger', 'sm')}>반려</button> : null}
                  {g.status === 'approved' ? <button type="button" onClick={() => setStatus(g, 'closed')} className={btn('secondary', 'sm')}>운영 종료</button> : null}
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
