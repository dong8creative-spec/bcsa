import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { AdminLayout } from './components/AdminLayout';
import { UserManagement } from './components/UserManagement';
import { ProgramManagement } from './components/ProgramManagement';
import { PostManagement } from './components/PostManagement';
import { ContentManagement } from './components/ContentManagement';
import { MenuManagement } from './components/MenuManagement';
import { MemberDetailView } from './components/MemberDetailView';

const VALID_TABS = ['users', 'memberDetail', 'programs', 'posts', 'content', 'menu'];

/**
 * 관리자 대시보드 메인 컴포넌트
 */
export const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'users';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && activeTab !== tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('사용자 정보 로드 오류:', error);
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠습니까?')) return;

    try {
      await authService.signOut();
      navigate('/');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'memberDetail':
        return <MemberDetailView />;
      case 'programs':
        return <ProgramManagement />;
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
      currentUser={currentUser}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminDashboard;
