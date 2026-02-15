import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import CalendarSection from '../components/CalendarSection';
import ModalPortal from '../components/ModalPortal';
import { ProgramAddModal } from '../components/ProgramAddModal';

const AllSeminarsView = ({ onBack, seminars = [], onApply, onNavigateToApply, currentUser, menuNames = {}, waitForKakaoMap, openKakaoPlacesSearch, pageTitles = {}, onWriteReview, applications = [], communityPosts = [], onProgramAdded, currentPage: currentPageProp, onPageChange }) => {
    /** 운영진 또는 관리자 권한: 프로그램 등록 가능 (admin 채널 없이 바로 등록) */
    const canManagePrograms = currentUser && (currentUser.memberGrade === '운영진' || currentUser.role === 'admin' || currentUser.role === 'master');
    const [showProgramAddModal, setShowProgramAddModal] = useState(false);
    // props 안전성 검증
    const safeSeminars = Array.isArray(seminars) ? seminars : [];
    const safeApplications = Array.isArray(applications) ? applications : [];
    const safeCommunityPosts = Array.isArray(communityPosts) ? communityPosts : [];
    
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedStatus, setSelectedStatus] = useState('전체');
    const [sortBy, setSortBy] = useState('latest');
    const [selectedSeminar, setSelectedSeminar] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageAspectRatios, setImageAspectRatios] = useState({}); // 이미지 인덱스별 비율 → 슬라이드마다 컨테이너 맞춰 상하좌우 여백 제거
    const [leftColumnHeightPx, setLeftColumnHeightPx] = useState(null);
    const [internalPage, setInternalPage] = useState(1);
    const isPageControlled = currentPageProp != null && typeof onPageChange === 'function';
    const currentPage = isPageControlled ? currentPageProp : internalPage;
    const setCurrentPage = isPageControlled ? (v) => { const next = typeof v === 'function' ? v(currentPage) : v; onPageChange(next); } : setInternalPage;
    
    const ITEMS_PER_PAGE = 3;
    const SLIDE_DURATION_MS = 7000;
    const SLIDE_TRANSITION_MS = 400;

    const currentImageIndexRef = useRef(0);
    const leftColRef = useRef(null);
    const listContainerRef = useRef(null);
    const prevFilterRef = useRef({ searchKeyword: '', selectedCategory: '전체', selectedStatus: '전체', sortBy: 'latest' });
    currentImageIndexRef.current = currentImageIndex;

    // #region agent log
    const mountIdRef = useRef(Math.random().toString(36).slice(2, 10));
    useEffect(() => {
        fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AllSeminarsView.jsx:mount',message:'AllSeminarsView mounted',data:{mountId:mountIdRef.current},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        return () => { fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AllSeminarsView.jsx:unmount',message:'AllSeminarsView unmounted',data:{mountId:mountIdRef.current},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{}); };
    }, []);
    // #endregion

    useEffect(() => {
        setCurrentImageIndex(0);
        setImageAspectRatios({});
        setLeftColumnHeightPx(null);
    }, [selectedSeminar?.id]);

    const currentAspectRatio = imageAspectRatios[currentImageIndex] ?? imageAspectRatios[0] ?? 1;

    useEffect(() => {
        if (!currentAspectRatio || !leftColRef.current) return;
        const measure = () => {
            if (leftColRef.current) {
                const h = leftColRef.current.offsetHeight;
                if (h > 0) setLeftColumnHeightPx(h);
            }
        };
        measure();
        const raf = requestAnimationFrame(measure);
        const ro = leftColRef.current && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (leftColRef.current && ro) ro.observe(leftColRef.current);
        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
        };
    }, [currentAspectRatio]);

    // 모달 갤러리: 7초마다 다음 이미지로 슬라이드
    useEffect(() => {
        if (!selectedSeminar) return;
        const raw = selectedSeminar.images || selectedSeminar.imageUrls;
        let list = [];
        if (raw && Array.isArray(raw) && raw.length > 0) list = raw.filter(img => img && typeof img === 'string' && img.trim() !== '');
        if (list.length === 0 && selectedSeminar.imageUrl) list = [selectedSeminar.imageUrl];
        if (list.length === 0 && selectedSeminar.img) {
            const img = selectedSeminar.img;
            if (typeof img === 'string' && img.trim() !== '') list = [img];
        }
        if (list.length <= 1) return;
        const len = list.length;
        const intervalId = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % len);
        }, SLIDE_DURATION_MS);
        return () => clearInterval(intervalId);
    }, [selectedSeminar?.id]);

    // ESC 키로 세미나 상세 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && selectedSeminar) {
                setSelectedSeminar(null);
                setCurrentImageIndex(0);
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [selectedSeminar]);
    
    const categories = ['전체', ...new Set(safeSeminars.map(s => s.category).filter(Boolean))];
    const statuses = ['전체', '모집중', '마감임박', '후기작성가능', '종료'];
    
    const filteredSeminars = safeSeminars.filter(seminar => {
        const matchKeyword = !searchKeyword || seminar.title.toLowerCase().includes(searchKeyword.toLowerCase()) || seminar.desc?.toLowerCase().includes(searchKeyword.toLowerCase());
        const matchCategory = selectedCategory === '전체' || seminar.category === selectedCategory;
        const matchStatus = selectedStatus === '전체' || seminar.status === selectedStatus;
        return matchKeyword && matchCategory && matchStatus;
    });
    
    // 정렬 로직
    const sortedSeminars = useMemo(() => {
        const sorted = [...filteredSeminars];
        // 날짜 파싱 함수 (공통 사용)
        const parseDate = (dateStr) => {
            if (!dateStr) return new Date(0);
            // "2024.01.15" 또는 "2024-01-15" 형식 파싱
            const match = dateStr.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
            if (match) {
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
            return new Date(dateStr) || new Date(0);
        };
        
        switch(sortBy) {
            case 'latest':
                // 운영일자 기준 최신순 정렬
                return sorted.sort((a, b) => {
                    const aDate = parseDate(a.date);
                    const bDate = parseDate(b.date);
                    return bDate - aDate; // 내림차순 (최신순)
                });
            case 'popular':
                return sorted.sort((a, b) => 
                    (b.currentParticipants || 0) - (a.currentParticipants || 0)
                );
            case 'date':
                return sorted.sort((a, b) => {
                    return parseDate(a.date) - parseDate(b.date);
                });
            default:
                return sorted;
        }
    }, [filteredSeminars, sortBy]);

    // 페이지네이션 계산 (totalPages 0 방지, effectivePage로 빈 목록 방지)
    const totalPages = Math.max(1, Math.ceil(sortedSeminars.length / ITEMS_PER_PAGE));
    const effectivePage = Math.min(currentPage, totalPages);
    const startIndex = (effectivePage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageSeminars = sortedSeminars.slice(startIndex, endIndex);

    // 검색/필터가 실제로 변경된 경우에만 1페이지로 리셋 (스크롤 등으로 인한 재렌더 시 오동작 방지)
    useEffect(() => {
        const prev = prevFilterRef.current;
        const changed = prev.searchKeyword !== searchKeyword || prev.selectedCategory !== selectedCategory || prev.selectedStatus !== selectedStatus || prev.sortBy !== sortBy;
        const didSetPage = changed;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AllSeminarsView.jsx:resetEffect',message:'reset effect ran',data:{prev:prev,searchKeyword,selectedCategory,selectedStatus,sortBy,changed,didSetPage},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        if (changed) {
            prevFilterRef.current = { searchKeyword, selectedCategory, selectedStatus, sortBy };
            setCurrentPage(1);
        }
    }, [searchKeyword, selectedCategory, selectedStatus, sortBy]);

    // totalPages가 줄어들었을 때 currentPage가 totalPages를 넘으면 마지막 페이지로 동기화
    useEffect(() => {
        const didSync = currentPage > totalPages;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/46284bc9-5391-43e7-a040-5d1fa22b83ec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AllSeminarsView.jsx:syncEffect',message:'sync effect ran',data:{currentPage,totalPages,didSync},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const scrollListIntoView = () => {
        listContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const getStatusColor = (status) => {
        switch(status) {
            case '모집중': return 'bg-blue-100 text-blue-700';
            case '마감임박': return 'bg-orange-100 text-orange-700';
            case '후기작성가능': return 'bg-green-100 text-green-700';
            case '종료': return 'bg-gray-100 text-gray-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // 금액 라벨 (무료 / 20,000원 등) — 버튼·태그 공통
    const getFeeLabel = (seminar) => {
        const fee = seminar.applicationFee != null ? Number(seminar.applicationFee) : 0;
        const price = seminar.price != null ? Number(seminar.price) : 0;
        const isPaid = fee > 0 || (seminar.requiresPayment && price > 0);
        const amount = fee > 0 ? fee : price;
        return isPaid ? (amount > 0 ? `${amount.toLocaleString()}원` : '유료') : '무료';
    };

    // 행사 일시가 지났는지 여부 (강의 종료 후에만 후기쓰기 표시)
    const isEventEnded = (seminar) => {
        if (!seminar?.date) return false;
        const s = String(seminar.date).trim();
        const match = s.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
        if (!match) return true;
        const eventDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
        eventDate.setHours(23, 59, 59, 999);
        return eventDate.getTime() <= Date.now();
    };

    // 버튼 설정 계산 함수
    const getButtonConfig = (seminar) => {
        if (seminar.status === '종료') {
            return { text: '종료', disabled: true, onClick: null, className: 'bg-gray-300 text-gray-500 cursor-not-allowed' };
        }
        if (seminar.status === '후기작성가능') {
            if (!isEventEnded(seminar)) {
                return { text: '종료 후 후기 작성', disabled: true, onClick: null, className: 'bg-gray-300 text-gray-500 cursor-not-allowed' };
            }
            const hasApplied = applications?.some(app => 
                String(app.seminarId) === String(seminar.id) && String(app.userId) === String(currentUser?.id)
            );
            if (hasApplied) {
                return { 
                    text: '후기쓰기', 
                    disabled: false, 
                    onClick: () => onWriteReview && onWriteReview(seminar),
                    className: 'bg-green-600 text-white hover:bg-green-700 shadow-md ring-2 ring-green-600/30'
                };
            }
            return { 
                text: '참여자만', 
                disabled: true, 
                onClick: () => alert('참여한 프로그램에만 후기를 작성할 수 있습니다.'),
                className: 'bg-gray-300 text-gray-500 cursor-not-allowed'
            };
        }
        return { 
            text: getFeeLabel(seminar), 
            disabled: false, 
            onClick: () => onNavigateToApply ? onNavigateToApply(seminar) : (() => {}),
            className: 'bg-brand text-white hover:bg-blue-700 shadow-md ring-2 ring-brand/30'
        };
    };

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

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="programs" pageTitles={pageTitles} defaultText={menuNames?.['프로그램'] || '프로그램'} />
                        <p className="text-gray-500 text-sm">비즈니스 세미나 및 네트워킹</p>
                                </div>
                    <div className="flex items-center gap-3">
                        {canManagePrograms && (
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowProgramAddModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-brand text-white hover:bg-blue-700 transition-colors">
                                <Icons.Plus size={20} /> 프로그램 등록
                            </button>
                        )}
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                            <Icons.ArrowLeft size={20} /> 메인으로
                        </button>
                    </div>
                    </div>

                {/* 검색 및 필터 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-8">
                    <div className="flex flex-col md:flex-row gap-0 items-center">
                        <div className="flex-1 w-full px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Search size={14} className="text-gray-400" /> 키워드 검색
                            </div>
                            <input 
                                type="text" 
                                placeholder="제목 또는 내용 검색" 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none text-sm placeholder-gray-300" 
                                value={searchKeyword} 
                                onChange={(e) => setSearchKeyword(e.target.value)} 
                            />
                        </div>
                        <div className="w-full md:w-48 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Tag size={14} className="text-gray-400" /> 카테고리
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={selectedCategory} 
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="w-full md:w-40 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.CheckCircle size={14} className="text-gray-400" /> 모집 상태
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={selectedStatus} 
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                        <div className="w-full md:w-32 px-4 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Filter size={14} className="text-gray-400" /> 정렬
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="latest">최신순</option>
                                <option value="popular">인기순</option>
                                <option value="date">날짜순</option>
                            </select>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-4 px-4">
                        검색 결과: <span className="font-bold text-brand">{sortedSeminars.length}</span>개
                    </div>
                </div>

                {/* 세미나 리스트 */}
                {sortedSeminars.length > 0 ? (
                    <div ref={listContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentPageSeminars.map((seminar) => {
                            // images/imageUrls 배열 또는 imageUrl/img 단일 필드 호환
                            const displayImage = (seminar.images && seminar.images.length > 0)
                                ? seminar.images[0]
                                : (seminar.imageUrls && seminar.imageUrls.length > 0)
                                    ? seminar.imageUrls[0]
                                    : seminar.imageUrl || seminar.img;
                            
                            return (
                            <div key={seminar.id} data-seminar-id={seminar.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-blue-200 hover:border-brand/20 cursor-pointer overflow-hidden flex flex-col" onClick={() => setSelectedSeminar(seminar)}>
                                <div className="w-full flex-shrink-0 overflow-hidden relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                                    {displayImage ? (
                                        <>
                                            <img src={displayImage} alt={seminar.title} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" />
                                            {((seminar.images && seminar.images.length > 1) || (seminar.imageUrls && seminar.imageUrls.length > 1)) && (
                                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                                    <Icons.Camera size={12} className="inline mr-1" />
                                                    {(seminar.images || seminar.imageUrls || []).length}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Icons.Calendar size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(seminar.status)}`}>{seminar.status}</span>
                                        {seminar.category && (
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${getCategoryColor(seminar.category)}`}>
                                                {seminar.category}
                                            </span>
                                        )}
                                        <span className="text-xs font-bold px-2 py-1 bg-brand/10 text-brand rounded-full">
                                            {(() => {
                                                const fee = seminar.applicationFee != null ? Number(seminar.applicationFee) : 0;
                                                const price = seminar.price != null ? Number(seminar.price) : 0;
                                                const isPaid = fee > 0 || (seminar.requiresPayment && price > 0);
                                                const amount = fee > 0 ? fee : price;
                                                return isPaid ? (amount > 0 ? `${amount.toLocaleString()}원` : '유료') : '무료';
                                            })()}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-dark mb-2 line-clamp-2">{seminar.title}</h3>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{seminar.desc}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        <span className="flex items-center gap-1"><Icons.Calendar size={14} /> {seminar.date}</span>
                                        {seminar.location && <span className="flex items-center gap-1"><Icons.MapPin size={14} /> {seminar.location}</span>}
                                    </div>
                                <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-dark flex items-center gap-1"><Icons.Users size={14} className="text-brand" /> 신청: {seminar.currentParticipants || 0} / {seminar.maxParticipants || 0}명</span>
                                        {currentUser && (() => {
                                            const btnConfig = getButtonConfig(seminar);
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); btnConfig.onClick && btnConfig.onClick(); }} 
                                                    disabled={btnConfig.disabled}
                                                    className={`px-4 py-2 text-xs font-bold rounded-lg ${btnConfig.className}`}
                                                >
                                                    {btnConfig.text}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                    </div>
                                    </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>등록된 프로그램이 없습니다.</p>
                                    </div>
                )}

                {/* 페이지네이션 */}
                {sortedSeminars.length > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 my-8">
                        <button
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                scrollListIntoView();
                            }}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand transition-colors"
                        >
                            <Icons.ChevronLeft size={20} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => {
                                    setCurrentPage(page);
                                    scrollListIntoView();
                                }}
                                className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                                    currentPage === page
                                        ? 'bg-brand text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                scrollListIntoView();
                            }}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand transition-colors"
                        >
                            <Icons.ChevronRight size={20} />
                        </button>
                    </div>
                )}

                {/* 프로그램 일정표 */}
                <CalendarSection 
                    seminars={safeSeminars} 
                    onSelectSeminar={(seminar) => setSelectedSeminar(seminar)}
                    currentUser={currentUser}
                    onWriteReview={onWriteReview}
                    applications={safeApplications}
                />

                {/* 세미나 상세 모달 */}
                {selectedSeminar && (() => {
                    // images/imageUrls 배열 또는 imageUrl/img 단일 필드 호환
                    let images = [];
                    const raw = selectedSeminar.images || selectedSeminar.imageUrls;
                    if (raw && Array.isArray(raw) && raw.length > 0) {
                        images = raw.filter(img => img && typeof img === 'string' && img.trim() !== '');
                    }
                    if (images.length === 0 && selectedSeminar.imageUrl && typeof selectedSeminar.imageUrl === 'string' && selectedSeminar.imageUrl.trim() !== '') {
                        images = [selectedSeminar.imageUrl];
                    }
                    if (images.length === 0 && selectedSeminar.img && typeof selectedSeminar.img === 'string' && selectedSeminar.img.trim() !== '') {
                        images = [selectedSeminar.img];
                    }
                    
                    const hasImages = images.length > 0;
                    
                    return (
                    <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={(e) => { 
                        if (e.target === e.currentTarget) {
                            setSelectedSeminar(null);
                            setCurrentImageIndex(0);
                        }
                    }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[76.8rem] z-10 max-h-[90vh] flex flex-col md:flex-row md:items-start overflow-hidden relative max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            {/* 이미지: 잘림 없음(object-contain) + 여백 없음(컨테이너 비율=이미지 비율, 오른쪽 높이 맞춤) */}
                            <div
                                ref={leftColRef}
                                className="flex-[0_0_100%] md:flex-[0_0_480px] md:shrink-0 lg:flex-[0_0_540px] relative bg-gray-50 overflow-hidden max-h-[90vh] p-0"
                                style={{ aspectRatio: hasImages ? currentAspectRatio : undefined }}
                            >
                                {hasImages ? (
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div
                                            className="h-full flex transition-transform ease-out"
                                            style={{
                                                width: `${images.length * 100}%`,
                                                transform: `translateX(-${currentImageIndex * (100 / images.length)}%)`,
                                                transitionDuration: `${SLIDE_TRANSITION_MS}ms`,
                                            }}
                                        >
                                            {images.map((src, idx) => (
                                                <div key={idx} className="shrink-0 h-full" style={{ width: `${100 / images.length}%` }}>
                                                    <img
                                                        src={src}
                                                        alt={`${selectedSeminar.title} ${idx + 1}`}
                                                        className="w-full h-full object-contain"
                                                        loading="lazy"
                                                        decoding="async"
                                                        onLoad={(e) => {
                                                            if (e.target.naturalWidth && e.target.naturalHeight) {
                                                                const ratio = e.target.naturalWidth / e.target.naturalHeight;
                                                                setImageAspectRatios(prev => (prev[idx] === ratio ? prev : { ...prev, [idx]: ratio }));
                                                            }
                                                        }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            const placeholder = e.target.nextElementSibling;
                                                            if (placeholder) placeholder.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div className="hidden w-full h-full items-center justify-center bg-gray-100">
                                                        <div className="text-center">
                                                            <Icons.Camera className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                                                            <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 min-h-[280px]">
                                        <div className="text-center">
                                            <Icons.Camera className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">이미지가 없습니다</p>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                                        {selectedSeminar.category && (
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full shadow-sm ${getCategoryColor(selectedSeminar.category)}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                                                {selectedSeminar.category}
                                            </span>
                                        )}
                                    <span className="text-xs font-bold px-2 py-1 bg-white/90 text-gray-700 rounded-full shadow-sm">
                                            {(() => {
                                                const fee = selectedSeminar.applicationFee != null ? Number(selectedSeminar.applicationFee) : 0;
                                                const price = selectedSeminar.price != null ? Number(selectedSeminar.price) : 0;
                                                const isPaid = fee > 0 || (selectedSeminar.requiresPayment && price > 0);
                                                return isPaid ? '유료' : '무료';
                                            })()}
                                        </span>
                                    </div>
                                {hasImages && images.length > 1 && (
                                    <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                                className={`h-2 rounded-full transition-all ${currentImageIndex === idx ? 'w-6 bg-white/90 shadow-sm' : 'w-2 bg-white/50 hover:bg-white/70'}`}
                                                aria-label={`이미지 ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                )}
                                </div>
                            {/* 오른쪽: 모달 바닥까지 채워서 버튼 바 밀착 */}
                            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden self-stretch" style={leftColumnHeightPx ? { maxHeight: `${leftColumnHeightPx}px`, minHeight: `${leftColumnHeightPx}px` } : undefined}>
                                <div className="flex-1 min-h-0 p-6 md:p-8 overflow-y-auto modal-scroll" style={{ minWidth: '0' }}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusColor(selectedSeminar.status)}`}>{selectedSeminar.status}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-dark mb-4">{selectedSeminar.title}</h3>
                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        <div className="flex items-center gap-2"><Icons.Calendar size={16} /> {selectedSeminar.date}</div>
                                        {selectedSeminar.location && <div className="flex items-center gap-2"><Icons.MapPin size={16} /> {selectedSeminar.location}</div>}
                                        <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: '1.3em' }}>
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl border-2 border-blue-200 bg-blue-50/80 font-semibold text-dark">
                                                {(() => {
                                                    const fee = selectedSeminar.applicationFee != null ? Number(selectedSeminar.applicationFee) : 0;
                                                    const price = selectedSeminar.price != null ? Number(selectedSeminar.price) : 0;
                                                    const isPaid = fee > 0 || (selectedSeminar.requiresPayment && price > 0);
                                                    return isPaid ? '유료' : '무료';
                                                })()}
                                            </span>
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl border-2 border-blue-200 bg-blue-50/80 font-semibold text-dark">
                                                신청비용 {getFeeLabel(selectedSeminar)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-soft p-6 rounded-2xl border border-brand/5 mb-6">
                                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedSeminar.desc}</p>
                                    </div>
                                </div>
                                {/* 하단 3등분: 신청 비율에 따른 색상(파랑→초록→빨강), 버튼 위치·패딩 조정 */}
                                {(() => {
                                    const max = Number(selectedSeminar.maxParticipants) || 0;
                                    const current = Number(selectedSeminar.currentParticipants) || 0;
                                    const left = max - current;
                                    const ratio = max > 0 ? current / max : 0;
                                    const isApplyState = selectedSeminar.status !== '종료' && selectedSeminar.status !== '후기작성가능';
                                    let barBg = 'bg-brand';
                                    let barHover = 'hover:bg-blue-700';
                                    if (isApplyState && max > 0) {
                                        if (left <= 3) {
                                            barBg = 'bg-red-600';
                                            barHover = 'hover:bg-red-700';
                                        } else if (ratio >= 2 / 3) {
                                            barBg = 'bg-green-600';
                                            barHover = 'hover:bg-green-700';
                                        } else {
                                            barBg = 'bg-brand';
                                            barHover = 'hover:bg-blue-700';
                                        }
                                    }
                                    return (
                                        <div className={`shrink-0 border-t border-gray-200 grid grid-cols-3 divide-x divide-white/20 ${barBg}`}>
                                            <div className="flex items-center justify-center py-4 px-3 min-h-[76px]">
                                                <span className="text-sm font-semibold text-white whitespace-nowrap">
                                                    신청인원 {selectedSeminar.currentParticipants || 0}/{selectedSeminar.maxParticipants || 0}
                                                </span>
                                            </div>
                                            {currentUser ? (() => {
                                                const btnConfig = getButtonConfig(selectedSeminar);
                                                const disabledClass = btnConfig.disabled ? 'opacity-75 cursor-not-allowed' : `${barHover} cursor-pointer`;
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => { btnConfig.onClick && btnConfig.onClick(); }}
                                                        disabled={btnConfig.disabled}
                                                        className={`flex items-center justify-center py-4 px-3 min-h-[76px] font-bold text-sm text-white transition-colors w-full ${disabledClass}`}
                                                    >
                                                        {btnConfig.text}
                                                    </button>
                                                );
                                            })() : (
                                                <div className="flex items-center justify-center py-4 px-3 min-h-[76px]">
                                                    <span className="text-sm font-semibold text-white">{getFeeLabel(selectedSeminar)}</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedSeminar(null); setCurrentImageIndex(0); }}
                                                className={`flex items-center justify-center py-4 px-3 min-h-[76px] font-bold text-sm text-white transition-colors w-full ${barHover} cursor-pointer`}
                                            >
                                                닫기
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                    </ModalPortal>
);
                })()}

                {showProgramAddModal && (
                    <ProgramAddModal
                        onClose={() => setShowProgramAddModal(false)}
                        onSuccess={() => { onProgramAdded?.(); }}
                    />
                )}
                </div>
            </div>
    );
};

export default AllSeminarsView;
