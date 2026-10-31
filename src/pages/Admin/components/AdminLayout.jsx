import React, { useEffect, useRef } from 'react';
import { Icons } from '../../../components/Icons';
import { AdminDialogHost, btn } from './ui';

/** 관리자 메뉴 8개. sub가 있으면 화면 위쪽에 하위 탭으로 보인다 */
export const ADMIN_MENUS = [
  { id: 'home', label: '홈 · 오늘 할 일', short: '홈', icon: Icons.Home },
  { id: 'users', label: '회원', short: '회원', icon: Icons.User, badgeKeys: ['pendingMembers', 'businessDocs'] },
  { id: 'programs', label: '프로그램 · 신청자', short: '프로그램', icon: Icons.Calendar },
  { id: 'groups', label: '소모임 · 스터디', short: '소모임', icon: Icons.Users, badgeKeys: ['pendingGroups'] },
  { id: 'reports', label: '신고 처리', short: '신고', icon: Icons.AlertCircle, badgeKeys: ['openReports'] },
  {
    id: 'promo', label: '소식 · 홍보', short: '소식·홍보', icon: Icons.FileText,
    subs: [
      { id: 'news', label: '뉴스' },
      { id: 'supportPrograms', label: '지원사업' },
      { id: 'externalPosters', label: '외부행사 포스터' },
    ],
  },
  { id: 'reviews', label: '후기 관리', short: '후기', icon: Icons.MessageSquare },
  {
    id: 'settings', label: '사이트 설정', short: '설정', icon: Icons.Settings,
    subs: [
      { id: 'content', label: '페이지 문구' },
      { id: 'menu', label: '메뉴' },
    ],
  },
];

const badgeCount = (menu, todo) =>
  (menu.badgeKeys || []).reduce((sum, k) => sum + (Number(todo?.[k]?.value) || 0), 0);

const Badge = ({ n, active }) => (n > 0 ? (
  <span className={`ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center ${active ? 'bg-white text-brand' : 'bg-red-500 text-white'}`}>
    {n > 99 ? '99+' : n}
  </span>
) : null);

/**
 * 관리자 레이아웃
 * - 넓은 화면: 왼쪽 메뉴(스크롤해도 따라옴)
 * - 휴대폰: 제목 아래 가로로 넘기는 메뉴 한 줄 → 본문이 아래로 밀리지 않음
 */
export const AdminLayout = ({ children, activeTab, activeSub, onTabChange, onSubChange, onLogout, currentUser, todo }) => {
  const menu = ADMIN_MENUS.find((m) => m.id === activeTab) || ADMIN_MENUS[0];
  const mobileActiveRef = useRef(null);
  // 휴대폰 가로 메뉴: 지금 메뉴가 화면 밖에 있으면 보이게 옮긴다
  useEffect(() => {
    mobileActiveRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-soft">
      <header className="bg-white border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Shield size={24} className="text-brand shrink-0" />
              <h1 className="text-lg sm:text-xl font-bold text-dark truncate">부산청년사업가들 관리자</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {currentUser ? (
                <div className="text-right hidden md:block mr-1">
                  <p className="text-sm font-bold text-dark">{currentUser.name || '관리자'}</p>
                  <p className="text-xs text-slate-500">{currentUser.email}</p>
                </div>
              ) : null}
              <a href="/" className={btn('secondary')} aria-label="사이트로 가기">
                <Icons.Home size={16} />
                <span className="hidden sm:inline">사이트로</span>
              </a>
              <button type="button" onClick={onLogout} className={btn('secondary')} aria-label="로그아웃">
                <Icons.LogOut size={16} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
        {/* 휴대폰·태블릿: 가로로 넘기는 메뉴 */}
        <nav className="lg:hidden overflow-x-auto border-t border-black/[0.06]" aria-label="관리자 메뉴">
          <div className="flex gap-1.5 px-4 py-2 w-max">
            {ADMIN_MENUS.map((m) => {
              const active = m.id === activeTab;
              const n = badgeCount(m, todo);
              return (
                <button key={m.id} ref={active ? mobileActiveRef : null} type="button" onClick={() => onTabChange(m.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${active ? 'bg-brand text-white' : 'bg-soft text-slate-700'}`}>
                  {m.short}
                  {n > 0 ? <span className={`min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-xs font-bold inline-flex items-center justify-center ${active ? 'bg-white text-brand' : 'bg-red-500 text-white'}`}>{n > 99 ? '99+' : n}</span> : null}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="hidden lg:block lg:col-span-3">
            <nav className="bg-white rounded-2xl border border-black/[0.06] p-3 space-y-1 sticky top-6" aria-label="관리자 메뉴">
              {ADMIN_MENUS.map((m) => {
                const Icon = m.icon;
                const active = m.id === activeTab;
                return (
                  <button key={m.id} type="button" onClick={() => onTabChange(m.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-brand text-white' : 'text-slate-700 hover:bg-soft'}`}>
                    <Icon size={18} />
                    <span>{m.label}</span>
                    <Badge n={badgeCount(m, todo)} active={active} />
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="lg:col-span-9 min-w-0">
            {menu.subs ? (
              <div className="flex gap-1.5 mb-4 overflow-x-auto" role="tablist">
                {menu.subs.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={s.id === activeSub} onClick={() => onSubChange(s.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold ${s.id === activeSub ? 'bg-dark text-white' : 'bg-white text-slate-600 border border-black/10'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="bg-white rounded-2xl border border-black/[0.06] p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
      <AdminDialogHost />
    </div>
  );
};
