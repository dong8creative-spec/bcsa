import React from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { MEMBERS_ONLY_MENUS } from '../constants/appConstants';

/**
 * 모바일 메뉴 (모달 형태, App에서 사용)
 */
export const MobileMenu = ({
  isOpen,
  onClose,
  onNavigate,
  menuEnabled,
  menuNames,
  menuOrder,
  currentUser,
}) => {
  if (!isOpen) return null;

  const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.uid));
  const visibleItems = (menuOrder || []).filter(
    (item) => menuEnabled[item] || MEMBERS_ONLY_MENUS.includes(item)
  );

  const handleMenuClick = (item) => {
    onNavigate(item);
    onClose();
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          zIndex: 2147483647,
          isolation: 'isolate',
          overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.55)',
          opacity: 1,
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-xl relative flex flex-col items-center justify-center py-10 px-4"
          style={{ backgroundColor: '#ffffff', opacity: 1, touchAction: 'manipulation' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-600 bg-white rounded-full touch-manipulation z-[110] hover:bg-gray-100 hover:text-gray-800 shadow-md transition-colors"
            style={{ opacity: 1 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
          >
            <Icons.X size={22} className="text-current" />
          </button>
          <nav className="flex flex-col w-full items-center pt-2 pb-4 relative z-0">
            {visibleItems.map((item, idx) => {
              const isMemberOnlyDisabled = MEMBERS_ONLY_MENUS.includes(item) && !currentUser;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMenuClick(item);
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMenuClick(item);
                  }}
                  className={`w-full max-w-[240px] py-4 px-6 text-base font-bold text-center touch-manipulation transition-colors ${isMemberOnlyDisabled ? 'mobile-menu-item-disabled text-gray-400 cursor-not-allowed hover:bg-transparent active:bg-transparent' : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100'}`}
                >
                  {menuNames[item] || item}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-gray-50 rounded-b-2xl relative z-0">
            <div className="relative flex items-center justify-center">
              <a
                href="https://open.kakao.com/o/gMWryRA"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                aria-label="부청사 오픈채팅방"
              >
                <Icons.MessageSquare className="w-5 h-5" />
              </a>
              {!isLoggedIn && (
                <a
                  href="https://open.kakao.com/o/gMWryRA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-menu-speech-bubble"
                  aria-label="부청사 단톡방으로 이동"
                >
                  부청사 단톡방으로 이동
                </a>
              )}
            </div>
            <a
              href="https://www.instagram.com/businessmen_in_busan"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              aria-label="부청사 인스타그램"
            >
              <Icons.Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.youtube.com/@businessmen_in_busan"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              aria-label="부청사 유튜브"
            >
              <Icons.Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default MobileMenu;
