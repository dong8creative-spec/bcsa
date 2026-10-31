import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { AdminLayout, ADMIN_MENUS } from './components/AdminLayout';
import { AdminHome } from './components/AdminHome';
import { UserManagement } from './components/UserManagement';
import { ProgramManagement } from './components/ProgramManagement';
import { PostManagement } from './components/PostManagement';
import { ContentManagement } from './components/ContentManagement';
import { MenuManagement } from './components/MenuManagement';
import { ExternalEventPosterManagement } from './components/ExternalEventPosterManagement';
import { SupportProgramManagement } from './components/SupportProgramManagement';
import { NewsManagement } from './components/NewsManagement';
import { GroupManagement } from './components/GroupManagement';
import { ReportManagement } from './components/ReportManagement';
import { adminAlert, adminConfirm } from './components/ui';
import { useAdminTodo } from './useAdminTodo';

/** 예전 주소(?tab=news 등)로 들어와도 새 메뉴의 해당 화면이 열리게 */
const LEGACY_TABS = {
  news: ['promo', 'news'],
  supportPrograms: ['promo', 'supportPrograms'],
  externalPosters: ['promo', 'externalPosters'],
  posts: ['reviews', null],
  content: ['settings', 'content'],
  menu: ['settings', 'menu'],
};

const resolveLocation = (tabParam, subParam) => {
  let tab = tabParam;
  let sub = subParam;
  if (LEGACY_TABS[tab]) [tab, sub] = [LEGACY_TABS[tab][0], LEGACY_TABS[tab][1] || sub];
  const menu = ADMIN_MENUS.find((m) => m.id === tab) || ADMIN_MENUS[0];
  const validSub = menu.subs ? (menu.subs.find((s) => s.id === sub)?.id || menu.subs[0].id) : null;
  return { tab: menu.id, sub: validSub };
};

/**
 * 관리자 대시보드. 지금 보고 있는 메뉴는 주소(?tab=…&sub=…)에 남겨서
 * 새로고침·뒤로가기·주소 공유를 해도 같은 화면이 열린다.
 * userDoc은 AdminRoute가 이미 확인해 둔 값을 그대로 받는다.
 */
export const AdminDashboard = ({ userDoc }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab: activeTab, sub: activeSub } = resolveLocation(searchParams.get('tab'), searchParams.get('sub'));
  const navigate = useNavigate();
  const todo = useAdminTodo();

  const go = (tab, sub, extra = {}) => {
    const next = { tab };
    if (sub) next.sub = sub;
    Object.entries(extra).forEach(([k, v]) => { if (v != null && v !== '') next[k] = v; });
    setSearchParams(next);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = async () => {
    if (!(await adminConfirm('로그아웃할까요?', { okText: '로그아웃' }))) return;
    let signOutError = null;
    try {
      if (authService?.logout) await authService.logout();
      else await authService.signOut();
    } catch (error) {
      signOutError = error;
      console.warn('Admin logout signOut error:', error);
    }
    if (authService?.getCurrentUser?.() && signOutError) {
      adminAlert('로그아웃하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <AdminHome todo={todo} onNavigate={go} />;
      case 'users': return <UserManagement currentUser={userDoc} initialView={searchParams.get('view')} />;
      case 'programs': return <ProgramManagement currentUser={userDoc} />;
      case 'groups': return <GroupManagement />;
      case 'reports': return <ReportManagement currentUser={userDoc} />;
      case 'promo':
        if (activeSub === 'supportPrograms') return <SupportProgramManagement />;
        if (activeSub === 'externalPosters') return <ExternalEventPosterManagement />;
        return <NewsManagement />;
      case 'reviews': return <PostManagement />;
      case 'settings':
        return activeSub === 'menu' ? <MenuManagement /> : <ContentManagement />;
      default: return <AdminHome todo={todo} onNavigate={go} />;
    }
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      activeSub={activeSub}
      onTabChange={(tab) => go(tab, null)}
      onSubChange={(sub) => go(activeTab, sub)}
      onLogout={handleLogout}
      currentUser={userDoc}
      todo={todo}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminDashboard;
