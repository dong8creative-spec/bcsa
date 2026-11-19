import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from '../components/Icons';
import CalendarSection from '../components/CalendarSection';
import ModalPortal from '../components/ModalPortal';
import { ProgramAddModal } from '../components/ProgramAddModal';
import { useMediaQuery, MOBILE_QUERY } from '../hooks/useMediaQuery';
import { getParticipantCountDisplay, getSeminarCapacity, getDisplayedParticipantCurrent, is정모 } from '../utils/seminarDisplay';
import { getEffectiveCapacityLimit } from '../utils/adminHiddenApplications';
import { MgPageHead, MgWrap, MgCard, MgInfoTable } from '../components/mg/Mg';

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

    const isMobile = useMediaQuery(MOBILE_QUERY);
    
    const ITEMS_PER_PAGE = 3;
    const SLIDE_DURATION_MS = 7000;
    const SLIDE_TRANSITION_MS = 400;

    const currentImageIndexRef = useRef(0);
    const leftColRef = useRef(null);
    const listContainerRef = useRef(null);
    const prevFilterRef = useRef({ searchKeyword: '', selectedCategory: '전체', selectedStatus: '전체', sortBy: 'latest' });
    currentImageIndexRef.current = currentImageIndex;

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
                    getDisplayedParticipantCurrent(b) - getDisplayedParticipantCurrent(a)
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
        if (changed) {
            prevFilterRef.current = { searchKeyword, selectedCategory, selectedStatus, sortBy };
            setCurrentPage(1);
        }
    }, [searchKeyword, selectedCategory, selectedStatus, sortBy]);

    // totalPages가 줄어들었을 때 currentPage가 totalPages를 넘으면 마지막 페이지로 동기화
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const scrollListIntoView = () => {
        listContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 먼저가본 개편(2026-11): 상태 표시는 네모 하나 — 모집중=로얄블루, 마감임박=빨강, 종료·후기작성가능=검정
    const getStatusColor = (status) => {
        switch(status) {
            case '모집중': return 'bg-royal text-white';
            case '마감임박': return 'bg-red-600 text-white';
            case '후기작성가능': return 'bg-ink text-white';
            case '종료': return 'bg-ink text-white';
            default: return 'bg-sky text-royal';
        }
    };
    const getStatusTone = (status) => (status === '마감임박' ? 'alert' : (status === '종료' || status === '후기작성가능') ? 'muted' : 'royal');

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

    const BTN_OFF = 'bg-card text-sub cursor-not-allowed';
    // 버튼 설정 계산 함수
    const getButtonConfig = (seminar) => {
        if (seminar.status === '종료') {
            return { text: '종료', disabled: true, onClick: null, className: BTN_OFF };
        }
        if (seminar.status === '후기작성가능') {
            if (!isEventEnded(seminar)) {
                return { text: '종료 후 후기 작성', disabled: true, onClick: null, className: BTN_OFF };
            }
            const hasApplied = applications?.some(app =>
                String(app.seminarId) === String(seminar.id) && String(app.userId) === String(currentUser?.id)
            );
            if (hasApplied) {
                return {
                    text: '후기쓰기',
                    disabled: false,
                    onClick: () => onWriteReview && onWriteReview(seminar),
                    className: 'bg-[#1a1a1a] text-white hover:bg-black'
                };
            }
            return {
                text: '참여자만',
                disabled: true,
                onClick: () => alert('참여한 프로그램에만 후기를 작성할 수 있습니다.'),
                className: BTN_OFF
            };
        }
        const current = getDisplayedParticipantCurrent(seminar);
        const limit = getEffectiveCapacityLimit(seminar);
        if (Number.isFinite(limit) && current >= limit) {
            return { text: '정원 마감', disabled: true, onClick: null, className: BTN_OFF };
        }
        return {
            text: '참여신청',
            disabled: false,
            onClick: () => onNavigateToApply ? onNavigateToApply(seminar) : (() => {}),
            className: 'bg-royal text-white hover:bg-royalDark'
        };
    };

    const pageTitleText = pageTitles?.programs?.text || menuNames?.['프로그램'] || '프로그램';
    const fieldLabel = 'mb-1.5 block text-[14px] font-semibold text-ink';
    const fieldCls = 'h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] text-ink focus:border-royal focus:outline-none';

    return (
        <div className="min-h-screen min-h-0 overflow-y-auto bg-white">
            <MgPageHead eyebrow="PROGRAMS" title={<span style={{ whiteSpace: 'pre-line' }}>{pageTitleText}</span>} desc="비즈니스 세미나 및 네트워킹">
                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                    {canManagePrograms && (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowProgramAddModal(true); }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-royal px-4 text-[15px] font-bold text-white transition-colors hover:bg-royalDark">
                            <Icons.Plus size={18} /> 프로그램 등록
                        </button>
                    )}
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 px-4 text-[15px] font-bold text-white transition-colors hover:border-white">
                        <Icons.ArrowLeft size={18} /> 메인으로
                    </button>
                </div>
            </MgPageHead>

            <section className="pb-16 pt-10 md:pb-[100px] md:pt-14">
                <MgWrap>
                {/* 검색 및 필터 */}
                <div className="mb-8 border-b border-line pb-6">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_200px_170px_140px]">
                        <label className="col-span-2 min-w-0 md:col-span-1">
                            <span className={fieldLabel}>키워드 검색</span>
                            <span className="relative block">
                                <Icons.Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sub" aria-hidden="true" />
                                <input
                                    type="text"
                                    placeholder="제목 또는 내용 검색"
                                    className={`${fieldCls} pl-10 placeholder:text-[#9a9a9a]`}
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                />
                            </span>
                        </label>
                        <label className="col-span-2 min-w-0 sm:col-span-1">
                            <span className={fieldLabel}>카테고리</span>
                            <select
                                className={`${fieldCls} cursor-pointer`}
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </label>
                        <label className="min-w-0">
                            <span className={fieldLabel}>모집 상태</span>
                            <select
                                className={`${fieldCls} cursor-pointer`}
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </label>
                        <label className="min-w-0">
                            <span className={fieldLabel}>정렬</span>
                            <select
                                className={`${fieldCls} cursor-pointer`}
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="latest">최신순</option>
                                <option value="popular">인기순</option>
                                <option value="date">날짜순</option>
                            </select>
                        </label>
                    </div>
                    <p className="mt-4 text-[14px] text-sub" aria-live="polite">
                        검색 결과: <span className="font-semibold text-royal">{sortedSeminars.length}</span>개
                    </p>
                </div>

                {/* 프로그램 목록 — 3:2 그림 카드(MgCard) 3열, 휴대폰 2열 */}
                {sortedSeminars.length > 0 ? (
                    <div ref={listContainerRef} className="grid scroll-mt-28 grid-cols-2 gap-x-2.5 gap-y-8 md:grid-cols-3 md:gap-x-3">
                        {currentPageSeminars.map((seminar) => {
                            // images/imageUrls 배열 또는 imageUrl/img 단일 필드 호환
                            const displayImage = (seminar.images && seminar.images.length > 0)
                                ? seminar.images[0]
                                : (seminar.imageUrls && seminar.imageUrls.length > 0)
                                    ? seminar.imageUrls[0]
                                    : seminar.imageUrl || seminar.img;
                            const max = getSeminarCapacity(seminar);
                            const currentCount = getDisplayedParticipantCurrent(seminar);
                            const isPopular = !!displayImage && ((seminar.title || '').includes('정모') || (max > 0 && currentCount / max >= 0.8));
                            const imageCount = (seminar.images || seminar.imageUrls || []).length;
                            const d = getParticipantCountDisplay(seminar);
                            const btnConfig = currentUser ? getButtonConfig(seminar) : null;

                            return (
                            <div key={seminar.id} data-seminar-id={seminar.id} className="flex h-full min-w-0 flex-col">
                                <MgCard
                                    image={displayImage}
                                    state={`${seminar.status || '모집중'}${isPopular ? ' · 인기' : ''}`}
                                    stateTone={getStatusTone(seminar.status)}
                                    title={<span className="text-ink">{seminar.title}</span>}
                                    meta={(
                                        <>
                                            {/* 정보는 늘 2줄(줄마다 한 줄 고정) — 글 양과 상관없이 카드 높이가 같다 */}
                                            <span className="block truncate text-sub">{[seminar.date, seminar.location].filter(Boolean).join(' · ') || '\u00a0'}</span>
                                            <span className="block truncate">
                                                신청 {d.mode === 'noCapacity' ? <><span className="font-semibold">{d.current}</span>명</> : <>{d.current} / {d.max}명</>}
                                                <span className="text-sub">
                                                    {' · '}{[getFeeLabel(seminar), seminar.category].filter(Boolean).join(' · ')}
                                                    {imageCount > 1 ? <> · 사진 {imageCount}장</> : null}
                                                </span>
                                            </span>
                                        </>
                                    )}
                                    onClick={() => { if (isMobile && onNavigateToApply) { onNavigateToApply(seminar); } else { setSelectedSeminar(seminar); } }}
                                />
                                {btnConfig && (
                                    <div className="mt-auto pt-3">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); btnConfig.onClick && btnConfig.onClick(); }}
                                            disabled={btnConfig.disabled}
                                            className={`h-11 w-full truncate rounded-lg px-3 text-[15px] font-bold transition-colors ${btnConfig.className}`}
                                        >
                                            {btnConfig.text}
                                        </button>
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">등록된 프로그램이 없습니다.</p>
                )}

                {/* 페이지네이션 */}
                {sortedSeminars.length > 0 && totalPages > 1 && (
                    <nav aria-label="프로그램 목록 페이지" className="my-10 flex flex-wrap items-center justify-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                scrollListIntoView();
                            }}
                            disabled={currentPage === 1}
                            aria-label="이전 페이지"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Icons.ChevronLeft size={20} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => {
                                    setCurrentPage(page);
                                    scrollListIntoView();
                                }}
                                aria-current={currentPage === page ? 'page' : undefined}
                                className={`h-11 min-w-[44px] rounded-lg px-2 text-[15px] font-semibold transition-colors ${
                                    currentPage === page
                                        ? 'bg-ink text-white'
                                        : 'border border-line2 bg-white text-ink hover:border-ink'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                scrollListIntoView();
                            }}
                            disabled={currentPage === totalPages}
                            aria-label="다음 페이지"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Icons.ChevronRight size={20} />
                        </button>
                    </nav>
                )}

                {/* 프로그램 일정표 */}
                <div className="mt-14">
                <CalendarSection
                    seminars={safeSeminars}
                    onSelectSeminar={isMobile ? (seminar) => onNavigateToApply && onNavigateToApply(seminar) : (seminar) => setSelectedSeminar(seminar)}
                    currentUser={currentUser}
                    onWriteReview={onWriteReview}
                    applications={safeApplications}
                />
                </div>
                </MgWrap>
            </section>

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
                    const closeModal = () => { setSelectedSeminar(null); setCurrentImageIndex(0); };

                    return (
                    <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeModal();
                        }
                    }}>
                    <div className="absolute inset-0 bg-black/50" aria-hidden="true"></div>
                        <div role="dialog" aria-modal="true" aria-labelledby="seminar-modal-title" className="relative z-10 flex max-h-[90vh] w-full max-w-[76.8rem] flex-col overflow-hidden rounded-[18px] bg-white md:flex-row md:items-start" onClick={(e) => e.stopPropagation()}>
                            {/* 이미지: 잘림 없음(object-contain) + 여백 없음(컨테이너 비율=이미지 비율, 오른쪽 높이 맞춤) */}
                            <div
                                ref={leftColRef}
                                className="relative max-h-[90vh] flex-[0_0_100%] overflow-hidden bg-[#f6f6f6] p-0 md:shrink-0 md:flex-[0_0_480px] lg:flex-[0_0_540px]"
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
                                                    <div className="hidden h-full w-full items-center justify-center bg-[#f6f6f6]">
                                                        <div className="text-center">
                                                            <Icons.Camera className="mx-auto mb-2 h-12 w-12 text-sub" />
                                                            <p className="text-[14px] text-sub">이미지를 불러올 수 없습니다</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-[#f6f6f6]">
                                        <div className="text-center">
                                            <Icons.Camera className="mx-auto mb-2 h-12 w-12 text-sub" />
                                            <p className="text-[14px] text-sub">이미지가 없습니다</p>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                                    {selectedSeminar.category && (
                                        <span className="bg-white px-2 py-1 text-[13px] font-semibold text-ink">
                                            {selectedSeminar.category}
                                        </span>
                                    )}
                                    <span className="bg-white px-2 py-1 text-[13px] font-semibold text-ink">
                                        {(() => {
                                            const fee = selectedSeminar.applicationFee != null ? Number(selectedSeminar.applicationFee) : 0;
                                            const price = selectedSeminar.price != null ? Number(selectedSeminar.price) : 0;
                                            const isPaid = fee > 0 || (selectedSeminar.requiresPayment && price > 0);
                                            return isPaid ? '유료' : '무료';
                                        })()}
                                    </span>
                                </div>
                                {hasImages && images.length > 1 && (
                                    <div className="absolute bottom-[10px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                                className={`h-2 rounded-full transition-all ${currentImageIndex === idx ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'}`}
                                                aria-label={`이미지 ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                )}
                                </div>
                            {/* 오른쪽: 모달 바닥까지 채워서 버튼 바 밀착 */}
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden" style={leftColumnHeightPx ? { maxHeight: `${leftColumnHeightPx}px`, minHeight: `${leftColumnHeightPx}px` } : undefined}>
                                <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-6 md:p-8" style={{ minWidth: '0' }}>
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <span className={`inline-flex h-6 items-center px-2 text-[12.5px] font-semibold ${getStatusColor(selectedSeminar.status)}`}>{selectedSeminar.status}</span>
                                        <button type="button" onClick={closeModal} aria-label="닫기" className="-mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink">
                                            <Icons.X size={20} />
                                        </button>
                                    </div>
                                    <h3 id="seminar-modal-title" className="mb-5 break-keep text-[22px] font-bold leading-snug text-ink md:text-[24px]">{selectedSeminar.title}</h3>
                                    <MgInfoTable
                                        className="mb-6"
                                        rows={[
                                            ['일시', selectedSeminar.date || '\u00a0'],
                                            ['장소', selectedSeminar.location || null],
                                            ['신청비용', (
                                                <span className="font-semibold">
                                                    {(() => {
                                                        const fee = selectedSeminar.applicationFee != null ? Number(selectedSeminar.applicationFee) : 0;
                                                        const price = selectedSeminar.price != null ? Number(selectedSeminar.price) : 0;
                                                        const isPaid = fee > 0 || (selectedSeminar.requiresPayment && price > 0);
                                                        return isPaid ? '유료' : '무료';
                                                    })()}
                                                    {' · '}{getFeeLabel(selectedSeminar)}
                                                </span>
                                            )],
                                        ]}
                                    />
                                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#333] md:text-[16px]">{selectedSeminar.desc}</p>
                                </div>
                                {/* 하단 3등분: 남은 자리에 따라 색(로얄블루 → 검정(2/3 이상 찼을 때) → 빨강(3자리 이하)) */}
                                {(() => {
                                    const max = getSeminarCapacity(selectedSeminar);
                                    const current = getDisplayedParticipantCurrent(selectedSeminar);
                                    const left = max - current;
                                    const ratio = max > 0 ? current / max : 0;
                                    const isApplyState = selectedSeminar.status !== '종료' && selectedSeminar.status !== '후기작성가능';
                                    let barBg = 'bg-royal';
                                    let barHover = 'hover:bg-royalDark';
                                    if (isApplyState && max > 0) {
                                        if (left <= 3) {
                                            barBg = 'bg-red-600';
                                            barHover = 'hover:bg-red-700';
                                        } else if (ratio >= 2 / 3) {
                                            barBg = 'bg-[#1a1a1a]';
                                            barHover = 'hover:bg-black';
                                        } else {
                                            barBg = 'bg-royal';
                                            barHover = 'hover:bg-royalDark';
                                        }
                                    }
                                    const participantLabel =
                                        max <= 0 ? (
                                            <>신청 <span className="font-bold">{current}</span>명</>
                                        ) : (
                                            <>신청인원 {current}/{max}</>
                                        );
                                    return (
                                        <div className={`grid shrink-0 grid-cols-3 divide-x divide-white/20 ${barBg}`}>
                                            <div className="flex min-h-[64px] items-center justify-center px-3 py-4">
                                                <span className="whitespace-nowrap text-[15px] font-semibold text-white">
                                                    {participantLabel}
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
                                                        className={`flex min-h-[64px] w-full items-center justify-center px-3 py-4 text-[16px] font-bold text-white transition-colors ${disabledClass}`}
                                                    >
                                                        {btnConfig.text}
                                                    </button>
                                                );
                                            })() : (
                                                <div className="flex min-h-[64px] items-center justify-center bg-black/25 px-3 py-4">
                                                    <span className="text-center text-[15px] font-semibold text-white">로그인 후 신청가능</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={closeModal}
                                                className={`flex min-h-[64px] w-full cursor-pointer items-center justify-center px-3 py-4 text-[16px] font-bold text-white transition-colors ${barHover}`}
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
    );
};

export default AllSeminarsView;
