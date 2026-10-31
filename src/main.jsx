import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { AdminRoute } from './components/AdminRoute';
import AppErrorBoundary, { reloadOnceForNewVersion } from './components/AppErrorBoundary';

// 관리자·비밀번호 재설정·프로그램 상세는 필요할 때만 내려받는다 (첫 화면 번들 축소)
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AuthResetPasswordPage = lazy(() => import('./pages/AuthResetPasswordPage'));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage'));
import './index.css';
import { preloadPortOneWhenIdle } from './utils/portoneLoader';

preloadPortOneWhenIdle();

// 새 버전 배포 뒤 열려 있던 탭이 예전 화면 조각을 못 받으면 한 번 새로고침해 새 버전을 받는다
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen" />}>
      <Routes>
        {/* 비밀번호 재설정 (메일 링크) */}
        <Route path="/auth/reset-password" element={<AuthResetPasswordPage />} />

        {/* 관리자 페이지 */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
        
        {/* 프로그램 공개 상세 페이지 */}
        <Route path="/programs/:id" element={<ProgramDetailPage />} />

        {/* 메인 앱 (모든 다른 경로) */}
        <Route path="/*" element={<App />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);



