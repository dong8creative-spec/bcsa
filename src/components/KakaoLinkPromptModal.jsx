import React from 'react';
import ModalPortal from './ModalPortal';

const KakaoSymbol = () => (
  <span className="inline-flex shrink-0 w-6 h-6" aria-hidden="true">
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C6.2 3 1.5 6.66 1.5 11.18c0 2.84 1.8 5.36 4.61 6.94-.12.44-.42 1.58-.48 1.83-.08.38.14.37.33.27.15-.08 2.42-1.58 3.4-2.27.57.08 1.17.12 1.79.12 5.8 0 10.5-3.66 10.5-8.18S17.8 3 12 3z" />
    </svg>
  </span>
);

/**
 * 이메일 로그인 후 카카오 연동 안내 팝업
 * onLink: 연동하기 클릭
 * onDismiss: 나중에 클릭 (계속 알림)
 * onNeverAsk: 다시 묻지 않기 (사용 안 함 - 비동의자도 계속 알림)
 */
export default function KakaoLinkPromptModal({ onLink, onDismiss }) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden border-[0.5px] border-yellow-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="bg-[#FEE500] px-6 pt-6 pb-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 bg-[#191919] rounded-2xl flex items-center justify-center text-[#FEE500] text-3xl shadow-lg">
                <KakaoSymbol />
              </div>
            </div>
            <h3 className="text-lg font-bold text-[#191919]">카카오 계정 연동</h3>
            <p className="text-xs text-[#3C3C3C] mt-1">더 편리하게 로그인하세요</p>
          </div>

          {/* 본문 */}
          <div className="px-6 py-5 text-center">
            <p className="text-sm text-gray-700 leading-relaxed">
              카카오 계정을 연동하면<br />
              <span className="font-bold text-gray-900">다음부터 카카오로 간편 로그인</span>이 가능합니다.
            </p>
            <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-xs text-gray-600 text-left space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500 font-bold">✓</span>
                <span>비밀번호 없이 원터치 로그인</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500 font-bold">✓</span>
                <span>자동 로그인으로 매번 편리하게</span>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="px-6 pb-6 space-y-2">
            <button
              type="button"
              onClick={onLink}
              className="w-full py-3 bg-[#FEE500] text-[#191919] font-bold rounded-xl hover:bg-[#FDD835] transition-colors text-sm flex items-center justify-center gap-2"
            >
              <KakaoSymbol />
              카카오 계정 연동하기
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
            >
              나중에 하기
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
