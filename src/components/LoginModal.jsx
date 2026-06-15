import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { authService } from '../services/authService';
import { firebaseService } from '../services/firebaseService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 카카오 심볼 아이콘 (로그인 버튼용) */
const KakaoSymbol = ({ className = 'w-5 h-5' }) => (
  <span className={`inline-flex shrink-0 ${className}`} aria-hidden="true">
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C6.2 3 1.5 6.66 1.5 11.18c0 2.84 1.8 5.36 4.61 6.94-.12.44-.42 1.58-.48 1.83-.08.38.14.37.33.27.15-.08 2.42-1.58 3.4-2.27.57.08 1.17.12 1.79.12 5.8 0 10.5-3.66 10.5-8.18S17.8 3 12 3z" />
    </svg>
  </span>
);

/**
 * 로그인 모달 (App에서 사용)
 * mode: 'login' | 'findId' | 'resetPassword'
 */
export const LoginModal = ({ onClose, onLogin, onKakaoLogin, onSignUpClick }) => {
  const [mode, setMode] = useState('login');

  // 로그인
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 아이디 찾기
  const [findName, setFindName] = useState('');
  const [findPhone, setFindPhone] = useState('');
  const [findResult, setFindResult] = useState(null); // { type: 'success'|'fail'|'error', maskedEmail? }
  const [findLoading, setFindLoading] = useState(false);

  // 비밀번호 재설정
  const [resetEmail, setResetEmail] = useState('');
  const [resetResult, setResetResult] = useState(null); // { type: 'sent'|'error', message? }
  const [resetLoading, setResetLoading] = useState(false);

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

  const switchMode = (next) => {
    setMode(next);
    setFindResult(null);
    setResetResult(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(id, password);
  };

  const handleFindId = async (e) => {
    e.preventDefault();
    const name = findName.trim();
    const phoneDigits = findPhone.replace(/\D/g, '');
    if (!name) {
      setFindResult({ type: 'error', message: '이름을 입력해 주세요.' });
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setFindResult({ type: 'error', message: '휴대폰 번호를 정확히 입력해 주세요. (숫자 10~11자리)' });
      return;
    }
    setFindLoading(true);
    setFindResult(null);
    try {
      const res = await firebaseService.lookupAccountByIdentity({ name, phone: phoneDigits });
      if (res.found) {
        setFindResult({ type: 'success', maskedEmail: res.maskedEmail });
      } else {
        setFindResult({ type: 'fail' });
      }
    } catch (err) {
      setFindResult({ type: 'error', message: err?.message || '계정 조회 중 오류가 발생했습니다.' });
    } finally {
      setFindLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const email = resetEmail.trim();
    if (!EMAIL_REGEX.test(email)) {
      setResetResult({ type: 'error', message: '올바른 이메일 형식을 입력해 주세요.' });
      return;
    }
    setResetLoading(true);
    setResetResult(null);
    try {
      await authService.resetPassword(email);
      setResetResult({ type: 'sent' });
    } catch (err) {
      // 계정 존재 여부를 드러내지 않도록 user-not-found도 발송 안내로 처리
      if (err?.code === 'auth/user-not-found') {
        setResetResult({ type: 'sent' });
      } else if (err?.code === 'auth/invalid-email') {
        setResetResult({ type: 'error', message: '올바른 이메일 형식을 입력해 주세요.' });
      } else if (err?.code === 'auth/too-many-requests') {
        setResetResult({ type: 'error', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      } else {
        setResetResult({ type: 'error', message: '재설정 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
      }
    } finally {
      setResetLoading(false);
    }
  };

  const inputClass = 'w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm';
  const primaryBtnClass = 'w-full py-2.5 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all mt-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed';

  const headerByMode = {
    login: { title: '로그인', desc: '부청사 커뮤니티에 오신 것을 환영합니다' },
    findId: { title: '아이디 찾기', desc: '가입 시 입력한 이름과 휴대폰 번호로 찾을 수 있어요' },
    resetPassword: { title: '비밀번호 재설정', desc: '가입한 이메일로 재설정 링크를 보내드려요' },
  };
  const header = headerByMode[mode];

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
          <div className="flex-1 min-h-0 overflow-y-auto p-4 text-center">
            <div className="mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-brand/30">
                <Icons.Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark mb-0.5">{header.title}</h3>
              <p className="text-xs text-gray-500">{header.desc}</p>
            </div>

            {mode === 'login' && (
              <>
                <form onSubmit={handleSubmit} className="space-y-3 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">이메일</label>
                    <input
                      type="text"
                      placeholder="이메일을 입력하세요"
                      autoComplete="username"
                      className={inputClass}
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
                        className={`${inputClass} pr-10`}
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
                  <button type="submit" className={primaryBtnClass}>
                    로그인
                  </button>
                </form>
                {onKakaoLogin ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onKakaoLogin(); }}
                    className="w-full mt-2 py-2.5 bg-[#FEE500] text-[#191919] font-bold rounded-xl hover:bg-[#FDD835] transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <KakaoSymbol className="w-5 h-5" />
                    <span>카카오로 로그인</span>
                  </button>
                ) : null}
                {onSignUpClick ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSignUpClick(); }}
                    className="w-full mt-2 py-2.5 border-[0.5px] border-brand/30 text-brand font-bold rounded-xl hover:bg-brand/5 transition-colors text-sm"
                  >
                    회원가입
                  </button>
                ) : null}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => switchMode('findId')}
                    className="text-xs text-brand hover:text-blue-700 font-medium transition-colors underline"
                  >
                    아이디 찾기
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => switchMode('resetPassword')}
                    className="text-xs text-brand hover:text-blue-700 font-medium transition-colors underline"
                  >
                    비밀번호 재설정
                  </button>
                </div>
              </>
            )}

            {mode === 'findId' && (
              <>
                <form onSubmit={handleFindId} className="space-y-3 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">이름</label>
                    <input
                      type="text"
                      placeholder="가입 시 입력한 이름"
                      autoComplete="name"
                      className={inputClass}
                      value={findName}
                      onChange={(e) => setFindName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">휴대폰 번호</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="숫자만 입력 (예: 01012345678)"
                      autoComplete="tel"
                      className={inputClass}
                      value={findPhone}
                      onChange={(e) => setFindPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    />
                  </div>
                  <button type="submit" disabled={findLoading} className={primaryBtnClass}>
                    {findLoading ? '조회 중...' : '아이디 찾기'}
                  </button>
                </form>

                {findResult?.type === 'success' && (
                  <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-left">
                    <p className="text-xs text-green-700 mb-1">가입된 계정을 찾았습니다.</p>
                    <p className="text-sm font-bold text-green-800 break-all">{findResult.maskedEmail}</p>
                    <button
                      type="button"
                      onClick={() => switchMode('resetPassword')}
                      className="mt-2 text-xs text-brand hover:text-blue-700 font-medium underline"
                    >
                      비밀번호도 잊으셨나요? 재설정하기
                    </button>
                  </div>
                )}
                {findResult?.type === 'fail' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                    <p className="text-xs text-amber-700">
                      입력하신 정보와 일치하는 계정을 찾을 수 없습니다. 이름과 휴대폰 번호를 다시 확인해 주세요.
                    </p>
                  </div>
                )}
                {findResult?.type === 'error' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-left">
                    <p className="text-xs text-red-700">{findResult.message}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors underline"
                >
                  로그인으로 돌아가기
                </button>
              </>
            )}

            {mode === 'resetPassword' && (
              <>
                <form onSubmit={handleResetPassword} className="space-y-3 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">이메일</label>
                    <input
                      type="email"
                      placeholder="가입한 이메일을 입력하세요"
                      autoComplete="email"
                      className={inputClass}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                  <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                    {resetLoading ? '발송 중...' : '재설정 메일 보내기'}
                  </button>
                </form>

                {resetResult?.type === 'sent' && (
                  <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-left">
                    <p className="text-xs text-green-700">
                      가입된 이메일이라면 비밀번호 재설정 메일이 발송됩니다. 메일함(스팸함 포함)을 확인해 주세요.
                    </p>
                  </div>
                )}
                {resetResult?.type === 'error' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-left">
                    <p className="text-xs text-red-700">{resetResult.message}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => switchMode('findId')}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors underline"
                  >
                    아이디 찾기
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors underline"
                  >
                    로그인으로 돌아가기
                  </button>
                </div>
              </>
            )}
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
