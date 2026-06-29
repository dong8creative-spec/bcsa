import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { AdminDashboard } from './pages/Admin';
import { AdminRoute } from './components/AdminRoute';
import AuthResetPasswordPage from './pages/AuthResetPasswordPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </React.StrictMode>
);



