import React, { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { firebaseService } from './services/firebaseService';
import { authService } from './services/authService';
import { CONFIG } from './config';
import { calculateStatus, fetchSheetData } from './utils';
import { uploadImageToImgBB, uploadLogoOrFaviconToGitHub, resizeImage, fileToBase64, normalizeImagesList } from './utils/imageUtils';
import { translateFirebaseError } from './utils/errorUtils';
import { 
  loadUsersFromStorage, 
  hashPassword, 
  verifyPassword, 
  generateTemporaryPassword, 
  sendEmailViaEmailJS,
  saveUsersToStorage,
  loadCurrentUserFromStorage,
  saveCurrentUserToStorage
} from './utils/authUtils';
import { PORTONE_IMP_CODE, PORTONE_CHANNEL_KEY } from './constants';
import { getApiBaseUrl } from './utils/api';
import { requestPayment as paymentServiceRequestPayment } from './services/paymentService';
import { PaymentResultView } from './pages/PaymentResultView';
import { defaultContent } from './constants/content';
import PageTitle from './components/PageTitle';
import NoticeView from './pages/NoticeView';
import AboutView from './pages/AboutView';
import MyPageView from './pages/MyPageView';
import AllMembersView from './pages/AllMembersView';
import AllSeminarsView from './pages/AllSeminarsView';
import SignUpPage from './pages/SignUpPage';
import CalendarSection from './components/CalendarSection';
import { Icons } from './components/Icons';
import CommunityView from './components/CommunityView';
import SignUpModal from './components/SignUpModal';
import RestaurantsListView from './components/RestaurantsListView';
import RestaurantDetailView from './components/RestaurantDetailView';
import RestaurantFormView from './components/RestaurantFormView';
import InquiryModal from './components/InquiryModal';
import DonationView from './components/DonationView';
import ProgramApplyView from './pages/ProgramApplyView';
import PrivacyPolicyView from './pages/PrivacyPolicyView';
import TermsOfServiceView from './pages/TermsOfServiceView';
import RefundPolicyView from './pages/RefundPolicyView';
import AppLayout from './components/AppLayout';
import ModalPortal from './components/ModalPortal';
import { KakaoMapModal } from './pages/Admin/components/KakaoMapModal';

const IMGBB_API_KEY = CONFIG.IMGBB?.API_KEY || '4c975214037cdf1889d5d02a01a7831d';

/** 후원 기능 비노출: true면 메뉴·홈 섹션·뷰 접근 모두 없음. 다시 켜려면 false로 변경 */
const DONATION_FEATURE_DISABLED = true;

/** 메인 검색용 부산 지역구 목록 (구·군) */
const BUSAN_DISTRICTS = ['전체', '해운대구', '부산진구', '동래구', '남구', '북구', '중구', '영도구', '동구', '서구', '사하구', '금정구', '연제구', '수영구', '사상구', '기장군'];

/** 협력기관 로고 경로 (메인 페이지 협력기관 섹션, partner1~6 순) */
const PARTNER_LOGOS = [
    '/assets/images/partners/partner1.png',
    '/assets/images/partners/partner2.png',
    '/assets/images/partners/partner3.png',
    '/assets/images/partners/partner4.png',
    '/assets/images/partners/partner5.png',
    '/assets/images/partners/partner6.png',
];
const PARTNER_NAMES = ['중소벤처기업부', '15분도시', '나라장터', 'KOTRA', '부산경제진흥원', '부산광역시'];

// 이미지 메타데이터
const imageMetadata = [
    { year: 2017, filename: '2017.png', alt: '부산지역자활센터협회 2017년 활동 사진' },
    { year: 2018, filename: '2018.png', alt: '부산지역자활센터협회 2018년 활동 사진' },
    { year: 2019, filename: '2019.png', alt: '부산지역자활센터협회 2019년 활동 사진' },
    { year: 2020, filename: '2020.png', alt: '부산지역자활센터협회 2020년 활동 사진' },
    { year: 2021, filename: '2021.png', alt: '부산지역자활센터협회 2021년 활동 사진' },
    { year: 2022, filename: '2022.png', alt: '부산지역자활센터협회 2022년 활동 사진' },
    { year: 2023, filename: '2023.png', alt: '부산지역자활센터협회 2023년 활동 사진' },
    { year: 2024, filename: '2024.png', alt: '부산지역자활센터협회 2024년 활동 사진' },
];

// ==========================================
// View 컴포넌트들 (RestaurantsListView, RestaurantDetailView, RestaurantFormView, InquiryModal, DonationView는 components/로 분리됨)
// ==========================================

// AllSeminarsView는 pages/AllSeminarsView.jsx로 분리됨

// Daum Postcode helper function
const openDaumPostcode = (onComplete) => {
    if (window.location.protocol === 'file:') {
        alert('⚠️ 주소 검색 기능은 HTTP 서버에서만 작동합니다.\n\n로컬 서버를 실행하려면:\nnpm run http\n\n그 후 브라우저에서 http://localhost:3000/index.html 을 열어주세요.');
        return;
    }
    
    if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
        alert('주소 검색 서비스가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    new window.daum.Postcode({
        oncomplete: function(data) {
            try {
                let fullRoadAddr = '';
                let extraRoadAddr = '';
                
                if (data.userSelectedType === 'R') {
                    fullRoadAddr = data.roadAddress;
                    
                    if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
                        extraRoadAddr += data.bname;
                    }
                    if (data.buildingName !== '' && data.apartment === 'Y') {
                        extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
                    }
                    if (extraRoadAddr !== '') {
                        extraRoadAddr = ' (' + extraRoadAddr + ')';
                    }
                    fullRoadAddr += extraRoadAddr;
                } else {
                    fullRoadAddr = data.jibunAddress || data.autoJibunAddress || data.roadAddress;
                }
                
                const zonecode = data.zonecode;
                const jibunAddress = data.jibunAddress || data.autoJibunAddress;
                
                if (onComplete && typeof onComplete === 'function') {
                    onComplete({
                        roadAddress: fullRoadAddr || data.roadAddress || '',
                        jibunAddress: jibunAddress || '',
                        zipCode: zonecode || '',
                        buildingName: data.buildingName || ''
                    });
                }
            } catch (error) {
                alert('주소 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            }
        }
    }).open();
};

// LoginModal Component
const LoginModal = ({ onClose, onLogin, onKakaoLogin, onSignUpClick }) => {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // 모달 열릴 때 배경 스크롤 방지
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);
    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [onClose]);

    const handleSubmit = (e) => { 
        e.preventDefault(); 
        onLogin(id, password); 
    };
    
    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 flex flex-col max-h-[90vh] relative border-[0.5px] border-brand scale-90 origin-center" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
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
                                <input type="text" placeholder="아이디 또는 이메일을 입력하세요" autoComplete="username" className="w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={id} onChange={e => setId(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">비밀번호</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요" autoComplete="current-password" className="w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors pr-10 text-sm" value={password} onChange={e => setPassword(e.target.value)} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                        {showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all mt-2 text-sm">
                                로그인
                            </button>
                        </form>
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                            {onKakaoLogin && (
                                <button
                                    type="button"
                                    disabled
                                    className="w-full py-2.5 bg-[#FEE500]/50 text-[#191919]/70 font-bold rounded-xl cursor-not-allowed opacity-60 text-sm flex items-center justify-center gap-2"
                                >
                                    <span className="inline-flex shrink-0" aria-hidden="true">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 3C6.2 3 1.5 6.66 1.5 11.18c0 2.84 1.8 5.36 4.61 6.94-.12.44-.42 1.58-.48 1.83-.08.38.14.37.33.27.15-.08 2.42-1.58 3.4-2.27.57.08 1.17.12 1.79.12 5.8 0 10.5-3.66 10.5-8.18S17.8 3 12 3z"/>
                                        </svg>
                                    </span>
                                    <span>카카오로 로그인</span>
                                </button>
                            )}
                        </div>
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
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-brand text-white font-bold rounded-lg hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200 text-sm">
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

// SignUpModal Component




const App = () => {
    // 결제/API 환경 변수 점검용 (개발 모드에서만 콘솔 출력)
    if (import.meta.env.DEV) {
        console.log('[BCSA env]', {
            api: import.meta?.env?.VITE_API_URL || '(없음)',
            imp: import.meta?.env?.VITE_PORTONE_IMP_CODE ? '설정됨' : '없음',
            channel: import.meta?.env?.VITE_PORTONE_CHANNEL_KEY ? '설정됨' : '없음'
        });
    }
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const openMobileMenu = useCallback(() => { setIsMenuOpen(true); }, []);
    const closeMobileMenu = useCallback(() => { setIsMenuOpen(false); }, []);
    const [scrolled, setScrolled] = useState(false);
    const [content, setContent] = useState(() => {
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('busan_ycc_content');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // 기본값과 병합하여 누락된 필드 보완
                    return { ...defaultContent, ...parsed };
                }
            }
            return defaultContent;
            } catch (error) {
            
            return defaultContent;
        }
    });
    const [membersData, setMembersData] = useState([]);
    const [seminarsData, setSeminarsData] = useState([]);
    const [communityPosts, setCommunityPosts] = useState([]);
    const [restaurantsData, setRestaurantsData] = useState([]);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [currentView, setCurrentView] = useState('home');
    const [programListPage, setProgramListPage] = useState(1);
    const [membersListPage, setMembersListPage] = useState(1);
    const navigate = useNavigate();
    const location = useLocation();

    // 햄버거 클릭을 전역 이벤트로도 수신 (클릭이 콜백보다 확실히 전달되도록)
    useEffect(() => {
        const handler = () => setIsMenuOpen(true);
        window.addEventListener('openMobileMenu', handler);
        return () => window.removeEventListener('openMobileMenu', handler);
    }, []);

    // 모바일 메뉴 열림 시 배경 스크롤 완전 잠금 (iOS 포함)
    const menuScrollYRef = useRef(0);
    const closingByNavigateRef = useRef(false);
    useEffect(() => {
        if (!isMenuOpen) return;
        menuScrollYRef.current = window.scrollY ?? window.pageYOffset ?? 0;
        const style = document.body.style;
        const prevOverflow = style.overflow;
        const prevPosition = style.position;
        const prevTop = style.top;
        const prevLeft = style.left;
        const prevRight = style.right;
        const prevWidth = style.width;
        style.overflow = 'hidden';
        style.position = 'fixed';
        style.left = '0';
        style.right = '0';
        style.top = `-${menuScrollYRef.current}px`;
        style.width = '100%';
        return () => {
            style.overflow = prevOverflow;
            style.position = prevPosition;
            style.top = prevTop;
            style.left = prevLeft;
            style.right = prevRight;
            style.width = prevWidth;
            if (closingByNavigateRef.current) {
                window.scrollTo(0, 0);
                closingByNavigateRef.current = false;
            } else {
                window.scrollTo(0, menuScrollYRef.current);
            }
        };
    }, [isMenuOpen]);

    // 개발 모드에서 콘솔에서 접근 가능하도록 전역 함수 노출
    useEffect(() => {
        if (import.meta.env.MODE === 'development') {
            window.__setCurrentView = setCurrentView;
            window.__getCurrentView = () => currentView;
        }
    }, [currentView]);
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    
    // 승인된 회원만 필터링 (테스트 계정 필터링 제거)
    const filterApprovedMembers = (users) => {
        if (!Array.isArray(users)) return [];
        
        // approvalStatus가 'approved'이거나 없는 회원만 표시
        return users.filter(user => {
            const isApproved = !user.approvalStatus || user.approvalStatus === 'approved';
            return isApproved;
        });
    };

    // 사용자 데이터 로드 (페이지 로드 시)
    useEffect(() => {
        // Load users from Firebase (우선 사용)
        if (firebaseService && firebaseService.subscribeUsers) {
            const unsubscribe = firebaseService.subscribeUsers((users) => {
                const filteredUsers = filterApprovedMembers(users);
                
                setUsers(filteredUsers);
                // membersData도 업데이트 (AllMembersView에서 사용) - Firebase 데이터 우선
                setMembersData(filteredUsers);
            });
            
            return () => unsubscribe();
        } else {
            (async () => {
                try {
                    const users = await loadUsersFromStorage();
                    if (users && users.length > 0) {
                        const filteredUsers = filterApprovedMembers(users);
                        setUsers(filteredUsers);
                        setMembersData(filteredUsers);
                    }
                } catch (error) {
                    console.error('사용자 로드 오류:', error);
                }
            })();
        }
    }, []);
    
    // Content 실시간 구독 (메인 페이지 텍스트 실시간 업데이트)
    useEffect(() => {
        if (firebaseService && firebaseService.subscribeContent) {
            const unsubscribe = firebaseService.subscribeContent((contentData) => {
                if (contentData && Object.keys(contentData).length > 0) {
                    // 기본값과 Firebase Content 병합 (기본값을 기준으로 Firebase 설정으로 덮어쓰기)
                    const merged = { ...defaultContent, ...contentData };
                    setContent(() => merged);
                    try {
                        if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                            localStorage.setItem('busan_ycc_content', JSON.stringify(merged));
                        }
                    } catch (_) {}
                    // menuNames도 Firebase에서 가져오기 (우선 사용)
                    if (contentData.menuNames) {
                        setMenuNames(prev => ({ ...defaultMenuNames, ...contentData.menuNames }));
                    } else {
                        // Firebase에 menuNames가 없으면 localStorage 사용 (폴백)
                        const localMenuNames = loadMenuNamesFromStorage();
                        setMenuNames(localMenuNames);
                    }
                    
                    // menuEnabled도 Firebase에서 가져오기 (우선 사용)
                    if (contentData.menuEnabled) {
                        setMenuEnabled(prev => ({ ...loadMenuEnabledFromStorage(), ...contentData.menuEnabled }));
                    }
                }
            });
            
            return () => unsubscribe();
        } else {
            // Firebase Service가 없으면 초기 로드 시 Content 가져오기
            const loadContent = async () => {
                        if (firebaseService && firebaseService.getContent) {
                    try {
                                const contentData = await firebaseService.getContent();
                        if (contentData && Object.keys(contentData).length > 0) {
                            // 기본값과 Firebase Content 병합 (기본값을 기준으로 Firebase 설정으로 덮어쓰기)
                            const merged = { ...defaultContent, ...contentData };
                            setContent(() => merged);
                            try {
                                if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                                    localStorage.setItem('busan_ycc_content', JSON.stringify(merged));
                                }
                            } catch (_) {}
                            // menuNames도 Firebase에서 가져오기
                            if (contentData.menuNames) {
                                setMenuNames(prev => ({ ...defaultMenuNames, ...contentData.menuNames }));
                            } else {
                                // Firebase에 없으면 localStorage 사용
                                const localMenuNames = loadMenuNamesFromStorage();
                                setMenuNames(localMenuNames);
                            }
                            
                            // menuEnabled도 Firebase에서 가져오기
                            if (contentData.menuEnabled) {
                                setMenuEnabled(prev => ({ ...loadMenuEnabledFromStorage(), ...contentData.menuEnabled }));
                            }
                        }
                    } catch (error) {
                        console.error('Content 로드 오류:', error);
                    }
                }
            };
            loadContent();
        }
    }, []);
    
    // pageTitles 상태 관리 (content에서 분리)
    const [pageTitles, setPageTitles] = useState(() => {
        // 기본값과 content에서 병합
        return { ...defaultContent.pageTitles, ...(content.pageTitles || {}) };
    });
    
    // pageTitles를 content에서 동기화 (기본값과 병합)
    useEffect(() => {
        if (content.pageTitles) {
            setPageTitles(prev => ({ ...defaultContent.pageTitles, ...prev, ...content.pageTitles }));
        } else {
            // content에 pageTitles가 없으면 기본값 사용
            setPageTitles(defaultContent.pageTitles || {});
        }
    }, [content.pageTitles]);

    // LCP 개선: hero_image 동적 preload (Content에서 URL을 알게 되는 시점에 head에 삽입)
    const heroPreloadId = 'hero-image-preload';
    useEffect(() => {
        const url = content?.hero_image;
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
        let link = document.getElementById(heroPreloadId);
        if (link && link.getAttribute('href') === url) return;
        if (link) link.remove();
        link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        link.id = heroPreloadId;
        document.head.appendChild(link);
        return () => {
            const el = document.getElementById(heroPreloadId);
            if (el) el.remove();
        };
    }, [content?.hero_image]);

    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [showSignUpChoiceModal, setShowSignUpChoiceModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pendingView, setPendingView] = useState(null); // 로그인 후 이동할 뷰
    const [mySeminars, setMySeminars] = useState([]);
    const [myPosts, setMyPosts] = useState([]);
    const [reviewSeminar, setReviewSeminar] = useState(null); // 후기 작성할 프로그램
    const [programAlerts, setProgramAlerts] = useState([]); // 프로그램 알람 목록
    const [showProgramAlertModal, setShowProgramAlertModal] = useState(false); // 알람 모달 표시 여부
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchStatus, setSearchStatus] = useState('');
    const [searchDistrict, setSearchDistrict] = useState('전체');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [popupPrograms, setPopupPrograms] = useState([]); // 최대 3개 프로그램 팝업
    const [applySeminarFromPopup, setApplySeminarFromPopup] = useState(null);
    const [isPopupApplyModalOpen, setIsPopupApplyModalOpen] = useState(false);
    const [popupApplicationData, setPopupApplicationData] = useState({ 
        participationPath: '',
        applyReason: '',
        preQuestions: '',
        mealAfter: '',
        privacyAgreed: false,
    });
    const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
    const [showKakaoMapModal, setShowKakaoMapModal] = useState(false);
    const [paymentInfoModalOpen, setPaymentInfoModalOpen] = useState(false);
    const [pendingPaymentContext, setPendingPaymentContext] = useState(null);
    const [paymentInfoPhone, setPaymentInfoPhone] = useState('');
    const [paymentInfoEmail, setPaymentInfoEmail] = useState('');
    const [showGoogleSignupExtraInfoModal, setShowGoogleSignupExtraInfoModal] = useState(false);
    const [googleSignupExtraInfoUser, setGoogleSignupExtraInfoUser] = useState(null);
    const [googleSignupExtraPhone, setGoogleSignupExtraPhone] = useState('');
    const [googleSignupExtraEmail, setGoogleSignupExtraEmail] = useState('');
    const kakaoMapCallbackRef = useRef(null);
    const popupShownRef = useRef(false); // 팝업 설정 중복 실행 방지용 ref
    const programTrackRef = useRef(null);
    const programScrollOffsetRef = useRef(0);
    const [programScrollOffset, setProgramScrollOffset] = useState(0);
    const programDragRef = useRef({ active: false, startX: 0, startOffset: 0, hasMoved: false });
    const lastUnknownViewLoggedRef = useRef(null);

    // 프로그램 자동 흐름 애니메이션 (250초 주기) + 드래그 시 일시 정지
    useEffect(() => {
        programScrollOffsetRef.current = programScrollOffset;
    }, [programScrollOffset]);

    useEffect(() => {
        if (!Array.isArray(seminarsData) || seminarsData.length === 0) return;
        let rafId;
        const tick = () => {
            if (programDragRef.current.active) {
                rafId = requestAnimationFrame(tick);
                return;
            }
            const el = programTrackRef.current;
            const contentWidth = el ? el.offsetWidth / 2 : 0;
            if (contentWidth <= 0) {
                rafId = requestAnimationFrame(tick);
                return;
            }
            const speed = contentWidth / 250 / 60;
            setProgramScrollOffset((prev) => {
                let next = prev - speed;
                if (next < -contentWidth) next += contentWidth;
                if (next > 0) next -= contentWidth;
                return next;
            });
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [seminarsData.length]);

    // 프로그램 섹션 마우스/터치 드래그 스크롤 (드래그 중에는 자동 흐름 일시 정지)
    const handleProgramDragStart = (e) => {
        const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        programDragRef.current = {
            active: true,
            startX: clientX,
            startOffset: programScrollOffsetRef.current,
            hasMoved: false
        };
        const container = programTrackRef.current?.parentElement;
        if (container) {
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
        }
        const onMove = (e2) => {
            const x = e2.clientX ?? e2.touches?.[0]?.clientX ?? programDragRef.current.startX;
            const dx = programDragRef.current.startX - x;
            if (Math.abs(dx) > 5) programDragRef.current.hasMoved = true;
            setProgramScrollOffset(programDragRef.current.startOffset - dx);
            if (e2.cancelable) e2.preventDefault();
        };
        const onUp = () => {
            programDragRef.current.active = false;
            if (container) {
                container.style.cursor = 'grab';
                container.style.userSelect = '';
            }
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove, { passive: false });
            document.removeEventListener('touchend', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    };

    // 카카오맵 SDK 로드 완료를 기다리는 헬퍼 함수
    const waitForKakaoMap = () => {
        return new Promise((resolve, reject) => {
            // 이미 로드된 경우
            if (window.kakao && window.kakao.maps) {
                resolve(window.kakao);
                return;
            }
            
            // 스크립트가 로드 중인지 확인
            const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
            
            // 스크립트가 있으면 이미 로드됐을 수 있으므로 폴링으로 대기 (load 이벤트는 이미 끝났을 수 있음)
            if (existingScript) {
                let attempts = 0;
                const maxAttempts = 50; // 5초 대기
                const pollInterval = setInterval(() => {
                    attempts++;
                    if (window.kakao && window.kakao.maps) {
                        clearInterval(pollInterval);
                        resolve(window.kakao);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        reject(new Error('카카오맵 SDK를 로드할 수 없습니다.'));
                    }
                }, 100);
                existingScript.addEventListener('error', () => {
                    clearInterval(pollInterval);
                    reject(new Error('카카오맵 SDK 스크립트 로드에 실패했습니다.'));
                }, { once: true });
                return;
            }
            
            // 스크립트가 없으면 동적으로 로드
            (async () => {
                try {
                    await loadKakaoMapScript();
                    // 로드 후 kakao 객체 초기화까지 대기
                    let attempts = 0;
                    const maxAttempts = 50; // 5초 대기
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.kakao && window.kakao.maps) {
                            clearInterval(checkInterval);
                            resolve(window.kakao);
                        } else if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                            reject(new Error('카카오맵 SDK를 로드할 수 없습니다.'));
                        }
                    }, 100);
                } catch (err) {
                    reject(err);
                }
            })();
        });
    };
    
    // 카카오맵 SDK 동적 로드 함수
    const loadKakaoMapScript = () => {
        return new Promise((resolve, reject) => {
            // 이미 로드 중이거나 로드된 경우
            if (window.kakao && window.kakao.maps) {
                resolve();
                return;
            }
            
            const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
            if (existingScript) {
                if (existingScript.readyState === 'complete' || existingScript.readyState === 'loaded' || (window.kakao && window.kakao.maps)) {
                    resolve();
                    return;
                }
                existingScript.addEventListener('load', resolve, { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }
            
            // 스크립트 동적 생성 및 로드 (async=false: SDK 내부 document.write 호환)
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=f35b8c9735d77cced1235c5775c7c3b1&libraries=services';
            script.async = false;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };
    
    // 장소 선정: Admin 프로그램 등록과 동일한 KakaoMapModal 사용
    const openKakaoPlacesSearch = (onComplete) => {
        kakaoMapCallbackRef.current = onComplete;
        setShowKakaoMapModal(true);
    };
    
    // 카테고리별 컬러 반환 함수
    const getCategoryColor = (category) => {
        const colorMap = {
            '네트워킹 모임': 'bg-green-100 text-green-700',
            '교육/세미나': 'bg-blue-100 text-blue-700',
            '커피챗': 'bg-amber-100 text-amber-700',
            '네트워킹/모임': 'bg-green-100 text-green-700',
            '투자/IR': 'bg-orange-100 text-orange-700',
            '멘토링/상담': 'bg-purple-100 text-purple-700',
            '기타': 'bg-gray-100 text-gray-700'
        };
        return colorMap[category] || 'bg-gray-100 text-gray-700';
    };
    
    // 모달 상태 변경 디버깅 (개발 환경에서만)
    useEffect(() => {
        
    }, [showSignUpModal]);
    
    useEffect(() => {
        
    }, [showLoginModal]);
    
    // 회원가입 선택 모달 열릴 때 배경 스크롤 방지
    useEffect(() => {
        if (!showSignUpChoiceModal) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [showSignUpChoiceModal]);
    
    // 마감임박 판단 함수
    const isDeadlineSoon = (seminar) => {
        if (!seminar.dateObj) return false;
        const today = new Date();
        const daysLeft = Math.ceil((seminar.dateObj - today) / (1000 * 60 * 60 * 24));
        const participantRatio = (seminar.currentParticipants || 0) / (seminar.maxParticipants || 999);
        return daysLeft <= 3 || participantRatio >= 0.8;
    };
    
    // 홈 + 세미나 데이터 있을 때 팝업 후보 이미지 미리 preload (팝업 표시 전에 캐시 적재)
    useEffect(() => {
        if (currentView !== 'home' || !seminarsData?.length) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = seminarsData
            .filter(s => s.status !== '종료')
            .map(s => {
                const matches = s.date ? s.date.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/) : null;
                if (!matches) return null;
                const year = parseInt(matches[1]);
                const month = parseInt(matches[2]) - 1;
                const day = parseInt(matches[3]);
                const seminarDate = new Date(year, month, day);
                seminarDate.setHours(0, 0, 0, 0);
                if (seminarDate >= today) return { ...s, dateObj: seminarDate };
                return null;
            })
            .filter(s => s !== null)
            .filter(s => !!s.img)
            .filter(s => (s.currentParticipants || 0) < (s.maxParticipants || 999))
            .sort((a, b) => a.dateObj - b.dateObj)
            .slice(0, 3);
        upcoming.forEach((p) => {
            if (p.img && typeof p.img === 'string') {
                const img = new Image();
                img.src = p.img;
            }
        });
    }, [currentView, seminarsData]);

    // 메인페이지 진입 시 다가오는 프로그램 팝업 표시 (최대 3개)
    useEffect(() => {
        // 이미 표시된 경우 또는 설정 중인 경우 return
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                if (localStorage.getItem('busan_ycc_popup_shown') === 'true' || popupShownRef.current) {
                    return;
                }
            }
        } catch (error) {
            // localStorage 접근 실패 시 무시
        }
        
        if (currentView === 'home' && seminarsData.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // date가 문자열 또는 Timestamp/Date 객체 모두 처리
            const toDateObj = (dateVal) => {
                if (dateVal == null) return null;
                if (typeof dateVal.toDate === 'function') return dateVal.toDate();
                if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
                const str = String(dateVal).trim();
                const matches = str ? str.match(/(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})/) : null;
                if (!matches) return null;
                const year = parseInt(matches[1], 10);
                const month = parseInt(matches[2], 10) - 1;
                const day = parseInt(matches[3], 10);
                const d = new Date(year, month, day);
                return isNaN(d.getTime()) ? null : d;
            };
            const upcomingSeminars = seminarsData
                .filter(s => s.status !== '종료')
                .map(s => {
                    const seminarDate = toDateObj(s.date);
                    if (!seminarDate) return null;
                    seminarDate.setHours(0, 0, 0, 0);
                    if (seminarDate >= today) {
                        return { ...s, dateObj: seminarDate };
                    }
                    return null;
                })
                .filter(s => s !== null)
                .filter(s => !!s.img)
                .filter(s => {
                    const is정모 = (s.title || '').includes('정모');
                    const isFull = (s.currentParticipants || 0) >= (s.maxParticipants || 999);
                    return is정모 || !isFull;
                })
                .sort((a, b) => a.dateObj - b.dateObj)
                .slice(0, 3);
            
                if (Array.isArray(upcomingSeminars) && upcomingSeminars.length > 0) {
                const seminarsWithDeadline = upcomingSeminars.map(s => ({
                    ...s,
                    isDeadlineSoon: isDeadlineSoon(s)
                }));
                // 이미 신청한 프로그램은 팝업에서 제외 (신청한 사람은 해당 프로그램 팝업이 뜨지 않음)
                const appliedIds = new Set((mySeminars || []).map(m => m.id).filter(Boolean));
                const toShow = seminarsWithDeadline.filter(p => !appliedIds.has(p.id));
                // 팝업 이미지 사전 로딩 (캐시 미적중 시 대비, 위 useEffect에서 이미 앞당겨 preload함)
                toShow.slice(0, 3).forEach((p) => {
                    if (p.img && typeof p.img === 'string') {
                        const img = new Image();
                        img.src = p.img;
                    }
                });
                // 팝업 설정 전에 ref를 true로 설정하여 중복 방지
                popupShownRef.current = true;
                setPopupPrograms(toShow.length > 0 ? toShow : []);
            } else {
                setPopupPrograms([]);
            }
        }
    }, [currentView, seminarsData, mySeminars]);
    
    // Load members from Firebase (우선 사용 - 애드민과 동기화)
    useEffect(() => {
        if (firebaseService && firebaseService.subscribeUsers) {
            const unsubscribe = firebaseService.subscribeUsers((users) => {
                const members = filterApprovedMembers(users);
                // Firebase 데이터를 우선적으로 사용하여 애드민과 동기화
                setMembersData(members);
            });
            return () => unsubscribe();
        } else {
            if (firebaseService && firebaseService.getUsers) {
                (async () => {
                    try {
                        const users = await firebaseService.getUsers();
                        const members = filterApprovedMembers(users);
                        setMembersData(members);
                    } catch (error) {
                        console.error('사용자 로드 오류:', error);
                    }
                })();
            }
        }
    }, []);
    
    // 프로그램 알람 체크 함수 (시작 3일 전) - useEffect 이전에 정의
    const checkProgramAlerts = (appliedSeminars, userId) => {
        if (!appliedSeminars || appliedSeminars.length === 0) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 이미 확인한 알람 목록 가져오기
        const checkedAlertsKey = `program_alerts_checked_${userId}`;
        const checkedAlerts = JSON.parse(localStorage.getItem(checkedAlertsKey) || '[]');
        
        // 날짜 문자열을 Date 객체로 변환하는 함수
        const parseDateString = (dateStr) => {
            if (!dateStr) return null;
            
            // 시간 부분 제거
            let dateOnly = dateStr.trim();
            if (dateOnly.includes(' ')) {
                dateOnly = dateOnly.split(' ')[0];
            }
            if (dateOnly.includes('T')) {
                dateOnly = dateOnly.split('T')[0];
            }
            
            // 다양한 구분자 처리
            dateOnly = dateOnly.replace(/-/g, '.').replace(/\//g, '.');
            const parts = dateOnly.split('.');
            if (parts.length < 3) {
                if (dateOnly.length === 8 && /^\d+$/.test(dateOnly)) {
                    return new Date(
                        parseInt(dateOnly.substring(0, 4), 10),
                        parseInt(dateOnly.substring(4, 6), 10) - 1,
                        parseInt(dateOnly.substring(6, 8), 10)
                    );
                }
                return null;
            }
            
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            
            return new Date(year, month, day);
        };
        
        // 시작일이 3일 이내인 프로그램 찾기
        const alerts = appliedSeminars.filter(seminar => {
            if (!seminar.date) return false;
            
            const programDate = parseDateString(seminar.date);
            if (!programDate) return false;
            
            programDate.setHours(0, 0, 0, 0);
            
            // 프로그램 시작일이 오늘 이후이고 3일 이내인지 확인
            const diffTime = programDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // 0일 이상 3일 이하 (오늘부터 3일 후까지)
            if (diffDays >= 0 && diffDays <= 3) {
                // 이미 확인한 알람인지 체크
                const alertKey = `${seminar.id}_${programDate.toISOString().split('T')[0]}`;
                return !checkedAlerts.includes(alertKey);
            }
            
            return false;
        });
        
        if (alerts.length > 0) {
            setProgramAlerts(alerts);
            setShowProgramAlertModal(true);
        }
    };

    // Firebase Auth 상태 변경 리스너 - 새로고침 시 로그인 세션 유지
    useEffect(() => {
        if (authService && authService.onAuthStateChanged) {
            const unsubscribe = authService.onAuthStateChanged(async (user) => {
                if (user) {
                    // 사용자가 로그인되어 있으면 Firestore에서 사용자 데이터 로드
                    try {
                        const userDoc = await authService.getUserData(user.uid);
                        if (userDoc) {
                            setCurrentUser(userDoc);
                            setMyPosts(communityPosts.filter(p => p.author === userDoc.name));
                            
                            // Firestore에서 신청한 프로그램 목록 가져오기
                            try {
                                if (firebaseService && firebaseService.getApplicationsByUserId) {
                                    const applications = await firebaseService.getApplicationsByUserId(userDoc.id);
                                    // applications에서 seminarId를 추출하여 해당 seminar 찾기 (타입 통일 비교)
                                    const appliedSeminarIds = applications.map(app => String(app.seminarId));
                                    const appliedSeminars = seminarsData.filter(seminar => 
                                        appliedSeminarIds.includes(String(seminar.id))
                                    );
                                    setMySeminars(appliedSeminars);
                                    
                                    // 프로그램 알람 체크 (시작 3일 전)
                                    checkProgramAlerts(appliedSeminars, userDoc.id);
                                }
                            } catch (error) {
                                console.error('신청한 프로그램 목록 로드 실패:', error);
                                // 실패 시 localStorage에서 가져오기 (폴백)
                                try {
                                    const localApplications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                                    const localAppliedSeminarIds = localApplications
                                        .filter(app => String(app.userId) === String(userDoc.id))
                                        .map(app => String(app.seminarId));
                                    const localAppliedSeminars = seminarsData.filter(seminar => 
                                        localAppliedSeminarIds.includes(String(seminar.id))
                                    );
                                    setMySeminars(localAppliedSeminars);
                                    
                                    // 프로그램 알람 체크 (시작 3일 전)
                                    checkProgramAlerts(localAppliedSeminars, userDoc.id);
                                } catch (localError) {
                                    console.error('localStorage에서 프로그램 목록 로드 실패:', localError);
                                }
                            }
                        }
                    } catch (error) {
                    }
                } else {
                    // 사용자가 로그아웃했으면 상태 초기화
                    setCurrentUser(null);
                    setMyPosts([]);
                    setMySeminars([]);
                    setProgramAlerts([]);
                    setShowProgramAlertModal(false);
                }
            });
            
            return () => unsubscribe();
        }
    }, [communityPosts, seminarsData]);

    // currentUser + seminarsData가 모두 있을 때 신청한 프로그램 목록 동기화 (seminarsData가 나중에 로드된 경우 대비)
    useEffect(() => {
        if (!currentUser?.id || !Array.isArray(seminarsData) || seminarsData.length === 0) return;
        const loadMySeminars = async () => {
            try {
                if (firebaseService?.getApplicationsByUserId) {
                    const applications = await firebaseService.getApplicationsByUserId(currentUser.id);
                    const appliedIds = applications.map(app => String(app.seminarId));
                    const applied = seminarsData.filter(s => appliedIds.includes(String(s.id)));
                    setMySeminars(prev => {
                        if (prev.length === applied.length && prev.every((p, i) => String(p?.id) === String(applied[i]?.id))) return prev;
                        return applied;
                    });
                    checkProgramAlerts(applied, currentUser.id);
                    return;
                }
            } catch (e) {
                console.error('신청한 프로그램 목록 로드 실패:', e);
            }
            try {
                const local = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                const appliedIds = local
                    .filter(app => String(app.userId) === String(currentUser.id))
                    .map(app => String(app.seminarId));
                const applied = seminarsData.filter(s => appliedIds.includes(String(s.id)));
                setMySeminars(applied);
                checkProgramAlerts(applied, currentUser.id);
            } catch (e) {
                console.error('localStorage에서 프로그램 목록 로드 실패:', e);
            }
        };
        loadMySeminars();
    }, [currentUser?.id, seminarsData]);
    
    // 알람 확인 처리 함수
    const handleProgramAlertConfirm = (userId) => {
        if (!userId) return;
        
        const checkedAlertsKey = `program_alerts_checked_${userId}`;
        const checkedAlerts = JSON.parse(localStorage.getItem(checkedAlertsKey) || '[]');
        
        // 오늘 확인한 알람들을 기록
        const today = new Date().toISOString().split('T')[0];
        programAlerts.forEach(seminar => {
            if (seminar.date) {
                const alertKey = `${seminar.id}_${today}`;
                if (!checkedAlerts.includes(alertKey)) {
                    checkedAlerts.push(alertKey);
                }
            }
        });
        
        localStorage.setItem(checkedAlertsKey, JSON.stringify(checkedAlerts));
        setShowProgramAlertModal(false);
        setProgramAlerts([]);
    };
    
    // Load seminars from Firebase
    useEffect(() => {
        // 기존 데이터 호환성: img 필드를 images 배열로 변환하는 함수
        const normalizeSeminarImages = (seminar) => {
            if (!seminar) {
                return null;
            }
            
            let images = [];
            
            // images 필드 처리 (문자열 배열 또는 { firebase, imgbb } 객체 배열 지원)
            if (seminar.images) {
                if (Array.isArray(seminar.images)) {
                    images = normalizeImagesList(seminar.images);
                } else if (typeof seminar.images === 'string' && seminar.images.trim() !== '') {
                    // 문자열인 경우 배열로 변환
                    try {
                        const parsed = JSON.parse(seminar.images);
                        if (Array.isArray(parsed)) {
                            images = normalizeImagesList(parsed);
                        } else {
                            images = [seminar.images];
                        }
                    } catch (e) {
                        // JSON 파싱 실패 시 단일 문자열로 처리
                        images = [seminar.images];
                    }
                }
            }
            
            // images 배열이 비어있고 img 필드가 있으면 img 필드 사용
            if (images.length === 0 && seminar.img) {
                if (typeof seminar.img === 'string' && seminar.img.trim() !== '') {
                    images = [seminar.img];
                }
            }
            
            return {
                ...seminar,
                images: images,
                // 호환성을 위해 img 필드도 유지 (첫 번째 이미지)
                img: images.length > 0 ? images[0] : (seminar.img && typeof seminar.img === 'string' && seminar.img.trim() !== '' ? seminar.img : ''),
                date: seminar.date || '',
                // 항상 최신 상태로 재계산 (Firestore의 오래된 status 무시)
                status: calculateStatus(seminar.date || '')
            };
        };
        
        // 강의일자(날짜) 기준 최신순 정렬 (맨 앞 = 가장 최신 강의)
        const parseLectureDate = (dateStr) => {
            if (!dateStr) return new Date(0);
            let dateOnly = String(dateStr).trim().split(/[\sT]/)[0].replace(/-/g, '.').replace(/\//g, '.');
            const parts = dateOnly.split('.');
            if (parts.length >= 3) {
                const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
            }
            if (dateOnly.length === 8 && /^\d+$/.test(dateOnly))
                return new Date(parseInt(dateOnly.slice(0, 4), 10), parseInt(dateOnly.slice(4, 6), 10) - 1, parseInt(dateOnly.slice(6, 8), 10));
            return new Date(0);
        };
        const sortByLectureDateDesc = (list) => {
            return [...list].sort((a, b) => parseLectureDate(b.date).getTime() - parseLectureDate(a.date).getTime());
        };
        if (firebaseService && firebaseService.subscribeSeminars) {
            const unsubscribe = firebaseService.subscribeSeminars((seminars) => {
                const normalizedSeminars = seminars.map(normalizeSeminarImages);
                setSeminarsData(sortByLectureDateDesc(normalizedSeminars));
            });
            return () => unsubscribe();
        } else {
            if (firebaseService && firebaseService.getSeminars) {
                (async () => {
                    try {
                        const seminars = await firebaseService.getSeminars();
                        const normalizedSeminars = seminars.map(normalizeSeminarImages);
                        setSeminarsData(sortByLectureDateDesc(normalizedSeminars));
                    } catch (error) {
                        console.error('세미나 로드 오류:', error);
                    }
                })();
            }
        }
    }, []);
    
    // Load posts from Firebase
    useEffect(() => {
        if (firebaseService && firebaseService.subscribePosts) {
            const unsubscribe = firebaseService.subscribePosts((posts) => {
                setCommunityPosts(posts);
            });
            return () => unsubscribe();
        } else {
            if (firebaseService && firebaseService.getPosts) {
                (async () => {
                    try {
                        const posts = await firebaseService.getPosts();
                        setCommunityPosts(posts);
                    } catch (error) {
                        console.error('게시글 로드 오류:', error);
                    }
                })();
            }
        }
    }, []);
    
    // Load restaurants from Firebase
    useEffect(() => {
        if (firebaseService && firebaseService.subscribeRestaurants) {
            const unsubscribe = firebaseService.subscribeRestaurants((restaurants) => {
                setRestaurantsData(restaurants);
            });
            return () => unsubscribe();
        } else {
            if (firebaseService && firebaseService.getRestaurants) {
                (async () => {
                    try {
                        const restaurants = await firebaseService.getRestaurants();
                        setRestaurantsData(restaurants);
                    } catch (error) {
                        console.error('맛집 로드 오류:', error);
                    }
                })();
            }
        }
    }, []);
    
    // Firebase real-time listeners handle data synchronization automatically
    
    // 메뉴 항목 활성/비활성 상태 관리 (로컬 스토리지에서 로드)
    const loadMenuEnabledFromStorage = () => {
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('busan_ycc_menu_enabled');
                const parsed = stored ? JSON.parse(stored) : {};
                // 기본값 설정 (admin.html과 일치)
                return {
                    '홈': parsed['홈'] !== undefined ? parsed['홈'] : true,
                    '소개': parsed['소개'] !== undefined ? parsed['소개'] : true,
                    '프로그램': parsed['프로그램'] !== undefined ? parsed['프로그램'] : true,
                    '부청사 회원': parsed['부청사 회원'] !== undefined ? parsed['부청사 회원'] : true,
                    '커뮤니티': parsed['커뮤니티'] !== undefined ? parsed['커뮤니티'] : true,
                    '후원': parsed['후원'] !== undefined ? parsed['후원'] : true,
                    '부산맛집': parsed['부산맛집'] !== undefined ? parsed['부산맛집'] : true,
                    ...parsed
                };
            }
        } catch (error) {
            
        }
        return {
            '홈': true,
            '소개': true,
            '프로그램': true,
            '부청사 회원': true,
            '커뮤니티': true,
            '후원': true,
            '부산맛집': true
        };
    };

    const [menuEnabled, setMenuEnabled] = useState(loadMenuEnabledFromStorage());

    // 메뉴 명칭 관리 (기본값)
    const defaultMenuNames = {
        '홈': '홈',
        '소개': '소개',
        '프로그램': '프로그램',
        '부청사 회원': '부청사 회원',
        '커뮤니티': '커뮤니티',
        '후원': '후원',
        '부산맛집': '부산맛집'
    };

    // 로컬 스토리지에서 메뉴 명칭 로드
    const loadMenuNamesFromStorage = () => {
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('busan_ycc_menu_names');
                return stored ? JSON.parse(stored) : defaultMenuNames;
            }
        } catch (error) {
            
        }
        return defaultMenuNames;
    };

    // 메뉴 명칭 저장
    const saveMenuNamesToStorage = (menuNames) => {
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.setItem('busan_ycc_menu_names', JSON.stringify(menuNames));
            }
        } catch (error) {
            
        }
    };

    // menuNames 상태 관리 (Firebase 우선, localStorage 폴백)
    const [menuNames, setMenuNames] = useState(() => {
        // 초기값: localStorage에서 로드 (Firebase 구독 전까지 사용)
        return loadMenuNamesFromStorage();
    });
    
    // menuNames는 Settings 구독에서 함께 처리 (중복 방지)
    
    // menuNames 변경 감지 (localStorage 변경 시 자동 업데이트 - Firebase에 없을 때만)
    useEffect(() => {
        // Firebase 구독이 있으면 localStorage 변경은 무시 (Firebase가 우선)
        if (firebaseService && firebaseService.subscribeSettings) {
            return; // Firebase 구독이 있으면 localStorage 이벤트 무시
        }
        
        const handleStorageChange = (e) => {
            if (e.key === 'busan_ycc_menu_names') {
                try {
                    const newMenuNames = e.newValue ? JSON.parse(e.newValue) : defaultMenuNames;
                    setMenuNames(newMenuNames);
                } catch (error) {
                    console.error('메뉴명 파싱 오류:', error);
                }
            }
        };
        
        // localStorage 변경 이벤트 리스너 (다른 탭에서 변경 시)
        window.addEventListener('storage', handleStorageChange);
        
        // 같은 탭에서의 변경 감지를 위한 커스텀 이벤트
        const handleCustomStorageChange = () => {
            const newMenuNames = loadMenuNamesFromStorage();
            setMenuNames(newMenuNames);
        };
        window.addEventListener('menuNamesUpdated', handleCustomStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('menuNamesUpdated', handleCustomStorageChange);
        };
    }, []);

    // 메뉴 순서 관리
    const defaultMenuOrder = ['홈', '소개', '프로그램', '부청사 회원', '커뮤니티', '후원', '부산맛집'];
    
    const loadMenuOrderFromStorage = () => {
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('busan_ycc_menu_order');
                if (stored) {
                    const parsedOrder = JSON.parse(stored);
                    // 저장된 순서와 기본 메뉴를 병합
                    const ordered = parsedOrder.filter(key => defaultMenuOrder.includes(key));
                    const remaining = defaultMenuOrder.filter(key => !parsedOrder.includes(key));
                    return [...ordered, ...remaining];
                }
            }
        } catch (error) {
            console.error('메뉴 순서 로드 실패:', error);
        }
        return defaultMenuOrder;
    };

    const [menuOrder, setMenuOrder] = useState(loadMenuOrderFromStorage());

    // menuOrder가 변경되면 업데이트
    useEffect(() => {
        const handleStorageChange = () => {
            setMenuOrder(loadMenuOrderFromStorage());
        };
        
        // localStorage 변경 감지 (다른 탭에서 변경된 경우)
        window.addEventListener('storage', handleStorageChange);
        
        // 주기적으로 확인 (같은 탭에서 변경된 경우)
        const interval = setInterval(() => {
            const newOrder = loadMenuOrderFromStorage();
            if (JSON.stringify(newOrder) !== JSON.stringify(menuOrder)) {
                setMenuOrder(newOrder);
            }
        }, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [menuOrder]);

    /** 후원 비노출 시 메뉴에서도 제거되도록 */
    const effectiveMenuEnabled = useMemo(() => ({
        ...menuEnabled,
        ...(DONATION_FEATURE_DISABLED ? { '후원': false } : {}),
    }), [menuEnabled]);

    useEffect(() => {
        const handleScroll = () => {
            if (import.meta.env.DEV) {
                fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.jsx:handleScroll',message:'window scroll',data:{scrollY:window.scrollY},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
            }
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 사용자 목록은 Firebase subscribeUsers 또는 첫 번째 useEffect의 loadUsersFromStorage로만 로드 (중복 제거)

    const loadMembersFromCSV = async () => {
        try {
            // CONFIG에서 URL 가져오기
            const csvUrl = CONFIG.SHEET_URLS?.MEMBER || '';
            
            if (!csvUrl) {
                return null;
            }
            
            const csvData = await fetchSheetData(
                csvUrl,
                CONFIG.SHEET_LOADING?.RETRY_ATTEMPTS || 3,
                CONFIG.SHEET_LOADING?.RETRY_DELAY || 1000
            );
            
            if (csvData && csvData.length > 0) {
                // CSV 데이터를 애플리케이션 형식으로 변환
                const members = csvData.map((row, index) => {
                    // 기본 필드 매핑
                    const member = {
                        id: row.id || row.ID || `member_${index + 1}`,
                        name: row.name || row.이름 || row.Name || '',
                        email: row.email || row.Email || row.이메일 || '',
                        phone: row.phone || row.Phone || row.전화번호 || '',
                        phonePublic: false,
                        company: row.company || row.Company || row.회사명 || '',
                        companyPhone: row.companyPhone || row.CompanyPhone || row.회사전화번호 || row.회사번호 || '',
                        companyWebsite: row.companyWebsite || row.CompanyWebsite || row.회사사이트 || row.회사_사이트 || '',
                        businessRegistrationNumber: row.businessRegistrationNumber || row.BusinessRegistrationNumber || row.사업자등록번호 || '',
                        businessType: row.businessType || row.BusinessType || row.사업자유형 || '',
                        businessCategory: row.businessCategory || row.BusinessCategory || row.업종 || '',
                        role: row.role || row.Role || row.직책 || '',
                        status: row.status || row.Status || 'approved',
                        approvalStatus: row.approvalStatus || row.ApprovalStatus || 'approved',
                        memberGrade: row.memberGrade || row.MemberGrade || row.회원등급 || '',
                        img: row.img || row.Img || row.이미지 || row.image || '',
                        createdAt: row.createdAt || row.CreatedAt || row.생성일 || new Date().toISOString()
                    };
                    
                    // JSON 문자열 필드 파싱
                    if (typeof member.img === 'string' && member.img.startsWith('[')) {
                        try {
                            member.img = JSON.parse(member.img)[0] || member.img;
                        } catch (e) {
                            
                        }
                    }
                    
                    return member;
                }).filter(m => m.name && m.name.trim() !== '');
                
                // 승인된 회원만 필터링
                const filteredMembers = filterApprovedMembers(members);
                return filteredMembers;
            }
            return null;
        } catch (error) {
            return null;
        }
    };
    const loadSeminarsFromCSV = async () => {
        try {
            const csvUrl = CONFIG.SHEET_URLS?.SEMINAR || '';
            
            if (!csvUrl) {
                return null;
            }
            
            const csvData = await fetchSheetData(
                csvUrl,
                CONFIG.SHEET_LOADING?.RETRY_ATTEMPTS || 3,
                CONFIG.SHEET_LOADING?.RETRY_DELAY || 1000
            );
            
            if (csvData && csvData.length > 0) {
                const seminars = csvData.map((row, index) => {
                    const seminar = {
                        id: row.id || row.ID || `seminar_${index + 1}`,
                        title: row.title || row.Title || row.제목 || '',
                        category: row.category || row.Category || row.카테고리 || '',
                        date: row.date || row.Date || row.날짜 || '',
                        location: row.location || row.Location || row.장소 || '',
                        locationAddress: row.locationAddress || row.LocationAddress || row.주소 || '',
                        locationLat: row.locationLat ? parseFloat(row.locationLat) : null,
                        locationLng: row.locationLng ? parseFloat(row.locationLng) : null,
                        desc: row.desc || row.Desc || row.설명 || row.description || '',
                        images: [],
                        price: row.price ? parseInt(row.price) : 0,
                        maxParticipants: row.maxParticipants ? parseInt(row.maxParticipants) : 0,
                        currentParticipants: row.currentParticipants ? parseInt(row.currentParticipants) : 0,
                        requiresPayment: row.requiresPayment === 'true' || row.requiresPayment === true,
                        status: calculateStatus(row.date || row.Date || row.날짜 || '')
                    };
                    
                    // 이미지 처리
                    const imgField = row.images || row.Images || row.이미지 || row.image || '';
                    if (imgField) {
                        if (typeof imgField === 'string' && (imgField.startsWith('[') || imgField.startsWith('"'))) {
                            try {
                                seminar.images = JSON.parse(imgField.replace(/^"|"$/g, ''));
                            } catch (e) {
                                
                                seminar.images = [imgField];
                            }
                        } else {
                            seminar.images = [imgField];
                        }
                    }
                    
                    // 첫 번째 이미지를 img 필드로도 설정
                    if (seminar.images.length > 0) {
                        seminar.img = seminar.images[0];
                    }
                    
                    return seminar;
                }).filter(s => s.title && s.title.trim() !== ''); // 제목이 있는 세미나만
                
                
                return seminars;
            } else {
                
            }
            
            return null;
        } catch (error) {
            
            // 에러 발생 시 사용자에게 알림 (선택적)
            // alert('세미나 데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return null;
        }
    };
    
    /**
     * 게시글 데이터 CSV에서 로드
     */
    const loadPostsFromCSV = async () => {
        try {
            // 게시글 CSV URL은 config에 없을 수 있으므로 Google Apps Script API 사용
            // 또는 별도 CSV URL이 있다면 사용
            if (typeof getPostsFromSheet === 'function') {
                
                const posts = await getPostsFromSheet();
                if (posts && posts.length > 0) {
                    
                    return posts;
                }
            }
            
            return null;
        } catch (error) {
            
            return null;
        }
    };

    useEffect(() => {
        const loadCSVData = async () => {
            // Firebase 데이터가 이미 로드되었으면 CSV는 보조로만 사용 (동기화 유지)
            const hasFirebaseData = firebaseService && (firebaseService.subscribeUsers || firebaseService.getUsers);
            
            if (!hasFirebaseData) {
                const csvUrl = CONFIG.SHEET_URLS?.MEMBER || '';
                
                if (csvUrl) {
                    const csvMembers = await loadMembersFromCSV();
                    if (csvMembers && csvMembers.length > 0) {
                        // 이미 loadMembersFromCSV에서 필터링이 적용됨
                        // Firebase 데이터가 없을 때만 CSV 데이터 사용
                        if (membersData.length === 0) {
                            setMembersData(csvMembers);
                        }
                        try {
                            localStorage.setItem('busan_ycc_members', JSON.stringify(csvMembers));
                        } catch {}
                    } else {
                        try {
                            const stored = localStorage.getItem('busan_ycc_members');
                            if (stored) {
                                const members = JSON.parse(stored);
                                if (members && members.length > 0) {
                                    // localStorage에서 로드할 때도 필터링 적용
                                    const filteredMembers = filterApprovedMembers(members);
                                    if (membersData.length === 0) {
                                        setMembersData(filteredMembers);
                                    }
                                }
                            }
                        } catch {}
                    }
                } else {
                    try {
                        const stored = localStorage.getItem('busan_ycc_members');
                        if (stored) {
                            const members = JSON.parse(stored);
                            if (members && members.length > 0) {
                                const filteredMembers = filterApprovedMembers(members);
                                if (membersData.length === 0) {
                                    setMembersData(filteredMembers);
                                }
                            }
                        }
                    } catch (e) {
                        
                    }
                }
            }
        };
        
        loadCSVData();
        
        const cacheDuration = CONFIG.SHEET_LOADING?.CACHE_DURATION || 5 * 60 * 1000;
        
        const intervalId = setInterval(() => {
            loadCSVData();
        }, cacheDuration);
        
        return () => clearInterval(intervalId);
    }, []);
    
    // 세미나 CSV/로컬 로드: Firebase가 없을 때만 사용 (Firebase 단일 소스)
    useEffect(() => {
        const hasFirebaseSeminars = firebaseService && (firebaseService.subscribeSeminars || firebaseService.getSeminars);
        if (hasFirebaseSeminars) return;

        const loadCSVData = async () => {
            const csvUrl = CONFIG.SHEET_URLS?.SEMINAR || '';
            
            if (csvUrl) {
                const csvSeminars = await loadSeminarsFromCSV();
                if (csvSeminars && csvSeminars.length > 0) {
                    setSeminarsData(csvSeminars);
                    // localStorage에도 저장 (캐시용)
                    try {
                        localStorage.setItem('busan_ycc_seminars', JSON.stringify(csvSeminars));
                    } catch (e) {
                        
                    }
                } else {
                    // CSV 로드 실패 시 localStorage 폴백
                    
                    try {
                        const stored = localStorage.getItem('busan_ycc_seminars');
                        if (stored) {
                            const seminars = JSON.parse(stored);
                            // 테스트 세미나 데이터 필터링
                            const filtered = seminars.filter(s => {
                                if (s.id === 1 || s.id === 2 || s.id === 3) return false;
                                const testTitles = [
                                    '2025 상반기 스타트업 투자 트렌드',
                                    '부산 청년 창업가 네트워킹 나이트',
                                    '초기 창업가를 위한 세무/노무 특강'
                                ];
                                if (testTitles.includes(s.title)) return false;
                                return true;
                            });
                            
                            if (filtered.length !== seminars.length) {
                                localStorage.setItem('busan_ycc_seminars', JSON.stringify(filtered));
                                
                            }
                            
                            if (filtered && filtered.length > 0) {
                                setSeminarsData(filtered);
                            }
                        }
                    } catch (e) {}
                }
            } else {
                try {
                    const stored = localStorage.getItem('busan_ycc_seminars');
                    if (stored) {
                        const seminars = JSON.parse(stored);
                        const filtered = seminars.filter(s => {
                            if (s.id === 1 || s.id === 2 || s.id === 3) return false;
                            const testTitles = [
                                '2025 상반기 스타트업 투자 트렌드',
                                '부산 청년 창업가 네트워킹 나이트',
                                '초기 창업가를 위한 세무/노무 특강'
                            ];
                            if (testTitles.includes(s.title)) return false;
                            return true;
                        });
                        if (filtered.length !== seminars.length) {
                            localStorage.setItem('busan_ycc_seminars', JSON.stringify(filtered));
                        }
                        if (filtered && filtered.length > 0) {
                            setSeminarsData(filtered);
                        }
                    }
                } catch (e) {}
            }
        };

        loadCSVData();
        const cacheDuration = CONFIG.SHEET_LOADING?.CACHE_DURATION || 5 * 60 * 1000;
        const intervalId = setInterval(loadCSVData, cacheDuration);
        return () => clearInterval(intervalId);
    }, []);
    
    // 게시글은 Google Apps Script API 사용 (이미 구현됨)

    const handleSignUp = async (userInfo) => {
        if (userInfo.userType === '사업자' && !userInfo.businessRegistrationNumber) {
            return alert('사업자등록번호를 입력해주세요.');
        }

        try {
            if (!authService || !authService.signUp) {
                throw new Error('Firebase Auth가 초기화되지 않았습니다.');
            }
            
            // Check for existing user by email (Firebase 우선)
            let allUsers = [];
            if (firebaseService && firebaseService.getUsers) {
                try {
                    allUsers = await firebaseService.getUsers();
                } catch (e) {
                    allUsers = await loadUsersFromStorage();
                }
            } else {
                allUsers = await loadUsersFromStorage();
            }
            const existingUser = Array.isArray(allUsers) ? allUsers.find(u => {
                if (u.email === userInfo.email) return true;
                if (userInfo.businessRegistrationNumber && u.businessRegistrationNumber && 
                    u.businessRegistrationNumber === userInfo.businessRegistrationNumber) {
                    return true;
                }
                return false;
            }) : null;
            
            if (existingUser) {
                const message = userInfo.businessRegistrationNumber 
                    ? '이미 사용 중인 이메일 또는 사업자등록번호입니다. 로그인을 시도해주세요.'
                    : '이미 사용 중인 이메일입니다. 로그인을 시도해주세요.';
                return alert(message);
            }

            // Create Firebase Auth user
            const user = await authService.signUp(userInfo.email, userInfo.password, {
                    name: userInfo.name,
                    company: userInfo.company || '',
                    role: userInfo.role || '',
                industry: userInfo.businessCategory || userInfo.industry || 'Other',
                userType: userInfo.userType || 'Business',
                    businessType: userInfo.businessType || '',
                    businessCategory: userInfo.businessCategory || '',
                    address: userInfo.address || '',
                    phone: userInfo.phone || '',
                img: userInfo.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name)}&background=random`,
                approvalStatus: 'pending',
                    businessRegistrationNumber: userInfo.businessRegistrationNumber || null,
                isIdentityVerified: false
            });
            
            // Create member data
            const newMember = {
                id: user.uid,
                name: userInfo.name,
                industry: userInfo.businessCategory || userInfo.industry || 'Other',
                role: userInfo.role || '',
                company: userInfo.company || '',
                userType: userInfo.userType,
                businessType: userInfo.businessType || '',
                businessCategory: userInfo.businessCategory || '',
                address: userInfo.address || '',
                phone: userInfo.phone || '',
                email: userInfo.email,
                img: userInfo.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name)}&background=random`,
                approvalStatus: 'pending',
                businessRegistrationNumber: userInfo.businessRegistrationNumber || null,
                isIdentityVerified: false
            };
            
            // Firebase 구독이 있으면 실시간으로 users/membersData 반영되므로 낙관적 업데이트만
            setMembersData(prev => [...prev, newMember]);
            if (!firebaseService?.subscribeUsers) {
                const updatedUsers = await loadUsersFromStorage();
                setUsers(updatedUsers);
            }

            alert("회원가입이 완료되었습니다!\n\n계정 승인 대기 중입니다.\n승인 상태는 마이페이지에서 확인할 수 있습니다.");
            
        } catch (error) {
            
            const errorMessage = translateFirebaseError(error);
            alert(errorMessage);
        }
    };

    const handleLogin = async (id, pw) => {
        try {
            if (!authService || !authService.signIn) {
                throw new Error('Firebase Auth가 초기화되지 않았습니다.');
            }
            
            // Sign in with email and password
            const user = await authService.signIn(id, pw);
            
            // Get user data from Firestore
            const userDoc = await authService.getUserData(user.uid);
            if (!userDoc) {
                throw new Error('사용자 정보를 찾을 수 없습니다.');
            }
            
            setCurrentUser(userDoc);
                setShowLoginModal(false);
            setMyPosts(communityPosts.filter(p => p.author === userDoc.name));
                
            const approvalStatus = userDoc.approvalStatus || 'pending';
                if (approvalStatus === 'pending') {
                alert("로그인 성공!\n\n회원가입 승인 대기 중입니다.");
                } else if (approvalStatus === 'rejected') {
                alert("로그인 성공!\n\n회원가입이 거부되었습니다. 관리자에게 문의해주세요.");
                } else {
                    alert("로그인 성공!");
                }
                
                // pendingView가 있으면 해당 뷰로 이동
                if (pendingView) {
                    setCurrentView(pendingView);
                    setPendingView(null);
                }
                
                return true;
        } catch (error) {
            
            const errorMessage = translateFirebaseError(error);
            alert(errorMessage);
                return false;
        }
    };

    const applySocialLoginResult = useCallback(async (user, userDoc) => {
        setCurrentUser(userDoc);
        setShowLoginModal(false);
        setShowSignUpChoiceModal(false);
        setMyPosts(communityPosts.filter(p => p.author === userDoc.name));
        const hasPhone = (userDoc.phone || userDoc.phoneNumber || '').toString().trim();
        const hasEmail = (userDoc.email || '').toString().trim();
        if (!hasPhone || !hasEmail) {
            setGoogleSignupExtraPhone((userDoc.phone || userDoc.phoneNumber || '').toString().trim());
            setGoogleSignupExtraEmail((userDoc.email || '').toString().trim());
            setGoogleSignupExtraInfoUser(userDoc);
            setShowGoogleSignupExtraInfoModal(true);
            return;
        }
        const approvalStatus = userDoc.approvalStatus || 'pending';
        if (approvalStatus === 'pending') {
            alert("로그인 성공!\n\n회원가입 승인 대기 중입니다.");
        } else if (approvalStatus === 'rejected') {
            alert("로그인 성공!\n\n회원가입이 거부되었습니다. 관리자에게 문의해주세요.");
        } else {
            alert("로그인 성공!");
        }
        if (pendingView) {
            setCurrentView(pendingView);
            setPendingView(null);
        }
    }, [communityPosts, pendingView]);

    const handleKakaoLogin = () => {
        try {
            const base = getApiBaseUrl();
            if (!base) {
                alert('API URL이 설정되지 않았습니다. 환경 변수 VITE_API_URL을 확인해주세요.');
                return;
            }
            const callbackUrl = `${base.replace(/\/$/, '')}/api/auth/kakao/callback`;
            authService.startKakaoLogin(callbackUrl);
        } catch (error) {
            alert(error?.message || '카카오 로그인을 시작할 수 없습니다.');
        }
    };

    // 카카오 로그인 콜백: URL 해시에 auth=kakao&token= 있으면 커스텀 토큰으로 로그인 후 결과 적용. p 있으면 프로필(name, phone, email) 자동 기입.
    useEffect(() => {
        const hash = location.hash.slice(1);
        if (!hash) return;
        const params = new URLSearchParams(hash);
        if (params.get('auth') !== 'kakao') return;
        let token = params.get('token');
        if (token) try { token = decodeURIComponent(token); } catch (_) {}
        if (!token || !authService?.signInWithKakaoToken) return;
        let profile = null;
        const pRaw = params.get('p');
        if (pRaw) {
            try {
                const decoded = decodeURIComponent(pRaw);
                const base64 = decoded.replace(/-/g, '+').replace(/_/g, '/');
                const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
                const jsonStr = atob(padded);
                profile = JSON.parse(jsonStr);
            } catch (_) {}
        }
        (async () => {
            try {
                const user = await authService.signInWithKakaoToken(token);
                let userDoc = await authService.getUserData(user.uid);
                if (!userDoc && firebaseService?.createUser) {
                    const name = (profile?.name && profile.name.trim()) || '카카오 사용자';
                    const phone = (profile?.phone && String(profile.phone).trim()) || '';
                    const email = (profile?.email && String(profile.email).trim()) || '';
                    await firebaseService.createUser({
                        uid: user.uid,
                        email,
                        name,
                        phone,
                        approvalStatus: 'pending',
                        createdAt: new Date().toISOString()
                    });
                    userDoc = await authService.getUserData(user.uid);
                }
                if (userDoc) {
                    await applySocialLoginResult(user, userDoc);
                }
            } catch (e) {
                alert(e?.message || '카카오 로그인 처리에 실패했습니다.');
            }
            window.history.replaceState(null, '', location.pathname + location.search);
        })();
    }, [location.hash, authService, firebaseService, applySocialLoginResult]);

    const handleLogout = async () => {
        try {
            if (authService && authService.signOut) {
                await authService.signOut();
            }
        setCurrentUser(null);
        setCurrentView('home');
        setMySeminars([]);
        setMyFoods([]);
        setMyPosts([]);
            alert("Logged out successfully.");
        } catch (error) {
            alert('Logout failed');
        }
    };

    /** 로고 클릭 시 홈으로 강제 이동 (모달·메뉴 닫기, URL 리셋) */
    const onGoHome = useCallback(() => {
        navigate('/', { replace: true });
        setCurrentView('home');
        setShowLoginModal(false);
        setShowSignUpModal(false);
        setShowSignUpChoiceModal(false);
        setIsMenuOpen(false);
        setIsPopupApplyModalOpen(false);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [navigate]);
    
    // 음식관련사업자 권한 체크 함수
    const isFoodBusinessOwner = (user) => {
        if (!user) return false;
        const businessCategory = user.businessCategory || user.industry || '';
        const foodCategories = [
            '요식업 (한식)',
            '요식업 (양식)',
            '요식업 (중식)',
            '요식업 (일식)',
            '요식업 (카페)'
        ];
        return foodCategories.includes(businessCategory);
    };
    
    // 맛집 등록 핸들러
    const handleRestaurantCreate = async (restaurantData) => {
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            return false;
        }
        if (!isFoodBusinessOwner(currentUser)) {
            alert('음식관련사업자만 맛집을 등록할 수 있습니다.');
            return false;
        }
        
        try {
            const restaurantToSave = {
                ...restaurantData,
                ownerId: currentUser.id || currentUser.uid,
                ownerName: currentUser.name
            };
            
            if (firebaseService && firebaseService.createRestaurant) {
                await firebaseService.createRestaurant(restaurantToSave);
                alert('맛집이 등록되었습니다.');
                return true;
            } else {
                alert('서비스에 연결할 수 없습니다.');
                return false;
            }
        } catch (error) {
            console.error('Error creating restaurant:', error);
            alert('맛집 등록에 실패했습니다. 다시 시도해주세요.');
            return false;
        }
    };
    
    // 맛집 수정 핸들러
    const handleRestaurantUpdate = async (restaurantId, restaurantData) => {
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            return false;
        }
        
        const restaurant = restaurantsData.find(r => r.id === restaurantId);
        if (!restaurant) {
            alert('맛집을 찾을 수 없습니다.');
            return false;
        }
        
        if (restaurant.ownerId !== (currentUser.id || currentUser.uid)) {
            alert('본인이 등록한 맛집만 수정할 수 있습니다.');
            return false;
        }
        
        try {
            if (firebaseService && firebaseService.updateRestaurant) {
                await firebaseService.updateRestaurant(restaurantId, restaurantData);
                alert('맛집 정보가 수정되었습니다.');
                return true;
            } else {
                alert('서비스에 연결할 수 없습니다.');
                return false;
            }
        } catch (error) {
            console.error('Error updating restaurant:', error);
            alert('맛집 수정에 실패했습니다. 다시 시도해주세요.');
            return false;
        }
    };
    
    // 맛집 삭제 핸들러
    const handleRestaurantDelete = async (restaurantId) => {
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            return false;
        }
        
        const restaurant = restaurantsData.find(r => r.id === restaurantId);
        if (!restaurant) {
            alert('맛집을 찾을 수 없습니다.');
            return false;
        }
        
        if (restaurant.ownerId !== (currentUser.id || currentUser.uid)) {
            alert('본인이 등록한 맛집만 삭제할 수 있습니다.');
            return false;
        }
        
        if (!confirm('정말로 이 맛집을 삭제하시겠습니까?')) {
            return false;
        }
        
        try {
            if (firebaseService && firebaseService.deleteRestaurant) {
                await firebaseService.deleteRestaurant(restaurantId);
                alert('맛집이 삭제되었습니다.');
                return true;
            } else {
                alert('서비스에 연결할 수 없습니다.');
                return false;
            }
        } catch (error) {
            console.error('Error deleting restaurant:', error);
            alert('맛집 삭제에 실패했습니다. 다시 시도해주세요.');
            return false;
        }
    };
    
    const handleWithdraw = async () => {
         if (!currentUser) return;
         const userId = currentUser.id || currentUser.uid;

         // 1) Auth 삭제 먼저 (실패 시 Firestore 삭제하지 않음 → 재가입 가능하도록)
         if (authService && authService.deleteCurrentUser) {
             try {
                 await authService.deleteCurrentUser();
             } catch (err) {
                 const code = err?.code || err?.message || '';
                 if (code === 'auth/requires-recent-login') {
                     alert('보안을 위해 다시 로그인한 뒤 탈퇴를 시도해 주세요.');
                 } else {
                     alert('계정 삭제에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.');
                 }
                 return;
             }
         }

         // 2) Firestore 사용자 문서 삭제 (Firebase 사용 시)
         if (firebaseService && firebaseService.deleteUser && userId) {
             try {
                 await firebaseService.deleteUser(userId);
             } catch (err) {
                 console.error('Firestore 사용자 삭제 오류:', err);
             }
         }

         // 3) 로컬 상태 정리: 세미나 후기와 사진은 유지, 나머지 게시글만 정리
         const updatedPosts = communityPosts.filter(p => {
             if (p.category === '프로그램 후기' && p.author === currentUser.name) return true;
             return p.author !== currentUser.name;
         });
         setCommunityPosts(updatedPosts);

         const updatedUsers = users.filter(u => u.id !== currentUser.id && u.uid !== currentUser.uid);
         setUsers(updatedUsers);
         saveUsersToStorage(updatedUsers);

         const updatedMembers = membersData.filter(m => m.name !== currentUser.name);
         setMembersData(updatedMembers);

         handleLogout();
         alert("회원 탈퇴가 완료되었습니다.\n세미나 후기와 사진은 유지됩니다.");
    };

    /** 결제 요청 (Payment Service: 모바일/CEP·UXP는 리다이렉트, PC는 표준 결제) */
    const requestPortOnePayment = (seminar, applicationData, onSuccess, onFail, overrideCustomer) => {
        const amount = Number(seminar?.applicationFee) || 0;
        if (amount <= 0) {
            if (onFail) onFail();
            return;
        }
        let phoneNumber = overrideCustomer?.phoneNumber?.trim() || (currentUser?.phone || currentUser?.phoneNumber || '').toString().trim();
        let email = overrideCustomer?.email?.trim() || (currentUser?.email || '').toString().trim();
        if (!phoneNumber || !email) {
            setPaymentInfoPhone((currentUser?.phone || currentUser?.phoneNumber || '').toString().trim());
            setPaymentInfoEmail((currentUser?.email || '').toString().trim());
            setPendingPaymentContext({ seminar, applicationData, onSuccess, onFail });
            setPaymentInfoModalOpen(true);
            return;
        }
        const customer = {
            fullName: (overrideCustomer?.fullName || currentUser?.name || '').toString().trim() || '구매자',
            phoneNumber,
            email
        };
        paymentServiceRequestPayment({
            seminar,
            applicationData,
            customer,
            apiBaseUrl: getApiBaseUrl(),
            userId: currentUser?.id,
            onSuccess,
            onFail
        });
    };

    const handleSeminarApply = async (seminar, applicationData = null) => {
        if (!currentUser) { alert("로그인이 필요한 서비스입니다."); return false; }
        if (mySeminars.find(s => s.id === seminar.id)) { alert("이미 신청한 세미나입니다."); return false; }
        if (seminar.status === '종료') { alert("종료된 프로그램입니다."); return false; }
        const is정모 = (seminar.title || '').includes('정모');
        const max = Number(seminar.maxParticipants ?? seminar.capacity) || 0;
        const current = Number(seminar.currentParticipants) || 0;
        if (!is정모 && max > 0 && current >= max) {
            alert("정원이 마감되었습니다.");
            return false;
        }
        // 신청 정보 저장
        const application = {
            id: Date.now().toString(),
            seminarId: seminar.id,
            userId: currentUser.id,
            userName: currentUser.name,
            userEmail: currentUser.email,
            userPhone: currentUser.phone || '',
            participationPath: applicationData?.participationPath || '',
            applyReason: applicationData?.applyReason || '',
            preQuestions: applicationData?.preQuestions || '',
            mealAfter: applicationData?.mealAfter || '',
            privacyAgreed: applicationData?.privacyAgreed === true,
            reason: [applicationData?.participationPath, applicationData?.applyReason].filter(Boolean).join(' / ') || '',
            questions: [applicationData?.preQuestions].filter(Boolean),
            appliedAt: new Date().toISOString()
        };
        
        // Google Sheets에 저장
        if (typeof addSeminarApplicationToSheet === 'function') {
            try {
                const result = await addSeminarApplicationToSheet(application);
                if (!result.success) {
                    
                    alert('신청 저장에 실패했습니다. 다시 시도해주세요.');
                    return false;
                }
            } catch (error) {
                
                // 오류 발생 시에도 localStorage에 저장 (폴백)
            }
        }
        
        // localStorage에도 저장 (폴백용)
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const storageKey = 'busan_ycc_seminar_applications';
                const existingApplications = JSON.parse(localStorage.getItem(storageKey) || '[]');
                existingApplications.push(application);
                localStorage.setItem(storageKey, JSON.stringify(existingApplications));
            }
        } catch (error) {
            
        }
        
        // Firestore에 신청 정보 저장
        try {
            if (firebaseService && firebaseService.createApplication) {
                await firebaseService.createApplication({
                    seminarId: seminar.id,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    userPhone: currentUser.phone || '',
                    participationPath: applicationData?.participationPath || '',
                    applyReason: applicationData?.applyReason || '',
                    preQuestions: applicationData?.preQuestions || '',
                    mealAfter: applicationData?.mealAfter || '',
                    privacyAgreed: applicationData?.privacyAgreed === true,
                    reason: [applicationData?.participationPath, applicationData?.applyReason].filter(Boolean).join(' / ') || '',
                    questions: [applicationData?.preQuestions].filter(Boolean),
                    appliedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Firestore 신청 저장 실패:', error);
            // 실패해도 다른 저장소에 저장은 완료된 것으로 처리
        }
        
        // Firestore의 seminar 문서 업데이트 (currentParticipants 증가)
        try {
            if (firebaseService && firebaseService.updateSeminar) {
                await firebaseService.updateSeminar(seminar.id, {
                    currentParticipants: (seminar.currentParticipants || 0) + 1
                });
            }
        } catch (error) {
            console.error('참가자 수 업데이트 실패:', error);
            // 실패해도 신청은 완료된 것으로 처리
        }
        
        const updatedMySeminars = [...mySeminars, seminar];
        setMySeminars(updatedMySeminars);
        
        // 신청 후 알람 체크
        if (currentUser && currentUser.id) {
            checkProgramAlerts(updatedMySeminars, currentUser.id);
        }
        
        alert("신청이 완료되었습니다.");
        return true;
    };

    /** 결제 완료 처리 공통 함수. 리다이렉트 복귀 시 또는 표준 결제 성공 시 사용 */
    const completePaymentSuccess = async (seminar, applicationData, { afterSuccess } = {}) => {
        const ok = await handleSeminarApply(seminar, applicationData);
        if (ok && afterSuccess) afterSuccess();
        return ok;
    };

    // 후기 작성 핸들러
    const handleWriteReview = (seminar) => {
        if (!currentUser) {
            alert("로그인이 필요한 서비스입니다.");
            setShowLoginModal(true);
            return;
        }
        
        // 참여자인지 확인
        const applications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
        const hasApplied = applications.some(app => 
            String(app.seminarId) === String(seminar.id) && String(app.userId) === String(currentUser?.id)
        );
        
        if (!hasApplied) {
            alert("참여한 프로그램에만 후기를 작성할 수 있습니다.");
            return;
        }
        
        // 후기 작성할 프로그램 설정 및 커뮤니티 페이지로 이동
        setReviewSeminar(seminar);
        setCurrentView('community');
    };

    // 팝업 닫기 및 표시 기록 함수
    const closePopupAndMarkAsShown = () => {
        setPopupPrograms([]);
        try {
            localStorage.setItem('busan_ycc_popup_shown', 'true');
        } catch (e) {
            
        }
    };
    
    if (typeof window !== 'undefined') {
        window.resetPopupShown = () => {
            try {
                localStorage.removeItem('busan_ycc_popup_shown');
                if (import.meta.env.MODE === 'development') {
                    console.log('[개발] 프로그램 팝업 표시 기록 초기화됨. 새로고침 후 홈에서 다시 뜹니다.');
                }
            } catch {}
        };
    }
    
    // 팝업에서 신청하기 버튼 클릭 핸들러
    const handlePopupApply = async (program) => {
        if (!currentUser) {
            setShowLoginModal(true);
            closePopupAndMarkAsShown();
            return;
        }
        
        // 이미 신청했는지 확인
        const checkApplication = async () => {
            // Google Sheets에서 확인 시도
            if (typeof getSeminarApplicationsFromSheet === 'function') {
                try {
                    const applications = await getSeminarApplicationsFromSheet();
                    const hasApplied = applications.some(app => 
                        app.seminarId === program.id && app.userId === currentUser.id
                    );
                    if (hasApplied) {
                        alert('이미 신청한 프로그램입니다.');
                        return true;
                    }
                } catch (error) {
                    
                }
            }
            
            // localStorage에서 확인 (폴백)
            try {
                if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                    const applications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                    const hasApplied = applications.some(app => 
                        app.seminarId === program.id && app.userId === currentUser.id
                    );
                    if (hasApplied) {
                        alert('이미 신청한 프로그램입니다.');
                        return true;
                    }
                }
            } catch (error) {
                
            }
            return false;
        };
        
        const hasApplied = await checkApplication();
        if (hasApplied) {
            closePopupAndMarkAsShown();
            return;
        }
        
        // 팝업 닫기 후 프로그램 신청 페이지로 이동
        closePopupAndMarkAsShown();
        navigate(`/program/apply/${program.id}`);
    };

    // 팝업 신청 제출 (유료 프로그램이면 결제 후 신청)
    const handlePopupApplySubmit = () => {
        if (!popupApplicationData.participationPath) {
            alert('참여 경로를 선택해주세요.');
            return;
        }
        if (!popupApplicationData.mealAfter) {
            alert('강연 후 식사 여부를 선택해주세요.');
            return;
        }
        if (!popupApplicationData.privacyAgreed) {
            alert('개인정보 동의에 체크해주세요.');
            return;
        }
        const fee = applySeminarFromPopup?.applicationFee != null ? Number(applySeminarFromPopup.applicationFee) : 0;
        const isPaid = fee > 0;
        if (isPaid) {
            requestPortOnePayment(applySeminarFromPopup, popupApplicationData, async () => {
                const success = await handleSeminarApply(applySeminarFromPopup, popupApplicationData);
                if (success) {
                    generateAndDownloadCalendar(applySeminarFromPopup);
                    setIsPopupApplyModalOpen(false);
                    closePopupAndMarkAsShown();
                    setApplySeminarFromPopup(null);
                    setPopupApplicationData({ participationPath: '', applyReason: '', preQuestions: '', mealAfter: '', privacyAgreed: false });
                }
            }, () => {
                alert('결제가 취소되었거나 실패했습니다.');
            });
            return;
        }
        (async () => {
            const success = await handleSeminarApply(applySeminarFromPopup, popupApplicationData);
            if (success) {
                generateAndDownloadCalendar(applySeminarFromPopup);
                setIsPopupApplyModalOpen(false);
                closePopupAndMarkAsShown();
                setApplySeminarFromPopup(null);
                setPopupApplicationData({ participationPath: '', applyReason: '', preQuestions: '', mealAfter: '', privacyAgreed: false });
            }
        })();
    };

    // 문의하기 저장 함수
    const handleInquirySubmit = async (inquiryData) => {
        const newInquiry = {
            id: Date.now().toString(),
            userId: currentUser?.id || null,
            userName: inquiryData.name,
            userEmail: inquiryData.email,
            userPhone: inquiryData.phone || '',
            subject: inquiryData.title,
            message: inquiryData.content,
            createdAt: new Date().toISOString()
        };
        
        // Google Sheets에 저장
        if (typeof addInquiryToSheet === 'function') {
            try {
                const result = await addInquiryToSheet(newInquiry);
                if (!result.success) {
                    
                    alert('문의 등록에 실패했습니다. 다시 시도해주세요.');
                    return;
                }
            } catch (error) {
                
                // 오류 발생 시에도 localStorage에 저장 (폴백)
            }
        }
        
        // localStorage에도 저장 (폴백용)
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const existingInquiries = JSON.parse(localStorage.getItem('busan_ycc_inquiries') || '[]');
                const updatedInquiries = [...existingInquiries, newInquiry];
                localStorage.setItem('busan_ycc_inquiries', JSON.stringify(updatedInquiries));
            }
        } catch (error) {
            
        }
        
        alert('문의하기가 등록되었습니다. 관리자가 확인 후 답변드리겠습니다.');
        setIsInquiryModalOpen(false);
    };

    // .ics 파일 생성 및 다운로드
    const generateAndDownloadCalendar = (program) => {
        if (!program.date) {
            
            return;
        }
        
        // 날짜 파싱 (YYYY.MM.DD 또는 YYYY-MM-DD 형식)
        const dateMatch = program.date.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
        if (!dateMatch) {
            
            return;
        }
        
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // 0-based
        const day = parseInt(dateMatch[3]);
        
        // 프로그램 시작 시간 (기본값: 오전 10시)
        const startDate = new Date(year, month, day, 10, 0, 0);
        // 프로그램 종료 시간 (기본값: 시작 시간 + 2시간)
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 2);
        
        // .ics 형식으로 변환
        const formatICSDate = (date) => {
            return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
        };
        
        // 제목과 설명에서 특수문자 이스케이프
        const escapeICS = (text) => {
            if (!text) return '';
            return text.replace(/\\/g, '\\\\')
                       .replace(/,/g, '\\,')
                       .replace(/;/g, '\\;')
                       .replace(/\n/g, '\\n');
        };
        
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//부산청년사업가들//프로그램 일정//KO
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${program.id}@bcsa.co.kr
DTSTAMP:${formatICSDate(new Date())}Z
DTSTART:${formatICSDate(startDate)}Z
DTEND:${formatICSDate(endDate)}Z
SUMMARY:${escapeICS(program.title)}
DESCRIPTION:${escapeICS(program.desc || '')}
LOCATION:${escapeICS(program.location || '')}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:프로그램 시작 하루 전 알림
TRIGGER:-P1DT0H0M0S
END:VALARM
END:VEVENT
END:VCALENDAR`;
        
        // Blob 생성 및 다운로드
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${program.title.replace(/[^\w\s가-힣]/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('캘린더 파일이 다운로드되었습니다. 파일을 열어 캘린더에 추가해주세요.');
    };

    const handleSeminarCancel = async (seminarId) => {
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        const base = (getApiBaseUrl() || '').replace(/\/$/, '');
        if (!base) {
            alert('취소 요청을 처리할 수 없습니다. API 주소를 확인해 주세요.');
            return;
        }
        try {
            const res = await fetch(`${base}/api/payment/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id || currentUser.uid,
                    seminarId
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.message || data?.error || '취소 처리에 실패했습니다.';
                alert(msg === 'application_not_found' ? '해당 신청 내역을 찾을 수 없습니다.' : `취소 실패: ${msg}. 이메일로 문의해 주세요.`);
                return;
            }
            if (data.cancelled) {
                setMySeminars(prev => prev.filter(s => String(s.id) !== String(seminarId)));
                alert('세미나 신청이 취소되었습니다. 환불은 영업일 기준 3~5일 내 처리됩니다.');
            } else {
                alert('취소 처리에 실패했습니다. 이메일로 문의해 주세요.');
            }
        } catch (err) {
            console.error('Seminar cancel error', err);
            alert('취소 처리 중 오류가 발생했습니다. 이메일로 문의해 주세요.');
        }
    };

    const handleUpdateProfile = async (updatedData) => {
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        try {
            if (firebaseService && firebaseService.updateUser) {
                const userId = currentUser.id || currentUser.uid;
                if (!userId) throw new Error('사용자 ID를 찾을 수 없습니다.');
                await firebaseService.updateUser(userId, updatedData);
                const newCurrentUser = { ...currentUser, ...updatedData };
                setCurrentUser(newCurrentUser);
                try { saveCurrentUserToStorage(newCurrentUser); } catch (e) {}
                alert("프로필이 수정되었습니다.");
                return;
            }

            // Firebase 없을 때만 로컬 스토리지
            const storedUsers = loadUsersFromStorage();
            const userIndex = storedUsers.findIndex(u => 
                u.id === currentUser.id || 
                u.impUid === currentUser.impUid ||
                u.verifiedPhone === currentUser.verifiedPhone
            );

            if (userIndex === -1) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            const updatedUser = {
                ...storedUsers[userIndex],
                ...updatedData,
                updatedAt: new Date().toISOString()
            };

            storedUsers[userIndex] = updatedUser;
            saveUsersToStorage(storedUsers);
            setCurrentUser(updatedUser);
            saveCurrentUserToStorage(updatedUser);
            setUsers(storedUsers);
            alert("프로필이 수정되었습니다.");
        } catch (error) {
            alert(`프로필 수정 실패: ${error.message}`);
        }
    };

    const handleSearch = () => {
        if (!searchKeyword && !searchStatus && !searchCategory && (!searchDistrict || searchDistrict === '전체')) {
            setSearchResults(seminarsData);
            setIsSearchExpanded(true);
            return;
        }
        const results = seminarsData.filter(seminar => {
            const text = (seminar.title + seminar.desc).toLowerCase();
            const matchKeyword = !searchKeyword || text.includes(searchKeyword.toLowerCase());
            const matchStatus = !searchStatus || seminar.status === searchStatus;
            const matchCategory = !searchCategory || seminar.category === searchCategory;
            const loc = (seminar.location || seminar.locationAddress || '').toString();
            const matchDistrict = !searchDistrict || searchDistrict === '전체' || loc.includes(searchDistrict);
            return matchKeyword && matchStatus && matchCategory && matchDistrict;
        });
        setSearchResults(results);
        setIsSearchExpanded(true);
    };

    const handleCommunityCreate = async (newPost) => {
        // 글 작성 시 로그인 확인
        if (!currentUser) {
            alert("로그인이 필요합니다.");
            return;
        }
        // 게시글 데이터 준비 (Firebase는 자체 ID를 생성하므로 id 필드 제거)
        const { id, ...postDataWithoutId } = newPost;
        
        // undefined 값 제거 및 데이터 정리
        const cleanPostData = Object.keys(postDataWithoutId).reduce((acc, key) => {
            const value = postDataWithoutId[key];
            // undefined가 아닌 값만 포함
            if (value !== undefined) {
                // 함수나 복잡한 객체는 제외
                if (typeof value !== 'function') {
                    acc[key] = value;
                }
            }
            return acc;
        }, {});
        
        const post = { 
            ...cleanPostData,
            date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), 
            views: 0, 
            reply: null, 
            author: currentUser ? currentUser.name : '익명',
            authorId: currentUser ? (currentUser.id || currentUser.uid || null) : null,
            likes: newPost.likes || 0,
            comments: newPost.comments || []
        };
        
        // Save to Firebase
        if (firebaseService && firebaseService.createPost) {
            try {
                const postId = await firebaseService.createPost(post);
                // Firebase에서 반환된 ID를 사용하여 게시글 업데이트
                const savedPost = { ...post, id: postId };
                setCommunityPosts([savedPost, ...communityPosts]);
                if(currentUser) setMyPosts([savedPost, ...myPosts]);
                alert('게시글이 등록되었습니다.');
            } catch (error) {
                const errorMessage = translateFirebaseError(error);
                alert(`게시글 저장에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            // Firebase service not available, use local ID
            const maxId = communityPosts.length > 0 ? Math.max(...communityPosts.map(p => p.id || 0)) : 0;
            const localPost = { ...post, id: maxId + 1 };
            setCommunityPosts([localPost, ...communityPosts]);
            if(currentUser) setMyPosts([localPost, ...myPosts]);
            alert('게시글이 등록되었습니다.');
        }
    };
    const handleCommunityUpdate = async (id, updatedPost) => {
        // Update in Firebase
        if (firebaseService && firebaseService.updatePost) {
            try {
                await firebaseService.updatePost(id, updatedPost);
                // 상태 업데이트: 기존 데이터와 병합하여 업데이트
                const updatedPostData = { ...updatedPost };
                setCommunityPosts(communityPosts.map(p => p.id === id ? { ...p, ...updatedPostData } : p));
                setMyPosts(myPosts.map(p => p.id === id ? { ...p, ...updatedPostData } : p));
                alert('게시글이 수정되었습니다.');
                // 모달 닫기 (CommunityView에서 사용, MyPageView는 자체적으로 처리)
                setIsEditModalOpen(false);
                setEditingPost(null);
            } catch (error) {
                console.error('게시글 수정 오류:', error);
                const errorMessage = translateFirebaseError(error);
                alert(`게시글 수정에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            // Firebase service not available, update locally
            const updatedPostData = { ...updatedPost };
            setCommunityPosts(communityPosts.map(p => p.id === id ? { ...p, ...updatedPostData } : p));
            setMyPosts(myPosts.map(p => p.id === id ? { ...p, ...updatedPostData } : p));
            alert('게시글이 수정되었습니다.');
            // 모달 닫기 (CommunityView에서 사용, MyPageView는 자체적으로 처리)
            setIsEditModalOpen(false);
            setEditingPost(null);
        }
    };
    
    const handleCommunityDelete = async (id) => {
        if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) {
            return;
        }
        
        // Delete from Firebase
        if (firebaseService && firebaseService.deletePost) {
            try {
                await firebaseService.deletePost(id);
                setCommunityPosts(communityPosts.filter(p => p.id !== id));
                setMyPosts(myPosts.filter(p => p.id !== id));
                alert('게시글이 삭제되었습니다.');
            } catch (error) {
                
                const errorMessage = translateFirebaseError(error);
                alert(`게시글 삭제에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            // Firebase service not available, delete locally
            setCommunityPosts(communityPosts.filter(p => p.id !== id));
            setMyPosts(myPosts.filter(p => p.id !== id));
            alert('게시글이 삭제되었습니다.');
        }
    };

    const handleNotifyAdmin = (notification) => {
        // 건의사항 등록 알림 (관리자는 admin.html에서 확인 가능)
        alert("건의사항이 등록되었습니다. 관리자에게 전달되었습니다.");
    };


    
    // 모바일 메뉴: 모달 형태로 최상단 노출, PC와 동일하게 menuOrder·menuEnabled 기준으로 표시
    const MEMBERS_ONLY_MENUS = ['부청사 회원', '커뮤니티'];
    const MobileMenu = ({ isOpen, onClose, onNavigate, menuEnabled, menuNames, menuOrder, currentUser }) => {
        if (!isOpen) return null;
        const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.uid));
        const visibleItems = (menuOrder || []).filter(item => menuEnabled[item] || MEMBERS_ONLY_MENUS.includes(item));
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
                <div className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-xl relative flex flex-col items-center justify-center py-10 px-4" style={{ backgroundColor: '#ffffff', opacity: 1, touchAction: 'manipulation' }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="메뉴 닫기" className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-600 bg-white rounded-full touch-manipulation z-[110] hover:bg-gray-100 hover:text-gray-800 shadow-md transition-colors" style={{ opacity: 1 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}><Icons.X size={22} className="text-current"/></button>
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
                            <a href="https://open.kakao.com/o/gMWryRA" target="_blank" rel="noopener noreferrer" className={isLoggedIn ? 'w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors' : 'mobile-menu-kakao-glow w-11 h-11 rounded-full flex items-center justify-center text-gray-900'} style={isLoggedIn ? { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : undefined} aria-label="부청사 오픈채팅방">
                                <Icons.MessageSquare className="w-5 h-5" />
                            </a>
                            {!isLoggedIn && (
                                <a href="https://open.kakao.com/o/gMWryRA" target="_blank" rel="noopener noreferrer" className="mobile-menu-speech-bubble" aria-label="부청사 단톡방으로 이동">
                                    부청사 단톡방으로 이동
                                </a>
                            )}
                        </div>
                        <a href="https://www.instagram.com/businessmen_in_busan" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} aria-label="부청사 인스타그램">
                            <Icons.Instagram className="w-5 h-5" />
                        </a>
                        <a href="https://www.youtube.com/@businessmen_in_busan" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} aria-label="부청사 유튜브">
                            <Icons.Youtube className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </div>
            </ModalPortal>
        );
    };

    const handleNavigation = (item) => {
        if (item === '후원' && DONATION_FEATURE_DISABLED) {
            alert('준비중인 서비스입니다.');
            return;
        }
        // 비활성화된 메뉴 클릭 시 준비중 알림
        if (!menuEnabled[item]) {
            alert('준비중인 서비스입니다.');
            return;
        }
        
        if (item === '홈') { 
            setCurrentView('home'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '소개') { 
            setCurrentView('about'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '프로그램') { 
            setCurrentView('allSeminars'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '부청사 회원') { 
            if (!currentUser) {
                alert('로그인이 필요한 서비스입니다.');
                setPendingView('allMembers');
                setShowLoginModal(true);
                return;
            }
            setCurrentView('allMembers'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '커뮤니티') { 
            if (!currentUser) {
                alert('로그인이 필요한 서비스입니다.');
                setPendingView('community'); // 로그인 후 커뮤니티로 이동할 의도 저장
                setShowLoginModal(true);
                return;
            }
            setCurrentView('community'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '후원') { 
            setCurrentView('donation'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '부산맛집') { 
            setCurrentView('restaurants'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else {
            // 처리되지 않는 메뉴 항목에 대한 fallback
            console.error(`[Navigation] 처리되지 않는 메뉴 항목: "${item}"`);
            console.warn('[Navigation] 사용 가능한 메뉴:', defaultMenuOrder);
            alert(`"${item}" 메뉴는 아직 준비 중입니다.`);
            return;
        }
    };

    const getNavClass = (item) => {
        const baseClass = "nav-item px-3 py-2 rounded-full text-[19px] font-medium text-gray-600 hover:text-brand";
        let isActive = false;
        if (item === '홈' && currentView === 'home') isActive = true;
        else if (item === '소개' && currentView === 'about') isActive = true;
        else if (item === '프로그램' && currentView === 'allSeminars') isActive = true;
        else if (item === '부청사 회원' && currentView === 'allMembers') isActive = true;
        else if (item === '커뮤니티' && (currentView === 'community' || currentView === 'notice')) isActive = true;
        else if (item === '후원' && currentView === 'donation') isActive = true;
        else if (item === '부산맛집' && (currentView === 'restaurants' || currentView === 'restaurantDetail' || currentView === 'restaurantForm')) isActive = true;
        return `${baseClass} ${isActive ? 'active' : ''}`;
    }

    const renderView = () => {
        try {
            if (location.pathname === '/payment/result') {
                return <PaymentResultView onComplete={completePaymentSuccess} />;
            }
            if (location.pathname === '/signup') {
                return (
                    <SignUpPage
                        onSignUp={(userData) => {
                            setMembersData(prev => [...(prev || []), { ...userData, id: userData.uid }]);
                        }}
                    />
                );
            }
            if (location.pathname === '/privacy') {
                return <PrivacyPolicyView onBack={() => navigate('/')} />;
            }
            if (location.pathname === '/terms') {
                return <TermsOfServiceView onBack={() => navigate('/')} />;
            }
            if (location.pathname === '/refund') {
                return <RefundPolicyView onBack={() => navigate('/')} content={content} />;
            }
            // 프로그램 신청 전용 페이지 (URL: /program/apply/:programId)
            const programApplyMatch = location.pathname.match(/^\/program\/apply\/([^/]+)/);
            if (programApplyMatch) {
                const programId = programApplyMatch[1];
                const safeSeminars = Array.isArray(seminarsData) ? seminarsData : [];
                const isTestRoute = programId === 'test';
                const program = isTestRoute
                    ? {
                        id: 'test',
                        title: '자영업자들을 위한 릴스 편집특강(소개편)',
                        date: '2026.03.15 14:00',
                        location: '부산 부산진구 부전동 521-1',
                        status: '모집중',
                        category: '교육/세미나',
                        applicationFee: 20000,
                        desc: '정원 30명, 강의료 5만원 테스트용 프로그램입니다. 청년 사업가들을 위한 실전 비즈니스 인사이트를 공유합니다.',
                        maxParticipants: 30,
                        currentParticipants: 0,
                        images: ['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80'],
                    }
                    : safeSeminars.find(s => String(s.id) === String(programId));
                const canViewWithoutLogin = isTestRoute;
                if (!currentUser && !canViewWithoutLogin) {
                    return (
                        <div className="pt-32 pb-20 px-4 min-h-screen bg-soft">
                            <div className="container mx-auto max-w-2xl">
                                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                                    <Icons.AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-dark mb-2">로그인이 필요합니다</h2>
                                    <p className="text-gray-600 mb-2">프로그램 신청은 회원가입 후 가능합니다.</p>
                                    <p className="text-gray-600 mb-6">회원이시면 로그인해 주세요.</p>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button type="button" onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">로그인</button>
                                        <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 border-2 border-brand text-brand font-bold rounded-xl hover:bg-brand/5">돌아가기</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <ProgramApplyView
                        program={program}
                        currentUser={isTestRoute ? null : currentUser}
                        isTestPage={isTestRoute}
                        onBack={() => navigate(-1)}
                        onApply={isTestRoute
                            ? async () => { alert('테스트용 프로그램입니다. 실제 신청은 프로그램 목록에서 진행해 주세요.'); return false; }
                            : async (seminar, applicationData) => {
                                try {
                                    const fee = seminar?.applicationFee != null ? Number(seminar.applicationFee) : 0;
                                    if (fee > 0) {
                                        return await new Promise((resolve) => {
                                            requestPortOnePayment(seminar, applicationData, async () => {
                                                const ok = await handleSeminarApply(seminar, applicationData);
                                                if (ok) generateAndDownloadCalendar(seminar);
                                                resolve(ok);
                                            }, () => resolve(false));
                                        });
                                    }
                                    const ok = await handleSeminarApply(seminar, applicationData);
                                    if (ok) generateAndDownloadCalendar(seminar);
                                    return ok;
                                } catch (err) {
                                    console.error('프로그램 신청 오류:', err);
                                    alert('프로그램 신청 중 오류가 발생했습니다.');
                                    return false;
                                }
                            }
                        }
                    />
                );
            }
            if (currentView === 'myPage') {
                if (!currentUser) {
                    // 로그인 필요 처리
                    return (
                        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                            <div className="container mx-auto max-w-7xl">
                                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                                    <Icons.AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold text-dark mb-2">로그인이 필요합니다</h2>
                                    <p className="text-gray-600 mb-6">이 페이지를 보려면 로그인이 필요합니다.</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginModal(true)}
                                        className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        로그인하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }
                return <MyPageView onBack={() => setCurrentView('home')} user={currentUser} mySeminars={mySeminars} myPosts={myPosts} onWithdraw={handleWithdraw} onUpdateProfile={handleUpdateProfile} onCancelSeminar={handleSeminarCancel} pageTitles={pageTitles} onUpdatePost={handleCommunityUpdate} />;
            }
        if (currentView === 'allMembers' && !currentUser) {
            return (
                <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                    <div className="container mx-auto max-w-2xl">
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                            <Icons.AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-dark mb-2">로그인이 필요합니다</h2>
                            <p className="text-gray-600 mb-6">회원명단은 로그인한 회원만 볼 수 있습니다.</p>
                            <div className="flex flex-wrap justify-center gap-3">
                                <button type="button" onClick={() => { setPendingView('allMembers'); setShowLoginModal(true); }} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">로그인</button>
                                <button type="button" onClick={() => setCurrentView('home')} className="px-6 py-3 border-2 border-brand text-brand font-bold rounded-xl hover:bg-brand/5">홈으로</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (currentView === 'allMembers' && !menuEnabled['부청사 회원']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'allMembers') {
            // approvalStatus가 'approved'이거나 없는 회원만 표시 (Firebase와 동기화)
            const displayMembers = membersData.filter(m => {
                const isApproved = !m.approvalStatus || m.approvalStatus === 'approved';
                return isApproved;
            });
            return <AllMembersView currentPage={membersListPage} onPageChange={setMembersListPage} onBack={() => setCurrentView('home')} members={displayMembers} currentUser={currentUser} pageTitles={pageTitles} />;
        }
        if (currentView === 'allSeminars' && !menuEnabled['프로그램']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'allSeminars') {
            try {
                // seminarsData가 undefined나 null인 경우 빈 배열로 처리
                const safeSeminarsData = Array.isArray(seminarsData) ? seminarsData : [];
                
                return <AllSeminarsView 
                    key="programList"
                    currentPage={programListPage}
                    onPageChange={setProgramListPage}
                    onBack={() => setCurrentView('home')} 
                    seminars={safeSeminarsData} 
                    menuNames={menuNames} 
                    onNavigateToApply={(seminar) => navigate(`/program/apply/${seminar.id}`)}
                    onApply={async (seminar, applicationData) => {
                        try {
                            const fee = seminar?.applicationFee != null ? Number(seminar.applicationFee) : 0;
                            let success = false;
                            if (fee > 0) {
                                success = await new Promise((resolve) => {
                                    requestPortOnePayment(seminar, applicationData, async () => {
                                        const ok = await handleSeminarApply(seminar, applicationData);
                                        resolve(ok);
                                    }, () => resolve(false));
                                });
                            } else {
                                success = await handleSeminarApply(seminar, applicationData);
                            }
                            if (success) generateAndDownloadCalendar(seminar);
                            return success;
                        } catch (error) {
                            console.error('프로그램 신청 오류:', error);
                            alert('프로그램 신청 중 오류가 발생했습니다.');
                            return false;
                        }
                    }} 
                    currentUser={currentUser}
                    waitForKakaoMap={waitForKakaoMap}
                    openKakaoPlacesSearch={openKakaoPlacesSearch}
                    pageTitles={pageTitles}
                    onWriteReview={handleWriteReview}
                    applications={JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]')}
                    communityPosts={communityPosts}
                />;
            } catch (error) {
                console.error('프로그램 페이지 렌더링 오류:', error);
                return (
                    <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                        <div className="container mx-auto max-w-7xl">
                            <div className="bg-white rounded-3xl shadow-card p-8 text-center">
                                <Icons.AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-dark mb-2">페이지를 불러올 수 없습니다</h2>
                                <p className="text-gray-600 mb-6">프로그램 페이지를 표시하는 중 오류가 발생했습니다.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCurrentView('home');
                                        window.location.reload();
                                    }}
                                    className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                >
                                    홈으로 돌아가기
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }
        } 
        if (currentView === 'community' && !menuEnabled['커뮤니티']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'community' && !currentUser) {
            return (
                <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                    <div className="container mx-auto max-w-2xl">
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                            <Icons.AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-dark mb-2">로그인이 필요합니다</h2>
                            <p className="text-gray-600 mb-6">커뮤니티는 로그인한 회원만 이용할 수 있습니다.</p>
                            <div className="flex flex-wrap justify-center gap-3">
                                <button type="button" onClick={() => { setPendingView('community'); setShowLoginModal(true); }} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">로그인</button>
                                <button type="button" onClick={() => setCurrentView('home')} className="px-6 py-3 border-2 border-brand text-brand font-bold rounded-xl hover:bg-brand/5">홈으로</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (currentView === 'community') {
            const isCurrentUserAdmin = typeof localStorage !== 'undefined' && localStorage.getItem('adminAuthenticated') === 'true';
            return <CommunityView 
                onBack={() => { setReviewSeminar(null); setCurrentView('home'); }} 
                posts={communityPosts} 
                onCreate={handleCommunityCreate} 
                onDelete={handleCommunityDelete} 
                currentUser={currentUser} 
                onNotifyAdmin={handleNotifyAdmin} 
                seminars={seminarsData} 
                setShowLoginModal={setShowLoginModal} 
                pageTitles={pageTitles} 
                menuNames={menuNames} 
                reviewSeminar={reviewSeminar} 
                onReviewComplete={() => setReviewSeminar(null)}
                handleCommunityUpdate={handleCommunityUpdate}
                handleCommunityDelete={handleCommunityDelete}
                openKakaoPlacesSearch={openKakaoPlacesSearch}
                isCurrentUserAdmin={isCurrentUserAdmin}
            />;
        }
        if (currentView === 'notice') return <NoticeView onBack={() => setCurrentView('home')} posts={communityPosts} menuNames={menuNames} pageTitles={pageTitles} />;
        if (currentView === 'donation' && DONATION_FEATURE_DISABLED) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'donation' && !menuEnabled['후원']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'donation') return <DonationView onBack={() => setCurrentView('home')} currentUser={currentUser} setCurrentUser={setCurrentUser} setMembersData={setMembersData} membersData={membersData} saveCurrentUserToStorage={saveCurrentUserToStorage} pageTitles={pageTitles} />;
        if (currentView === 'restaurants' && !menuEnabled['부산맛집']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'restaurants') {
            return (
                <RestaurantsListView
                    onBack={() => setCurrentView('home')}
                    restaurants={restaurantsData}
                    currentUser={currentUser}
                    isFoodBusinessOwner={isFoodBusinessOwner}
                    menuNames={menuNames}
                    pageTitles={pageTitles}
                    onRestaurantClick={(restaurant) => {
                        setSelectedRestaurant(restaurant);
                        setCurrentView('restaurantDetail');
                    }}
                    onCreateClick={() => {
                        setSelectedRestaurant(null);
                        setCurrentView('restaurantForm');
                    }}
                />
            );
        }
        if (currentView === 'restaurantDetail' && selectedRestaurant) {
            return (
                <RestaurantDetailView
                    restaurant={selectedRestaurant}
                    onBack={() => {
                        setSelectedRestaurant(null);
                        setCurrentView('restaurants');
                    }}
                    currentUser={currentUser}
                    onEdit={() => {
                        setCurrentView('restaurantForm');
                    }}
                    onDelete={async () => {
                        const success = await handleRestaurantDelete(selectedRestaurant.id);
                        if (success) {
                            setSelectedRestaurant(null);
                            setCurrentView('restaurants');
                        }
                    }}
                    waitForKakaoMap={waitForKakaoMap}
                    openKakaoPlacesSearch={openKakaoPlacesSearch}
                />
            );
        }
        if (currentView === 'restaurantForm') {
            return (
                <RestaurantFormView
                    restaurant={selectedRestaurant}
                    onBack={() => {
                        if (selectedRestaurant) {
                            setCurrentView('restaurantDetail');
                        } else {
                            setCurrentView('restaurants');
                        }
                    }}
                    onSave={async (restaurantData) => {
                        if (selectedRestaurant) {
                            // 수정
                            const success = await handleRestaurantUpdate(selectedRestaurant.id, restaurantData);
                            if (success) {
                                // 수정 후 최신 데이터로 selectedRestaurant 업데이트
                                setTimeout(() => {
                                    const updatedRestaurant = restaurantsData.find(r => r.id === selectedRestaurant.id);
                                    if (updatedRestaurant) {
                                        setSelectedRestaurant(updatedRestaurant);
                                        setCurrentView('restaurantDetail');
                                    } else {
                                        setSelectedRestaurant(null);
                                        setCurrentView('restaurants');
                                    }
                                }, 500); // Firebase 업데이트 반영 대기
                            }
                        } else {
                            // 등록
                            const success = await handleRestaurantCreate(restaurantData);
                            if (success) {
                                setSelectedRestaurant(null);
                                setCurrentView('restaurants');
                            }
                        }
                    }}
                    waitForKakaoMap={waitForKakaoMap}
                    openKakaoPlacesSearch={openKakaoPlacesSearch}
                    resizeImage={resizeImage}
                    uploadImageToImgBB={uploadImageToImgBB}
                />
            );
        }
        if (currentView === 'about' && !menuEnabled['소개']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'about') return <AboutView onBack={() => setCurrentView('home')} content={content} pageTitles={pageTitles} />;
        
        // 예상치 못한 currentView 값에 대한 fallback (항상 유효한 React 요소 반환 보장)
        // currentView가 'home'이 아니고 위의 모든 조건에 맞지 않으면 홈으로 리다이렉트
        if (currentView && currentView !== 'home') {
            // 개발 모드에서 currentView 변경 시에만 로그 (매 렌더마다 찍히지 않도록)
            if (import.meta.env.MODE === 'development' && lastUnknownViewLoggedRef.current !== currentView) {
                lastUnknownViewLoggedRef.current = currentView;
                console.error(`[RenderView] 알 수 없는 뷰: "${currentView}"`);
                console.warn('[RenderView] 사용 가능한 뷰:', [
                    'home', 'myPage', 'allMembers', 'allSeminars', 
                    'community', 'notice', 'donation', 'restaurants',
                    'restaurantDetail', 'restaurantForm', 'about'
                ]);
            }
            
            // 사용자에게 명확한 피드백 제공
            return (
                <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                    <div className="container mx-auto max-w-7xl">
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                            <Icons.AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-dark mb-2">페이지를 찾을 수 없습니다</h2>
                            <p className="text-gray-600 mb-6">요청하신 페이지가 존재하지 않거나 준비 중입니다.</p>
                            <button
                                type="button"
                                onClick={() => setCurrentView('home')}
                                className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                홈으로 돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // currentView가 'home'이거나 null/undefined인 경우 홈 화면 렌더링 (모바일 스크롤 보장)
        const homeView = (
            <div className="min-h-screen overflow-y-auto">
            <Fragment>
                {/* ============================================
                    📍 섹션 1: HERO & SEARCH (메인 히어로 + 검색)
                    ============================================
                    이 섹션은 페이지 최상단에 표시됩니다.
                    메인 타이틀, 설명, 배경 이미지, 검색 기능이 포함되어 있습니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="pt-32 pb-10 md:pb-16 px-4 md:px-6">
                     <div className="container mx-auto max-w-7xl relative mb-12 md:mb-24">
                        <div className="flex flex-col md:flex-row items-center md:items-center justify-between mb-8 px-2 text-center md:text-right">
                            <div className="flex-1">
                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight break-keep text-dark whitespace-pre-line text-center md:text-left">
                                    {content.hero_title ? content.hero_title.split('\n').map((line, idx) => (
                                        <span key={idx}>
                                            {idx === content.hero_title.split('\n').length - 1 ? (
                                                <span className="text-brand">{line}</span>
                                            ) : (
                                                <Fragment>{line}<br/></Fragment>
                                            )}
                                        </span>
                                    )) : (
                                        <Fragment>함께 성장하는<br/>청년 사업가 커뮤니티<br/><span className="text-brand">부산청년사업가들</span></Fragment>
                                    )}
                                </h1>
                                <p className="text-gray-500 text-base sm:text-lg md:text-left max-w-md mt-4 break-keep">{content.hero_desc}</p>
                            </div>
                        </div>
                        <div className="relative w-full">
                            <div className="relative w-full rounded-4xl md:rounded-5xl overflow-hidden shadow-deep-blue group z-0" style={{ aspectRatio: '16/9' }}>
                                {content.hero_image && <img src={content.hero_image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Hero" loading="eager" fetchpriority="high" decoding="async" sizes="(max-width: 768px) 100vw, 1280px" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                            </div>
                            
                            <div className="w-[95%] md:min-w-[800px] mx-auto bg-white rounded-2xl md:rounded-3xl shadow-float flex flex-col transition-all duration-300 ease-in-out z-20 overflow-hidden mt-4 md:-mt-12">
                                <div className="flex flex-col md:flex-row gap-1 md:gap-0 items-center p-2 md:p-3 relative bg-white z-30">
                                    <div className="flex-1 w-full px-3 md:px-4 border-b md:border-b-0 md:border-r border-brand/10 py-1.5 md:py-0">
                                        <div className="flex items-center gap-2 mb-0.5 md:mb-1 text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.Search size={12} className="text-accent md:w-3.5 md:h-3.5" /> 키워드 검색</div>
                                        <input type="text" className="w-full font-bold text-dark bg-transparent outline-none text-xs md:text-sm placeholder-gray-300 py-0.5" placeholder="관심 주제 (예: 투자, 마케팅)" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()}/>
                                    </div>
                                    <div className="w-full md:w-48 px-3 md:px-4 border-b md:border-b-0 md:border-r border-brand/10 py-1.5 md:py-0">
                                        <div className="flex items-center gap-2 mb-0.5 md:mb-1 text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.Tag size={12} className="text-accent md:w-3.5 md:h-3.5" /> 카테고리</div>
                                        <select className="w-full font-bold text-dark bg-transparent outline-none cursor-pointer text-xs md:text-sm py-0.5" value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}><option value="">전체 카테고리</option><option value="교육/세미나">📚 교육 · 세미나</option><option value="네트워킹/모임">🤝 네트워킹 · 모임</option><option value="투자/IR">💰 투자 · IR</option><option value="멘토링/상담">💡 멘토링 · 상담</option><option value="기타">🎸 기타</option></select>
                                    </div>
                                    <div className="w-full md:w-40 px-3 md:px-4 border-b md:border-b-0 md:border-r border-brand/10 py-1.5 md:py-0">
                                        <div className="flex items-center gap-2 mb-0.5 md:mb-1 text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.CheckCircle size={12} className="text-accent md:w-3.5 md:h-3.5" /> 모집 상태</div>
                                        <select className="w-full font-bold text-dark bg-transparent outline-none cursor-pointer text-xs md:text-sm py-0.5" value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)}><option value="">전체 상태</option><option value="모집중">모집중</option><option value="마감임박">마감임박</option><option value="종료">종료</option></select>
                                    </div>
                                    <div className="w-full md:w-40 px-3 md:px-4 py-1.5 md:py-0">
                                        <div className="flex items-center gap-2 mb-0.5 md:mb-1 text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.MapPin size={12} className="text-accent md:w-3.5 md:h-3.5" /> 지역구</div>
                                        <select className="w-full font-bold text-dark bg-transparent outline-none cursor-pointer text-xs md:text-sm py-0.5" value={searchDistrict} onChange={(e) => setSearchDistrict(e.target.value)}>
                                            {BUSAN_DISTRICTS.map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSearch(); }} className="w-full md:w-16 h-10 md:h-14 bg-brand rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/30 hover:bg-blue-800 transition-colors shrink-0"><Icons.Search className="w-5 h-5 md:w-6 md:h-6" /></button>
                                </div>
                                <div className={`transition-all duration-300 ease-in-out bg-soft ${isSearchExpanded ? 'max-h-[400px] opacity-100 border-t border-brand/10' : 'max-h-0 opacity-0'}`}>
                                    <div className="p-4 md:p-6 overflow-y-auto max-h-[400px]">
                                        <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3"><h3 className="text-sm font-bold text-gray-500">검색 결과 <span className="text-brand">{searchResults.length}</span>건</h3></div><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSearchExpanded(false); }} className="text-xs text-gray-400 hover:text-dark flex items-center gap-1">닫기 <Icons.X size={14}/></button></div>
                                        {searchResults.length > 0 ? (<div className="grid grid-cols-1 gap-3">{searchResults.map((result, idx) => (<div key={idx} className="bg-white p-4 rounded-2xl border border-blue-100 hover:border-brand/30 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}><div className="flex-1"><div className="flex gap-2 mb-2"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${result.status === '모집중' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{result.status}</span><span className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-500 rounded-full flex items-center gap-1"><Icons.Calendar size={10}/> {result.date}</span><span className="text-[10px] font-bold px-2 py-1 bg-brand/10 text-brand rounded-full">{result.category}</span></div><h4 className="font-bold text-dark text-lg mb-1 break-keep">{result.title}</h4><div className="text-xs text-gray-500 mb-1 font-medium">신청: {result.currentParticipants || 0} / {result.maxParticipants}명</div><p className="text-xs text-gray-500 line-clamp-1 break-keep">{result.desc}</p></div><div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-0 border-gray-50"><span className="text-xs text-brand font-bold hover:underline flex items-center gap-1">상세보기 <Icons.ArrowRight size={12} /></span></div></div>))}</div>) : (<div className="py-10 text-center text-gray-400 flex flex-col items-center gap-3"><div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"><Icons.Info className="w-6 h-6 text-gray-300" /></div><p className="text-sm">조건에 맞는 세미나가 없습니다.</p></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* ============================================
                    📍 섹션 2: STATS (통계 숫자)
                    ============================================
                    활동중인 사업가, 진행된 세미나, 투자 성공 사례 등의 통계를 표시합니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="pt-10 pb-10 md:py-20 bg-soft/50">
                    <div className="container mx-auto max-w-6xl px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
                            <div><div className="text-3xl md:text-4xl font-bold text-brand mb-2">{content.stat_1_val}</div><div className="text-sm text-gray-500 font-medium break-keep">{content.stat_1_desc}</div></div>
                            <div><div className="text-3xl md:text-4xl font-bold text-brand mb-2">{content.stat_2_val}</div><div className="text-sm text-gray-500 font-medium break-keep">{content.stat_2_desc}</div></div>
                            <div><div className="text-3xl md:text-4xl font-bold text-brand mb-2">{content.stat_3_val}</div><div className="text-sm text-gray-500 font-medium break-keep">{content.stat_3_desc}</div></div>
                            <div><div className="text-3xl md:text-4xl font-bold text-brand mb-2">{content.stat_4_val}</div><div className="text-sm text-gray-500 font-medium break-keep">{content.stat_4_desc}</div></div>
                        </div>
                    </div>
                </section>

                {/* ============================================
                    📍 섹션 4: FEATURES (특장점 소개)
                    ============================================
                    "함께할 때 더 멀리 갈 수 있습니다" 섹션입니다.
                    다양한 네트워크, 검증된 전문가, 성공 사례 공유를 소개합니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="py-12 md:py-20 px-6 bg-white">
                    <div className="container mx-auto max-w-6xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
                            <div className="relative h-[300px] md:h-[500px]">
                                {content.features_image_1 && <div className="absolute top-0 left-0 w-3/5 rounded-3xl overflow-hidden shadow-deep-blue z-10" style={{ aspectRatio: '1/1' }}><img src={content.features_image_1} className="w-full h-full object-cover" alt="Office" loading="lazy" decoding="async" /></div>}
                                {content.features_image_2 && <div className="absolute bottom-0 right-0 w-3/5 rounded-3xl overflow-hidden shadow-deep-blue z-20 border-4 border-white" style={{ aspectRatio: '1/1' }}><img src={content.features_image_2} className="w-full h-full object-cover" alt="Meeting" loading="lazy" decoding="async" /></div>}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-50 rounded-full -z-10 blur-3xl"></div>
                            </div>
                            <div><h2 className="text-2xl md:text-5xl font-bold text-dark mb-6 leading-tight break-keep">{content.features_title || '함께할 때 더 멀리 갈 수 있습니다'}</h2><div className="space-y-4 md:space-y-8 mt-6 md:mt-10"><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-brand shrink-0"><Icons.Users /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_network_title || '다양한 네트워크'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_network_desc || 'IT, 제조, 유통 등 다양한 산업군의 대표님들과 연결되어 새로운 비즈니스 기회를 창출합니다.'}</p></div></div><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><Icons.CheckCircle /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_expert_title || '검증된 전문가'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_expert_desc || '세무, 노무, 마케팅 등 각 분야 전문가 멘토링을 통해 사업 운영의 어려움을 해결해드립니다.'}</p></div></div><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 shrink-0"><Icons.Star /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_success_title || '성공 사례 공유'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_success_desc || '선배 창업가들의 생생한 성공 및 실패 사례를 통해 시행착오를 줄이고 빠르게 성장하세요.'}</p></div></div></div></div>
                        </div>
                    </div>
                </section>

                {/* 협력기관 (Features 다음, 프로그램 앞) */}
                <section className="py-12 md:py-20 px-6 bg-soft">
                    <div className="container mx-auto max-w-6xl">
                        <h2 className="text-2xl md:text-3xl font-bold text-dark mb-[4.5rem] text-center">협력기관</h2>
                        <div className="md:scale-[0.9] md:origin-center">
                            <div className="grid grid-cols-2 gap-y-12 gap-x-1 sm:grid-cols-3 sm:gap-12 md:gap-16">
                            {PARTNER_LOGOS.map((src, i) => (
                                <div key={i} className={`w-full flex items-center justify-center ${i === 0 ? 'overflow-visible' : ''}`}>
                                    <img src={src} alt={PARTNER_NAMES[i] || `협력기관 ${i + 1}`} className={`max-h-16 w-full object-contain ${i === 4 ? 'scale-[0.9]' : `scale-[0.8] ${i === 0 ? 'md:scale-[1.6]' : 'md:scale-100'}`}`} />
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ============================================
                    📍 프로그램 (자동 흐름 + 드래그 스크롤, 클릭 시 신청 페이지 이동)
                    ============================================ */}
                {menuEnabled['프로그램'] && Array.isArray(seminarsData) && seminarsData.length > 0 ? (
                <section className="py-12 md:py-20 px-6 overflow-hidden">
                    <div className="container mx-auto max-w-7xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 gap-4">
                            <div className="w-full md:w-auto text-left">
                                <h2 className="text-2xl md:text-3xl font-bold text-dark mb-3 break-keep">프로그램</h2>
                                <p className="text-gray-600 text-sm md:text-base break-keep">진행 중인 프로그램을 확인하세요</p>
                            </div>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="self-end md:self-auto text-sm font-bold text-gray-500 hover:text-brand flex items-center gap-1 transition-colors shrink-0">전체 보기 <Icons.ArrowRight size={16} /></button>
                        </div>
                        <div
                            role="region"
                            aria-label="프로그램 목록"
                            className="overflow-hidden cursor-grab select-none"
                            style={{ marginLeft: '-1.5rem', marginRight: '-1.5rem' }}
                            onMouseDown={handleProgramDragStart}
                            onTouchStart={handleProgramDragStart}
                        >
                            <div
                                ref={programTrackRef}
                                className="flex gap-6 w-max"
                                style={{ transform: `translateX(${programScrollOffset}px)` }}
                            >
                                {[...seminarsData, ...seminarsData].map((seminar, idx) => {
                                    const img = (seminar.images && seminar.images[0]) || (seminar.imageUrls && seminar.imageUrls[0]) || seminar.imageUrl || seminar.img;
                                    const fee = seminar.applicationFee != null ? Number(seminar.applicationFee) : 0;
                                    const price = seminar.price != null ? Number(seminar.price) : 0;
                                    const isPaid = fee > 0 || (seminar.requiresPayment && price > 0);
                                    const amount = fee > 0 ? fee : price;
                                    return (
                                        <button
                                            key={`${seminar.id}-${idx}`}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (programDragRef.current?.hasMoved) return;
                                                navigate(`/program/apply/${seminar.id}`);
                                            }}
                                            className="flex-shrink-0 w-[280px] md:w-[320px] bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md hover:border-brand/30 transition-all text-left overflow-hidden group flex flex-col"
                                        >
                                            <div className="w-full flex-shrink-0 aspect-[3/4] bg-gray-100 overflow-hidden relative">
                                                {img ? <img src={img} alt={seminar.title} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Icons.Calendar size={48} /></div>}
                                                {(() => {
                                                    const max = Number(seminar.maxParticipants ?? seminar.capacity) || 0;
                                                    const current = seminar.status === '종료' ? max : (Number(seminar.currentParticipants) || 0);
                                                    const isPopular = (seminar.title || '').includes('정모') || (max > 0 && current / max >= 0.8);
                                                    return isPopular ? (
                                                        <div className="absolute top-2 left-2" style={{ transform: 'scale(0.667)', transformOrigin: 'top left' }}>
                                                            <div className="px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-700 text-white text-2xl font-bold shadow-lg badge-popular-pulse" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' }}>인기</div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                            <div className="p-4 flex flex-col flex-shrink-0 w-full min-h-[7rem] box-border">
                                                <div className="flex flex-wrap gap-2 mb-2 flex-shrink-0">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${seminar.status === '모집중' ? 'bg-blue-100 text-blue-700' : seminar.status === '마감임박' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{seminar.status || '모집중'}</span>
                                                    <span className="text-xs font-bold px-2 py-0.5 bg-brand/10 text-brand rounded-full">{isPaid ? `${amount.toLocaleString()}원` : '무료'}</span>
                                                </div>
                                                <h3 className="font-bold text-base text-dark mb-1 line-clamp-2 group-hover:text-brand transition-colors leading-snug min-h-[2.5em]">{seminar.title}</h3>
                                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-auto pt-2"><Icons.Calendar size={14} /> {seminar.date}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
                ) : null}

                {/* ============================================
                    📍 ACTIVITIES (커뮤니티 주요 활동 - 고정 카드 그리드)
                    ============================================ */}
                {menuEnabled['프로그램'] ? (
                <section className="py-12 md:py-20 px-6">
                    <div className="container mx-auto max-w-7xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 gap-4">
                            <div className="w-full md:w-auto text-left">
                                <h2 className="text-2xl md:text-3xl font-bold text-dark mb-3 break-keep">{content.activities_title || '커뮤니티 주요 활동'}</h2>
                                <p className="text-gray-600 text-sm md:text-base break-keep">{content.activities_subtitle || '사업 역량 강화와 네트워크 확장을 위한 다양한 프로그램'}</p>
                            </div>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="self-end md:self-auto text-sm font-bold text-gray-500 hover:text-brand flex items-center gap-1 transition-colors">{content.activities_view_all || '전체 프로그램 보기'} <Icons.ArrowRight size={16} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative rounded-2xl overflow-hidden mb-4 card-zoom" style={{ aspectRatio: '4/3' }}>{content.activity_seminar_image && <img src={content.activity_seminar_image} className="w-full h-full object-cover" alt="비즈니스 세미나" loading="lazy" decoding="async" />}<div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-brand shadow-sm">SEMINAR</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-base md:text-lg font-bold text-dark group-hover:text-brand transition-colors leading-snug">{content.activity_seminar_title || '비즈니스 세미나'}</h3></div><p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em] break-keep leading-relaxed">{content.activity_seminar_desc || '매월 진행되는 창업 트렌드 및 마케팅 실무 세미나'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_seminar_schedule || '매월 2째주 목요일'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative rounded-2xl overflow-hidden mb-4 card-zoom" style={{ aspectRatio: '4/3' }}>{content.activity_investment_image && <img src={content.activity_investment_image} className="w-full h-full object-cover" alt="투자 & 지원사업" loading="lazy" decoding="async" />}<div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-green-600 shadow-sm">INVESTMENT</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-base md:text-lg font-bold text-dark group-hover:text-brand transition-colors leading-snug">{content.activity_investment_title || '투자 & 지원사업'}</h3></div><p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em] break-keep leading-relaxed">{content.activity_investment_desc || '최신 정부 지원사업 큐레이션 및 IR 피칭 기회'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_investment_schedule || '수시 모집'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative rounded-2xl overflow-hidden mb-4 card-zoom" style={{ aspectRatio: '4/3' }}>{content.activity_networking_image && <img src={content.activity_networking_image} className="w-full h-full object-cover" alt="사업가 네트워킹" loading="lazy" decoding="async" />}<div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-accent shadow-sm">NETWORK</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-base md:text-lg font-bold text-dark group-hover:text-brand transition-colors leading-snug">{content.activity_networking_title || '사업가 네트워킹'}</h3></div><p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em] break-keep leading-relaxed">{content.activity_networking_desc || '다양한 업종의 대표님들과 교류하며 비즈니스 기회'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_networking_schedule || '매주 금요일'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-soft rounded-3xl p-6 flex flex-col justify-center items-center text-center hover:bg-brand hover:text-white transition-colors duration-300 cursor-pointer group shadow-deep-blue border-none w-full"><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-brand mb-4 shadow-sm group-hover:scale-110 transition-transform"><Icons.ArrowRight size={24} /></div><h3 className="text-lg font-bold mb-2 text-dark group-hover:text-white">{content.activity_more_title || 'More Programs'}</h3><p className="text-sm text-gray-700 group-hover:text-white break-keep">{content.activity_more_desc || '멘토링, 워크샵 등 더 많은 활동 보기'}</p></button>
                        </div>
                    </div>
                </section>
                ) : null}

                {/* ============================================
                    📍 섹션 6-1: 후원 섹션
                    ============================================
                    후원하기 전용 섹션입니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                {!DONATION_FEATURE_DISABLED && menuEnabled['후원'] ? (
                <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="container mx-auto max-w-6xl">
                        <div className="relative rounded-4xl overflow-hidden bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-center px-6 shadow-2xl shadow-green-500/40" style={{ aspectRatio: '16/9' }}>
                            {content.donation_image && <div className="absolute inset-0"><img src={content.donation_image} className="w-full h-full object-cover opacity-20 mix-blend-overlay" alt="Support" loading="lazy" decoding="async" /></div>}
                            <div className="relative z-10 max-w-2xl">
                                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight break-keep">{content.donation_title || '부청사와 함께 성장하세요'}</h2>
                                <p className="text-green-100 text-base md:text-lg mb-10 break-keep">{content.donation_desc || '후원을 통해 더 많은 청년 사업가들이 꿈을 이룰 수 있도록 도와주세요'}</p>
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('donation'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="px-8 py-4 bg-white text-green-600 font-bold rounded-2xl hover:bg-green-50 transition-all shadow-lg btn-hover">{content.donation_button || '후원하기'}</button>
                            </div>
                        </div>
                    </div>
                </section>
                ) : null}

                {/* ============================================
                    📍 섹션 6: CTA (행동 유도 섹션)
                    ============================================
                    "사업의 꿈을 현실로!" 섹션입니다.
                    가입하기, 문의하기 버튼이 포함된 마지막 홍보 섹션입니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="py-12 md:py-24 px-6">
                    <div className="container mx-auto max-w-6xl">
                        <div className="relative rounded-4xl overflow-hidden bg-brand h-[400px] flex items-center justify-center text-center px-6 shadow-2xl shadow-brand/40">
                            {content.cta_image && <div className="absolute inset-0"><img src={content.cta_image} className="w-full h-full object-cover opacity-30 mix-blend-overlay" alt="Building" loading="lazy" decoding="async" /></div>}
                            <div className="relative z-10 max-w-2xl">
                                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight break-keep">{content.cta_title}</h2>
                                <p className="text-blue-100 text-base md:text-lg mb-10 break-keep">{content.cta_desc}</p>
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <button type="button" onClick={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        navigate('/signup'); 
                                    }} className="px-8 py-4 bg-white text-brand font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-lg btn-hover">{content.cta_join_button || '지금 가입하기'}</button>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsInquiryModalOpen(true); }} className="px-8 py-4 bg-transparent border border-white/30 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">{content.cta_contact_button || '문의하기'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </Fragment>
            </div>
        );
        // currentView가 'home'이거나 null/undefined인 경우 홈 화면 렌더링
        // homeView는 항상 유효한 React 요소이므로 null 체크 불필요
        return homeView;
        } catch (error) {
            console.error('renderView error:', error);
            console.error('Error stack:', error.stack);
            console.error('Current view:', currentView);
            // 오류 발생 시 에러 메시지 표시 (null 대신 유효한 React 요소 반환)
            if (currentView !== 'home') {
                setCurrentView('home');
            }
            return (
                <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                    <div className="container mx-auto max-w-7xl">
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                            <Icons.AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-dark mb-2">페이지를 불러올 수 없습니다</h2>
                            <p className="text-gray-600 mb-6">오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentView('home');
                                    window.location.reload();
                                }}
                                className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                홈으로 돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    };
    return (
    <div className="app-main">
        {/* 모바일 메뉴: 상태가 있는 App에서 직접 렌더해 클릭 미반응 방지 */}
        {MobileMenu && (
            <MobileMenu
                isOpen={isMenuOpen}
                onClose={closeMobileMenu}
                onNavigate={(item) => {
                    closingByNavigateRef.current = true;
                    handleNavigation(item);
                }}
                menuEnabled={effectiveMenuEnabled}
                menuNames={menuNames}
                menuOrder={menuOrder}
                currentUser={currentUser}
            />
        )}
        <AppLayout
            navigate={navigate}
            renderView={renderView}
            currentView={currentView}
            setCurrentView={setCurrentView}
            onGoHome={onGoHome}
            popupPrograms={popupPrograms}
            setPopupPrograms={setPopupPrograms}
            closePopupAndMarkAsShown={closePopupAndMarkAsShown}
            isPopupApplyModalOpen={isPopupApplyModalOpen}
            applySeminarFromPopup={applySeminarFromPopup}
            setIsPopupApplyModalOpen={setIsPopupApplyModalOpen}
            popupApplicationData={popupApplicationData}
            setPopupApplicationData={setPopupApplicationData}
            handlePopupApplySubmit={handlePopupApplySubmit}
            handlePopupApply={handlePopupApply}
            onNavigateToProgramApply={(program) => { closePopupAndMarkAsShown(); navigate(`/program/apply/${program.id}`); }}
            getCategoryColor={getCategoryColor}
            scrolled={scrolled}
            menuOrder={menuOrder}
            menuEnabled={effectiveMenuEnabled}
            menuNames={menuNames}
            handleNavigation={handleNavigation}
            getNavClass={getNavClass}
            currentUser={currentUser}
            handleLogout={handleLogout}
            showLoginModal={showLoginModal}
            setShowLoginModal={setShowLoginModal}
            showSignUpModal={showSignUpModal}
            setShowSignUpModal={setShowSignUpModal}
            setShowSignUpChoiceModal={setShowSignUpChoiceModal}
            onSignUpClick={() => navigate('/signup')}
            isInquiryModalOpen={isInquiryModalOpen}
            setIsInquiryModalOpen={setIsInquiryModalOpen}
            handleInquirySubmit={handleInquirySubmit}
            showProgramAlertModal={showProgramAlertModal}
            programAlerts={programAlerts}
            handleProgramAlertConfirm={handleProgramAlertConfirm}
            handleSignUp={handleSignUp}
            handleLogin={handleLogin}
            handleKakaoLogin={handleKakaoLogin}
            users={users}
            LoginModal={LoginModal}
            setIsMenuOpen={setIsMenuOpen}
            onOpenMobileMenu={openMobileMenu}
            content={content}
            isMenuOpen={isMenuOpen}
        />
        {showKakaoMapModal && (
            <KakaoMapModal
                onClose={() => setShowKakaoMapModal(false)}
                onSelectLocation={(place) => {
                    if (kakaoMapCallbackRef.current) {
                        const displayAddress = place.name
                            ? `${place.name}, ${(place.address || '').trim()}`.trim()
                            : (place.address || '');
                        kakaoMapCallbackRef.current({
                            name: place.name,
                            address: place.address,
                            lat: place.lat,
                            lng: place.lng,
                            displayAddress
                        });
                    }
                    setShowKakaoMapModal(false);
                }}
                initialLocation={null}
            />
        )}
        {showSignUpChoiceModal && (
            <ModalPortal>
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setShowSignUpChoiceModal(false); }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 scale-90 origin-center" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-dark mb-1 text-center">회원가입</h3>
                        <p className="text-xs text-gray-500 mb-4 text-center">회원가입 또는 카카오로 회원가입 중 선택하세요.</p>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSignUpChoiceModal(false);
                                    navigate('/signup');
                                }}
                                className="w-full py-3 px-4 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                회원가입
                            </button>
                            <button
                                type="button"
                                disabled
                                className="w-full py-3 px-4 bg-[#FEE500]/50 text-[#191919]/70 border-2 border-[#FDD835]/50 rounded-xl font-bold cursor-not-allowed opacity-60 flex items-center justify-center gap-2 text-sm"
                            >
                                <span className="inline-flex shrink-0" aria-hidden="true">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 3C6.2 3 1.5 6.66 1.5 11.18c0 2.84 1.8 5.36 4.61 6.94-.12.44-.42 1.58-.48 1.83-.08.38.14.37.33.27.15-.08 2.42-1.58 3.4-2.27.57.08 1.17.12 1.79.12 5.8 0 10.5-3.66 10.5-8.18S17.8 3 12 3z"/>
                                    </svg>
                                </span>
                                <span>카카오로 회원가입</span>
                            </button>
                        </div>
                        <button type="button" onClick={() => setShowSignUpChoiceModal(false)} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700 font-medium">취소</button>
                    </div>
                </div>
            </ModalPortal>
        )}
        {showGoogleSignupExtraInfoModal && googleSignupExtraInfoUser && (
            <ModalPortal>
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) { setShowGoogleSignupExtraInfoModal(false); setGoogleSignupExtraInfoUser(null); } }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-dark mb-2">추가 개인정보 기입</h3>
                        <p className="text-sm text-gray-500 mb-4">회원 확인에 필요한 연락처 정보가 없습니다. 아래 항목을 필수로 입력해주세요.</p>
                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">휴대폰 번호 *</label>
                                <input
                                    type="tel"
                                    placeholder="010-0000-0000"
                                    className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={googleSignupExtraPhone}
                                    onChange={(e) => setGoogleSignupExtraPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">이메일 *</label>
                                <input
                                    type="email"
                                    placeholder="example@email.com"
                                    className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={googleSignupExtraEmail}
                                    onChange={(e) => setGoogleSignupExtraEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const phone = googleSignupExtraPhone.trim();
                                const email = googleSignupExtraEmail.trim();
                                if (!phone) { alert('휴대폰 번호를 입력해주세요.'); return; }
                                if (!email) { alert('이메일을 입력해주세요.'); return; }
                                const user = googleSignupExtraInfoUser;
                                const userId = user.id || user.uid;
                                if (!userId) return;
                                try {
                                    if (firebaseService?.updateUser) {
                                        await firebaseService.updateUser(userId, { phone, email });
                                    }
                                    setCurrentUser(prev => prev ? { ...prev, phone, email, phoneNumber: phone } : prev);
                                } catch (e) {
                                    alert('저장에 실패했습니다. 다시 시도해주세요.');
                                    return;
                                }
                                setShowGoogleSignupExtraInfoModal(false);
                                setGoogleSignupExtraInfoUser(null);
                                const approvalStatus = user.approvalStatus || 'pending';
                                if (approvalStatus === 'pending') {
                                    alert("로그인 성공!\n\n회원가입 승인 대기 중입니다.");
                                } else if (approvalStatus === 'rejected') {
                                    alert("로그인 성공!\n\n회원가입이 거부되었습니다. 관리자에게 문의해주세요.");
                                } else {
                                    alert("로그인 성공!");
                                }
                                if (pendingView) {
                                    setCurrentView(pendingView);
                                    setPendingView(null);
                                }
                            }}
                            className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700"
                        >
                            저장하고 완료하기
                        </button>
                    </div>
                </div>
            </ModalPortal>
        )}
        {paymentInfoModalOpen && pendingPaymentContext && (
            <ModalPortal>
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) { setPaymentInfoModalOpen(false); setPendingPaymentContext(null); pendingPaymentContext.onFail?.(); } }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-dark mb-2">결제를 위해 연락처를 입력해주세요</h3>
                        <p className="text-sm text-gray-500 mb-4">소셜 로그인 시 연락처가 없을 수 있습니다. 입력한 정보는 프로필에 저장됩니다.</p>
                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">휴대폰 번호 *</label>
                                <input
                                    type="tel"
                                    placeholder="010-0000-0000"
                                    className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={paymentInfoPhone}
                                    onChange={(e) => setPaymentInfoPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">이메일 *</label>
                                <input
                                    type="email"
                                    placeholder="example@email.com"
                                    className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={paymentInfoEmail}
                                    onChange={(e) => setPaymentInfoEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setPaymentInfoModalOpen(false);
                                    setPendingPaymentContext(null);
                                    pendingPaymentContext.onFail?.();
                                }}
                                className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const phone = paymentInfoPhone.trim();
                                    const email = paymentInfoEmail.trim();
                                    if (!phone) { alert('휴대폰 번호를 입력해주세요.'); return; }
                                    if (!email) { alert('이메일을 입력해주세요.'); return; }
                                    const ctx = pendingPaymentContext;
                                    if (!ctx) return;
                                    setPaymentInfoModalOpen(false);
                                    setPendingPaymentContext(null);
                                    requestPortOnePayment(ctx.seminar, ctx.applicationData, ctx.onSuccess, ctx.onFail, { phoneNumber: phone, email });
                                    handleUpdateProfile({ phone, email }).catch(() => {});
                                }}
                                className="flex-1 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700"
                            >
                                확인 후 결제
                            </button>
                        </div>
                    </div>
                </div>
            </ModalPortal>
        )}
    </div>
    );
}

export default App;
