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
        className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/50 md:items-center md:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kakao-link-title"
          className="bg-white rounded-t-[18px] md:rounded-[18px] w-full md:max-w-[420px] z-10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 머리 */}
          <div className="px-6 pt-7 pb-2 md:px-8 md:pt-8">
            <span className="inline-flex w-11 h-11 items-center justify-center rounded-lg bg-[#FEE500] text-[#191919] mb-4" aria-hidden="true">
              <KakaoSymbol />
            </span>
            <h3 id="kakao-link-title" className="text-[23px] font-bold text-ink">카카오 계정 연동</h3>
            <p className="text-[15px] text-sub mt-1.5">더 편리하게 로그인하세요</p>
          </div>

          {/* 본문 */}
          <div className="px-6 py-4 md:px-8">
            <p className="text-[16px] text-ink leading-relaxed">
              카카오 계정을 연동하면{' '}
              <span className="font-semibold">다음부터 카카오로 간편 로그인</span>이 가능합니다.
            </p>
            <ul className="mt-4 rounded-xl bg-card px-4 py-3.5 text-[15px] text-ink space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-royal font-bold" aria-hidden="true">✓</span>
                <span>비밀번호 없이 원터치 로그인</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-royal font-bold" aria-hidden="true">✓</span>
                <span>자동 로그인으로 매번 편리하게</span>
              </li>
            </ul>
          </div>

          {/* 버튼 */}
          <div className="px-6 pb-6 pt-2 md:px-8 md:pb-8 space-y-2">
            <button
              type="button"
              onClick={onLink}
              className="w-full h-[52px] bg-[#FEE500] text-[#191919] font-bold rounded-lg hover:bg-[#FDD835] transition-colors text-[16px] flex items-center justify-center gap-2"
            >
              <KakaoSymbol />
              카카오 계정 연동하기
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full h-12 bg-white border border-line2 text-ink rounded-lg hover:border-ink text-[15px] font-semibold transition-colors"
            >
              나중에 하기
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
