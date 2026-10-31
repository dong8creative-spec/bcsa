import React, { useEffect, useState } from 'react';
import { Icons } from '../../../components/Icons';
import { groupService } from '../../../services/groupService';
import { firestoreLikeToMillis } from '../../../appHelpers';
import { AdminPageHeader, CARD, LoadError, adminAlert, adminConfirm, adminPrompt, btn, chip } from './ui';

const TARGET_LABEL = { group: '소모임·스터디', member: '회원' };
const fmt = (v) => {
  const ms = firestoreLikeToMillis(v);
  return ms ? new Date(ms).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
};

/**
 * 신고 처리: 그룹·회원 신고를 한곳에서 보고 처리한다. 처리할 때 누가·언제·어떻게 처리했는지 남긴다.
 */
export const ReportManagement = ({ currentUser }) => {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => groupService.subscribeAllReports((list) => { setReports(list); setError(false); }, () => setError(true)), []);

  const resolve = async (r) => {
    const note = await adminPrompt(`"${r.targetTitle || r.targetId}" 신고를 처리 완료로 바꿀게요.\n어떻게 처리했는지 짧게 남겨 주세요. (다른 운영진이 볼 수 있어요)`, {
      title: '신고 처리', multiline: true, maxLength: 500, placeholder: '예: 그룹장에게 연락해 안내함 / 확인 결과 문제없음', okText: '처리 완료',
    });
    if (note === null) return;
    setBusyId(r.id);
    try {
      await groupService.resolveReport(r.id, { note, by: { uid: currentUser?.uid || currentUser?.id, name: currentUser?.name } });
    } catch (e) {
      adminAlert(`처리하지 못했어요. ${e?.message || ''}`);
    } finally {
      setBusyId(null);
    }
  };

  const reopen = async (r) => {
    if (!(await adminConfirm('이 신고를 다시 "처리 전"으로 돌릴까요?'))) return;
    setBusyId(r.id);
    try { await groupService.reopenReport(r.id); } catch (e) { adminAlert(`바꾸지 못했어요. ${e?.message || ''}`); } finally { setBusyId(null); }
  };

  const counts = (reports || []).reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
  const list = (reports || []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div>
      <AdminPageHeader title="신고 처리" description="회원이 보낸 신고예요. 신고 내용은 운영진만 볼 수 있어요." />
      <div className="flex flex-wrap gap-2 mb-4">
        {[['open', '처리 전'], ['resolved', '처리 완료'], ['all', '전체']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={chip(filter === k)}>
            {label}{k !== 'all' && counts[k] ? ` ${counts[k]}` : ''}
          </button>
        ))}
      </div>

      {error ? <LoadError what="신고 목록" /> : reports === null ? <p className="text-sm text-slate-500">불러오는 중…</p> : list.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-500`}>{filter === 'open' ? '처리할 신고가 없어요.' : '해당하는 신고가 없어요.'}</div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`${CARD} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${r.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.status === 'open' ? '처리 전' : '처리 완료'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{TARGET_LABEL[r.targetType] || r.targetType}</span>
                    <span className="text-xs text-slate-400">{fmt(r.createdAt)} 접수</span>
                  </div>
                  <p className="font-semibold text-dark">{r.targetTitle || r.targetId}</p>
                  <p className="text-xs text-slate-500">신고한 회원 {r.reporterName || '-'}</p>
                  <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap break-keep">{r.reason}</p>
                  {r.status === 'resolved' ? (
                    <div className="mt-3 rounded-lg bg-soft px-3 py-2 text-xs text-slate-600">
                      <p>{r.resolvedByName || '운영진'} · {fmt(r.resolvedAt)} 처리</p>
                      {r.resolutionNote ? <p className="mt-1 text-slate-700 whitespace-pre-wrap">{r.resolutionNote}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {r.targetType === 'group' ? (
                    <a href={`/groups/${r.targetId}`} target="_blank" rel="noopener noreferrer" className={btn('secondary', 'sm')}>
                      <Icons.ExternalLink size={14} />그룹 보기
                    </a>
                  ) : null}
                  {r.status === 'open' ? (
                    <button type="button" disabled={busyId === r.id} onClick={() => resolve(r)} className={btn('primary', 'sm')}>처리 완료</button>
                  ) : (
                    <button type="button" disabled={busyId === r.id} onClick={() => reopen(r)} className={btn('secondary', 'sm')}>처리 전으로</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReportManagement;
