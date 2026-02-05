import React, { useState, useEffect, useMemo } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import CalendarSection from '../components/CalendarSection';
import ModalPortal from '../components/ModalPortal';

const AllSeminarsView = ({ onBack, seminars = [], onApply, onNavigateToApply, currentUser, menuNames = {}, waitForKakaoMap, openKakaoPlacesSearch, pageTitles = {}, onWriteReview, applications = [], communityPosts = [] }) => {
    // props 안전성 검증
    const safeSeminars = Array.isArray(seminars) ? seminars : [];
    const safeApplications = Array.isArray(applications) ? applications : [];
    const safeCommunityPosts = Array.isArray(communityPosts) ? communityPosts : [];
    
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedStatus, setSelectedStatus] = useState('전체');
    const [sortBy, setSortBy] = useState('latest');
    const [selectedSeminar, setSelectedSeminar] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0); // 이미지 갤러리 현재 인덱스
    const [showReviews, setShowReviews] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    const ITEMS_PER_PAGE = 3;
    
    // selectedSeminar가 변경될 때 이미지 인덱스·후기 펼침 초기화
    useEffect(() => {
        setCurrentImageIndex(0);
        setShowReviews(false);
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

    // 페이지네이션 계산
    const totalPages = Math.ceil(sortedSeminars.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageSeminars = sortedSeminars.slice(startIndex, endIndex);

    // 검색/필터 변경 시 첫 페이지로 리셋
    useEffect(() => {
        setCurrentPage(1);
    }, [searchKeyword, selectedCategory, selectedStatus, sortBy]);

    const getStatusColor = (status) => {
        switch(status) {
            case '모집중': return 'bg-blue-100 text-blue-700';
            case '마감임박': return 'bg-orange-100 text-orange-700';
            case '후기작성가능': return 'bg-green-100 text-green-700';
            case '종료': return 'bg-gray-100 text-gray-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // 버튼 설정 계산 함수
    const getButtonConfig = (seminar) => {
        if (seminar.status === '종료') {
            return { text: '종료', disabled: true, onClick: null, className: 'bg-gray-300 text-gray-500 cursor-not-allowed' };
        }
        if (seminar.status === '후기작성가능') {
            const hasApplied = applications?.some(app => 
                String(app.seminarId) === String(seminar.id) && String(app.userId) === String(currentUser?.id)
            );
            if (hasApplied) {
                return { 
                    text: '후기쓰기', 
                    disabled: false, 
                    onClick: () => onWriteReview && onWriteReview(seminar),
                    className: 'bg-green-600 text-white hover:bg-green-700'
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
            text: '신청하기', 
            disabled: false, 
            onClick: () => onNavigateToApply ? onNavigateToApply(seminar) : (() => {}),
            className: 'bg-brand text-white hover:bg-blue-700'
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
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="programs" pageTitles={pageTitles} defaultText={menuNames?.['프로그램'] || '프로그램'} />
                        <p className="text-gray-500 text-sm">비즈니스 세미나 및 네트워킹</p>
                                </div>
                    <div className="flex items-center gap-3">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentPageSeminars.map((seminar) => {
                            // images/imageUrls 배열 또는 imageUrl/img 단일 필드 호환
                            const displayImage = (seminar.images && seminar.images.length > 0)
                                ? seminar.images[0]
                                : (seminar.imageUrls && seminar.imageUrls.length > 0)
                                    ? seminar.imageUrls[0]
                                    : seminar.imageUrl || seminar.img;
                            
                            return (
                            <div key={seminar.id} data-seminar-id={seminar.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-blue-200 hover:border-brand/20 cursor-pointer overflow-hidden" onClick={() => setSelectedSeminar(seminar)}>
                                {displayImage && (
                                    <div className="w-full overflow-hidden relative" style={{ aspectRatio: '3/4' }}>
                                        <img src={displayImage} alt={seminar.title} className="w-full h-full object-cover" />
                                        {/* 이미지가 여러 장일 경우 표시 */}
                                        {((seminar.images && seminar.images.length > 1) || (seminar.imageUrls && seminar.imageUrls.length > 1)) && (
                                            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                                <Icons.Camera size={12} className="inline mr-1" />
                                                {(seminar.images || seminar.imageUrls || []).length}
                                            </div>
                                        )}
                                        </div>
                                )}
                                <div className="p-6">
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
                                        <span className="text-xs text-gray-500">신청: {seminar.currentParticipants || 0} / {seminar.maxParticipants || 0}명</span>
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
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand transition-colors"
                        >
                            <Icons.ChevronLeft size={20} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
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
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
                    
                    // currentImageIndex가 유효한 범위 내에 있는지 확인
                    const validIndex = images.length > 0 
                        ? Math.min(currentImageIndex, images.length - 1)
                        : 0;
                    const currentImage = images.length > 0 ? images[validIndex] : null;
                    const hasImages = images.length > 0;
                    const reviewsForSeminar = safeCommunityPosts.filter(p => p.category === '프로그램 후기' && String(p.seminarId) === String(selectedSeminar?.id));
                    const ratingsOnly = reviewsForSeminar.filter(p => p.rating != null && Number(p.rating) > 0);
                    const avgRating = ratingsOnly.length > 0 ? (ratingsOnly.reduce((a, p) => a + Number(p.rating), 0) / ratingsOnly.length).toFixed(1) : null;
                    
                    return (
                    <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-start justify-center p-4 pt-20" onClick={(e) => { 
                        if (e.target === e.currentTarget) {
                            setSelectedSeminar(null);
                            setCurrentImageIndex(0);
                        }
                    }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl z-10 max-h-[calc(100vh-5rem)] flex flex-col md:flex-row overflow-hidden relative max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            {avgRating != null && (
                                <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-bold" aria-label="평균 별점">
                                    평균 ★ {avgRating}
                                </div>
                            )}
                            {/* 이미지 갤러리 영역 (왼쪽, md 이상에서 고정 너비) */}
                            <div className="flex-[0_0_100%] md:flex-[0_0_400px] md:shrink-0 lg:flex-[0_0_450px] relative bg-gray-50" style={{ minHeight: '280px' }}>
                                {hasImages && currentImage ? (
                                    <>
                                        <img 
                                            src={currentImage} 
                                            alt={selectedSeminar.title} 
                                            className="w-full h-full object-contain cursor-pointer" 
                                            style={{ maxHeight: '90vh' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (images.length > 1) {
                                                    setCurrentImageIndex((prev) => (prev + 1) % images.length);
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
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                        <div className="text-center">
                                            <Icons.Camera className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">이미지가 없습니다</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* 이미지가 여러 장일 경우 네비게이션 */}
                                {hasImages && images.length > 1 && (
                                    <>
                                        {/* 이전 버튼 */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
                                            }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors z-10"
                                        >
                                            <Icons.ChevronLeft size={20} />
                                        </button>
                                        {/* 다음 버튼 */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentImageIndex((prev) => (prev + 1) % images.length);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors z-10"
                                        >
                                            <Icons.ChevronRight size={20} />
                                        </button>
                                        {/* 이미지 인덱스 표시 */}
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full z-10">
                                            {validIndex + 1} / {images.length}
                                        </div>
                                        {/* 썸네일 목록 (하단) */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3 z-10">
                                            <div className="flex gap-2 justify-center overflow-x-auto">
                                                {images.map((img, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentImageIndex(idx);
                                                        }}
                                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                                            idx === validIndex 
                                                                ? 'border-white scale-110' 
                                                                : 'border-white/50 opacity-60 hover:opacity-100'
                                                        }`}
                                                    >
                                                        <img 
                                                            src={img} 
                                                            alt={`${idx + 1}`} 
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
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
                                                const amount = fee > 0 ? fee : price;
                                                return isPaid ? (amount > 0 ? `${amount.toLocaleString()}원` : '유료') : '무료';
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            {/* 오른쪽: 텍스트 + 고정 푸터(버튼) + 후기 목록 */}
                            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                <div className="flex-1 min-h-0 p-6 md:p-8 overflow-y-auto modal-scroll" style={{ minWidth: '0' }}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusColor(selectedSeminar.status)}`}>{selectedSeminar.status}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-dark mb-4">{selectedSeminar.title}</h3>
                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        <div className="flex items-center gap-2"><Icons.Calendar size={16} /> {selectedSeminar.date}</div>
                                        {selectedSeminar.location && <div className="flex items-center gap-2"><Icons.MapPin size={16} /> {selectedSeminar.location}</div>}
                                    </div>
                                    <div className="bg-soft p-6 rounded-2xl border border-brand/5 mb-6">
                                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedSeminar.desc}</p>
                                    </div>
                                    <p className="text-sm text-gray-500">신청: {selectedSeminar.currentParticipants || 0} / {selectedSeminar.maxParticipants || 0}명</p>
                                </div>
                                <div className="shrink-0 border-t border-blue-200 p-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {currentUser && (() => {
                                            const btnConfig = getButtonConfig(selectedSeminar);
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => { btnConfig.onClick && btnConfig.onClick(); }}
                                                    disabled={btnConfig.disabled}
                                                    className={`px-6 py-3 font-bold rounded-xl transition-colors ${btnConfig.className}`}
                                                >
                                                    {btnConfig.text}
                                                </button>
                                            );
                                        })()}
                                        <button type="button" onClick={() => setShowReviews(prev => !prev)} className="px-6 py-3 font-bold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                                            후기 보기 {(() => {
                                                return reviewsForSeminar.length > 0 ? `(${reviewsForSeminar.length})` : '';
                                            })()}
                                        </button>
                                    </div>
                                    <button type="button" onClick={() => { setSelectedSeminar(null); setCurrentImageIndex(0); setShowReviews(false); }} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                        닫기
                                    </button>
                                </div>
                                {showReviews && (
                                    <div className="shrink-0 border-t border-blue-200 max-h-60 overflow-y-auto bg-gray-50">
                                        <div className="p-4 space-y-3">
                                            <h4 className="text-sm font-bold text-dark">후기글</h4>
                                            {(() => {
                                                if (reviewsForSeminar.length === 0) return <p className="text-sm text-gray-500">등록된 후기가 없습니다.</p>;
                                                return reviewsForSeminar.map((post) => (
                                                    <div key={post.id || post.title} className="bg-white rounded-xl p-4 border border-blue-100 text-sm">
                                                        <div className="flex gap-1 mb-2">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Icons.Star
                                                                    key={star}
                                                                    className={`w-4 h-4 ${(post.rating != null && post.rating >= star) ? 'text-yellow-400' : 'text-gray-300'}`}
                                                                    style={(post.rating != null && post.rating >= star) ? { fill: 'currentColor' } : {}}
                                                                />
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-gray-600 mb-2">
                                                            {(post.author || post.authorName) || '작성자'} · {(post.company || post.authorCompany) || '—'}
                                                        </p>
                                                        <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    </ModalPortal>
);
                })()}

                </div>
            </div>
    );
};

export default AllSeminarsView;
