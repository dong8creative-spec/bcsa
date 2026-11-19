import React, { useRef, useState, useEffect } from 'react';
import { Icons } from './Icons';
import SignUpModal from './SignUpModal';
import InquiryModal from './InquiryModal';
import ModalPortal from './ModalPortal';
import Footer from './Footer';
import { useMediaQuery, MOBILE_QUERY } from '../hooks/useMediaQuery';
import { defaultContent } from '../constants/content';
import { isAdminUser } from '../utils/adminAccess';
import { BUSINESS_INFO, bizInfoCheckUrl } from '../constants/legal';

/** 전자상거래법 사업자 정보 표시: 상호·대표·사업자번호(정보 확인 링크)·통신판매업 신고·주소·호스팅 제공자 */
const BusinessInfoLines = ({ className }) => (
    <div className={className}>
        <p>상호 {BUSINESS_INFO.legalName} | 대표 {BUSINESS_INFO.ceo} | 사업자등록번호{' '}
            <a href={bizInfoCheckUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{BUSINESS_INFO.bizNo}</a>
            {' '}| 통신판매업 신고 {BUSINESS_INFO.mailOrderNo}</p>
        <p>{BUSINESS_INFO.address} | 호스팅서비스 제공 {BUSINESS_INFO.hosting}</p>
    </div>
);

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
        goTo,
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
        handleKakaoLogin,
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
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) closePopupAndMarkAsShown(); }}>
                    <div className="flex flex-col md:flex-row gap-6 max-w-6xl w-full overflow-x-auto py-4 max-h-[95vh] overflow-y-auto justify-center items-start" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                            const programsToShow = isMobile ? popupPrograms.slice(0, 1) : popupPrograms;
                            return programsToShow.map((program, idx) => (
                                <div
                                    key={program.id || idx}
                                    role="dialog" aria-modal="true" aria-label={program.title ? `${program.title} 안내` : '프로그램 안내'}
                                    className="bg-white rounded-[18px] overflow-hidden flex-shrink-0 w-[85vw] max-w-sm mx-auto flex flex-col md:max-w-[480px]"
                                >
                                    {/* 포스터 + 오른쪽 상단 X */}
                                    <div className="w-full relative" style={{ aspectRatio: '3/4' }}>
                                        {program.isDeadlineSoon ? (
                                            <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-red-600 text-white text-[13px] font-semibold">
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
                                            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white hover:bg-card text-ink z-10 border border-line"
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
                                                    className="absolute inset-0 z-0 block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-inset"
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
                                            <div className="w-full h-full flex items-center justify-center bg-card text-[#9a9893]">
                                                <Icons.Calendar size={48} />
                                            </div>
                                        )}
                                    </div>
                                    {/* 프로그램 신청하기 / 신청해주셔서 감사합니다 — 외부+링크는 이미지가 링크 */}
                                    <div className="p-4 md:p-5">
                                        {!program.isExternalPoster && (appliedProgramIds && appliedProgramIds.has(String(program.id))) ? (
                                            <div className="w-full h-[52px] flex items-center justify-center bg-card text-sub font-semibold rounded-lg text-[16px] cursor-default">
                                                신청해주셔서 감사합니다
                                            </div>
                                        ) : !program.isExternalPoster ? (
                                            <button
                                                type="button"
                                                onClick={() => onNavigateToProgramApply && onNavigateToProgramApply(program)}
                                                className="w-full h-[52px] bg-[#1a1a1a] text-white font-bold rounded-lg hover:bg-black transition-colors text-[16px]"
                                            >
                                                프로그램 신청하기
                                            </button>
                                        ) : null}
                                        {/* 24시간 동안 팝업 보이지 않기 */}
                                        <label className="mt-3 flex min-h-[44px] items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked && closePopupAndHide24h) {
                                                        closePopupAndHide24h();
                                                    }
                                                }}
                                                className="w-5 h-5 rounded border-line2 accent-[#2d4fe0]"
                                            />
                                            <span className="text-[15px] text-sub group-hover:text-ink">24시간 동안 팝업 보이지 않기</span>
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
                <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsPopupApplyModalOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="popup-apply-title" className="bg-white rounded-t-[18px] md:rounded-[18px] max-w-[640px] w-full flex flex-col max-h-[calc(100dvh-72px)] md:max-h-[calc(90vh-40px)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 pb-6 pt-7 md:px-8 md:pt-8">
                            <h3 id="popup-apply-title" className="text-[23px] font-bold text-ink mb-5 md:text-[24px]">프로그램 신청</h3>
                        <div className="mb-6 rounded-xl bg-card px-4 py-4 md:px-5">
                            <h4 className="text-[18px] font-semibold text-ink mb-2">{applySeminarFromPopup.title}</h4>
                            <div className="text-[15px] text-sub space-y-1">
                                <div><span className="font-semibold text-ink">일시</span> {applySeminarFromPopup.date}</div>
                                {applySeminarFromPopup.location && <div><span className="font-semibold text-ink">장소</span> {applySeminarFromPopup.location}</div>}
                                {applySeminarFromPopup.applicationFee != null && Number(applySeminarFromPopup.applicationFee) > 0 && (
                                  <div className="font-semibold text-royal mt-2">신청 비용: {new Intl.NumberFormat('ko-KR').format(Number(applySeminarFromPopup.applicationFee))}원</div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div role="group" aria-labelledby="popup-apply-path-label">
                                <p id="popup-apply-path-label" className="block text-[15px] font-semibold text-ink mb-2">참여 경로 <span className="text-red-600">*</span></p>
                                <div className="flex flex-wrap gap-2">
                                    {['부청사 오픈채팅', 'SNS', '지인 추천', '기타'].map((opt) => (
                                        <button key={opt} type="button" aria-pressed={popupApplicationData.participationPath === opt} onClick={() => setPopupApplicationData({...popupApplicationData, participationPath: opt})} className={`h-11 px-4 rounded-lg border text-[15px] font-semibold transition-colors ${popupApplicationData.participationPath === opt ? 'border-ink bg-[#0c0c0e] text-white' : 'border-line2 bg-white text-ink hover:border-ink'}`}>{opt === '부청사 오픈채팅' ? '먼저가본 오픈채팅' : opt}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="popup-apply-reason" className="block text-[15px] font-semibold text-ink mb-2">강연 신청 계기 <span className="text-sub text-[13px] font-normal">(선택)</span></label>
                                <textarea id="popup-apply-reason" className="w-full p-4 bg-white border border-line2 rounded-lg text-[16px] text-ink focus:border-royal focus:outline-none h-28 resize-none" value={popupApplicationData.applyReason} onChange={(e) => setPopupApplicationData({...popupApplicationData, applyReason: e.target.value})} placeholder="신청 계기를 입력해주세요" />
                            </div>
                            <div>
                                <label htmlFor="popup-apply-questions" className="block text-[15px] font-semibold text-ink mb-2">강연 사전 질문 <span className="text-sub text-[13px] font-normal">(선택)</span></label>
                                <textarea id="popup-apply-questions" className="w-full p-4 bg-white border border-line2 rounded-lg text-[16px] text-ink focus:border-royal focus:outline-none h-28 resize-none" value={popupApplicationData.preQuestions} onChange={(e) => setPopupApplicationData({...popupApplicationData, preQuestions: e.target.value})} placeholder="사전 질문을 입력해주세요" />
                            </div>
                            <div role="radiogroup" aria-labelledby="popup-apply-meal-label">
                                <p id="popup-apply-meal-label" className="block text-[15px] font-semibold text-ink mb-2">강연 후 식사 여부 <span className="text-red-600">*</span></p>
                                <div className="flex gap-5">
                                    <label className="flex min-h-[44px] items-center gap-2 cursor-pointer text-[16px] text-ink"><input type="radio" name="mealAfter" checked={popupApplicationData.mealAfter === '참석'} onChange={() => setPopupApplicationData({...popupApplicationData, mealAfter: '참석'})} className="w-5 h-5 accent-[#2d4fe0]" /> 참석</label>
                                    <label className="flex min-h-[44px] items-center gap-2 cursor-pointer text-[16px] text-ink"><input type="radio" name="mealAfter" checked={popupApplicationData.mealAfter === '미참석'} onChange={() => setPopupApplicationData({...popupApplicationData, mealAfter: '미참석'})} className="w-5 h-5 accent-[#2d4fe0]" /> 미참석</label>
                                </div>
                            </div>
                            <div className="rounded-xl border border-line px-4 py-2">
                                <label className="flex min-h-[44px] items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={popupApplicationData.privacyAgreed} onChange={(e) => setPopupApplicationData({...popupApplicationData, privacyAgreed: e.target.checked})} className="w-5 h-5 accent-[#2d4fe0]" />
                                    <span className="text-[15px] font-semibold text-ink">개인정보 수집·이용에 동의합니다 <span className="text-red-600">*</span></span>
                                </label>
                            </div>
                            <button type="button" onClick={handlePopupApplySubmit} className="w-full h-[52px] bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors !mt-6">
                                    참여신청
                                </button>
                        </div>
                        </div>
                        <div className="shrink-0 border-t border-line px-4 py-3 flex justify-end">
                            <button type="button" onClick={() => setIsPopupApplyModalOpen(false)} className="h-11 px-5 bg-white border border-line2 text-ink text-[15px] font-semibold rounded-lg hover:border-ink transition-colors">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            ) : null}
            <header className="fixed top-0 z-[1000] w-full bg-[#0c0c0e] text-white">
                {!isMobile ? (
                    <div className="border-b border-white/10">
                        <div className="mx-auto flex h-8 max-w-[1140px] items-center justify-between px-5 text-[12px] text-white/60">
                            <span>먼저 가본 선배의 경험을 사고파는 부산 사업가 커뮤니티</span>
                            {currentUser ? (
                                <span className="flex items-center gap-3">
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo('myPage'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-white">마이페이지</button>
                                    <span aria-hidden="true">/</span>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }} className="hover:text-white">로그아웃</button>
                                </span>
                            ) : (
                                <span className="flex items-center gap-3">
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(true); }} className="hover:text-white">로그인</button>
                                    <span aria-hidden="true">/</span>
                                    <button type="button" data-testid="header-signup-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSignUpClick?.(); }} className="hover:text-white">회원가입</button>
                                </span>
                            )}
                        </div>
                    </div>
                ) : null}
                <div className={`mx-auto flex max-w-[1140px] items-center gap-6 px-5 ${isMobile ? 'h-[60px]' : 'h-[72px]'}`}>
                    <button type="button" aria-label="먼저가본 처음 화면" className="shrink-0 font-logo text-[24px] leading-none text-white md:text-[26px]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); (onGoHome || (() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'instant' }); }))(); }}>
                        먼저가본
                    </button>
                    {!isMobile ? (
                        <nav className="ml-auto flex items-center gap-[30px] whitespace-nowrap" aria-label="주 메뉴">
                            {menuOrder.filter((item) => menuEnabled[item]).map((item, idx) => {
                                const membersOnly = ['부청사 회원', '커뮤니티'];
                                const isDisabled = membersOnly.includes(item) && !currentUser;
                                return (
                                    <button key={idx} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigation(item); }} className={`${getNavClass(item)} ${isDisabled ? 'cursor-not-allowed !text-white/40 nav-item-disabled' : ''}`}>
                                        {menuNames[item] || item}
                                    </button>
                                );
                            })}
                        </nav>
                    ) : (
                        <div className="ml-auto flex items-center gap-2">
                            {currentUser ? (
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo('myPage'); }} className="px-1 text-[13px] text-white/80">마이페이지</button>
                            ) : (
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginModal(true); }} className="px-1 text-[13px] text-white/80">로그인</button>
                            )}
                            <button type="button" aria-label="메뉴 열기" className="flex min-h-[40px] min-w-[44px] items-center justify-center rounded-lg border border-white/25 px-3 text-[14px] text-white touch-manipulation" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('openMobileMenu')); onOpenMobileMenu?.(); setIsMenuOpen?.(true); }}>
                                메뉴
                            </button>
                        </div>
                    )}
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
                    getNavClass={getNavClass}
                />
            )}

            <main className="min-h-0 flex-1 overflow-y-auto">
            <div
                key={currentView}
                className={
                    currentView === 'restaurants' || currentView === 'restaurantDetail' || currentView === 'restaurantForm'
                        ? 'min-h-full'
                        : 'min-h-full animate-fade-in'
                }
            >
            {(() => {
                try {
                    const viewResult = renderView();
                    // renderView()가 undefined를 반환하는 경우를 방지
                    if (viewResult === undefined || viewResult === null) {
                        console.error('renderView() returned undefined or null, currentView:', currentView);
                        if (currentView !== 'home') {
                            goTo('home');
                        }
                        return null;
                    }
                    if (!React.isValidElement(viewResult) && viewResult !== null) {
                        console.error('renderView() returned invalid element:', viewResult);
                        if (currentView !== 'home') {
                            goTo('home');
                        }
                        return null;
                    }
                    // 화면별 코드를 나눠 받는 동안(lazy) 빈 영역을 유지해 레이아웃이 튀지 않게 한다
                    return <React.Suspense fallback={<div className="min-h-[60vh]" />}>{viewResult}</React.Suspense>;
                } catch (error) {
                    console.error('renderView() error:', error);
                    console.error('Error stack:', error.stack);
                    if (currentView !== 'home') {
                        goTo('home');
                    }
                    return null;
                }
            })()}
            </div>
            </main>

            {/* 푸터 — 먼저가본 개편(2026-11): src/components/Footer.jsx (연회색 정보형) */}
            <Footer
                footerRef={footerRef}
                content={content}
                onNavigateToAbout={() => { goTo('about'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}
                onNavigateToNotice={() => { goTo('notice'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}
                onTerms={() => { navigate && navigate('/terms'); }}
                onPrivacy={() => { navigate && navigate('/privacy'); }}
                onRefundPolicy={() => { navigate && navigate('/refund'); }}
                onAdmin={() => { window.location.href = '/admin'; }}
            />

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
                    onKakaoLogin={handleKakaoLogin}
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
                    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) setProfileIncompleteModalClosed(true); }}>
                        <div role="dialog" aria-modal="true" aria-labelledby="profile-incomplete-title" className="bg-white rounded-t-[18px] md:rounded-[18px] w-full md:max-w-[440px] px-6 pb-6 pt-7 md:px-8 md:pb-8 md:pt-8" onClick={(e) => e.stopPropagation()}>
                            <p className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-royal">
                                <Icons.AlertCircle className="w-4 h-4" aria-hidden="true" />
                                회원정보 확인
                            </p>
                            <h3 id="profile-incomplete-title" className="text-[23px] font-bold text-ink mb-2">필수 회원정보 입력 안내</h3>
                            <p className="text-[16px] text-sub leading-relaxed mb-6">
                                필수 회원정보가 입력되지 않았습니다. 서비스 이용을 위해 마이페이지에서 입력해주세요.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setProfileIncompleteModalClosed(true);
                                    setCurrentView('myPage');
                                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                                }}
                                className="w-full h-[52px] text-[16px] font-bold text-white bg-[#1a1a1a] rounded-lg hover:bg-black transition-colors"
                            >
                                마이페이지에서 입력하기
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}
            
            {/* 프로그램 알람 모달 */}
            {showProgramAlertModal && programAlerts.length > 0 && currentUser ? (
                <ModalPortal>
                <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) handleProgramAlertConfirm(currentUser.id); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="program-alert-title" className="bg-white rounded-t-[18px] md:rounded-[18px] px-6 pb-6 pt-7 md:px-8 md:pb-8 md:pt-8 w-full md:max-w-[440px] max-h-[calc(100dvh-72px)] md:max-h-[90vh] overflow-y-auto modal-scroll" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 mb-6">
                            <div>
                                <h3 id="program-alert-title" className="text-[23px] font-bold text-ink">프로그램 시작 알림</h3>
                                <p className="mt-1 text-[15px] text-sub">곧 시작되는 프로그램이 있습니다</p>
                            </div>
                            <button 
                                type="button" 
                                aria-label="닫기"
                                onClick={() => handleProgramAlertConfirm(currentUser.id)} 
                                className="-mr-2 -mt-1 w-11 h-11 shrink-0 flex items-center justify-center text-ink hover:bg-card rounded-lg transition-colors"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-3 mb-6">
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
                                    <div key={seminar.id || idx} className="bg-white border border-line rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="mb-2">
                                                    <span className="inline-block px-2 py-0.5 bg-royal text-white text-[13px] font-semibold">
                                                        {diffDays === 0 ? '오늘' : diffDays === 1 ? '내일' : `${diffDays}일 후`}
                                                    </span>
                                                </div>
                                                <h4 className="font-semibold text-[18px] text-ink mb-1">{seminar.title}</h4>
                                                <div className="text-[15px] text-sub space-y-1">
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
                            className="w-full h-[52px] bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors"
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
                    aria-label="먼저가본 오픈채팅방"
                    className="relative w-11 h-11 bg-[#FEE500] rounded-lg flex items-center justify-center group"
                >
                    <Icons.MessageSquare className="w-5 h-5 text-[#191919]" aria-hidden="true" />
                    <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 bg-[#0c0c0e] text-white text-[13px] font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none" aria-hidden="true">
                        먼저가본 오픈채팅방
                    </span>
                </a>
                <a
                    href="https://www.instagram.com/businessmen_in_busan"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="먼저가본 인스타그램"
                    className="relative w-11 h-11 bg-[#0c0c0e] rounded-lg flex items-center justify-center group"
                >
                    <Icons.Instagram className="w-5 h-5 text-white" aria-hidden="true" />
                    <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 bg-[#0c0c0e] text-white text-[13px] font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none" aria-hidden="true">
                        먼저가본 인스타그램
                    </span>
                </a>
                <a
                    href="https://www.youtube.com/@businessmen_in_busan"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="먼저가본 유튜브"
                    className="relative w-11 h-11 bg-[#0c0c0e] rounded-lg flex items-center justify-center group"
                >
                    <Icons.Youtube className="w-5 h-5 text-white" aria-hidden="true" />
                    <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 bg-[#0c0c0e] text-white text-[13px] font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none" aria-hidden="true">
                        먼저가본 유튜브
                    </span>
                </a>
            </div>
            )}
        </div>
    );
};

export default AppLayout;
