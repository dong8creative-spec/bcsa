import React, { useRef, useState, useEffect } from 'react';
import { Icons } from './Icons';
import SignUpModal from './SignUpModal';
import InquiryModal from './InquiryModal';
import ModalPortal from './ModalPortal';
import { useMediaQuery, MOBILE_QUERY } from '../hooks/useMediaQuery';
import { defaultContent } from '../constants/content';

const FAB_GAP_PX = 16;
const FAB_ESTIMATE_HEIGHT_PX = 152;

/** 필수 회원정보 미기입 여부 (SignUp/MyPage·Firestore·본인인증 필드와 동일 기준) */
function isProfileIncomplete(user) {
    if (!user) return false;
    const name = (user.name || '').toString().trim();
    if (!name) return true;
    // 생년월일: birthdate 또는 본인인증 verifiedBirthday(8자리)
    const birthdate = (user.birthdate || '').toString().trim();
    const verifiedBirthday = (user.verifiedBirthday || '').toString().replace(/\D/g, '');
    const birthdateDigits = birthdate.replace(/\D/g, '');
    const birthdateValid =
        (birthdate.length >= 8 && (birthdateDigits.length >= 8 || /^\d{4}-\d{2}-\d{2}$/.test(birthdate))) ||
        (verifiedBirthday.length >= 8);
    if (!birthdateValid) return true;
    // 성별: gender 또는 본인인증 verifiedGender('M'/'F')
    const gender = (user.gender || '').toString().trim();
    const verifiedGender = (user.verifiedGender || '').toString().trim();
    const genderValid = !!gender || verifiedGender === 'M' || verifiedGender === 'F';
    if (!genderValid) return true;
    // 연락처: phone/phoneNumber/verifiedPhone, 10~11자리 01x 형식 허용
    const phoneDigits = (user.phone || user.phoneNumber || user.verifiedPhone || '').toString().replace(/\D/g, '');
    const phoneValid = (phoneDigits.length === 10 || phoneDigits.length === 11) && /^0?1[0-9]{8,9}$/.test(phoneDigits);
    if (!phoneValid) return true;
    // userType 없으면 company/bno로 사업자 여부 추론 (MyPage와 동일). 비사업자(예창)면 사업자 필드 검사 생략
    const hasCompanyOrBno = !!(user.company || '').toString().trim() || ((user.businessRegistrationNumber || '').toString().replace(/\D/g, '').length === 10);
    const effectiveUserType = (user.userType || '').toString().trim() || (hasCompanyOrBno ? '사업자' : '');
    if (effectiveUserType === '사업자') {
        if (!(user.company || '').toString().trim()) return true;
        const bno = (user.businessRegistrationNumber || '').toString().replace(/\D/g, '');
        if (bno.length !== 10) return true;
        if (!(user.businessCategory || user.industry || '').toString().trim()) return true;
        if (!(user.collaborationIndustry || '').toString().trim()) return true;
        if (!(user.keyCustomers || '').toString().trim()) return true;
    }
    return false;
}

const AppLayout = (props) => {
    const footerRef = useRef(null);
    const fabRef = useRef(null);
    const prevViewRef = useRef(null);
    const [fabStyle, setFabStyle] = useState({ position: 'fixed', right: '1.5rem', bottom: '10rem' });
    const [profileIncompleteModalClosed, setProfileIncompleteModalClosed] = useState(false);
    const {
        navigate,
        renderView,
        currentView,
        setCurrentView,
        onGoHome,
        popupPrograms,
        setPopupPrograms,
        appliedProgramIds,
        closePopupAndMarkAsShown,
        closePopupAndHide24h,
        isPopupApplyModalOpen,
        applySeminarFromPopup,
        setIsPopupApplyModalOpen,
        popupApplicationData,
        setPopupApplicationData,
        handlePopupApplySubmit,
        handlePopupApply,
        onNavigateToProgramApply,
        getCategoryColor,
        scrolled,
        menuOrder,
        menuEnabled,
        menuNames,
        handleNavigation,
        getNavClass,
        currentUser,
        handleLogout,
        showLoginModal,
        setShowLoginModal,
        showSignUpModal,
        setShowSignUpModal,
        onSignUpClick,
        isInquiryModalOpen,
        setIsInquiryModalOpen,
        handleInquirySubmit,
        showProgramAlertModal,
        programAlerts,
        handleProgramAlertConfirm,
        handleSignUp,
        handleLogin,
        users,
        LoginModal,
        content,
        MobileMenu,
        isMenuOpen,
        setIsMenuOpen,
        onOpenMobileMenu,
    } = props;

    const isMobile = useMediaQuery(MOBILE_QUERY);

    useEffect(() => {
        const updateFabPosition = () => {
            const footerEl = footerRef.current;
            const fabEl = fabRef.current;
            if (!footerEl) return;
            const footerRect = footerEl.getBoundingClientRect();
            const fabHeight = fabEl?.getBoundingClientRect()?.height ?? FAB_ESTIMATE_HEIGHT_PX;
            const viewportBottom = window.innerHeight;
            const threshold = viewportBottom - fabHeight - FAB_GAP_PX;
            if (footerRect.top <= threshold) {
                const top = Math.max(FAB_GAP_PX, footerRect.top - fabHeight - FAB_GAP_PX);
                setFabStyle({ position: 'fixed', right: '1.5rem', bottom: 'auto', top: `${top}px` });
            } else {
                setFabStyle({ position: 'fixed', right: '1.5rem', bottom: '10rem', top: 'auto' });
            }
        };
        updateFabPosition();
        window.addEventListener('scroll', updateFabPosition, { passive: true });
        window.addEventListener('resize', updateFabPosition);
        return () => {
            window.removeEventListener('scroll', updateFabPosition);
            window.removeEventListener('resize', updateFabPosition);
        };
    }, []);

    // 개발 모드에서 currentView 변경 시에만 로그 (매 렌더마다 찍히지 않도록)
    useEffect(() => {
        if (import.meta.env.MODE !== 'development') return;
        if (prevViewRef.current === currentView) return;
        prevViewRef.current = currentView;
        console.info('[RenderView] currentView:', currentView);
    }, [currentView]);

    const showProfileIncompleteBanner = currentUser && isProfileIncomplete(currentUser) && !profileIncompleteModalClosed;

    return (
        <div className="min-h-screen flex flex-col bg-white text-dark font-sans selection:bg-accent/30 selection:text-brand relative">
            {/* 프로그램 팝업: 포스터 + X + 프로그램 신청하기 + 24시간 보이지 않기. 모바일 1개, PC 최대 3개 */}
            {popupPrograms && popupPrograms.length > 0 && !showProfileIncompleteBanner ? (
                <ModalPortal>
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) closePopupAndMarkAsShown(); }}>
                    <div className="flex flex-col md:flex-row gap-6 max-w-6xl w-full overflow-x-auto py-4 max-h-[95vh] overflow-y-auto justify-center items-start" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                            const programsToShow = isMobile ? popupPrograms.slice(0, 1) : popupPrograms;
                            return programsToShow.map((program, idx) => (
                                <div
                                    key={program.id || idx}
                                    className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-shrink-0 w-[85vw] max-w-sm mx-auto flex flex-col md:max-w-[480px]"
                                >
                                    {/* 포스터 + 오른쪽 상단 X */}
                                    <div className="w-full relative" style={{ aspectRatio: '3/4' }}>
                                        {program.isDeadlineSoon ? (
                                            <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                                                마감임박
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const remaining = popupPrograms.filter((_, i) => i !== idx);
                                                if (remaining.length === 0) closePopupAndMarkAsShown();
                                                else setPopupPrograms(remaining);
                                            }}
                                            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-white text-gray-700 z-10 shadow-md border border-gray-200"
                                            aria-label="닫기"
                                        >
                                            <Icons.X size={20} />
                                        </button>
                                        {program.img ? (
                                            program.isExternalPoster && program.externalLink ? (
                                                <a
                                                    href={program.externalLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute inset-0 z-0 block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                                                    aria-label={`${program.title || '외부 행사'} 페이지로 이동`}
                                                >
                                                    <img
                                                        src={program.img}
                                                        alt={program.title}
                                                        className="w-full h-full object-cover object-center pointer-events-none"
                                                        loading="eager"
                                                        fetchPriority="high"
                                                        decoding="async"
                                                    />
                                                </a>
                                            ) : (
                                                <img
                                                    src={program.img}
                                                    alt={program.title}
                                                    className="w-full h-full object-cover object-center"
                                                    loading="eager"
                                                    fetchPriority="high"
                                                    decoding="async"
                                                />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                <Icons.Calendar size={48} />
                                            </div>
                                        )}
                                    </div>
                                    {/* 프로그램 신청하기 / 신청해주셔서 감사합니다 — 외부+링크는 이미지가 링크 */}
                                    <div className="p-4 pt-3">
                                        {!program.isExternalPoster && (appliedProgramIds && appliedProgramIds.has(String(program.id))) ? (
                                            <div className="w-full py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-sm text-center cursor-default">
                                                신청해주셔서 감사합니다
                                            </div>
                                        ) : !program.isExternalPoster ? (
                                            <button
                                                type="button"
                                                onClick={() => onNavigateToProgramApply && onNavigateToProgramApply(program)}
                                                className="w-full py-3.5 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm"
                                            >
                                                프로그램 신청하기
                                            </button>
                                        ) : null}
                                        {/* 24시간 동안 팝업 보이지 않기 */}
                                        <label className="mt-4 flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked && closePopupAndHide24h) {
                                                        closePopupAndHide24h();
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                                            />
                                            <span className="text-sm text-gray-600 group-hover:text-gray-800">24시간 동안 팝업 보이지 않기</span>
                                        </label>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
                </ModalPortal>
            ) : null}
            {/* 팝업 신청 모달 (ESC 미적용) */}
            {isPopupApplyModalOpen && applySeminarFromPopup ? (
                <ModalPortal>
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setIsPopupApplyModalOpen(false); }}>
                    <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                            <h3 className="text-2xl font-bold text-dark mb-6">프로그램 신청</h3>
                        <div className="mb-6">
                            <h4 className="text-lg font-bold text-dark mb-2">{applySeminarFromPopup.title}</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div><span className="font-bold">일시:</span> {applySeminarFromPopup.date}</div>
                                {applySeminarFromPopup.location && <div><span className="font-bold">장소:</span> {applySeminarFromPopup.location}</div>}
                                {applySeminarFromPopup.applicationFee != null && Number(applySeminarFromPopup.applicationFee) > 0 && (
                                  <div className="font-bold text-brand mt-2">신청 비용: {new Intl.NumberFormat('ko-KR').format(Number(applySeminarFromPopup.applicationFee))}원</div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">참여 경로 <span className="text-red-500">*</span></label>
                                <div className="flex flex-wrap gap-2">
                                    {['부청사 오픈채팅', 'SNS', '지인 추천', '기타'].map((opt) => (
                                        <button key={opt} type="button" onClick={() => setPopupApplicationData({...popupApplicationData, participationPath: opt})} className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-colors ${popupApplicationData.participationPath === opt ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200 text-gray-600 hover:border-brand/50'}`}>{opt}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">강연 신청 계기 <span className="text-gray-400 text-xs">(선택)</span></label>
                                <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-24 resize-none" value={popupApplicationData.applyReason} onChange={(e) => setPopupApplicationData({...popupApplicationData, applyReason: e.target.value})} placeholder="신청 계기를 입력해주세요" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">강연 사전 질문 <span className="text-gray-400 text-xs">(선택)</span></label>
                                <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-24 resize-none" value={popupApplicationData.preQuestions} onChange={(e) => setPopupApplicationData({...popupApplicationData, preQuestions: e.target.value})} placeholder="사전 질문을 입력해주세요" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">강연 후 식사 여부 <span className="text-red-500">*</span></label>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mealAfter" checked={popupApplicationData.mealAfter === '참석'} onChange={() => setPopupApplicationData({...popupApplicationData, mealAfter: '참석'})} className="w-4 h-4 text-brand" /> 참석</label>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mealAfter" checked={popupApplicationData.mealAfter === '미참석'} onChange={() => setPopupApplicationData({...popupApplicationData, mealAfter: '미참석'})} className="w-4 h-4 text-brand" /> 미참석</label>
                                </div>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={popupApplicationData.privacyAgreed} onChange={(e) => setPopupApplicationData({...popupApplicationData, privacyAgreed: e.target.checked})} className="w-4 h-4 text-brand rounded" />
                                    <span className="text-sm font-bold text-gray-700">개인정보 수집·이용에 동의합니다 <span className="text-red-500">*</span></span>
                                </label>
                            </div>
                            <button type="button" onClick={handlePopupApplySubmit} className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 mt-6">
                                    참여신청
                                </button>
                        </div>
                        </div>
                        <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                            <button type="button" onClick={() => setIsPopupApplyModalOpen(false)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            ) : null}
            
            <header className={`fixed top-0 w-full z-[1000] transition-all duration-300 ease-in-out ${isMobile ? 'px-4 py-3' : 'px-6 py-5'} ${scrolled ? 'bg-white/80 backdrop-blur-lg shadow-glass' : isMobile ? 'bg-white/70 backdrop-blur-sm' : 'bg-transparent'}`}>
                <div className={`container mx-auto flex items-center relative w-full ${isMobile ? 'grid grid-cols-[auto_1fr_auto] gap-2' : 'flex justify-between gap-0'}`}>
                    {/* 모바일 전용: 가운데 로고(홈 버튼) */}
                    {isMobile && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none w-full max-w-[60%] z-0">
                            <button type="button" aria-label="홈으로 이동" className="pointer-events-auto h-[60px] flex items-center overflow-hidden cursor-pointer group p-0 border-0 bg-transparent" onClick={(e) => { e.preventDefault(); e.stopPropagation(); (onGoHome || (() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'instant' }); }))(); }}>
                                <img src="/assets/images/logo.png" alt="부산청년사업가들" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="eager" decoding="async" onError={(e) => { e.target.onerror = null; if (e.target.src.includes('/assets/')) { e.target.src = '/assets/images/logo.png'; } else { e.target.style.display = 'none'; const fallback = document.createElement('div'); fallback.className = 'text-lg font-black text-brand'; fallback.textContent = '부청사'; e.target.parentNode.appendChild(fallback); } }} />
                            </button>
                        </div>
                    )}
                    {/* 왼쪽: 모바일 햄버거 / PC 로고 */}
                    <div className="flex items-center min-w-0 relative z-20">
                        {isMobile ? (
                            <button type="button" aria-label="메뉴 열기" className="min-w-[44px] min-h-[44px] p-2 -ml-2 rounded-lg bg-white/90 text-gray-800 hover:bg-white active:bg-white/95 shadow-sm transition-colors touch-manipulation flex items-center justify-center" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('openMobileMenu')); onOpenMobileMenu?.(); setIsMenuOpen?.(true); }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('openMobileMenu')); onOpenMobileMenu?.(); setIsMenuOpen?.(true); }}>
                                <Icons.Menu size={24} />
                            </button>
                        ) : (
                            <div className="flex items-center cursor-pointer group h-[75px] overflow-hidden" onClick={(e) => { e.preventDefault(); e.stopPropagation(); (onGoHome || (() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'instant' }); }))(); }}>
                                <img src="/assets/images/logo.png" alt="부산청년사업가들" className="h-full w-auto object-contain hover:opacity-90 transition-opacity" loading="eager" decoding="async" onError={(e) => { e.target.onerror = null; if (e.target.src.includes('/assets/')) { e.target.src = '/assets/images/logo.png'; } else { e.target.style.display = 'none'; const fallback = document.createElement('div'); fallback.className = 'text-2xl font-black text-brand'; fallback.textContent = '부청사'; e.target.parentNode.appendChild(fallback); } }} />
                            </div>
                        )}
                    </div>
                    {/* 가운데: PC nav만 */}
                    <div className={`flex items-center min-w-0 relative z-20 ${isMobile ? 'justify-center w-full' : 'flex-1 justify-center'}`}>
                        {!isMobile && (
                            <nav className={`flex items-center px-2 py-1.5 rounded-full transition-all duration-300 gap-3 relative whitespace-nowrap ${scrolled ? 'bg-transparent' : 'bg-white/40 backdrop-blur-md shadow-glass'}`}>
                                {menuOrder.filter(item => {
                                        const enabled = menuEnabled[item];
                                        if (!enabled) return false;
                                        return true;
                                    }).map((item, idx) => {
                                        const membersOnly = ['부청사 회원', '커뮤니티'];
                                        const isDisabled = membersOnly.includes(item) && !currentUser;
                                        return (
                                    <div key={idx} className="flex flex-col items-center gap-1 relative flex-shrink-0 min-w-fit">
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigation(item); }} className={`${getNavClass(item)} relative ${isDisabled ? '!text-gray-400 !font-medium cursor-not-allowed opacity-80 hover:!text-gray-400 hover:opacity-80 nav-item-disabled' : ''}`}>
                                            {menuNames[item] || item}
                                        </button>
                                    </div>
                                        );
                                    })}
                            </nav>
                        )}
                    </div>
                    {/* 오른쪽: 로그인/가입 또는 마이페이지/로그아웃 */}
                    <div className="flex items-center justify-end gap-3 whitespace-nowrap min-w-0 relative z-20">
                        {currentUser ? (
                            <div className="flex items-center gap-2">
                                {!isMobile && (
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('myPage'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="text-xs font-bold text-gray-600 hover:text-brand transition-colors px-2 flex-shrink-0">마이페이지</button>
                                )}
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }} className={`py-2 bg-gray-200 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-300 transition-colors whitespace-nowrap flex-shrink-0 ${isMobile ? 'px-3' : 'px-4'}`}>로그아웃</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                {isMobile ? (
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(true); }} className="px-3 py-2 bg-brand text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-brand/20 whitespace-nowrap flex-shrink-0">
                                        로그인
                                    </button>
                                ) : (
                                    <>
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(true); }} className="text-xs font-semibold text-gray-600 hover:text-brand transition-colors px-2 flex-shrink-0">
                                            로그인
                                        </button>
                                        <button type="button" data-testid="header-signup-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSignUpClick?.(); }} className="inline-flex px-4 py-2 bg-brand text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-brand/20 btn-hover whitespace-nowrap flex-shrink-0">가입하기</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {MobileMenu && (
                <MobileMenu
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen?.(false)}
                    onNavigate={handleNavigation}
                    menuEnabled={menuEnabled}
                    menuNames={menuNames}
                    menuOrder={menuOrder}
                    currentUser={currentUser}
                />
            )}

            <main className="min-h-0 flex-1 overflow-y-auto">
            <div key={currentView} className="min-h-full animate-fade-in">
            {(() => {
                try {
                    const viewResult = renderView();
                    // renderView()가 undefined를 반환하는 경우를 방지
                    if (viewResult === undefined || viewResult === null) {
                        console.error('renderView() returned undefined or null, currentView:', currentView);
                        // 홈으로 리다이렉트
                        if (currentView !== 'home') {
                            setCurrentView('home');
                        }
                        return null;
                    }
                    // React 요소인지 확인 (React.isValidElement 사용)
                    if (!React.isValidElement(viewResult) && viewResult !== null) {
                        console.error('renderView() returned invalid element:', viewResult);
                        // 홈으로 리다이렉트
                        if (currentView !== 'home') {
                            setCurrentView('home');
                        }
                        return null;
                    }
                    return viewResult;
                } catch (error) {
                    console.error('renderView() error:', error);
                    console.error('Error stack:', error.stack);
                    // 오류 발생 시 홈으로 리다이렉트
                    if (currentView !== 'home') {
                        setCurrentView('home');
                    }
                    return null;
                }
            })()}
            </div>
            </main>

            <footer ref={footerRef} className="py-12 px-6 text-white bg-[#0046a5]">
                <div className="container mx-auto max-w-6xl">
                    <div className="md:hidden text-center">
                        <h3 className="text-lg font-bold text-white mb-4">{content?.footer_title || '부산청년사업가 포럼'}</h3>
                        <div className="mb-2">
                            <p className="text-[26px] text-white font-bold mb-0">
                                <span className="mr-2" aria-hidden="true">☎</span><a href={`tel:${(content?.footer_phone || defaultContent.footer_phone).replace(/\s/g, '')}`} className="hover:text-white/90 transition-colors">{content?.footer_phone || defaultContent.footer_phone}</a>
                            </p>
                            <p className="text-[13px] font-normal text-white/90 mt-1 mb-0">{content?.footer_hours ? `(${content.footer_hours})` : '(평일 09:00–18:00 / 주말·공휴일 휴무)'}</p>
                        </div>
                        <p className="text-[26px] text-white font-bold mb-8">
                            <span className="mr-2" aria-hidden="true">✉</span><a href={`mailto:${content?.footer_email || defaultContent.footer_email}`} className="hover:text-white/90 transition-colors">{content?.footer_email || defaultContent.footer_email}</a>
                        </p>
                        {(() => {
                            const line2Raw = content?.footer_line2 || '부산광역시 연제구 법원남로9번길 17(거제동) | 대표 정은지 | 사업자등록번호 792-72-00616';
                            const address = line2Raw.split(/\s*\|\s*/)[0]?.trim() || '';
                            const businessNum = '792-72-00616';
                            return (
                                <>
                                    {address && <p className="text-[10px] text-white/90 mb-2">{address}</p>}
                                    <p className="text-[10px] text-white/90 mb-2">
                                        대표 정은지 | 사업자등록번호{' '}
                                        <a href="http://www.ftc.go.kr/bizCommPop.do?wrkr_no=7927200616" target="_blank" rel="noopener noreferrer" className="hover:text-white/90 underline">792-72-00616</a>
                                    </p>
                                </>
                            );
                        })()}
                        <p className="text-[8px] text-white/70 mb-4">{(content?.footer_copyright || `© ${new Date().getFullYear()} 부산청년사업가 포럼 (BCSA). All rights reserved.`).replace(/\b2025\b/g, String(new Date().getFullYear()))}</p>
                        <p className="text-[8px] text-white/70 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (navigate) navigate('/'); setCurrentView('about'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-white/90 transition-colors">소개</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (navigate) navigate('/'); setCurrentView('notice'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-white/90 transition-colors">공지사항</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/terms'); }} className="hover:text-white/90 transition-colors">서비스 이용약관</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/privacy'); }} className="hover:text-white/90 transition-colors">개인정보 처리방침</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/refund'); }} className="hover:text-white/90 transition-colors">취소/환불 규정</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = '/admin'; }} className="text-white/60 hover:text-white/90 transition-colors" title="관리자">Admin</button>
                        </p>
                    </div>
                    <div className="hidden md:block text-left">
                        <h3 className="text-lg font-bold text-white mb-4">{content?.footer_title || '부산청년사업가 포럼'}</h3>
                        <p className="text-[10px] md:text-sm text-white/90 mb-2">
                            부산광역시 연제구 법원남로9번길 17(거제동) | 대표 정은지 | 사업자등록번호{' '}
                            <a href="http://www.ftc.go.kr/bizCommPop.do?wrkr_no=7927200616" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">792-72-00616</a>
                        </p>
                        <p className="text-[10px] md:text-sm text-white/90 mb-2">
                            대표번호 <a href={`tel:${(content?.footer_phone || defaultContent.footer_phone).replace(/\s/g, '')}`} className="hover:text-white transition-colors font-bold">{content?.footer_phone || defaultContent.footer_phone}</a>
                            {content?.footer_hours ? ` (${content.footer_hours})` : ' (평일 09:00–18:00 / 주말·공휴일 휴무)'} | 대표 메일 <a href={`mailto:${content?.footer_email || defaultContent.footer_email}`} className="hover:text-white transition-colors font-bold">{content?.footer_email || defaultContent.footer_email}</a>
                        </p>
                        <p className="text-[8px] md:text-xs text-white/70 mb-4">{(content?.footer_copyright || `© ${new Date().getFullYear()} 부산청년사업가 포럼 (BCSA). All rights reserved.`).replace(/\b2025\b/g, String(new Date().getFullYear()))}</p>
                        <p className="text-[8px] md:text-xs text-white/70 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (navigate) navigate('/'); setCurrentView('about'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-white/90 transition-colors">소개</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (navigate) navigate('/'); setCurrentView('notice'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-white/90 transition-colors">공지사항</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/terms'); }} className="hover:text-white/90 transition-colors">서비스 이용약관</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/privacy'); }} className="hover:text-white/90 transition-colors">개인정보 처리방침</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate && navigate('/refund'); }} className="hover:text-white/90 transition-colors">취소/환불 규정</button>
                            <span className="text-white/50">|</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = '/admin'; }} className="text-white/60 hover:text-white/90 transition-colors" title="관리자">Admin</button>
                        </p>
                    </div>
                </div>
            </footer>

            {/* 🌟 모달들 */}
            {showSignUpModal === true ? (
                <SignUpModal 
                    onClose={() => {
                        
                        setShowSignUpModal(false);
                    }} 
                    onSignUp={handleSignUp}
                    existingUsers={users}
                />
            ) : null}
            {showLoginModal === true ? (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    onLogin={handleLogin}
                    onSignUpClick={() => {
                        setShowLoginModal(false);
                        onSignUpClick?.();
                    }}
                />
            ) : null}

            {/* 문의하기 모달 */}
            {isInquiryModalOpen ? (
                <InquiryModal 
                    onClose={() => setIsInquiryModalOpen(false)}
                    currentUser={currentUser}
                    onSubmit={handleInquirySubmit}
                />
            ) : null}

            {/* 필수 회원정보 입력 안내 팝업 */}
            {showProfileIncompleteBanner && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setProfileIncompleteModalClosed(true); }}>
                        <div className="bg-white rounded-2xl shadow-xl border border-amber-200 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-start gap-3 mb-5">
                                <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Icons.AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-dark mb-1">필수 회원정보 입력 안내</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        필수 회원정보가 입력되지 않았습니다. 서비스 이용을 위해 마이페이지에서 입력해주세요.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileIncompleteModalClosed(true);
                                        setCurrentView('myPage');
                                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                                    }}
                                    className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors"
                                >
                                    마이페이지에서 입력하기
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
            
            {/* 프로그램 알람 모달 */}
            {showProgramAlertModal && programAlerts.length > 0 && currentUser ? (
                <ModalPortal>
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) handleProgramAlertConfirm(currentUser.id); }}>
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 max-w-[386px] w-full max-h-[90vh] overflow-y-auto modal-scroll max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                    <Icons.AlertCircle className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-dark">프로그램 시작 알림</h3>
                                    <p className="text-sm text-gray-500">곧 시작되는 프로그램이 있습니다</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => handleProgramAlertConfirm(currentUser.id)} 
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            {programAlerts.map((seminar, idx) => {
                                // 날짜 파싱
                                const parseDateString = (dateStr) => {
                                    if (!dateStr) return null;
                                    let dateOnly = dateStr.trim();
                                    if (dateOnly.includes(' ')) dateOnly = dateOnly.split(' ')[0];
                                    if (dateOnly.includes('T')) dateOnly = dateOnly.split('T')[0];
                                    dateOnly = dateOnly.replace(/-/g, '.').replace(/\//g, '.');
                                    const parts = dateOnly.split('.');
                                    if (parts.length < 3) return null;
                                    const year = parseInt(parts[0], 10);
                                    const month = parseInt(parts[1], 10) - 1;
                                    const day = parseInt(parts[2], 10);
                                    return new Date(year, month, day);
                                };
                                
                                const programDate = parseDateString(seminar.date);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const diffTime = programDate ? programDate - today : 0;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                return (
                                    <div key={seminar.id || idx} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Icons.Calendar className="w-4 h-4 text-orange-600" />
                                                    <span className="text-xs font-bold text-orange-700">
                                                        {diffDays === 0 ? '오늘' : diffDays === 1 ? '내일' : `${diffDays}일 후`}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-lg text-dark mb-1">{seminar.title}</h4>
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    {seminar.date && (
                                                        <div className="flex items-center gap-2">
                                                            <Icons.Calendar size={14} />
                                                            <span>{seminar.date}</span>
                                                        </div>
                                                    )}
                                                    {seminar.location && (
                                                        <div className="flex items-center gap-2">
                                                            <Icons.MapPin size={14} />
                                                            <span>{seminar.location}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <button
                            type="button"
                            onClick={() => handleProgramAlertConfirm(currentUser.id)}
                            className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
                </ModalPortal>
            ) : null}

            {/* 플로팅 소셜 아이콘 (PC만 표시: 1400px 초과 시) */}
            {!isMobile && (
            <div ref={fabRef} className="flex z-40 flex-col gap-3 transition-[top] duration-150" style={fabStyle}>
                <a
                    href="https://open.kakao.com/o/gMWryRA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all group"
                >
                    <Icons.MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                    <span className="absolute right-full mr-3 px-3 py-1.5 bg-yellow-400 text-black text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
                        부청사 오픈채팅방
                        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-yellow-400"></span>
                    </span>
                </a>
                <a
                    href="https://www.instagram.com/businessmen_in_busan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all group"
                >
                    <Icons.Instagram className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                    <span className="absolute right-full mr-3 px-3 py-1.5 bg-gradient-to-br from-purple-600 to-pink-500 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
                        부청사 인스타그램
                        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-purple-600"></span>
                    </span>
                </a>
                <a
                    href="https://www.youtube.com/@businessmen_in_busan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all group"
                >
                    <Icons.Youtube className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                    <span className="absolute right-full mr-3 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
                        부청사 유튜브
                        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-red-600"></span>
                    </span>
                </a>
            </div>
            )}
        </div>
    );
};

export default AppLayout;
