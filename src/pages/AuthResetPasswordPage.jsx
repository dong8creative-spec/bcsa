import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import { Icons } from '../components/Icons';

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return '비밀번호는 최소 8자 이상이어야 합니다.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.';
  }
  return '';
};

export default function AuthResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setError('유효하지 않은 재설정 링크입니다. 비밀번호 재설정을 다시 요청해 주세요.');
      setVerifying(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        auth.languageCode = 'ko';
        const accountEmail = await verifyPasswordResetCode(auth, oobCode);
        if (!cancelled) setEmail(accountEmail);
      } catch (err) {
        if (!cancelled) {
          const code = err?.code || '';
          if (code === 'auth/expired-action-code') {
            setError('재설정 링크가 만료되었습니다. 비밀번호 재설정을 다시 요청해 주세요.');
          } else if (code === 'auth/invalid-action-code') {
            setError('유효하지 않은 재설정 링크입니다. 비밀번호 재설정을 다시 요청해 주세요.');
          } else {
            setError('재설정 링크를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
          }
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      auth.languageCode = 'ko';
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setError('재설정 링크가 만료되었거나 유효하지 않습니다. 비밀번호 재설정을 다시 요청해 주세요.');
      } else if (code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다. 8자 이상 영문·숫자를 포함해 주세요.');
      } else {
        setError('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none text-sm';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden">
        <div className="bg-gradient-to-r from-brand to-blue-600 px-6 py-8 text-center text-white">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/15 flex items-center justify-center">
            <Icons.Users className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
          <p className="text-sm text-white/85 mt-1">부산청년사업가들</p>
        </div>

        <div className="p-6">
          {verifying && (
            <p className="text-center text-sm text-gray-500 py-8">재설정 링크를 확인하는 중입니다...</p>
          )}

          {!verifying && success && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-2xl">✓</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-gray-600 mb-6">새 비밀번호로 로그인해 주세요.</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl"
              >
                홈으로 이동
              </button>
            </div>
          )}

          {!verifying && !success && error && !email && (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-6">{error}</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 border border-brand/30 text-brand font-bold rounded-xl"
              >
                홈으로 이동
              </button>
            </div>
          )}

          {!verifying && !success && email && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">계정 이메일</label>
                <input type="email" value={email} readOnly className={`${inputClass} bg-gray-50 text-gray-600`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상, 영문·숫자 포함"
                    autoComplete="new-password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">새 비밀번호 확인</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {submitting ? '변경 중...' : '비밀번호 변경하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
