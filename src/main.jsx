import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { AdminRoute } from './components/AdminRoute';

// 관리자·비밀번호 재설정·프로그램 상세는 필요할 때만 내려받는다 (첫 화면 번들 축소)
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AuthResetPasswordPage = lazy(() => import('./pages/AuthResetPasswordPage'));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage'));
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
);



