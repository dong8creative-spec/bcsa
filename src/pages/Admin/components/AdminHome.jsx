import React from 'react';
import { Icons } from '../../../components/Icons';
import { AdminPageHeader, CARD, btn } from './ui';

const NumberCard = ({ label, hint, item, onClick, tone = 'brand' }) => {
  const n = item?.value;
  const urgent = Number(n) > 0;
  const toneClass = urgent ? (tone === 'red' ? 'text-red-600' : 'text-brand') : 'text-slate-400';
  return (
    <button type="button" onClick={onClick}
      className={`${CARD} p-4 sm:p-5 text-left hover:border-brand/40 hover:shadow-sm transition flex flex-col gap-1 min-h-[7.5rem]`}>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      {item?.error ? (
        <span className="text-sm font-semibold text-red-600 mt-1">불러오지 못했어요</span>
      ) : item?.loading ? (
        <span className="h-9 w-12 rounded-lg bg-soft animate-pulse mt-1" aria-label="불러오는 중" />
      ) : (
        <span className={`text-3xl font-bold ${toneClass}`}>{n}<span className="text-base font-semibold ml-0.5">건</span></span>
      )}
      <span className="text-xs text-slate-500 mt-auto break-keep">{item?.loading || item?.error ? '' : urgent ? hint : '처리할 일이 없어요'}</span>
    </button>
  );
};

/**
 * 관리자 첫 화면: 처리할 일을 숫자로 모아 보고, 누르면 해당 화면으로 바로 간다.
 */
export const AdminHome = ({ todo, onNavigate }) => {
  const upcoming = todo.upcoming;
  return (
    <div>
      <AdminPageHeader title="오늘 할 일" description="처리가 필요한 일을 모아 봤어요. 카드를 누르면 해당 화면으로 이동해요." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <NumberCard label="가입 승인 대기" hint="승인하거나 거절해 주세요" item={todo.pendingMembers}
          onClick={() => onNavigate('users', null, { view: 'pending' })} />
        <NumberCard label="사업자등록증 확인" hint="등록증을 보고 확인 완료를 눌러 주세요" item={todo.businessDocs}
          onClick={() => onNavigate('users', null, { view: 'businessDoc' })} />
        <NumberCard label="소모임 개설 신청" hint="승인하면 목록에 공개돼요" item={todo.pendingGroups}
          onClick={() => onNavigate('groups')} />
        <NumberCard label="처리하지 않은 신고" hint="내용을 보고 처리해 주세요" item={todo.openReports} tone="red"
          onClick={() => onNavigate('reports')} />
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-lg font-bold text-dark">다가오는 프로그램</h3>
        <button type="button" onClick={() => onNavigate('programs')} className={btn('secondary', 'sm')}>
          프로그램 관리로 <Icons.ChevronRight size={14} />
        </button>
      </div>
      {upcoming.error ? (
        <p className="text-sm text-red-600">프로그램·신청 정보를 불러오지 못했어요.</p>
      ) : upcoming.loading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : upcoming.value.length === 0 ? (
        <div className={`${CARD} p-6 text-center text-sm text-slate-500`}>예정된 프로그램이 없어요.</div>
      ) : (
        <ul className="space-y-2">
          {upcoming.value.map((p) => {
            const cap = Number(p.capacity) || 0;
            const pct = cap > 0 ? Math.min(100, Math.round((p.confirmed / cap) * 100)) : 0;
            return (
              <li key={p.id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-dark truncate">{p.title || '(제목 없음)'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.date || '날짜 미정'}{p.closed ? ' · 모집 중단됨' : ''}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-bold text-dark">
                      확정 {p.confirmed}명{cap > 0 ? <span className="text-slate-500 font-semibold"> / 정원 {cap}명</span> : null}
                    </p>
                    {p.awaitingPayment > 0 ? <p className="text-xs text-amber-700">결제 확인 안 된 신청 {p.awaitingPayment}건</p> : null}
                  </div>
                </div>
                {cap > 0 ? (
                  <div className="h-1.5 rounded-full bg-soft mt-3 overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminHome;
