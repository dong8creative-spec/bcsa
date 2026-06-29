import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { AdminLayout } from './components/AdminLayout';
import { UserManagement } from './components/UserManagement';
import { ProgramManagement } from './components/ProgramManagement';
import { PostManagement } from './components/PostManagement';
import { ContentManagement } from './components/ContentManagement';
import { MenuManagement } from './components/MenuManagement';
import { ExternalEventPosterManagement } from './components/ExternalEventPosterManagement';

const VALID_TABS = ['users', 'programs', 'externalPosters', 'posts', 'content', 'menu'];

/**
 * 관리자 대시보드 메인 컴포넌트
 */
export const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'users';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { userDoc } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && activeTab !== tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠습니까?')) return;

    let signOutError = null;
    try {
      if (authService?.logout) {
        await authService.logout();
      } else {
        await authService.signOut();
      }
    } catch (error) {
      signOutError = error;
      console.warn('Admin logout signOut error:', error);
    }

    const stillLoggedIn = !!authService?.getCurrentUser?.();
    if (stillLoggedIn && signOutError) {
      alert('로그아웃에 실패했습니다.');
      return;
    }

    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement currentUser={userDoc} />;
      case 'programs':
        return <ProgramManagement />;
      case 'externalPosters':
        return <ExternalEventPosterManagement />;
      case 'posts':
        return <PostManagement />;
      case 'content':
        return <ContentManagement />;
      case 'menu':
        return <MenuManagement />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      currentUser={userDoc}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminDashboard;
