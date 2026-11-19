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
  // (선택) 머리글과 같은 현재 메뉴 판별 함수. 넘겨주면 현재 메뉴를 로얄블루 밝은색으로 표시한다.
  getNavClass,
}) => {
  if (!isOpen) return null;

  const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.uid));
  const visibleItems = (menuOrder || []).filter(
    (item) => menuEnabled[item] || MEMBERS_ONLY_MENUS.includes(item)
  );

  const isActiveItem = (item) => {
    if (typeof getNavClass !== 'function') return false;
    return String(getNavClass(item) || '').split(/\s+/).includes('text-royalOnBlack');
  };

  const handleMenuClick = (item) => {
    onNavigate(item);
    onClose();
  };

  const snsClass = 'flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 text-white transition-colors hover:border-white';

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className="fixed inset-0 flex flex-col text-white"
        style={{
          zIndex: 2147483647,
          isolation: 'isolate',
          overflow: 'hidden',
          backgroundColor: '#0c0c0e',
          opacity: 1,
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* 위 띠: 머리글(60px)과 같은 높이 */}
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 px-5" style={{ touchAction: 'manipulation' }}>
          <span className="font-logo text-[24px] leading-none text-white">먼저가본</span>
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-white touch-manipulation"
            style={{ opacity: 1 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
          >
            <Icons.X size={24} className="text-current" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ touchAction: 'pan-y' }} onClick={(e) => e.stopPropagation()}>
          <nav className="flex w-full flex-col px-5 pt-2" aria-label="주 메뉴">
            {visibleItems.map((item, idx) => {
              const isMemberOnlyDisabled = MEMBERS_ONLY_MENUS.includes(item) && !currentUser;
              const active = isActiveItem(item);
              return (
                <button
                  key={idx}
                  type="button"
                  aria-current={active ? 'page' : undefined}
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
                  className={`flex min-h-[56px] w-full items-center border-b border-white/10 text-left text-[18px] touch-manipulation transition-colors ${isMemberOnlyDisabled ? 'mobile-menu-item-disabled cursor-not-allowed text-white/40' : active ? 'font-semibold text-royalOnBlack' : 'text-white active:text-royalOnBlack'}`}
                >
                  {menuNames[item] || item}
                </button>
              );
            })}
          </nav>

          {/* 오픈채팅 안내 · SNS */}
          <div className="mt-auto px-5 pb-8 pt-8">
            {!isLoggedIn && (
              <a
                href="https://open.kakao.com/o/gMWryRA"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 flex h-[52px] w-full items-center justify-center rounded-lg bg-royal text-[16px] font-bold text-white transition-colors hover:bg-royalDark"
                aria-label="먼저가본 단톡방으로 이동"
              >
                먼저가본 단톡방으로 이동
              </a>
            )}
            <div className="flex items-center gap-2.5">
              <a
                href="https://open.kakao.com/o/gMWryRA"
                target="_blank"
                rel="noopener noreferrer"
                className={snsClass}
                aria-label="먼저가본 오픈채팅방"
              >
                <Icons.MessageSquare className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/businessmen_in_busan"
                target="_blank"
                rel="noopener noreferrer"
                className={snsClass}
                aria-label="먼저가본 인스타그램"
              >
                <Icons.Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.youtube.com/@businessmen_in_busan"
                target="_blank"
                rel="noopener noreferrer"
                className={snsClass}
                aria-label="먼저가본 유튜브"
              >
                <Icons.Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default MobileMenu;
