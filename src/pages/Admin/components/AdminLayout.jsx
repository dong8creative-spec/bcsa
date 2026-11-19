import React from 'react';
import { Icons } from '../../../components/Icons';

/**
 * 관리자 대시보드 레이아웃 컴포넌트 — 먼저가본 개편(2026-11-20): 공개 사이트와 같은 검정 머리 띠,
 * 왼쪽 흰 직사각형 메뉴(선택은 검정 바탕), 휴대폰에선 가로로 넘기는 직사각형 탭, 본문은 연한 바탕 위 흰 판.
 * @param {Object} props
 * @param {React.ReactNode} props.children - 메인 콘텐츠
 * @param {string} props.activeTab - 현재 활성화된 탭
 * @param {Function} props.onTabChange - 탭 변경 핸들러
 * @param {Function} props.onLogout - 로그아웃 핸들러
 * @param {Object} props.currentUser - 현재 사용자 정보
 */
export const AdminLayout = ({ children, activeTab, onTabChange, onLogout, currentUser }) => {
  const tabs = [
    { id: 'users', label: '회원 관리', icon: Icons.Users },
    { id: 'programs', label: '프로그램 관리', icon: Icons.Calendar },
    { id: 'groups', label: '소모임·스터디', icon: Icons.Users },
    { id: 'externalPosters', label: '외부행사 포스터', icon: Icons.Image },
    { id: 'supportPrograms', label: '지원사업 피드', icon: Icons.Award },
    { id: 'topics', label: '토픽(인터뷰)', icon: Icons.MessageSquare },
    { id: 'coffee', label: '선배 커피챗', icon: Icons.Users },
    { id: 'news', label: '뉴스 관리', icon: Icons.FileText },
    { id: 'posts', label: '게시물 관리', icon: Icons.MessageSquare },
    { id: 'content', label: '페이지 관리', icon: Icons.FileText },
    { id: 'menu', label: '메뉴 관리', icon: Icons.Menu },
  ];

  return (
    <div className="min-h-screen bg-[#f3f5f8]">
      {/* 머리 띠 — 공개 사이트 머리글과 같은 검정 */}
      <header className="sticky top-0 z-[100] w-full bg-[#0c0c0e] text-white">
        <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-3 px-4 md:h-[72px] md:px-6">
          <a href="/" className="flex shrink-0 items-baseline gap-2.5" aria-label="먼저가본 처음 화면">
            <span className="font-logo text-[22px] leading-none md:text-[26px]">먼저가본</span>
            <span className="text-[15px] font-semibold text-white/75 md:text-[16px]">관리자</span>
          </a>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {currentUser && (
              <div className="hidden text-right lg:block">
                <p className="max-w-[200px] truncate text-[14px] font-semibold" title={currentUser.name || '관리자'}>{currentUser.name || '관리자'}</p>
                <p className="max-w-[200px] truncate text-[12px] text-white/60" title={currentUser.email}>{currentUser.email}</p>
              </div>
            )}
            {/* 「개선」: 사이트 개편 디자인 가안(public/admin-preview/redesign, 검색 노출 막음)을 새 창으로 */}
            <a
              href="/admin-preview/redesign/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-white/25 px-3 text-[14px] font-semibold text-white hover:border-white sm:inline-flex"
              title="사이트 개편 디자인 가안 보기 (새 창)"
            >
              <Icons.Eye size={16} />
              <span>개선</span>
            </a>
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/25 px-3 text-[14px] font-semibold text-white hover:border-white"
            >
              <Icons.Home size={16} />
              <span>사이트로 가기</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-[14px] font-semibold text-ink hover:bg-white/90"
            >
              <Icons.LogOut size={16} />
              <span className="hidden sm:inline">로그아웃</span>
              <span className="sr-only sm:hidden">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* 휴대폰: 가로로 넘기는 직사각형 탭 */}
      <nav aria-label="관리 메뉴" className="sticky top-[60px] z-[90] border-b border-line bg-white lg:hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-12 shrink-0 whitespace-nowrap border-r border-line px-4 text-[15px] font-semibold ${isActive ? 'bg-[#0c0c0e] text-white' : 'bg-white text-[#555] hover:text-ink'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* PC: 왼쪽 흰 직사각형 메뉴 */}
          <aside className="hidden lg:block">
            <nav aria-label="관리 메뉴" className="sticky top-[96px] border border-line bg-white">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex h-12 w-full items-center gap-3 border-b border-line px-4 text-left text-[15px] font-semibold last:border-b-0 ${isActive ? 'bg-[#0c0c0e] text-white' : 'bg-white text-[#444] hover:bg-[#f3f5f8] hover:text-ink'}`}
                  >
                    <Icon size={18} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* 본문: 연한 바탕 위 흰 판 */}
          <main className="min-w-0">
            <div className="rounded-[18px] border border-line bg-white p-4 md:p-7">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
