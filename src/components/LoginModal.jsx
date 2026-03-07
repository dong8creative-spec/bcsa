import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';

/**
 * 로그인 모달 (App에서 사용)
 */
export const LoginModal = ({ onClose, onLogin, onSignUpClick }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(id, password);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
        style={{ opacity: 1 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 flex flex-col max-h-[90vh] relative border-[0.5px] border-brand scale-90 origin-center"
          style={{ opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 min-h-0 overflow-hidden p-4 text-center">
            <div className="mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-brand/30">
                <Icons.Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark mb-0.5">로그인</h3>
              <p className="text-xs text-gray-500">부청사 커뮤니티에 오신 것을 환영합니다</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">아이디 또는 이메일</label>
                <input
                  type="text"
                  placeholder="아이디 또는 이메일을 입력하세요"
                  autoComplete="username"
                  className="w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호를 입력하세요"
                    autoComplete="current-password"
                    className="w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors pr-10 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all mt-2 text-sm"
              >
                로그인
              </button>
            </form>
            {onSignUpClick ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSignUpClick(); }}
                className="w-full mt-2 py-2.5 border-[0.5px] border-brand/30 text-brand font-bold rounded-xl hover:bg-brand/5 transition-colors text-sm"
              >
                회원가입
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                alert('아이디/비밀번호 찾기는 관리자에게 문의해주세요.');
              }}
              className="w-full mt-2 text-xs text-brand hover:text-blue-700 font-medium transition-colors underline"
            >
              아이디/비밀번호 찾기
            </button>
          </div>
          <div className="shrink-0 border-t border-blue-200 p-2.5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-brand text-white font-bold rounded-lg hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200 text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default LoginModal;
