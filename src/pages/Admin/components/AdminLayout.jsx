import React from 'react';
import { Icons } from '../../../components/Icons';

/**
 * 관리자 대시보드 레이아웃 컴포넌트
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
    { id: 'posts', label: '게시물 관리', icon: Icons.MessageSquare },
    { id: 'content', label: '콘텐츠 관리', icon: Icons.FileText },
    { id: 'menu', label: '메뉴 관리', icon: Icons.Menu },
  ];

  return (
    <div className="min-h-screen bg-soft">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Icons.Shield size={28} className="text-brand" />
              <h1 className="text-xl font-bold text-dark">관리자 대시보드</h1>
            </div>
            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-dark">{currentUser.name || '관리자'}</p>
                  <p className="text-xs text-gray-500">{currentUser.email}</p>
                </div>
              )}
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 text-gray-600 hover:text-brand transition-colors flex items-center gap-2"
              >
                <Icons.Home size={18} />
                <span className="hidden sm:inline">메인으로</span>
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Icons.LogOut size={18} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 사이드바 */}
          <aside className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                        ${isActive
                          ? 'bg-brand text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon size={20} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* 통계 카드 (옵션) */}
            <div className="mt-6 bg-gradient-to-br from-brand to-blue-600 rounded-2xl shadow-card p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Icons.Activity size={24} />
                <h3 className="font-bold">시스템 상태</h3>
              </div>
              <p className="text-sm opacity-90">정상 작동 중</p>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="lg:col-span-9">
            <div className="bg-white rounded-2xl shadow-card p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
