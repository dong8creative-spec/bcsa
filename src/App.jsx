import React, { useState, useEffect, useRef } from 'react';
import { firebaseService } from './services/firebaseService';
import { authService } from './services/authService';
import { CONFIG } from './config';
import { calculateStatus, fetchSheetData } from './utils';
import { uploadImageToImgBB, uploadLogoOrFaviconToGitHub, resizeImage, fileToBase64 } from './utils/imageUtils';
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
import { PORTONE_IMP_CODE } from './constants';
import { defaultContent } from './constants/content';
import PageTitle from './components/PageTitle';
import NoticeView from './pages/NoticeView';
import AboutView from './pages/AboutView';
import MyPageView from './pages/MyPageView';
import AllMembersView from './pages/AllMembersView';
import AllSeminarsView from './pages/AllSeminarsView';
import CalendarSection from './components/CalendarSection';
import { Icons } from './components/Icons';

const IMGBB_API_KEY = CONFIG.IMGBB?.API_KEY || '4c975214037cdf1889d5d02a01a7831d';

// 유틸리티 함수들은 별도 파일로 분리됨
// uploadImageToImgBB, uploadLogoOrFaviconToGitHub, resizeImage, fileToBase64는 imageUtils에서 import
// translateFirebaseError는 errorUtils에서 import
// loadUsersFromStorage, hashPassword, verifyPassword, generateTemporaryPassword, sendEmailViaEmailJS, saveUsersToStorage, loadCurrentUserFromStorage, saveCurrentUserToStorage는 authUtils에서 import

// 상수들은 별도 파일로 분리됨
// PORTONE_IMP_CODE는 constants/index.js에서 import
// SHEET_URL은 CONFIG.SHEET_URLS로 통일됨
// 모든 아이콘은 components/Icons.jsx의 Icons 객체를 통해 통일된 방식으로 사용
// defaultContent는 constants/content.js에서 import

// PageTitle은 components/PageTitle.jsx로 분리됨

// MyPageView는 별도 파일로 분리됨

// View Components 시작

// BidSearchView 컴포넌트 삭제됨 - 입찰공고 기능 제거

// NoticeView는 별도 파일로 분리됨

// AllMembersView는 별도 파일로 분리됨

// View Components 시작
// CalendarSection은 components/CalendarSection.jsx로 분리됨

// ==========================================
// View 컴포넌트들
// ==========================================

const CommunityView = ({ onBack, posts, onCreate, onDelete, currentUser, onNotifyAdmin, seminars, setShowLoginModal, pageTitles, menuNames }) => {
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedPost, setSelectedPost] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [formData, setFormData] = useState({ 
        category: '인력구인', 
        title: '', 
        content: '', 
        isSecret: false, 
        password: '',
        // 인력구인 필드
        jobDetails: '',
        recruitCount: '',
        workHours: '',
        salary: '',
        preferred: '',
        deadline: '',
        storeLocation: '',
        storePhone: '',
        storeImages: [],
        // 중고거래 필드
        itemName: '',
        itemCategory: '',
        price: '',
        itemCondition: '',
        tradeMethod: '',
        tradeLocation: '',
        itemImages: [],
        businessNumber: '',
        // 프로그램 후기 필드
        rating: 0,
        reviewImages: [],
        seminarId: null,
        seminarTitle: null
    });
    const [uploadingImages, setUploadingImages] = useState(false);
    
    // 신청한 프로그램 목록 가져오기
    const getAppliedSeminars = () => {
        if (!currentUser || !seminars) return [];
        try {
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const applications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                const appliedSeminarIds = applications
                    .filter(app => app.userId === currentUser.id)
                    .map(app => app.seminarId);
                return seminars.filter(seminar => appliedSeminarIds.includes(seminar.id));
            }
            return [];
        } catch (error) {
            
            return [];
        }
    };
    
    const appliedSeminars = getAppliedSeminars();
    
    // 관리자 여부 확인 (localStorage에서 adminAuthenticated 확인)
    const isCurrentUserAdmin = typeof localStorage !== 'undefined' && localStorage.getItem('adminAuthenticated') === 'true';
    
    // 공지사항과 일반 게시글 분리
    const noticePosts = posts.filter(p => p.category === '공지사항');
    const categories = isCurrentUserAdmin 
        ? ['전체', '공지사항', '프로그램 후기', '인력구인', '중고거래', '건의사항']
        : ['전체', '프로그램 후기', '인력구인', '중고거래', '건의사항'];
    
    const filteredPosts = selectedCategory === '전체' 
        ? posts.filter(p => p.category !== '공지사항')
        : posts.filter(p => p.category === selectedCategory);
    
    const handleImageUpload = async (files, imageType) => {
        const maxImages = 3;
        let currentImages;
        if (imageType === 'store') {
            currentImages = formData.storeImages;
        } else if (imageType === 'review') {
            currentImages = formData.reviewImages;
        } else {
            currentImages = formData.itemImages;
        }
        
        if (currentImages.length + files.length > maxImages) {
            alert(`최대 ${maxImages}장까지만 업로드할 수 있습니다.`);
            return;
        }

        setUploadingImages(true);
        const uploadPromises = Array.from(files).map(async (file) => {
            try {
            const base64Image = await fileToBase64(file);
                const resizedImage = await resizeImage(file, 1200, 800, 0.9);
                const result = await uploadImageToImgBB(resizedImage, file.name);
            return result.url;
        } catch (error) {
                
                alert(`${file.name} 업로드에 실패했습니다.`);
            return null;
        }
        });

        const uploadedUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
        
        if (imageType === 'store') {
            setFormData({...formData, storeImages: [...currentImages, ...uploadedUrls]});
        } else if (imageType === 'review') {
            setFormData({...formData, reviewImages: [...currentImages, ...uploadedUrls]});
            } else {
            setFormData({...formData, itemImages: [...currentImages, ...uploadedUrls]});
        }
        setUploadingImages(false);
    };

    const handleRemoveImage = (index, imageType) => {
        if (imageType === 'store') {
            setFormData({...formData, storeImages: formData.storeImages.filter((_, i) => i !== index)});
        } else if (imageType === 'review') {
            setFormData({...formData, reviewImages: formData.reviewImages.filter((_, i) => i !== index)});
            } else {
            setFormData({...formData, itemImages: formData.itemImages.filter((_, i) => i !== index)});
        }
    };

    const handleCreatePost = () => {
        if (!formData.title || !formData.content) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        // 인력구인 필수 필드 체크
        if (formData.category === '인력구인') {
            if (!formData.jobDetails || !formData.recruitCount || !formData.workHours || !formData.salary || !formData.deadline || !formData.storeLocation || !formData.storePhone) {
                alert('인력구인 게시글의 모든 필수 항목을 입력해주세요.');
            return;
        }
        }

        // 중고거래 필수 필드 체크
        if (formData.category === '중고거래') {
            if (!formData.itemName || !formData.itemCategory || !formData.price || !formData.itemCondition || !formData.tradeMethod || !formData.tradeLocation || !formData.businessNumber) {
                alert('중고거래 게시글의 모든 필수 항목을 입력해주세요.');
            return;
        }
            // 사업자등록번호 검증
            if (currentUser && currentUser.businessRegistrationNumber && 
                formData.businessNumber !== currentUser.businessRegistrationNumber) {
                if (!confirm('입력하신 사업자등록번호가 회원 정보와 일치하지 않습니다. 계속하시겠습니까?')) {
            return;
        }
            }
        }

        // 프로그램 후기 필수 필드 체크
        if (formData.category === '프로그램 후기') {
            if (!formData.seminarId || !formData.seminarTitle) {
                alert('후기를 작성할 프로그램을 선택해주세요.');
                return;
            }
            // 신청 여부 확인
            try {
                if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                    const applications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                    const hasApplied = applications.some(app => 
                        app.seminarId === formData.seminarId && app.userId === currentUser.id
                    );
                    if (!hasApplied) {
                        alert('신청하신 프로그램에 대해서만 후기를 작성할 수 있습니다.');
                        return;
                    }
                }
            } catch (error) {
                
                alert('신청 정보를 확인할 수 없습니다. 다시 시도해주세요.');
                return;
            }
            if (!formData.rating || formData.rating === 0) {
                alert('별점을 선택해주세요.');
                return;
            }
        }

        // onCreate에 전달할 데이터 준비 (프로그램 후기인 경우 rating과 reviewImages 포함)
        const postData = {
            ...formData,
            ...(formData.category === '프로그램 후기' && {
                rating: formData.rating,
                reviewImages: formData.reviewImages,
                images: formData.reviewImages // 호환성을 위해 images도 유지
            })
        };

        onCreate(postData);
        setFormData({ 
            category: '인력구인', 
            title: '', 
            content: '', 
            isSecret: false, 
            password: '',
            jobDetails: '',
            recruitCount: '',
            workHours: '',
            salary: '',
            preferred: '',
            deadline: '',
            storeLocation: '',
            storePhone: '',
            storeImages: [],
            itemName: '',
            itemCategory: '',
            price: '',
            itemCondition: '',
            tradeMethod: '',
            tradeLocation: '',
            itemImages: [],
            businessNumber: '',
            rating: 0,
            reviewImages: [],
            seminarId: null,
            seminarTitle: null
        });
        setIsCreateModalOpen(false);
    };

    const handleViewPost = (post) => {
        if (!currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            if (setShowLoginModal) {
                setShowLoginModal(true);
            }
            return;
        }
        if (post.isSecret) {
            const password = prompt('비밀번호를 입력하세요:');
            if (password !== post.password) {
                alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        }
        setSelectedPost(post);
    };

    // 비회원 접근 시 로그인 안내 화면
    if (!currentUser) {
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-dark mb-2">커뮤니티</h2>
                            <p className="text-gray-500 text-sm">정보 공유 및 소통 공간</p>
                                    </div>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                            <Icons.ArrowLeft size={20} /> 메인으로
                                </button>
                            </div>
                    <div className="bg-white rounded-3xl shadow-card p-12 text-center">
                        <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icons.Lock size={40} className="text-brand" />
                                                    </div>
                        <h3 className="text-2xl font-bold text-dark mb-4">로그인이 필요한 서비스입니다</h3>
                        <p className="text-gray-600 mb-8">커뮤니티 게시글을 보시려면 로그인이 필요합니다.</p>
                        <div className="flex gap-4 justify-center">
                            <button type="button" onClick={() => { if (setShowLoginModal) setShowLoginModal(true); }} className="px-8 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                                로그인하기
                                                    </button>
                            <button type="button" onClick={onBack} className="px-8 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                메인으로 돌아가기
                                                    </button>
                            </div>
                        </div>
                            </div>
                            </div>
        );
    }

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                                        <div>
                        <h2 className="text-3xl font-bold text-dark mb-2">커뮤니티</h2>
                        <p className="text-gray-500 text-sm">정보 공유 및 소통 공간</p>
                                        </div>
                    <div className="flex gap-3">
                        {currentUser ? (
                            <button type="button" onClick={() => setIsCreateModalOpen(true)} className="px-6 py-2.5 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <Icons.Plus size={18} /> 글쓰기
                                                        </button>
                        ) : null}
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                            <Icons.ArrowLeft size={20} /> 메인으로
                                                    </button>
                                    </div>
                                </div>
                                
                                        {/* 카테고리 필터 */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {categories.map(cat => (
                                                        <button 
                            key={cat}
                                                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                                selectedCategory === cat
                                    ? 'bg-brand text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {cat}
                                                        </button>
                                                ))}
                                                    </div>

                {/* 공지사항 상단 고정 (1줄 표기) */}
                {noticePosts.length > 0 ? (
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-dark mb-4 flex items-center gap-2">
                            <Icons.Info className="text-brand" /> 공지사항
                        </h3>
                        <div className="space-y-2">
                            {noticePosts.map((post) => (
                                                    <div 
                                                        key={post.id} 
                                    className="bg-white rounded-lg p-3 hover:bg-gray-50 transition-all cursor-pointer flex items-center justify-between"
                                    onClick={() => handleViewPost(post)}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-xs font-bold px-2 py-0.5 bg-brand text-white rounded flex-shrink-0">공지</span>
                                        <span className="text-sm font-bold text-dark truncate">{post.title}</span>
                                        <span className="text-xs text-gray-500 flex-shrink-0">{post.author}</span>
                                        <span className="text-xs text-gray-500 flex-shrink-0">{post.date}</span>
                                        <span className="text-xs text-gray-500 flex-shrink-0">조회 {post.views || 0}</span>
                                                        </div>
                                    {isCurrentUserAdmin ? (
                                        <div className="flex gap-2 ml-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                                    setEditingPost(post);
                                                    setFormData({ 
                                                        category: post.category, 
                                                        title: post.title, 
                                                        content: post.content, 
                                                        isSecret: post.isSecret || false, 
                                                        password: post.password || '',
                                                        ...(post.jobDetails && {
                                                            jobDetails: post.jobDetails,
                                                            recruitCount: post.recruitCount,
                                                            workHours: post.workHours,
                                                            salary: post.salary,
                                                            preferred: post.preferred,
                                                            deadline: post.deadline,
                                                            storeLocation: post.storeLocation,
                                                            storePhone: post.storePhone,
                                                            storeImages: post.storeImages || []
                                                        }),
                                                        ...(post.itemName && {
                                                            itemName: post.itemName,
                                                            itemCategory: post.itemCategory,
                                                            price: post.price,
                                                            itemCondition: post.itemCondition,
                                                            tradeMethod: post.tradeMethod,
                                                            tradeLocation: post.tradeLocation,
                                                            itemImages: post.itemImages || [],
                                                            businessNumber: post.businessNumber || ''
                                                        })
                                                    });
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Icons.Edit size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                                    if (confirm('정말 삭제하시겠습니까?')) {
                                                        onDelete(post.id);
                                                    }
                                        }}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                                <Icons.Trash size={14} />
                                    </button>
                                </div>
                                                                    ) : null}
                                                                </div>
                            ))}
                            </div>
                        </div>
                    ) : null}

                {/* 게시글 리스트 */}
                {filteredPosts.length > 0 ? (
                    <div className="space-y-4">
                        {filteredPosts.map((post) => (
                                                    <div 
                                                        key={post.id} 
                                className="bg-white rounded-3xl p-6 shadow-card hover:shadow-lg transition-all border border-transparent hover:border-brand/20"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 cursor-pointer" onClick={() => handleViewPost(post)}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{post.category}</span>
                                            {post.isSecret && <Icons.Lock size={14} className="text-gray-400" />}
                </div>
                                        <h3 className="text-xl font-bold text-dark mb-2">{post.title}</h3>
                                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.content}</p>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span>{post.author}</span>
                                            <span>{post.date}</span>
                                            <span>조회 {post.views || 0}</span>
                                            {post.likes > 0 ? <span>❤️ {post.likes}</span> : null}
            </div>
                        </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isCurrentUserAdmin ? (
                                            <React.Fragment>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingPost(post);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                                    title="수정"
                                                >
                                                    <Icons.Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCommunityDelete(post.id);
                                                    }}
                                                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                                    title="삭제"
                                                >
                                                    <Icons.Trash size={16} />
                                                </button>
                                            </React.Fragment>
                                        ) : null}
                                        <Icons.ArrowRight className="w-5 h-5 text-gray-400 cursor-pointer" onClick={() => handleViewPost(post)} />
                                    </div>
                    </div>
                                            </div>
                                        ))}
                                                    </div>
                                                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>등록된 게시글이 없습니다.</p>
                </div>
            )}

                {/* 게시글 작성 모달 */}
                {isCreateModalOpen ? (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}>
                        <div className="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[calc(90vh-200px)] overflow-y-auto modal-scroll">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-dark">게시글 작성</h3>
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <Icons.X size={24} />
                        </button>
                                                </div>
                                <div className="space-y-4">
                                    <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                                    <select 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                        value={formData.category} 
                                        onChange={(e) => {
                                            const newCategory = e.target.value;
                                            if (!isCurrentUserAdmin && newCategory === '공지사항') {
                                                alert('관리자만 공지사항을 작성할 수 있습니다.');
                                                return;
                                            }
                                            setFormData({
                                                ...formData, 
                                                category: newCategory,
                                                storeImages: [],
                                                itemImages: [],
                                                reviewImages: [],
                                                businessNumber: '',
                                                rating: 0
                                            });
                                        }}
                                    >
                                        {isCurrentUserAdmin && <option value="공지사항">공지사항</option>}
                                            <option value="인력구인">인력구인</option>
                                            <option value="프로그램 후기">프로그램 후기</option>
                                            <option value="건의사항">건의사항</option>
                                        <option value="중고거래">중고거래</option>
                                        </select>
                                    </div>
                                    <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                                    <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                                    </div>
                                    <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                                    <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-48 resize-none" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} />
                                    </div>

                                    {/* 인력구인 추가 필드 */}
                                    {formData.category === '인력구인' ? (
                                        <React.Fragment>
                                                <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">업무 내용 *</label>
                                                <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-32 resize-none" value={formData.jobDetails} onChange={(e) => setFormData({...formData, jobDetails: e.target.value})} placeholder="업무 내용을 상세히 입력해주세요" />
                                                </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">모집 인원 *</label>
                                                    <input type="number" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.recruitCount} onChange={(e) => setFormData({...formData, recruitCount: e.target.value})} placeholder="명" min="1" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">마감일 *</label>
                                                    <input type="date" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
                                            </div>
                                                </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">근무 시간 *</label>
                                                <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.workHours} onChange={(e) => setFormData({...formData, workHours: e.target.value})} placeholder="예: 09:00 ~ 18:00" />
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">급여/처우 *</label>
                                                <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} placeholder="예: 월 250만원, 주 5일" />
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">우대 사항</label>
                                                <textarea className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-24 resize-none" value={formData.preferred} onChange={(e) => setFormData({...formData, preferred: e.target.value})} placeholder="우대 사항을 입력해주세요" />
                                    </div>
                                            <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">매장 위치 *</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                                            value={formData.storeLocation} 
                                                            onChange={(e) => setFormData({...formData, storeLocation: e.target.value})} 
                                                            placeholder="매장 주소" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => openKakaoPlacesSearch((place) => {
                                                                setFormData({
                                                                    ...formData,
                                                                    storeLocation: `${place.name} (${place.address})`
                                                                });
                                                            })}
                                                            className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
                                                        >
                                                            장소 검색
                                                        </button>
                                                    </div>
                                    </div>
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">전화번호 *</label>
                                                    <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.storePhone} onChange={(e) => setFormData({...formData, storePhone: e.target.value})} placeholder="010-1234-5678" />
                                                </div>
                                                    </div>
                                                <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">매장 사진 (최대 3장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.storeImages.map((img, idx) => (
                                                        <div key={idx} className="relative">
                                                            <img src={img} alt={`매장 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, storeImages: formData.storeImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                                    ))}
                                                    {formData.storeImages.length < 3 ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                                                            {uploadingImages ? (
                                                                <div className="text-center">
                                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-2"></div>
                                                                    <span className="text-xs text-gray-500">업로드 중...</span>
                                            </div>
                                                            ) : (
                                                                <div className="text-center">
                                                                    <Icons.Plus size={24} className="text-gray-400 mx-auto mb-1" />
                                                                    <span className="text-xs text-gray-500">사진 추가</span>
                                        </div>
                                                            )}
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                multiple 
                                                                className="hidden" 
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files);
                                                                    if (files.length > 3) {
                                                                        alert('최대 3장까지만 선택할 수 있습니다.');
                                                                        return;
                                                                    }
                                                                    handleImageUpload(files, 'store');
                                                                    e.target.value = '';
                                                                }} 
                                                            />
                                                        </label>
                                                    ) : null}
                            </div>
                                    </div>
                                </React.Fragment>
                                    ) : null}

                                    {/* 중고거래 추가 필드 */}
                                    {formData.category === '중고거래' ? (
                                <React.Fragment>
                                            <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">제품명 *</label>
                                                    <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} placeholder="제품명을 입력해주세요" />
                                    </div>
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">카테고리 *</label>
                                                    <select className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.itemCategory} onChange={(e) => setFormData({...formData, itemCategory: e.target.value})}>
                                                        <option value="">카테고리 선택</option>
                                                        <option value="가전제품">가전제품</option>
                                                        <option value="가구">가구</option>
                                                        <option value="의류">의류</option>
                                                        <option value="전자기기">전자기기</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">가격 *</label>
                                                    <input type="number" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="원" min="0" />
                                        </div>
                                        <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">상태 *</label>
                                                    <select className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.itemCondition} onChange={(e) => setFormData({...formData, itemCondition: e.target.value})}>
                                                        <option value="">상태 선택</option>
                                                        <option value="S급">S급</option>
                                                        <option value="A급">A급</option>
                                                        <option value="B급">B급</option>
                                                        <option value="C급">C급</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">거래 방식 *</label>
                                                    <select className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.tradeMethod} onChange={(e) => setFormData({...formData, tradeMethod: e.target.value})}>
                                                        <option value="">거래 방식 선택</option>
                                                        <option value="직거래">직거래</option>
                                                        <option value="택배">택배</option>
                                                        <option value="직거래/택배">직거래/택배</option>
                                            </select>
                                        </div>
                                        <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">거래 지역 *</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                                            value={formData.tradeLocation} 
                                                            onChange={(e) => setFormData({...formData, tradeLocation: e.target.value})} 
                                                            placeholder="거래 지역을 입력해주세요" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => openKakaoPlacesSearch((place) => {
                                                                setFormData({
                                                                    ...formData,
                                                                    tradeLocation: `${place.name} (${place.address})`
                                                                });
                                                            })}
                                                            className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
                                                        >
                                                            장소 검색
                                                        </button>
                                                    </div>
                                        </div>
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">제품 사진 (최대 3장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.itemImages.map((img, idx) => (
                                                    <div key={idx} className="relative">
                                                            <img src={img} alt={`제품 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, itemImages: formData.itemImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                            ))}
                                                    {formData.itemImages.length < 3 ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                                                            {uploadingImages ? (
                                                                <div className="text-center">
                                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-2"></div>
                                                                    <span className="text-xs text-gray-500">업로드 중...</span>
                                        </div>
                                                            ) : (
                                                                <div className="text-center">
                                                                    <Icons.Plus size={24} className="text-gray-400 mx-auto mb-1" />
                                                                    <span className="text-xs text-gray-500">사진 추가</span>
                                    </div>
                                                            )}
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                multiple 
                                                                className="hidden" 
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files);
                                                                    if (files.length > 3) {
                                                                        alert('최대 3장까지만 선택할 수 있습니다.');
                                                                        return;
                                                                    }
                                                                    handleImageUpload(files, 'item');
                                                                    e.target.value = '';
                                                                }} 
                                                            />
                                                        </label>
                                                    ) : null}
                        </div>
                        </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록번호 * (신뢰도 확인용)</label>
                                                <input type="text" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.businessNumber} onChange={(e) => setFormData({...formData, businessNumber: e.target.value})} placeholder="사업자등록번호를 입력해주세요" />
                                                {currentUser && currentUser.businessRegistrationNumber && formData.businessNumber && formData.businessNumber !== currentUser.businessRegistrationNumber ? (
                                                    <p className="text-red-500 text-xs mt-1">회원 정보의 사업자등록번호와 일치하지 않습니다.</p>
            ) : null}
        </div>
                                </React.Fragment>
                                    ) : null}

                                    {/* 프로그램 후기 추가 필드 */}
                                    {formData.category === '프로그램 후기' ? (
                                        <React.Fragment>
                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">프로그램 선택 *</label>
                                                {appliedSeminars.length === 0 ? (
                                                    <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                                                        <p className="text-sm text-yellow-700">
                                                            신청하신 프로그램이 없습니다. 프로그램에 신청하신 후 후기를 작성할 수 있습니다.
                                                        </p>
                    </div>
                                                ) : (
                                                    <select 
                                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                                        value={formData.seminarId || ''}
                                                        onChange={(e) => {
                                                            const selectedId = parseInt(e.target.value);
                                                            const selectedSeminar = appliedSeminars.find(s => s.id === selectedId);
                                                            setFormData({
                                                                ...formData, 
                                                                seminarId: selectedId,
                                                                seminarTitle: selectedSeminar ? selectedSeminar.title : null
                                                            });
                                                        }}
                                                    >
                                                        <option value="">프로그램을 선택해주세요</option>
                                                        {appliedSeminars.map(seminar => (
                                                            <option key={seminar.id} value={seminar.id}>
                                                                {seminar.title} ({seminar.date})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">별점 *</label>
                    <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                                            key={star}
                                        type="button"
                                                            onClick={() => setFormData({...formData, rating: star})}
                                                            className="focus:outline-none"
                                                        >
                                                            <Icons.Star 
                                                                className={`w-8 h-8 transition-colors ${
                                                                    formData.rating >= star 
                                                                        ? 'text-yellow-400' 
                                                                        : 'text-gray-300'
                                                                }`} 
                                                                style={formData.rating >= star ? { fill: 'currentColor' } : {}}
                                                            />
                                    </button>
                                ))}
                            </div>
                                                {formData.rating > 0 ? (
                                                    <p className="text-xs text-gray-500 mt-1">{formData.rating}점 선택됨</p>
                                                ) : null}
                        </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">후기 사진 (최대 3장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.reviewImages.map((img, idx) => (
                                                        <div key={idx} className="relative">
                                                            <img src={img} alt={`후기 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, reviewImages: formData.reviewImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                            ))}
                                                    {formData.reviewImages.length < 3 ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                                                            {uploadingImages ? (
                                                                <div className="text-center">
                                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-2"></div>
                                                                    <span className="text-xs text-gray-500">업로드 중...</span>
                                        </div>
                                                            ) : (
                                                                <div className="text-center">
                                                                    <Icons.Plus size={24} className="text-gray-400 mx-auto mb-1" />
                                                                    <span className="text-xs text-gray-500">사진 추가</span>
                                                        </div>
                                                            )}
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                const files = Array.from(e.target.files);
                                                                handleImageUpload(files, 'review');
                                                                e.target.value = '';
                                                            }} />
                                                        </label>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ) : null}

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={formData.isSecret} onChange={(e) => setFormData({...formData, isSecret: e.target.checked})} />
                                        <span className="text-sm font-bold text-gray-700">비밀글</span>
                                                </label>
                                    {formData.isSecret ? (
                                        <input type="text" placeholder="비밀번호" className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                                    ) : null}
                                </div>
                        <div className="flex gap-4 mt-8">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">
                                취소
                                                </button>
                                    <button type="button" onClick={handleCreatePost} className="flex-1 py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">
                                        작성
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                    </div>
                ) : null}

                {/* 게시글 수정 모달 */}
                {isEditModalOpen && editingPost && isCurrentUserAdmin ? (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) { setIsEditModalOpen(false); setEditingPost(null); } }}>
                        <div className="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[calc(90vh-200px)] overflow-y-auto modal-scroll">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-dark">게시글 수정</h3>
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingPost(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <Icons.X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                        value={editingPost.title || ''} 
                                        onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                                    <textarea 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-48 resize-none" 
                                        value={editingPost.content || ''} 
                                        onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} 
                                    />
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsEditModalOpen(false); setEditingPost(null); }} 
                                        className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                                    >
                                        취소
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => handleCommunityUpdate(editingPost.id, editingPost)} 
                                        className="flex-1 py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700"
                                    >
                                        수정
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                    </div>
                ) : null}

                {/* 게시글 상세 모달 */}
            {selectedPost && currentUser ? (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl z-10 p-8 max-h-[calc(90vh-200px)] overflow-y-auto modal-scroll relative">
                            <button type="button" onClick={() => setSelectedPost(null)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                            <Icons.X size={18}/>
                        </button>
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                    <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{selectedPost.category}</span>
                                    {selectedPost.isSecret && <Icons.Lock size={14} className="text-gray-400" />}
                            </div>
                            <h3 className="text-2xl font-bold text-dark mb-4">{selectedPost.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                                <span>{selectedPost.author}</span>
                                <span>{selectedPost.date}</span>
                                    <span>조회 {selectedPost.views || 0}</span>
                            </div>
                                <div className="bg-soft p-6 rounded-2xl border border-brand/5">
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                                            </div>
                                
                                {/* 인력구인 추가 정보 */}
                                {selectedPost.category === '인력구인' ? (
                                    <div className="mt-6 space-y-4">
                                        {selectedPost.jobDetails ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">업무 내용</label>
                                                <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.jobDetails}</p>
                                </div>
                            ) : null}
                                        <div className="grid grid-cols-2 gap-4">
                                            {selectedPost.recruitCount ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">모집 인원</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.recruitCount}</p>
                                            </div>
                                        ) : null}
                                            {selectedPost.workHours ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">근무 시간</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.workHours}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.salary ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">급여/처우</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.salary}</p>
                                            </div>
                                        ) : null}
                                            {selectedPost.deadline ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">마감일</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.deadline}</p>
                                            </div>
                                        ) : null}
                                        </div>
                                        {selectedPost.preferred ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">우대 사항</label>
                                                <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.preferred}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.storeLocation ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">매장 위치</label>
                                                <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.storeLocation}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.storePhone ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                                                <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.storePhone}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.storeImages && selectedPost.storeImages.length > 0 ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">매장 사진</label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {selectedPost.storeImages.map((img, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(img)}>
                                                            <img src={img} alt={`매장 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                    </div>
                                </div>
                            ) : null}
                                    </div>
                                ) : null}
                                
                                {/* 중고거래 추가 정보 */}
                            {selectedPost.category === '중고거래' ? (
                                    <div className="mt-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            {selectedPost.itemName ? (
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">제품명</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.itemName}</p>
                                                </div>
                                            ) : null}
                                        {selectedPost.itemCategory ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.itemCategory}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.price ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">가격</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl font-bold text-brand">{selectedPost.price}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.itemCondition ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">상태</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.itemCondition}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.tradeMethod ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">거래 방식</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.tradeMethod}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.tradeLocation ? (
                                            <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">거래 지역</label>
                                                    <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.tradeLocation}</p>
                                            </div>
                                        ) : null}
                                        </div>
                                        {selectedPost.businessNumber ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록번호</label>
                                                <p className="text-gray-600 bg-white p-4 rounded-xl">{selectedPost.businessNumber}</p>
                                            </div>
                                        ) : null}
                                        {selectedPost.itemImages && selectedPost.itemImages.length > 0 ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">제품 사진</label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {selectedPost.itemImages.map((img, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(img)}>
                                                            <img src={img} alt={`제품 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                    </div>
                                </div>
                            ) : null}
                            </div>
                                ) : null}
                                
                                {/* 프로그램 후기 추가 정보 */}
                                {selectedPost.category === '프로그램 후기' ? (
                                    <div className="mt-6 space-y-4">
                                        {selectedPost.rating ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">별점</label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                                        <Icons.Star
                                                            key={star}
                                                            className={`w-6 h-6 ${
                                                                selectedPost.rating >= star
                                                                    ? 'text-yellow-400'
                                                                    : 'text-gray-300'
                                                            }`}
                                                            style={selectedPost.rating >= star ? { fill: 'currentColor' } : {}}
                                                        />
                                                    ))}
                                                    <span className="ml-2 text-gray-600 font-bold">{selectedPost.rating}점</span>
                                    </div>
                                </div>
                            ) : null}
                                        {(selectedPost.images || selectedPost.reviewImages) && (selectedPost.images || selectedPost.reviewImages).length > 0 ? (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">후기 사진</label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {(selectedPost.images || selectedPost.reviewImages).map((img, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(img)}>
                                                            <img src={img} alt={`후기 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                </div>
                            ) : null}
                                    </div>
                                ) : null}
                                
                            {selectedPost.reply ? (
                                <div className="mt-6 bg-brand/5 p-6 rounded-2xl border border-brand/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Icons.MessageCircle size={16} className="text-brand" />
                                        <span className="font-bold text-brand">관리자 답변</span>
                                    </div>
                                    <p className="text-gray-700">{selectedPost.reply}</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                                </div>
                            ) : null}

                {/* 이미지 확대 모달 */}
                {selectedImage ? (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90" onClick={(e) => { if (e.target === e.currentTarget) setSelectedImage(null); }}>
                        <button type="button" onClick={() => setSelectedImage(null)} className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all z-10">
                            <Icons.X size={24} />
                                </button>
                        <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <img src={selectedImage} alt="확대 이미지" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                            </div>
                                                </div>
                ) : null}
                                            </div>
                                    </div>
    );
};


// 맛집 리스트 뷰
const RestaurantsListView = ({ onBack, restaurants, currentUser, isFoodBusinessOwner, onRestaurantClick, onCreateClick, menuNames, pageTitles }) => {
    const [searchKeyword, setSearchKeyword] = useState('');
    
    const filteredRestaurants = restaurants.filter(restaurant => {
        // 승인 상태 및 노출 여부 체크
        const isApproved = restaurant.approvalStatus === 'approved' || !restaurant.approvalStatus;
        const isVisible = restaurant.isVisible !== false; // 기본값 true
        if (!isApproved || !isVisible) return false;
        
        // 검색어 매칭
        const matchKeyword = !searchKeyword || 
            restaurant.title?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
            restaurant.location?.address?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            restaurant.ownerName?.toLowerCase().includes(searchKeyword.toLowerCase());
        return matchKeyword;
    });

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="restaurants" pageTitles={pageTitles} defaultText={menuNames?.['부산맛집'] || '부산맛집'} />
                        <p className="text-gray-500 text-sm">부산 지역 맛집 정보</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateClick(); }} 
                                className="flex items-center gap-2 bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Icons.Plus size={20} /> 맛집 등록
                            </button>
                        ) : null}
                        <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} 
                            className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors"
                        >
                            <Icons.ArrowLeft size={20} /> 메인으로
                        </button>
                    </div>
                </div>

                {/* 검색 */}
                <div className="bg-white rounded-3xl shadow-card p-6 mb-8">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-2">검색</label>
                        <div className="relative">
                            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="맛집명, 주소, 등록자명 검색" 
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none text-sm" 
                                value={searchKeyword} 
                                onChange={(e) => setSearchKeyword(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        검색 결과: <span className="font-bold text-brand">{filteredRestaurants.length}</span>개
                    </div>
                </div>

                {/* 맛집 리스트 */}
                {filteredRestaurants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRestaurants.map((restaurant) => (
                            <div 
                                key={restaurant.id} 
                                className="bg-white rounded-3xl shadow-card hover:shadow-lg transition-all border border-transparent hover:border-brand/20 cursor-pointer overflow-hidden" 
                                onClick={() => onRestaurantClick(restaurant)}
                            >
                                {restaurant.images && restaurant.images.length > 0 ? (
                                    <div className="w-full overflow-hidden" style={{ aspectRatio: '1/1' }}>
                                        <img 
                                            src={restaurant.images[0]} 
                                            alt={restaurant.title} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : null}
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-dark mb-2 line-clamp-2">{restaurant.title || '제목 없음'}</h3>
                                    {restaurant.location?.address ? (
                                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                                            <Icons.MapPin size={14} />
                                            <span className="line-clamp-1">{restaurant.location.address}</span>
                                        </div>
                                    ) : null}
                                    {restaurant.ownerName ? (
                                        <div className="text-xs text-gray-500 mb-2">
                                            등록자: {restaurant.ownerName}
                                        </div>
                                    ) : null}
                                    {restaurant.menuItems && restaurant.menuItems.length > 0 ? (
                                        <div className="text-xs text-gray-500 mb-2">
                                            대표메뉴: {restaurant.menuItems[0].name}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>등록된 맛집이 없습니다.</p>
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button"
                                onClick={onCreateClick}
                                className="mt-4 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                맛집 등록하기
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

// 맛집 상세 뷰
const RestaurantDetailView = ({ restaurant, onBack, currentUser, onEdit, onDelete, waitForKakaoMap, openKakaoPlacesSearch }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    
    const isOwner = restaurant && currentUser && (restaurant.ownerId === (currentUser.id || currentUser.uid));
    
    // 지도 초기화
    useEffect(() => {
        if (!restaurant?.location?.lat || !restaurant?.location?.lng || !mapContainerRef.current) return;
        
        const initMap = async () => {
            try {
                await waitForKakaoMap();
                const kakao = window.kakao;
                const position = new kakao.maps.LatLng(restaurant.location.lat, restaurant.location.lng);
                
                const mapOption = {
                    center: position,
                    level: 3
                };
                
                mapRef.current = new kakao.maps.Map(mapContainerRef.current, mapOption);
                
                // 마커 표시
                markerRef.current = new kakao.maps.Marker({
                    position: position,
                    map: mapRef.current
                });
            } catch (error) {
                console.error('지도 초기화 실패:', error);
            }
        };
        
        initMap();
    }, [restaurant?.location, waitForKakaoMap]);
    
    if (!restaurant) {
        return (
            <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
                <div className="container mx-auto max-w-7xl text-center">
                    <p className="text-gray-500">맛집 정보를 찾을 수 없습니다.</p>
                    <button onClick={onBack} className="mt-4 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">
                        목록으로
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                <button onClick={onBack} className="mb-6 flex items-center gap-2 text-brand font-bold hover:underline">
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>
                
                {/* 갤러리 */}
                {restaurant.images && restaurant.images.length > 0 ? (
                    <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                        <div className="relative" style={{ aspectRatio: '1/1' }}>
                            <img 
                                src={restaurant.images[currentImageIndex]} 
                                alt={restaurant.title}
                                className="w-full h-full object-cover rounded-xl"
                            />
                            {restaurant.images.length > 1 ? (
                                <>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev - 1 + restaurant.images.length) % restaurant.images.length)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                                    >
                                        <Icons.ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev + 1) % restaurant.images.length)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                                    >
                                        <Icons.ChevronRight size={20} />
                                    </button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                        {restaurant.images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`w-2 h-2 rounded-full ${idx === currentImageIndex ? 'bg-brand w-6' : 'bg-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                
                {/* 기본 정보 */}
                <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-3xl font-bold text-dark">{restaurant.title}</h2>
                        {isOwner ? (
                            <div className="flex gap-2">
                                <button onClick={onEdit} className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700">
                                    수정
                                </button>
                                <button onClick={onDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">
                                    삭제
                                </button>
                            </div>
                        ) : null}
                    </div>
                    
                    {restaurant.location?.address ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.MapPin size={18} />
                            <span>{restaurant.location.address}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.phone ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.Phone size={18} />
                            <span>{restaurant.phone}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.businessHours ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.Clock size={18} />
                            <span>{restaurant.businessHours}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.priceRange ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-4">
                            <Icons.DollarSign size={18} />
                            <span>{restaurant.priceRange}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.description ? (
                        <p className="text-gray-700 mb-4">{restaurant.description}</p>
                    ) : null}
                    
                    {/* 예약 버튼 */}
                    <div className="flex gap-4 mt-6">
                        {restaurant.naverReservationUrl ? (
                            <a 
                                href={restaurant.naverReservationUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 text-center"
                            >
                                네이버 예약
                            </a>
                        ) : null}
                        {restaurant.smartPlaceUrl ? (
                            <a 
                                href={restaurant.smartPlaceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 text-center"
                            >
                                스마트플레이스
                            </a>
                        ) : null}
                    </div>
                </div>
                
                {/* 대표메뉴 */}
                {restaurant.menuItems && restaurant.menuItems.length > 0 ? (
                    <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                        <h3 className="text-xl font-bold text-dark mb-4">대표메뉴</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {restaurant.menuItems.map((menu, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="font-bold text-dark">{menu.name}</span>
                                    {menu.price && <span className="text-brand font-bold">{menu.price}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                
                {/* 지도 */}
                {restaurant.location?.lat && restaurant.location?.lng ? (
                    <div className="bg-white rounded-3xl shadow-card p-6">
                        <h3 className="text-xl font-bold text-dark mb-4">위치</h3>
                        <div ref={mapContainerRef} className="w-full" style={{ height: '400px', borderRadius: '12px', overflow: 'hidden' }}></div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

// 맛집 등록/수정 폼 뷰
const RestaurantFormView = ({ restaurant, onBack, onSave, waitForKakaoMap, openKakaoPlacesSearch, resizeImage, uploadImageToImgBB }) => {
    // 초기 데이터 설정 (이미지 배열을 최소 3개 슬롯으로 확장)
    const initializeFormData = (restaurantData) => {
        const existingImages = restaurantData?.images || [];
        // 이미지 배열을 최소 3개 슬롯으로 확장
        const images = [...existingImages];
        while (images.length < 3) {
            images.push('');
        }
        
        return {
            title: restaurantData?.title || '',
            images: images,
            location: restaurantData?.location || null,
            menuItems: restaurantData?.menuItems && restaurantData.menuItems.length > 0 
                ? restaurantData.menuItems 
                : [{ name: '', price: '' }],
            naverReservationUrl: restaurantData?.naverReservationUrl || '',
            smartPlaceUrl: restaurantData?.smartPlaceUrl || '',
            phone: restaurantData?.phone || '',
            businessHours: restaurantData?.businessHours || '',
            priceRange: restaurantData?.priceRange || '',
            description: restaurantData?.description || ''
        };
    };
    
    const [formData, setFormData] = useState(initializeFormData(restaurant));
    const [uploadingImages, setUploadingImages] = useState(false);
    
    // restaurant prop이 변경될 때 formData 업데이트
    useEffect(() => {
        if (restaurant) {
            setFormData(initializeFormData(restaurant));
        }
    }, [restaurant]);
    
    const handleImageUpload = async (e, index) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('이미지 크기는 5MB 이하여야 합니다.');
            return;
        }
        
        setUploadingImages(true);
        try {
            // 3:2 비율로 리사이징
            const resizedImage = await resizeImage(file, 1200, 800, 0.9);
            const result = await uploadImageToImgBB(resizedImage, `restaurant_${Date.now()}_${index}.jpg`);
            
            if (result.success) {
                const newImages = [...formData.images];
                newImages[index] = result.url;
                setFormData({ ...formData, images: newImages });
            } else {
                alert('이미지 업로드에 실패했습니다.');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            alert('이미지 업로드에 실패했습니다.');
        } finally {
            setUploadingImages(false);
        }
    };
    
    const handleAddMenuItem = () => {
        if (formData.menuItems.length >= 10) {
            alert('대표메뉴는 최대 10개까지 등록할 수 있습니다.');
            return;
        }
        setFormData({
            ...formData,
            menuItems: [...formData.menuItems, { name: '', price: '' }]
        });
    };
    
    const handleRemoveMenuItem = (index) => {
        const newMenuItems = formData.menuItems.filter((_, i) => i !== index);
        setFormData({ ...formData, menuItems: newMenuItems.length > 0 ? newMenuItems : [{ name: '', price: '' }] });
    };
    
    const handleLocationSelect = async () => {
        try {
            await waitForKakaoMap();
            openKakaoPlacesSearch((place) => {
                setFormData({
                    ...formData,
                    location: {
                        name: place.name,
                        address: place.address,
                        lat: place.lat,
                        lng: place.lng
                    }
                });
            });
        } catch (error) {
            alert('카카오맵을 불러올 수 없습니다.');
        }
    };
    
    const handleSubmit = () => {
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        
        // 이미지 검증: 빈 문자열 제거 후 검증
        const validImages = formData.images.filter(img => img && img.trim());
        if (validImages.length === 0) {
            alert('대표사진을 최소 1장 이상 업로드해주세요.');
            return;
        }
        
        // 등록 시에는 3장 필수, 수정 시에는 기존 이미지가 있으면 허용
        if (!restaurant && validImages.length < 3) {
            alert('맛집 등록 시 대표사진 3장을 모두 업로드해주세요.');
            return;
        }
        
        if (!formData.location) {
            alert('지도 위치를 선택해주세요.');
            return;
        }
        
        const validMenuItems = formData.menuItems.filter(m => m.name.trim());
        if (validMenuItems.length === 0) {
            alert('대표메뉴를 최소 1개 이상 등록해주세요.');
            return;
        }
        
        onSave({
            ...formData,
            images: validImages, // 빈 이미지 제거
            menuItems: validMenuItems
        });
    };
    
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-4xl">
                <button onClick={onBack} className="mb-6 flex items-center gap-2 text-brand font-bold hover:underline">
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>
                
                <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                    <h2 className="text-2xl font-bold text-dark mb-6">{restaurant ? '맛집 수정' : '맛집 등록'}</h2>
                    
                    <div className="space-y-6">
                        {/* 제목 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="맛집 이름"
                            />
                        </div>
                        
                        {/* 대표사진 3장 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                대표사진 {restaurant ? '(수정 가능)' : '(3장 필수)'} *
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                {[0, 1, 2].map((index) => (
                                    <div key={index} className="relative" style={{ aspectRatio: '3/2' }}>
                                        {formData.images[index] ? (
                                            <div className="relative w-full h-full group">
                                                <img src={formData.images[index]} alt={`사진 ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newImages = [...formData.images];
                                                        newImages[index] = '';
                                                        setFormData({ ...formData, images: newImages });
                                                    }}
                                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Icons.X size={16} />
                                                    </button>
                                                    <label className="absolute inset-0 cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => handleImageUpload(e, index)}
                                                            className="hidden"
                                                            disabled={uploadingImages}
                                                        />
                                                    </label>
                                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                                                        클릭하여 교체
                                                    </div>
                                                </div>
                                        ) : (
                                            <label className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleImageUpload(e, index)}
                                                    className="hidden"
                                                    disabled={uploadingImages}
                                                />
                                                <div className="text-center">
                                                    <Icons.Camera size={24} className="mx-auto mb-2 text-gray-400" />
                                                    <span className="text-xs text-gray-500">
                                                        {uploadingImages ? '업로드 중...' : `사진 ${index + 1} ${restaurant ? '(교체)' : '(필수)'}`}
                                                    </span>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {restaurant ? (
                                <p className="text-xs text-gray-500 mt-2">
                                    * 수정 시 기존 이미지를 유지하거나 교체할 수 있습니다. 최소 1장 이상 필요합니다.
                                </p>
                            ) : null}
                        </div>
                        
                        {/* 지도 위치 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">지도 위치 *</label>
                            {formData.location ? (
                                <div className="p-3 bg-gray-50 rounded-xl mb-2">
                                    <p className="font-bold">{formData.location.name}</p>
                                    <p className="text-sm text-gray-600">{formData.location.address}</p>
                                </div>
                            ) : null}
                            <button
                                onClick={handleLocationSelect}
                                className="w-full px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700"
                            >
                                {formData.location ? '위치 변경' : '위치 선택'}
                            </button>
                        </div>
                        
                        {/* 대표메뉴 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">대표메뉴 (최대 10개) *</label>
                            {formData.menuItems.map((menu, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={menu.name}
                                        onChange={(e) => {
                                            const newMenuItems = [...formData.menuItems];
                                            newMenuItems[index].name = e.target.value;
                                            setFormData({ ...formData, menuItems: newMenuItems });
                                        }}
                                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                        placeholder="메뉴명"
                                    />
                                    <input
                                        type="text"
                                        value={menu.price}
                                        onChange={(e) => {
                                            const newMenuItems = [...formData.menuItems];
                                            newMenuItems[index].price = e.target.value;
                                            setFormData({ ...formData, menuItems: newMenuItems });
                                        }}
                                        className="w-32 p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                        placeholder="가격"
                                    />
                                    {formData.menuItems.length > 1 ? (
                                        <button
                                            onClick={() => handleRemoveMenuItem(index)}
                                            className="px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
                                        >
                                            삭제
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            {formData.menuItems.length < 10 ? (
                                <button
                                    onClick={handleAddMenuItem}
                                    className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                                >
                                    메뉴 추가
                                </button>
                            ) : null}
                        </div>
                        
                        {/* 네이버 예약 URL */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">네이버 예약 URL</label>
                            <input
                                type="url"
                                value={formData.naverReservationUrl}
                                onChange={(e) => setFormData({ ...formData, naverReservationUrl: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="https://booking.naver.com/..."
                            />
                        </div>
                        
                        {/* 스마트플레이스 URL */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">스마트플레이스 URL</label>
                            <input
                                type="url"
                                value={formData.smartPlaceUrl}
                                onChange={(e) => setFormData({ ...formData, smartPlaceUrl: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="https://place.naver.com/..."
                            />
                        </div>
                        
                        {/* 전화번호 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="051-123-4567"
                            />
                        </div>
                        
                        {/* 영업시간 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">영업시간</label>
                            <input
                                type="text"
                                value={formData.businessHours}
                                onChange={(e) => setFormData({ ...formData, businessHours: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="예: 11:00 - 22:00"
                            />
                        </div>
                        
                        {/* 가격대 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">가격대</label>
                            <input
                                type="text"
                                value={formData.priceRange}
                                onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                placeholder="예: 만원대, 2만원대"
                            />
                        </div>
                        
                        {/* 설명 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                rows="5"
                                placeholder="맛집 소개"
                            />
                        </div>
                        
                        {/* 저장 버튼 */}
                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={onBack}
                                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={uploadingImages}
                                className="flex-1 px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {uploadingImages ? '업로드 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// AllSeminarsView는 pages/AllSeminarsView.jsx로 분리됨



const BidSearchView = ({ onBack, currentUser, pageTitles }) => {
    const [bidList, setBidList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 10;
    
    // 상세 모달 상태
    const [selectedBid, setSelectedBid] = useState(null);
    
    // 검색유형 (탭)
    const [searchType, setSearchType] = useState('입찰공고'); // 입찰공고, 개찰결과, 최종낙찰자
    
    // 기본 검색 필드
    const [bidNoticeNo, setBidNoticeNo] = useState(''); // 입찰공고번호
    const [keyword, setKeyword] = useState(''); // 공고명
    
    // 날짜 관련 필터
    const [dateType, setDateType] = useState('공고일자'); // 게시일자: 공고일자/개찰일자
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [excludeDeadline, setExcludeDeadline] = useState(false); // 입찰마감제외
    const [noticeType, setNoticeType] = useState('전체'); // 공고종류: 전체, 실공고, 가공고
    
    // 업무 관련 필터
    const [businessTypes, setBusinessTypes] = useState(['전체']); // 업무구분: 전체, 물품, 일반용역, 기술용역, 공사, 기타, 민간
    const [businessStatuses, setBusinessStatuses] = useState(['전체']); // 업무여부: 전체, 외자, 비축, 리스
    
    // 기관 및 참여 관련 필터
    const [institutionName, setInstitutionName] = useState(''); // 기관명
    const [isAnnouncingInstitution, setIsAnnouncingInstitution] = useState(true); // 공고기관
    const [isDemandingInstitution, setIsDemandingInstitution] = useState(false); // 수요기관
    const [referenceNo, setReferenceNo] = useState(''); // 참조번호
    const [restrictedArea, setRestrictedArea] = useState('전체'); // 참가제한지역
    
    // 상세 필터
    const [industry, setIndustry] = useState(''); // 업종
    const [priceMin, setPriceMin] = useState(''); // 추정가격 최소
    const [priceMax, setPriceMax] = useState(''); // 추정가격 최대
    const [detailItemNo, setDetailItemNo] = useState(''); // 세부품명번호
    const [prNo, setPrNo] = useState(''); // 조달요청번호/PRNO
    const [shoppingMall, setShoppingMall] = useState('전체'); // 쇼핑몰공고: 전체, Y, N
    const [domesticInternational, setDomesticInternational] = useState('전체'); // 국내/국제: 전체, 국내, 국제
    
    // 계약 관련 필터
    const [contractType, setContractType] = useState('전체'); // 계약유형
    const [contractLawType, setContractLawType] = useState('전체'); // 계약법구분: 전체, 국가계약법, 지방계약법
    const [contractMethod, setContractMethod] = useState('전체'); // 계약방법
    const [awardMethod, setAwardMethod] = useState('전체'); // 낙찰방법
    
    // 기존 필터 상태 (호환성 유지)
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [filterDeadlineStart, setFilterDeadlineStart] = useState('');
    const [filterDeadlineEnd, setFilterDeadlineEnd] = useState('');
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [isDetailedFilterExpanded, setIsDetailedFilterExpanded] = useState(false);
    
    // 정렬 상태 (기본값: 등록일 내림차순 - 최신순)
    const [sortField, setSortField] = useState('등록일');
    const [sortOrder, setSortOrder] = useState('desc'); // 기본값: 내림차순 (최신순)
    
    // 북마크 상태
    const [bookmarks, setBookmarks] = useState(new Set());
    const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
    const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

    // 날짜 포맷 함수
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // YYYYMMDDHHMMSS 형식을 YYYY.MM.DD HH:MM 형식으로 변환
        if (dateStr.length >= 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = dateStr.length >= 10 ? dateStr.substring(8, 10) : '00';
            const min = dateStr.length >= 12 ? dateStr.substring(10, 12) : '00';
            return `${year}.${month}.${day} ${hour}:${min}`;
        }
        return dateStr;
    };
    
    // 날짜 문자열을 Date 객체로 변환
    const parseDate = (dateStr) => {
        if (!dateStr || dateStr.length < 8) return null;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = dateStr.length >= 10 ? parseInt(dateStr.substring(8, 10)) : 0;
        const min = dateStr.length >= 12 ? parseInt(dateStr.substring(10, 12)) : 0;
        return new Date(year, month, day, hour, min);
    };
    
    // 공고 상태 계산 함수
    const getBidStatus = (bidClseDt) => {
        if (!bidClseDt) return { status: 'unknown', label: '상태 불명', color: 'gray' };
        const deadline = parseDate(bidClseDt);
        if (!deadline) return { status: 'unknown', label: '상태 불명', color: 'gray' };
        
        const now = new Date();
        const diffTime = deadline - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return { status: 'closed', label: '마감', color: 'gray' };
        } else if (diffDays <= 3) {
            return { status: 'urgent', label: '마감임박', color: 'orange' };
        } else {
            return { status: 'active', label: '진행중', color: 'green' };
        }
    };
    
    // 마감까지 남은 시간 계산
    const getTimeRemaining = (bidClseDt) => {
        if (!bidClseDt) return null;
        const deadline = parseDate(bidClseDt);
        if (!deadline) return null;
        
        const now = new Date();
        const diffTime = deadline - now;
        
        if (diffTime < 0) return '마감됨';
        
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffDays > 0) return `${diffDays}일 ${diffHours}시간`;
        if (diffHours > 0) return `${diffHours}시간 ${diffMins}분`;
        return `${diffMins}분`;
    };
    
    // 분류 목록 추출 (메모이제이션)
    const categories = React.useMemo ? React.useMemo(() => {
        return ['전체', ...new Set(bidList.map(bid => bid.bidNtceInsttClsfNm).filter(Boolean))];
    }, [bidList]) : ['전체', ...new Set(bidList.map(bid => bid.bidNtceInsttClsfNm).filter(Boolean))];
    
    // 모달 ESC 키로 닫기
    useEffect(() => {
        if (!selectedBid) return;
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setSelectedBid(null);
            }
        };
        
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedBid]);
    
    // file:// 프로토콜 감지 및 안내
    useEffect(() => {
        if (window.location.protocol === 'file:') {
            setError('⚠️ 이 페이지는 HTTP 서버에서 실행해야 합니다.\n\n로컬 서버를 시작하려면:\n1. 터미널에서 "npm run server" 실행\n2. 브라우저에서 "http://localhost:3000/index.html" 접속');
        }
    }, []);
    
    // 필터링 및 정렬된 목록 (메모이제이션)
    const filteredAndSortedList = React.useMemo ? React.useMemo(() => {
        let filtered = [...bidList];
        
        // 북마크만 보기 필터
        if (showBookmarksOnly && currentUser) {
            filtered = filtered.filter(bid => {
                const bidKey = `${bid.bidNtceNo}-${bid.bidNtceOrd || ''}`;
                return bookmarks.has(bidKey);
            });
        }
        
        // 분류 필터
        if (selectedCategory !== '전체') {
            filtered = filtered.filter(bid => bid.bidNtceInsttClsfNm === selectedCategory);
        }
        
        // 등록일 필터
        if (filterStartDate) {
            const start = new Date(filterStartDate + ' 00:00:00');
            filtered = filtered.filter(bid => {
                const bidDate = parseDate(bid.bidNtceDt);
                return bidDate && bidDate >= start;
            });
        }
        if (filterEndDate) {
            const end = new Date(filterEndDate + ' 23:59:59');
            filtered = filtered.filter(bid => {
                const bidDate = parseDate(bid.bidNtceDt);
                return bidDate && bidDate <= end;
            });
        }
        
        // 마감일 필터
        if (filterDeadlineStart) {
            const start = new Date(filterDeadlineStart + ' 00:00:00');
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline >= start;
            });
        }
        if (filterDeadlineEnd) {
            const end = new Date(filterDeadlineEnd + ' 23:59:59');
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline <= end;
            });
        }
        
        // 입찰마감제외 필터
        if (excludeDeadline) {
            const now = new Date();
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline > now;
            });
        }
        
        // 업무구분 필터 (클라이언트 측 필터링)
        if (!businessTypes.includes('전체') && businessTypes.length > 0) {
            // API 응답에 업무구분 필드가 있는 경우 필터링
            filtered = filtered.filter(bid => {
                // bid.bidNtceDtlClsfNm 또는 유사한 필드 확인 필요
                return true; // 임시로 모든 항목 통과
            });
        }
        
        // 업무여부 필터 (클라이언트 측 필터링)
        if (!businessStatuses.includes('전체') && businessStatuses.length > 0) {
            filtered = filtered.filter(bid => {
                return true; // 임시로 모든 항목 통과
            });
        }
        
        // 기관명 필터
        if (institutionName.trim()) {
            filtered = filtered.filter(bid => {
                const announcingMatch = isAnnouncingInstitution && 
                    (bid.ntceInsttNm || '').includes(institutionName);
                const demandingMatch = isDemandingInstitution && 
                    (bid.demandInsttNm || '').includes(institutionName);
                return announcingMatch || demandingMatch;
            });
        }
        
        // 참조번호 필터
        if (referenceNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.refNo || '').includes(referenceNo);
            });
        }
        
        // 업종 필터
        if (industry.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.industryNm || '').includes(industry);
            });
        }
        
        // 추정가격 필터
        if (priceMin || priceMax) {
            filtered = filtered.filter(bid => {
                const price = parseFloat(bid.estPrice || bid.estPriceAmt || 0);
                const min = priceMin ? parseFloat(priceMin) : 0;
                const max = priceMax ? parseFloat(priceMax) : Infinity;
                return price >= min && price <= max;
            });
        }
        
        // 세부품명번호 필터
        if (detailItemNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.detailItemNo || '').includes(detailItemNo);
            });
        }
        
        // 조달요청번호 필터
        if (prNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.prNo || '').includes(prNo);
            });
        }
        
        // 쇼핑몰공고 필터
        if (shoppingMall !== '전체') {
            filtered = filtered.filter(bid => {
                const isShoppingMall = bid.shoppingMallYn === shoppingMall;
                return isShoppingMall;
            });
        }
        
        // 국내/국제 필터
        if (domesticInternational !== '전체') {
            filtered = filtered.filter(bid => {
                const isDomestic = bid.domesticYn === 'Y';
                return domesticInternational === '국내' ? isDomestic : !isDomestic;
            });
        }
        
        // 계약법구분 필터
        if (contractLawType !== '전체') {
            filtered = filtered.filter(bid => {
                const lawType = bid.contractLawType || '';
                return contractLawType === '국가계약법' 
                    ? lawType.includes('국가') 
                    : lawType.includes('지방');
            });
        }
        
        // 정렬 (기본값: 등록일 내림차순 - 최신순)
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortField) {
                case '등록일':
                    aVal = parseDate(a.bidNtceDt) || new Date(0);
                    bVal = parseDate(b.bidNtceDt) || new Date(0);
                    break;
                case '마감일':
                    aVal = parseDate(a.bidClseDt) || new Date(0);
                    bVal = parseDate(b.bidClseDt) || new Date(0);
                    break;
                case '공고명':
                    aVal = (a.bidNtceNm || '').toLowerCase();
                    bVal = (b.bidNtceNm || '').toLowerCase();
                    break;
                case '기관명':
                    aVal = (a.ntceInsttNm || '').toLowerCase();
                    bVal = (b.ntceInsttNm || '').toLowerCase();
                    break;
                default:
                    // 기본값: 등록일 내림차순 (최신순)
                    aVal = parseDate(a.bidNtceDt) || new Date(0);
                    bVal = parseDate(b.bidNtceDt) || new Date(0);
                    break;
            }
            
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            } else {
                return sortOrder === 'asc' 
                    ? aVal - bVal 
                    : bVal - aVal;
            }
        });
        
        return filtered;
    }, [bidList, showBookmarksOnly, selectedCategory, filterStartDate, filterEndDate, filterDeadlineStart, filterDeadlineEnd, sortField, sortOrder, bookmarks, currentUser, excludeDeadline, businessTypes, businessStatuses, institutionName, isAnnouncingInstitution, isDemandingInstitution, referenceNo, industry, priceMin, priceMax, detailItemNo, prNo, shoppingMall, domesticInternational, contractLawType]) : (() => {
        let filtered = [...bidList];
        
        // 북마크만 보기 필터
        if (showBookmarksOnly && currentUser) {
            filtered = filtered.filter(bid => {
                const bidKey = `${bid.bidNtceNo}-${bid.bidNtceOrd || ''}`;
                return bookmarks.has(bidKey);
            });
        }
        
        // 분류 필터
        if (selectedCategory !== '전체') {
            filtered = filtered.filter(bid => bid.bidNtceInsttClsfNm === selectedCategory);
        }
        
        // 등록일 필터
        if (filterStartDate) {
            const start = new Date(filterStartDate + ' 00:00:00');
            filtered = filtered.filter(bid => {
                const bidDate = parseDate(bid.bidNtceDt);
                return bidDate && bidDate >= start;
            });
        }
        if (filterEndDate) {
            const end = new Date(filterEndDate + ' 23:59:59');
            filtered = filtered.filter(bid => {
                const bidDate = parseDate(bid.bidNtceDt);
                return bidDate && bidDate <= end;
            });
        }
        
        // 마감일 필터
        if (filterDeadlineStart) {
            const start = new Date(filterDeadlineStart + ' 00:00:00');
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline >= start;
            });
        }
        if (filterDeadlineEnd) {
            const end = new Date(filterDeadlineEnd + ' 23:59:59');
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline <= end;
            });
        }
        
        // 입찰마감제외 필터
        if (excludeDeadline) {
            const now = new Date();
            filtered = filtered.filter(bid => {
                const deadline = parseDate(bid.bidClseDt);
                return deadline && deadline > now;
            });
        }
        
        // 업무구분 필터
        if (!businessTypes.includes('전체') && businessTypes.length > 0) {
            filtered = filtered.filter(bid => {
                return true; // 임시로 모든 항목 통과
            });
        }
        
        // 업무여부 필터
        if (!businessStatuses.includes('전체') && businessStatuses.length > 0) {
            filtered = filtered.filter(bid => {
                return true; // 임시로 모든 항목 통과
            });
        }
        
        // 기관명 필터
        if (institutionName.trim()) {
            filtered = filtered.filter(bid => {
                const announcingMatch = isAnnouncingInstitution && 
                    (bid.ntceInsttNm || '').includes(institutionName);
                const demandingMatch = isDemandingInstitution && 
                    (bid.demandInsttNm || '').includes(institutionName);
                return announcingMatch || demandingMatch;
            });
        }
        
        // 참조번호 필터
        if (referenceNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.refNo || '').includes(referenceNo);
            });
        }
        
        // 업종 필터
        if (industry.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.industryNm || '').includes(industry);
            });
        }
        
        // 추정가격 필터
        if (priceMin || priceMax) {
            filtered = filtered.filter(bid => {
                const price = parseFloat(bid.estPrice || bid.estPriceAmt || 0);
                const min = priceMin ? parseFloat(priceMin) : 0;
                const max = priceMax ? parseFloat(priceMax) : Infinity;
                return price >= min && price <= max;
            });
        }
        
        // 세부품명번호 필터
        if (detailItemNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.detailItemNo || '').includes(detailItemNo);
            });
        }
        
        // 조달요청번호 필터
        if (prNo.trim()) {
            filtered = filtered.filter(bid => {
                return (bid.prNo || '').includes(prNo);
            });
        }
        
        // 쇼핑몰공고 필터
        if (shoppingMall !== '전체') {
            filtered = filtered.filter(bid => {
                const isShoppingMall = bid.shoppingMallYn === shoppingMall;
                return isShoppingMall;
            });
        }
        
        // 국내/국제 필터
        if (domesticInternational !== '전체') {
            filtered = filtered.filter(bid => {
                const isDomestic = bid.domesticYn === 'Y';
                return domesticInternational === '국내' ? isDomestic : !isDomestic;
            });
        }
        
        // 계약법구분 필터
        if (contractLawType !== '전체') {
            filtered = filtered.filter(bid => {
                const lawType = bid.contractLawType || '';
                return contractLawType === '국가계약법' 
                    ? lawType.includes('국가') 
                    : lawType.includes('지방');
            });
        }
        
        // 정렬 (기본값: 등록일 내림차순 - 최신순)
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortField) {
                case '등록일':
                    aVal = parseDate(a.bidNtceDt) || new Date(0);
                    bVal = parseDate(b.bidNtceDt) || new Date(0);
                    break;
                case '마감일':
                    aVal = parseDate(a.bidClseDt) || new Date(0);
                    bVal = parseDate(b.bidClseDt) || new Date(0);
                    break;
                case '공고명':
                    aVal = (a.bidNtceNm || '').toLowerCase();
                    bVal = (b.bidNtceNm || '').toLowerCase();
                    break;
                case '기관명':
                    aVal = (a.ntceInsttNm || '').toLowerCase();
                    bVal = (b.ntceInsttNm || '').toLowerCase();
                    break;
                default:
                    // 기본값: 등록일 내림차순 (최신순)
                    aVal = parseDate(a.bidNtceDt) || new Date(0);
                    bVal = parseDate(b.bidNtceDt) || new Date(0);
                    break;
            }
            
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            } else {
                return sortOrder === 'asc' 
                    ? aVal - bVal 
                    : bVal - aVal;
            }
        });
        
        return filtered;
    })();

    // 프록시 서버 상태 확인 함수
    const checkProxyServer = async (baseUrl) => {
        try {
            // 프록시 서버 상태 확인 (로컬 서버만)
            const healthUrl = baseUrl.includes('/apiBid') 
                ? baseUrl.replace('/apiBid/api/bid-search', '/health')
                : baseUrl.replace('/api/bid-search', '/health');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    };

    // API 호출 함수
    const fetchBidList = async (page = 1) => {
        setIsLoading(true);
        setError(null);

        try {
            // file:// 프로토콜 체크
            if (window.location.protocol === 'file:') {
                throw new Error('⚠️ 이 페이지는 HTTP 서버에서 실행해야 합니다.\n\n로컬 서버를 시작하려면:\n1. 터미널에서 "npm run server" 실행\n2. 브라우저에서 "http://localhost:3000/index.html" 접속');
            }

            // API 프록시 URL 설정
            const getProxyServerUrl = () => {
                // 1. file:// 프로토콜 체크
                if (window.location.protocol === 'file:') {
                    return null; // file://에서는 프록시 서버 사용 불가
                }
                
                // 2. 로컬 개발 환경
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    // Firebase Emulator 확인 (포트 5001 또는 5173에서 실행 중일 때)
                    // Emulator는 별도 포트에서 실행되므로, Vite 개발 서버(3000, 5173)에서도 Emulator 사용 가능
                    // 로컬 개발 시 Emulator 사용 (포트 5001)
                    return 'http://localhost:5001/bcsa-b190f/asia-northeast3';
                }
                
                // 3. 프로덕션 환경 - v2 Cloud Run URL 사용
                const hostname = window.location.hostname;
                if (hostname === 'bcsa.co.kr' || hostname === 'www.bcsa.co.kr') {
                    // 호스팅케이알 - Firebase Functions v2
                    return 'https://apibid-oytjv32jna-du.a.run.app';
                } else if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
                    // Firebase Hosting - Firebase Functions v2
                    return 'https://apibid-oytjv32jna-du.a.run.app';
                } else {
                    // 기타 도메인 - Firebase Functions v2
                    return 'https://apibid-oytjv32jna-du.a.run.app';
                }
            };

            const PROXY_SERVER_URL = getProxyServerUrl();
            
            // file:// 프로토콜 체크 (getProxyServerUrl에서 null 반환 시)
            if (!PROXY_SERVER_URL) {
                throw new Error('⚠️ 이 페이지는 HTTP 서버에서 실행해야 합니다.\n\n로컬 서버를 시작하려면:\n1. 터미널에서 "npm run server" 실행\n2. 브라우저에서 "http://localhost:3000/index.html" 접속');
            }
            
            let apiEndpoint;
            let baseUrl;
            // Ensure PROXY_SERVER_URL doesn't end with slash
            const cleanProxyUrl = PROXY_SERVER_URL.replace(/\/$/, '');
            
            // searchType에 따라 다른 엔드포인트 사용
            let endpointPath;
            if (searchType === '입찰공고') {
                endpointPath = 'bid-search';
            } else if (searchType === '개찰결과') {
                endpointPath = 'bid-openg-result';
            } else if (searchType === '최종낙찰자') {
                endpointPath = 'bid-award';
            } else {
                endpointPath = 'bid-search'; // 기본값
            }
            
            // Firebase Functions 사용 여부 확인
            const isFirebaseFunctions = cleanProxyUrl.includes('cloudfunctions.net');
            
            // 로컬 서버인지 확인
            const isLocalServer = cleanProxyUrl.includes('localhost') || cleanProxyUrl.includes('127.0.0.1');
            
            if (isFirebaseFunctions) {
                // Firebase Functions v2 - Cloud Run은 함수 이름 없이 직접 경로 사용
                baseUrl = cleanProxyUrl;
                apiEndpoint = `${cleanProxyUrl}/api/${endpointPath}`;
            } else if (cleanProxyUrl.includes('localhost:5001')) {
                // Firebase Emulator
                baseUrl = cleanProxyUrl;
                apiEndpoint = `${cleanProxyUrl}/apiBid/api/${endpointPath}`;
            } else if (isLocalServer) {
                // 로컬 Express 서버
                baseUrl = cleanProxyUrl;
                apiEndpoint = `${cleanProxyUrl}/api/${endpointPath}`;
            } else {
                throw new Error('지원하지 않는 프록시 서버입니다.');
            }
            
            // 프록시 서버 상태 확인 (로컬 개발 환경만)
            if (isLocalServer) {
                const isServerRunning = await checkProxyServer(baseUrl);
                if (!isServerRunning) {
                    throw new Error(`프록시 서버가 실행되지 않았습니다.\n\n로컬 개발 서버를 시작하려면:\n1. 터미널에서 "npm run server" 실행\n2. 서버가 포트 3001에서 실행되는지 확인`);
                }
            }

            // 파라미터 구성
            const searchKeyword = keyword.trim() || bidNoticeNo.trim();
            
            let params = new URLSearchParams({
                keyword: searchKeyword,
                pageNo: page.toString(),
                numOfRows: itemsPerPage.toString()
            });

            // 필터 파라미터 추가
            if (bidNoticeNo.trim()) {
                params.append('bidNtceNo', bidNoticeNo.trim());
            }
            if (filterStartDate) {
                params.append('fromBidDt', filterStartDate.replace(/-/g, ''));
            }
            if (filterEndDate) {
                params.append('toBidDt', filterEndDate.replace(/-/g, ''));
            }
            if (noticeType !== '전체') {
                params.append('bidNtceDtlClsfCd', noticeType);
            }
            if (institutionName.trim()) {
                params.append('insttNm', institutionName.trim());
            }
            if (referenceNo.trim()) {
                params.append('refNo', referenceNo.trim());
            }
            if (restrictedArea !== '전체') {
                params.append('area', restrictedArea);
            }
            if (industry.trim()) {
                params.append('industry', industry.trim());
            }
            if (priceMin) {
                params.append('fromEstPrice', priceMin);
            }
            if (priceMax) {
                params.append('toEstPrice', priceMax);
            }
            if (detailItemNo.trim()) {
                params.append('detailItemNo', detailItemNo.trim());
            }
            if (prNo.trim()) {
                params.append('prNo', prNo.trim());
            }
            if (shoppingMall !== '전체') {
                params.append('shoppingMallYn', shoppingMall);
            }
            if (domesticInternational !== '전체') {
                params.append('domesticYn', domesticInternational === '국내' ? 'Y' : 'N');
            }
            if (contractType !== '전체') {
                params.append('contractType', contractType);
            }
            if (contractLawType !== '전체') {
                params.append('contractLawType', contractLawType);
            }
            if (contractMethod !== '전체') {
                params.append('contractMethod', contractMethod);
            }
            if (awardMethod !== '전체') {
                params.append('awardMethod', awardMethod);
            }
            
            // 업무구분 파라미터 추가
            if (businessTypes && businessTypes.length > 0 && !businessTypes.includes('전체')) {
                businessTypes.forEach(type => {
                    params.append('businessTypes', type);
                });
            }

            if (currentUser) {
                params.append('userId', currentUser.uid || '');
                params.append('userEmail', currentUser.email || '');
                params.append('userName', currentUser.name || '');
            }

            // URL 구성
            const proxyRequestUrl = `${apiEndpoint}?${params.toString()}`;
            
            // Validate URL format
            try {
                new URL(proxyRequestUrl);
            } catch (error) {
                throw new Error(`잘못된 API URL 형식입니다: ${proxyRequestUrl}`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            let response;
            try {
                response = await fetch(proxyRequestUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
                }
                if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
                    let errorMsg;
                    if (isFirebaseFunctions) {
                        errorMsg = 'Firebase Functions에 연결할 수 없습니다.\n\n다음을 확인해주세요:\n1. Firebase Functions가 배포되었는지 확인\n2. 네트워크 연결 상태 확인\n3. Firebase Console에서 Functions 상태 확인\n\n배포 명령: firebase deploy --only functions';
                    } else if (isLocalServer) {
                        errorMsg = `프록시 서버에 연결할 수 없습니다.\n\n로컬 개발 서버를 시작하려면:\n1. 터미널에서 "npm run server" 실행\n2. 서버가 포트 3001에서 실행되는지 확인`;
                    } else {
                        errorMsg = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
                    }
                    throw new Error(errorMsg);
                }
                throw new Error(`네트워크 오류: ${fetchError.message}`);
            }

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `서버 오류: ${response.status}`);
                } catch {
                    throw new Error(`서버 오류 (${response.status}): ${errorText.substring(0, 200)}`);
                }
            }

            let data = await response.json();

            // 프록시 서버 응답 형식 처리 (Firebase Functions, 로컬 서버 모두 동일한 형식)
            if (data.success && data.data) {
                let items = data.data.items || [];
                
                // 검색 결과를 항상 등록일 기준 내림차순(최신순)으로 정렬
                items.sort((a, b) => {
                    const aDate = parseDate(a.bidNtceDt) || new Date(0);
                    const bDate = parseDate(b.bidNtceDt) || new Date(0);
                    return bDate - aDate; // 내림차순 (최신순)
                });
                
                setBidList(items);
                setTotalCount(data.data.totalCount || 0);
                setCurrentPage(page);
                setError(null);
                
                // 검색 후 정렬을 기본값(등록일 내림차순)으로 설정
                setSortField('등록일');
                setSortOrder('desc');
            } else {
                throw new Error(data.error || '검색 결과를 불러오는데 실패했습니다.');
            }

        } catch (err) {
            
            setError(err.message || '입찰공고 데이터를 불러오는데 실패했습니다.');
            setBidList([]);
            setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    // searchType 변경 시 자동 검색 (검색어가 있을 때만)
    useEffect(() => {
        if (keyword.trim() || bidNoticeNo.trim()) {
            fetchBidList(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchType]);
    
    // 검색 버튼 클릭
    const handleSearch = () => {
        // 키워드나 입찰공고번호 중 하나는 있어야 함
        if (!keyword.trim() && !bidNoticeNo.trim()) {
            alert('검색어 또는 입찰공고번호를 입력해주세요.');
            return;
        }
        // 정렬을 기본값(등록일 내림차순)으로 설정
        setSortField('등록일');
        setSortOrder('desc');
        fetchBidList(1);
    };

    // 엔터 키 검색
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };
    
    // 날짜 빠른 선택 함수
    const setQuickDateRange = (months) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        
        const formatDateForInput = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        setFilterStartDate(formatDateForInput(startDate));
        setFilterEndDate(formatDateForInput(endDate));
    };
    
    // 필터 초기화
    const resetFilters = () => {
        // 검색유형
        setSearchType('입찰공고');
        
        // 기본 검색 필드
        setBidNoticeNo('');
        setKeyword('');
        
        // 날짜 관련
        setDateType('공고일자');
        setFilterStartDate('');
        setFilterEndDate('');
        setExcludeDeadline(false);
        setNoticeType('전체');
        
        // 업무 관련
        setBusinessTypes(['전체']);
        setBusinessStatuses(['전체']);
        
        // 기관 관련
        setInstitutionName('');
        setIsAnnouncingInstitution(true);
        setIsDemandingInstitution(false);
        setReferenceNo('');
        setRestrictedArea('전체');
        
        // 상세 필터
        setIndustry('');
        setPriceMin('');
        setPriceMax('');
        setDetailItemNo('');
        setPrNo('');
        setShoppingMall('전체');
        setDomesticInternational('전체');
        
        // 계약 관련
        setContractType('전체');
        setContractLawType('전체');
        setContractMethod('전체');
        setAwardMethod('전체');
        
        // 기존 필터
        setSelectedCategory('전체');
        setFilterDeadlineStart('');
        setFilterDeadlineEnd('');
        setShowBookmarksOnly(false);
        
        // 정렬 기본값으로 리셋
        setSortField('등록일');
        setSortOrder('desc');
    };
    
    // 정렬 변경
    const handleSortChange = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };
    
    // 에러 재시도
    const handleRetry = () => {
        if (keyword.trim()) {
            fetchBidList(currentPage);
        } else {
            setError(null);
        }
    };
    
    // CSV 다운로드
    const downloadCSV = () => {
        if (filteredAndSortedList.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }
        
        // CSV 헤더
        const headers = ['공고번호', '분류', '공고명', '공고기관', '등록일시', '마감일시', '상태'];
        const rows = filteredAndSortedList.map(bid => {
            const status = getBidStatus(bid.bidClseDt);
            return [
                bid.bidNtceNo || '',
                bid.bidNtceInsttClsfNm || '',
                `"${(bid.bidNtceNm || '').replace(/"/g, '""')}"`, // 따옴표 이스케이프
                `"${(bid.ntceInsttNm || '').replace(/"/g, '""')}"`,
                formatDate(bid.bidNtceDt) || '',
                formatDate(bid.bidClseDt) || '',
                status.label
            ];
        });
        
        // CSV 내용 생성
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // BOM 추가 (한글 깨짐 방지)
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // 파일명 생성
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const filename = `입찰공고_검색결과_${dateStr}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    // 북마크 로드
    useEffect(() => {
        const loadBookmarks = async () => {
            if (!currentUser || !currentUser.uid || !firebaseService) return;
            
            setIsLoadingBookmarks(true);
            try {
                const userBookmarks = await firebaseService.getUserBookmarks(currentUser.uid);
                const bookmarkSet = new Set(
                    userBookmarks.map(b => `${b.bidNtceNo}-${b.bidNtceOrd || ''}`)
                );
                setBookmarks(bookmarkSet);
            } catch (error) {
                
            } finally {
                setIsLoadingBookmarks(false);
            }
        };
        
        if (currentUser && currentUser.uid && firebaseService) {
            loadBookmarks();
        }
    }, [currentUser]);
    
    // 북마크 토글
    const toggleBookmark = async (bid) => {
        if (!currentUser || !currentUser.uid || !firebaseService) {
            alert('북마크 기능을 사용하려면 로그인이 필요합니다.');
            return;
        }
        
        const bidKey = `${bid.bidNtceNo}-${bid.bidNtceOrd || ''}`;
        const isBookmarked = bookmarks.has(bidKey);
        
        try {
            if (isBookmarked) {
                await firebaseService.removeBookmark(currentUser.uid, bid.bidNtceNo, bid.bidNtceOrd);
                setBookmarks(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(bidKey);
                    return newSet;
                });
            } else {
                await firebaseService.addBookmark(currentUser.uid, bid);
                setBookmarks(prev => new Set(prev).add(bidKey));
            }
        } catch (error) {
            
            alert('북마크 저장 중 오류가 발생했습니다.');
        }
    };
    
    const isBidBookmarked = (bid) => {
        const bidKey = `${bid.bidNtceNo}-${bid.bidNtceOrd || ''}`;
        return bookmarks.has(bidKey);
    };

    // 페이지네이션
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const pageNumbers = [];
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage - startPage < maxPageButtons - 1) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <PageTitle pageKey="bidSearch" pageTitles={pageTitles} defaultText="조달청 입찰공고 검색" />
                        <p className="text-gray-500 text-sm">나라장터 입찰공고를 검색하고 확인하세요.</p>
                    </div>
                    <button type="button" onClick={onBack} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로
                    </button>
                </div>

                {/* 검색 영역 */}
                <div className="bg-white rounded-3xl shadow-card p-6 mb-8">
                    {/* 검색유형 탭 */}
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
                        <button
                            type="button"
                            onClick={() => setSearchType('입찰공고')}
                            className={`px-4 py-2 font-bold transition-colors ${
                                searchType === '입찰공고' 
                                    ? 'bg-brand text-white border-b-2 border-brand' 
                                    : 'text-gray-600 hover:text-brand'
                            }`}
                        >
                            입찰공고
                        </button>
                        <button
                            type="button"
                            onClick={() => setSearchType('개찰결과')}
                            className={`px-4 py-2 font-bold transition-colors ${
                                searchType === '개찰결과' 
                                    ? 'bg-brand text-white border-b-2 border-brand' 
                                    : 'text-gray-600 hover:text-brand'
                            }`}
                        >
                            개찰결과
                        </button>
                        <button
                            type="button"
                            onClick={() => setSearchType('최종낙찰자')}
                            className={`px-4 py-2 font-bold transition-colors ${
                                searchType === '최종낙찰자' 
                                    ? 'bg-brand text-white border-b-2 border-brand' 
                                    : 'text-gray-600 hover:text-brand'
                            }`}
                        >
                            최종낙찰자
                        </button>
                    </div>
                    
                    {/* 기본 검색 필드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">입찰공고번호</label>
                            <input
                                type="text"
                                value={bidNoticeNo}
                                onChange={(e) => setBidNoticeNo(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="입찰공고번호 입력"
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">공고명</label>
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="공고명 입력 (예: 부산)"
                                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors"
                            />
                        </div>
                    </div>
                    
                    {/* 검색 버튼 */}
                    <div className="flex justify-end gap-2 mb-4">
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-bold"
                        >
                            <Icons.X size={16} />
                            초기화
                        </button>
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <React.Fragment>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    검색 중...
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <Icons.Search size={20} />
                                    검색
                                </React.Fragment>
                            )}
                        </button>
                    </div>
                    
                    {/* 필터 및 정렬 영역 */}
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand transition-colors"
                            >
                                <Icons.Settings size={16} />
                                {isFilterExpanded ? '필터 접기' : '필터 펼치기'}
                            </button>
                            
                            {/* 북마크 필터 및 정렬 옵션 */}
                            {bidList.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    {currentUser ? (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showBookmarksOnly}
                                                onChange={(e) => setShowBookmarksOnly(e.target.checked)}
                                                className="w-4 h-4 text-brand rounded focus:ring-brand"
                                            />
                                            <span className="text-sm text-gray-600">북마크만 보기</span>
                                        </label>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">정렬:</span>
                                        <select
                                            value={sortField}
                                            onChange={(e) => handleSortChange(e.target.value)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none"
                                        >
                                            <option value="등록일">등록일순</option>
                                            <option value="마감일">마감일순</option>
                                            <option value="공고명">공고명순</option>
                                            <option value="기관명">기관명순</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                            title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
                                        >
                                            {sortOrder === 'asc' ? '↑' : '↓'}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        
                        {/* 필터 섹션 - 나라장터 스타일 */}
                        {isFilterExpanded ? (
                            <div className="border-t border-gray-200 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                                    {/* 공고/개찰일자 */}
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            공고/개찰일자
                                            <Icons.Info size={14} className="text-gray-400 cursor-help" title="공고일자 또는 개찰일자 선택" />
                                        </label>
                                        <div className="flex flex-col md:flex-row gap-2">
                                            <select
                                                value={dateType}
                                                onChange={(e) => setDateType(e.target.value)}
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                            >
                                                <option value="공고일자">공고일자</option>
                                                <option value="개찰일자">개찰일자</option>
                                            </select>
                                            <div className="flex-1 flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={filterStartDate}
                                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                />
                                                <span className="text-gray-500">~</span>
                                                <input
                                                    type="date"
                                                    value={filterEndDate}
                                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickDateRange(1)}
                                                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    최근1개월
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickDateRange(3)}
                                                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    최근3개월
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickDateRange(6)}
                                                    className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    최근6개월
                                                </button>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excludeDeadline}
                                                onChange={(e) => setExcludeDeadline(e.target.checked)}
                                                className="w-4 h-4 text-brand rounded focus:ring-brand"
                                            />
                                            <span className="text-sm text-gray-600">입찰마감제외</span>
                                        </label>
                                    </div>
                                    
                                    {/* 공고종류 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">공고종류</label>
                                        <select
                                            value={noticeType}
                                            onChange={(e) => setNoticeType(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                        >
                                            <option value="전체">전체</option>
                                            <option value="실공고">실공고</option>
                                            <option value="가공고">가공고</option>
                                        </select>
                                    </div>
                                    
                                    {/* 업무구분 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">업무구분</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['전체', '물품', '일반용역', '기술용역', '공사', '기타', '민간'].map(type => (
                                                <label key={type} className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={businessTypes.includes(type)}
                                                        onChange={(e) => {
                                                            if (type === '전체') {
                                                                setBusinessTypes(e.target.checked ? ['전체'] : []);
                                                            } else {
                                                                setBusinessTypes(prev => {
                                                                    const filtered = prev.filter(t => t !== '전체');
                                                                    return e.target.checked 
                                                                        ? [...filtered, type]
                                                                        : filtered.filter(t => t !== type);
                                                                });
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-brand rounded focus:ring-brand"
                                                    />
                                                    <span className="text-xs text-gray-600">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* 업무여부 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">업무여부</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['전체', '외자', '비축', '리스'].map(status => (
                                                <label key={status} className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={businessStatuses.includes(status)}
                                                        onChange={(e) => {
                                                            if (status === '전체') {
                                                                setBusinessStatuses(e.target.checked ? ['전체'] : []);
                                                            } else {
                                                                setBusinessStatuses(prev => {
                                                                    const filtered = prev.filter(s => s !== '전체');
                                                                    return e.target.checked 
                                                                        ? [...filtered, status]
                                                                        : filtered.filter(s => s !== status);
                                                                });
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-brand rounded focus:ring-brand"
                                                    />
                                                    <span className="text-xs text-gray-600">{status}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* 기관명 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            기관명
                                            <Icons.Info size={14} className="text-gray-400 cursor-help" title="기관명 검색" />
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={institutionName}
                                                onChange={(e) => setInstitutionName(e.target.value)}
                                                placeholder="기관명 입력"
                                                className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                            />
                                            {institutionName ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setInstitutionName('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <Icons.X size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-4 mt-2">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isAnnouncingInstitution}
                                                    onChange={(e) => setIsAnnouncingInstitution(e.target.checked)}
                                                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                                                />
                                                <span className="text-xs text-gray-600">공고기관</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isDemandingInstitution}
                                                    onChange={(e) => setIsDemandingInstitution(e.target.checked)}
                                                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                                                />
                                                <span className="text-xs text-gray-600">수요기관</span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {/* 참조번호 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">참조번호</label>
                                        <input
                                            type="text"
                                            value={referenceNo}
                                            onChange={(e) => setReferenceNo(e.target.value)}
                                            placeholder="참조번호 입력"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                        />
                                    </div>
                                    
                                    {/* 참가제한지역 */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            참가제한지역
                                            <Icons.Info size={14} className="text-gray-400 cursor-help" title="참가제한지역 선택" />
                                        </label>
                                        <select
                                            value={restrictedArea}
                                            onChange={(e) => setRestrictedArea(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                        >
                                            <option value="전체">전체</option>
                                            <option value="부산">부산</option>
                                            <option value="서울">서울</option>
                                            <option value="경기">경기</option>
                                        </select>
                                    </div>
                                    
                                    {/* 상세조건 접기/펼치기 버튼 */}
                                    <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsDetailedFilterExpanded(!isDetailedFilterExpanded)}
                                            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold"
                                        >
                                            {isDetailedFilterExpanded ? '상세조건 접기' : '상세조건 펼치기'}
                                            {isDetailedFilterExpanded ? <Icons.ChevronUp size={16} /> : <Icons.ChevronDown size={16} />}
                                        </button>
                                    </div>
                                    
                                    {/* 상세 필터 (접기/펼치기) */}
                                    {isDetailedFilterExpanded ? (
                                        <>
                                            {/* 업종 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                    업종
                                                    <Icons.Info size={14} className="text-gray-400 cursor-help" title="업종 검색" />
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={industry}
                                                        onChange={(e) => setIndustry(e.target.value)}
                                                        placeholder="업종 입력"
                                                        className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                    />
                                                    {industry ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIndustry('')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Icons.X size={16} />
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            
                                            {/* 추정가격 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                    추정가격
                                                    <Icons.Info size={14} className="text-gray-400 cursor-help" title="추정가격 범위 입력" />
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={priceMin}
                                                        onChange={(e) => setPriceMin(e.target.value)}
                                                        placeholder="최소"
                                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                    />
                                                    <span className="text-gray-500">~</span>
                                                    <input
                                                        type="number"
                                                        value={priceMax}
                                                        onChange={(e) => setPriceMax(e.target.value)}
                                                        placeholder="최대"
                                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* 세부품명번호 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                    세부품명번호
                                                    <Icons.Info size={14} className="text-gray-400 cursor-help" title="세부품명번호 검색" />
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={detailItemNo}
                                                        onChange={(e) => setDetailItemNo(e.target.value)}
                                                        placeholder="세부품명번호 입력"
                                                        className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                    />
                                                    {detailItemNo ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDetailItemNo('')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Icons.X size={16} />
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            
                                            {/* 조달요청번호/PRNO */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">조달요청번호/PRNO</label>
                                                <input
                                                    type="text"
                                                    value={prNo}
                                                    onChange={(e) => setPrNo(e.target.value)}
                                                    placeholder="조달요청번호 입력"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                />
                                            </div>
                                            
                                            {/* 쇼핑몰공고 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">쇼핑몰공고</label>
                                                <select
                                                    value={shoppingMall}
                                                    onChange={(e) => setShoppingMall(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                >
                                                    <option value="전체">전체</option>
                                                    <option value="Y">Y</option>
                                                    <option value="N">N</option>
                                                </select>
                                            </div>
                                            
                                            {/* 국내/국제 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">국내/국제</label>
                                                <select
                                                    value={domesticInternational}
                                                    onChange={(e) => setDomesticInternational(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                >
                                                    <option value="전체">전체</option>
                                                    <option value="국내">국내</option>
                                                    <option value="국제">국제</option>
                                                </select>
                                            </div>
                                            
                                            {/* 계약유형 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">계약유형</label>
                                                <select
                                                    value={contractType}
                                                    onChange={(e) => setContractType(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                >
                                                    <option value="전체">전체</option>
                                                    <option value="일반">일반</option>
                                                    <option value="수의">수의</option>
                                                </select>
                                            </div>
                                            
                                            {/* 계약법구분 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">계약법구분</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setContractLawType('전체')}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                                            contractLawType === '전체'
                                                                ? 'bg-brand text-white'
                                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        전체
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setContractLawType('국가계약법')}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                                            contractLawType === '국가계약법'
                                                                ? 'bg-brand text-white'
                                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        국가계약법
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setContractLawType('지방계약법')}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                                            contractLawType === '지방계약법'
                                                                ? 'bg-brand text-white'
                                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        지방계약법
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* 계약방법 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">계약방법</label>
                                                <select
                                                    value={contractMethod}
                                                    onChange={(e) => setContractMethod(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                >
                                                    <option value="전체">전체</option>
                                                    <option value="일괄계약">일괄계약</option>
                                                    <option value="수의계약">수의계약</option>
                                                </select>
                                            </div>
                                            
                                            {/* 낙찰방법 */}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">낙찰방법</label>
                                                <select
                                                    value={awardMethod}
                                                    onChange={(e) => setAwardMethod(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                                                >
                                                    <option value="전체">전체</option>
                                                    <option value="최저가">최저가</option>
                                                    <option value="적격심사">적격심사</option>
                                                </select>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* 에러 메시지 */}
                {error ? (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Icons.AlertCircle className="text-red-500 shrink-0" size={24} />
                            <p className="text-red-700 flex-1">{error}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-bold"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : null}

                {/* 검색 결과 없음 */}
                {!isLoading && bidList.length === 0 && !error && (keyword || bidNoticeNo) ? (
                    <div className="bg-white rounded-3xl shadow-card p-12 text-center">
                        <Icons.FileSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-600 mb-2">검색 결과가 없습니다</h3>
                        <p className="text-gray-400">검색 조건을 변경하거나 다른 키워드로 검색해보세요.</p>
                    </div>
                ) : null}
                
                {/* 필터 적용 후 결과 없음 */}
                {!isLoading && bidList.length > 0 && filteredAndSortedList.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-card p-12 text-center">
                        <Icons.FileSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-600 mb-2">필터 조건에 맞는 결과가 없습니다</h3>
                        <p className="text-gray-400 mb-4">필터 조건을 조정하거나 초기화해보세요.</p>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                        >
                            필터 초기화
                        </button>
                    </div>
                ) : null}

                {/* 결과 테이블 */}
                {bidList.length > 0 ? (
                    <React.Fragment>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                            <div className="flex items-center gap-3">
                                <p className="text-gray-600">
                                    총 <span className="font-bold text-brand">{totalCount.toLocaleString()}</span>건의 입찰공고
                                    {filteredAndSortedList.length !== bidList.length ? (
                                        <span className="text-gray-500 ml-2">
                                            (필터 적용: {filteredAndSortedList.length}건)
                                        </span>
                                    ) : null}
                                </p>
                                {filteredAndSortedList.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={downloadCSV}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-bold"
                                        title="검색 결과를 CSV 파일로 다운로드"
                                    >
                                        <Icons.FileText size={16} />
                                        CSV 다운로드
                                    </button>
                                ) : null}
                            </div>
                            <p className="text-sm text-gray-400">
                                {currentPage} / {totalPages} 페이지
                            </p>
                        </div>

                        {/* 데스크톱 테이블 */}
                        <div className="hidden md:block bg-white rounded-3xl shadow-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full" role="table" aria-label="입찰공고 검색 결과">
                                    <thead className="bg-brand text-white">
                                        <tr role="row">
                                            <th className="px-4 py-3 text-left text-sm font-bold w-20" scope="col">상태</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">공고번호</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">분류</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">공고명</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">공고기관</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">등록일시</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold" scope="col">마감일시</th>
                                            {currentUser ? (
                                                <th className="px-4 py-3 text-center text-sm font-bold w-20" scope="col">북마크</th>
                                            ) : null}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredAndSortedList.map((bid, idx) => {
                                            const status = getBidStatus(bid.bidClseDt);
                                            const bookmarked = isBidBookmarked(bid);
                                            return (
                                                <tr 
                                                    key={`${bid.bidNtceNo}-${bid.bidNtceOrd || idx}`} 
                                                    className="hover:bg-gray-50 transition-colors"
                                                    role="row"
                                                    tabIndex={0}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedBid(bid);
                                                        }
                                                    }}
                                                    aria-label={`입찰공고: ${bid.bidNtceNm || '제목 없음'}`}
                                                >
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                            status.color === 'green' ? 'bg-green-100 text-green-700' :
                                                            status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                <td 
                                                    className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    {bid.bidNtceNo || '-'}
                                                </td>
                                                <td 
                                                    className="px-4 py-3 text-sm cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    <span className="px-2 py-1 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                                                        {bid.bidNtceInsttClsfNm || '일반'}
                                                    </span>
                                                </td>
                                                <td 
                                                    className="px-4 py-3 text-sm font-medium text-dark cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    {bid.bidNtceNm || '-'}
                                                </td>
                                                <td 
                                                    className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    {bid.ntceInsttNm || '-'}
                                                </td>
                                                <td 
                                                    className="px-4 py-3 text-sm text-gray-500 cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    {formatDate(bid.bidNtceDt) || '-'}
                                                </td>
                                                <td 
                                                    className="px-4 py-3 text-sm text-gray-500 cursor-pointer"
                                                    onClick={() => setSelectedBid(bid)}
                                                    role="cell"
                                                >
                                                    {formatDate(bid.bidClseDt) || '-'}
                                                    {status.status !== 'closed' && getTimeRemaining(bid.bidClseDt) ? (
                                                        <span className="block text-xs text-gray-400 mt-1">
                                                            ({getTimeRemaining(bid.bidClseDt)} 남음)
                                                        </span>
                                                    ) : null}
                                                </td>
                                                    {currentUser ? (
                                                        <td 
                                                            className="px-4 py-3 text-center"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleBookmark(bid);
                                                                }}
                                                                className={`p-2 rounded-lg transition-colors ${
                                                                    bookmarked 
                                                                        ? 'text-yellow-500 hover:bg-yellow-50' 
                                                                        : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-400'
                                                                }`}
                                                                title={bookmarked ? '북마크 해제' : '북마크 추가'}
                                                            >
                                                                <Icons.Star 
                                                                    size={20} 
                                                                    className={bookmarked ? 'fill-current' : ''} 
                                                                />
                                                            </button>
                                                        </td>
                                                    ) : null}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 모바일 카드 뷰 */}
                        <div className="md:hidden space-y-4">
                            {filteredAndSortedList.map((bid, idx) => {
                                const status = getBidStatus(bid.bidClseDt);
                                const bookmarked = isBidBookmarked(bid);
                                return (
                                    <div 
                                        key={`${bid.bidNtceNo}-${bid.bidNtceOrd || idx}`} 
                                        className="bg-white rounded-2xl shadow-card p-4 hover:shadow-lg transition-shadow relative"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="px-2 py-1 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                                                    {bid.bidNtceInsttClsfNm || '일반'}
                                                </span>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                    status.color === 'green' ? 'bg-green-100 text-green-700' :
                                                    status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {currentUser ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleBookmark(bid);
                                                        }}
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            bookmarked 
                                                                ? 'text-yellow-500' 
                                                                : 'text-gray-300 hover:text-yellow-400'
                                                        }`}
                                                    >
                                                        <Icons.Star 
                                                            size={18} 
                                                            className={bookmarked ? 'fill-current' : ''} 
                                                        />
                                                    </button>
                                                ) : null}
                                                <span className="text-xs text-gray-400">{bid.bidNtceNo || '-'}</span>
                                            </div>
                                        </div>
                                        <div onClick={() => setSelectedBid(bid)} className="cursor-pointer">
                                            <h3 className="font-bold text-dark mb-3 line-clamp-2">{bid.bidNtceNm || '-'}</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Icons.Building2 size={16} className="text-gray-400 shrink-0" />
                                                    <span className="truncate">{bid.ntceInsttNm || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Icons.Calendar size={16} className="text-gray-400 shrink-0" />
                                                    <span>등록: {formatDate(bid.bidNtceDt) || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Icons.Clock size={16} className="text-gray-400 shrink-0" />
                                                    <span>마감: {formatDate(bid.bidClseDt) || '-'}</span>
                                                    {status.status !== 'closed' && getTimeRemaining(bid.bidClseDt) ? (
                                                        <span className="text-xs text-orange-600 font-bold">
                                                            ({getTimeRemaining(bid.bidClseDt)} 남음)
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 ? (
                            <div className="flex justify-center items-center gap-2 mt-8">
                                <button
                                    type="button"
                                    onClick={() => fetchBidList(1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Icons.ChevronsLeft size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchBidList(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Icons.ChevronLeft size={20} />
                                </button>
                                
                                {pageNumbers.map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => fetchBidList(num)}
                                        className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                                            currentPage === num 
                                                ? 'bg-brand text-white' 
                                                : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                                
                                <button
                                    type="button"
                                    onClick={() => fetchBidList(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Icons.ChevronRight size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchBidList(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Icons.ChevronsRight size={20} />
                                </button>
                            </div>
                        ) : null}
                    </React.Fragment>
            ) : null}
                
                {/* 상세 정보 모달 */}
                {selectedBid ? (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70" 
                        style={{ position: 'fixed', zIndex: 9999 }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelectedBid(null);
                        }}
                    >
                        <div 
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto modal-scroll relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 모달 헤더 */}
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between z-10">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        {(() => {
                                            const status = getBidStatus(selectedBid.bidClseDt);
                                            return (
                                                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                                                    status.color === 'green' ? 'bg-green-100 text-green-700' :
                                                    status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {status.label}
                                                </span>
                                            );
                                        })()}
                                        <span className="px-2 py-1 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                                            {selectedBid.bidNtceInsttClsfNm || '일반'}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-dark mb-2">{selectedBid.bidNtceNm || '-'}</h2>
                                    <p className="text-sm text-gray-500">공고번호: {selectedBid.bidNtceNo || '-'}</p>
                                </div>
                                <div className="flex items-start gap-2 shrink-0">
                                    {currentUser ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleBookmark(selectedBid)}
                                            className={`p-2 rounded-lg transition-colors ${
                                                isBidBookmarked(selectedBid)
                                                    ? 'text-yellow-500 hover:bg-yellow-50' 
                                                    : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-400'
                                            }`}
                                            title={isBidBookmarked(selectedBid) ? '북마크 해제' : '북마크 추가'}
                                        >
                                            <Icons.Star 
                                                size={24} 
                                                className={isBidBookmarked(selectedBid) ? 'fill-current' : ''} 
                                            />
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBid(null)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <Icons.X size={24} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* 모달 내용 */}
                            <div className="p-6 space-y-6">
                                {/* 기본 정보 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 mb-1">공고기관</div>
                                        <div className="font-bold text-dark">{selectedBid.ntceInsttNm || '정보 없음'}</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 mb-1">분류</div>
                                        <div className="font-bold text-dark">{selectedBid.bidNtceInsttClsfNm || '일반'}</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 mb-1">등록일시</div>
                                        <div className="font-bold text-dark">{formatDate(selectedBid.bidNtceDt) || '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 mb-1">마감일시</div>
                                        <div className="font-bold text-dark">
                                            {formatDate(selectedBid.bidClseDt) || '-'}
                                            {(() => {
                                                const status = getBidStatus(selectedBid.bidClseDt);
                                                const remaining = getTimeRemaining(selectedBid.bidClseDt);
                                                if (status.status !== 'closed' && remaining) {
                                                    return (
                                                        <span className="block text-sm text-orange-600 font-normal mt-1">
                                                            {remaining} 남음
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 추가 정보 (API 응답에 있는 경우) */}
                                {(selectedBid.cntrctMthdNm || selectedBid.presmptPrce || selectedBid.dminsttNm) ? (
                                    <div className="border-t border-gray-200 pt-6">
                                        <h3 className="text-lg font-bold text-dark mb-4">상세 정보</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedBid.cntrctMthdNm ? (
                                                <div className="bg-gray-50 rounded-xl p-4">
                                                    <div className="text-xs text-gray-500 mb-1">계약방법</div>
                                                    <div className="font-bold text-dark">{selectedBid.cntrctMthdNm}</div>
                                                </div>
                                            ) : null}
                                            {selectedBid.presmptPrce ? (
                                                <div className="bg-gray-50 rounded-xl p-4">
                                                    <div className="text-xs text-gray-500 mb-1">예산</div>
                                                    <div className="font-bold text-dark">{selectedBid.presmptPrce}</div>
                                                </div>
                                            ) : null}
                                            {selectedBid.dminsttNm ? (
                                                <div className="bg-gray-50 rounded-xl p-4">
                                                    <div className="text-xs text-gray-500 mb-1">담당기관</div>
                                                    <div className="font-bold text-dark">{selectedBid.dminsttNm}</div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                                
                                {/* 나라장터 링크 */}
                                {selectedBid.bidNtceNo ? (
                                    <div className="border-t border-gray-200 pt-6">
                                        <a
                                            href={`https://www.g2b.go.kr/ep/co/co/coDetail.do?bidno=${selectedBid.bidNtceNo}&bidseq=${selectedBid.bidNtceOrd || '0'}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-xl hover:bg-blue-700 transition-colors font-bold"
                                        >
                                            <Icons.ExternalLink size={20} />
                                            나라장터에서 상세보기
                                        </a>
                                    </div>
                                ) : null}
                    </div>
                    </div>
                </div>
            ) : null}
                        </div>
        </div>
    );
};



// AboutView는 별도 파일로 분리됨

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
const LoginModal = ({ onClose, onLogin }) => {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    useEffect(() => {
        return () => {
            // Cleanup
        };
    }, []);

    const handleSubmit = (e) => { 
        e.preventDefault(); 
        onLogin(id, password); 
    };
    
    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md"></div>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 p-8 text-center relative border-[0.5px] border-brand" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                        <Icons.X size={18}/>
                    </button>
                    <div className="mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/30">
                            <Icons.Users className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-dark mb-2">로그인</h3>
                        <p className="text-sm text-gray-500">부청사 커뮤니티에 오신 것을 환영합니다</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-5 text-left">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">아이디 또는 이메일</label>
                            <input type="text" placeholder="아이디 또는 이메일을 입력하세요" className="w-full p-4 border-[0.5px] border-brand/30 rounded-2xl focus:border-brand focus:outline-none transition-colors" value={id} onChange={e => setId(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">비밀번호</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요" className="w-full p-4 border-[0.5px] border-brand/30 rounded-2xl focus:border-brand focus:outline-none transition-colors pr-12" value={password} onChange={e => setPassword(e.target.value)} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                    {showPassword ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="w-full py-4 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-brand/30 transition-all mt-6 text-lg">
                            로그인
                        </button>
                    </form>
                    <button 
                        type="button" 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            alert('아이디/비밀번호 찾기는 관리자에게 문의해주세요.');
                        }} 
                        className="w-full mt-3 text-sm text-brand hover:text-blue-700 font-medium transition-colors underline"
                    >
                        아이디/비밀번호 찾기
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                        취소
                    </button>
                </div>
            </div>
        </>
    );
};

// SignUpModal Component
const InquiryModal = ({ onClose, currentUser, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        title: '',
        content: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.title || !formData.content) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }
        if (onSubmit) {
            onSubmit(formData);
            setFormData({
                name: currentUser?.name || '',
                email: currentUser?.email || '',
                phone: currentUser?.phone || '',
                title: '',
                content: ''
            });
        }
        if (onClose) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-scroll">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-dark">문의하기</h3>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <Icons.X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">이름 *</label>
                        <input
                            type="text"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">이메일 *</label>
                        <input
                            type="email"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                        <input
                            type="tel"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                        <input
                            type="text"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                        <textarea
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-32 resize-none"
                            value={formData.content}
                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                            required
                        />
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">
                            취소
                        </button>
                        <button type="submit" className="flex-1 py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">
                            문의하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SignUpModal = ({ onClose, onSignUp, existingUsers = [] }) => {
    const [formData, setFormData] = useState({ 
        userType: '',
        email: '',
        password: '', 
        passwordConfirm: '',
        name: '', 
        phone: '',
        img: '',
        privacyAgreed: false,
        roadAddress: '',
        detailAddress: '',
        zipCode: '',
        businessRegistrationNumber: '',
        businessVerified: false,
        businessVerificationStatus: 'not_started',
        businessType: '',
        businessCategory: '',
        company: '', 
        role: '', 
        approvalStatus: 'pending'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [firebaseUser, setFirebaseUser] = useState(null);
    
    useEffect(() => {
        return () => {
            // Cleanup
        };
    }, []);
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, img: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password) => {
        if (password.length < 8) return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
        if (!/[a-zA-Z]/.test(password)) return { valid: false, message: '비밀번호에 영문이 포함되어야 합니다.' };
        if (!/[0-9]/.test(password)) return { valid: false, message: '비밀번호에 숫자가 포함되어야 합니다.' };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, message: '비밀번호에 특수문자가 포함되어야 합니다.' };
        return { valid: true, message: '' };
    };

    const validatePhone = (phone) => {
        const cleaned = phone.replace(/[^0-9]/g, '');
        const phoneRegex = /^(010|011|016|017|018|019)[0-9]{7,8}$/;
        return phoneRegex.test(cleaned);
    };

    const validateBusinessNumber = (businessNumber) => {
        const cleaned = businessNumber.replace(/[^0-9]/g, '');
        if (cleaned.length !== 10) return false;
        
        const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleaned[i]) * weights[i];
        }
        sum += Math.floor((parseInt(cleaned[8]) * 5) / 10);
        const remainder = sum % 10;
        const checkDigit = (10 - remainder) % 10;
        
        return checkDigit === parseInt(cleaned[9]);
    };

    const verifyBusinessNumberAPI = async (businessNumber) => {
        const cleaned = businessNumber.replace(/[^0-9]/g, '');
        if (cleaned.length !== 10) {
            return { success: false, message: '사업자등록번호는 10자리 숫자여야 합니다.' };
        }

        if (!validateBusinessNumber(cleaned)) {
            return { success: false, message: '올바른 사업자등록번호 형식이 아닙니다.' };
        }

        try {
            const API_KEY = CONFIG.PUBLIC_DATA_API?.API_KEY || '';
            
            if (API_KEY && API_KEY.trim() !== '') {
                const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${API_KEY}&b_no=${cleaned}`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('API 호출 실패');
                }
                
                const data = await response.json();
                
                if (data.status_code === '01' && data.valid === '01') {
                    return { 
                        success: true, 
                        message: '운영 중인 사업자로 확인되었습니다.',
                        data: data
                    };
                } else {
                    return { 
                        success: false, 
                        message: '운영 중인 사업자만 등록 가능합니다.',
                        data: data
                    };
                }
            } else {
                return { 
                    success: true, 
                    message: '사업자등록번호 형식이 올바릅니다. (실제 API 연동 필요)',
                    data: { status: 'FORMAT_VALID' }
                };
            }
        } catch (error) {
            return { 
                success: false, 
                message: '사업자등록번호 검증에 실패했습니다. 다시 시도해주세요.' 
            };
        }
    };

    const handleNextStep = async () => {
        if (currentStep === 1) {
            if (!formData.userType) {
                return alert("회원 유형을 선택해주세요.");
            }
            if (!formData.email || !formData.password || !formData.passwordConfirm || !formData.name || !formData.phone) {
                return alert("모든 필수 정보를 입력해주세요.");
            }
            if (!validateEmail(formData.email)) {
                return alert("올바른 이메일 형식을 입력해주세요.");
            }
            const passwordValidation = validatePassword(formData.password);
            if (!passwordValidation.valid) {
                return alert(passwordValidation.message);
            }
            if (formData.password !== formData.passwordConfirm) {
                return alert("비밀번호가 일치하지 않습니다.");
            }
            if (!validatePhone(formData.phone)) {
                return alert("올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)");
            }
            if (!formData.privacyAgreed) {
                return alert("개인정보 수집 및 이용에 동의해주세요.");
            }
            
            setIsCreatingAccount(true);
            try {
                const allUsers = await loadUsersFromStorage();
                const existingUser = allUsers.find(u => u.email === formData.email);
                if (existingUser) {
                    setIsCreatingAccount(false);
                    return alert("이미 사용 중인 이메일입니다.");
                }
                
                if (authService && authService.signUp) {
                    const user = await authService.signUp(formData.email, formData.password, {
                        name: formData.name,
                        phone: formData.phone,
                        userType: formData.userType,
                        img: formData.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
                        approvalStatus: 'pending'
                    });
                    setFirebaseUser(user);
                    setCurrentStep(2);
                } else {
                    throw new Error('Firebase Auth가 초기화되지 않았습니다.');
                }
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    alert("이미 사용 중인 이메일입니다.");
                } else if (error.code === 'auth/weak-password') {
                    alert("비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.");
                } else if (error.code === 'auth/network-request-failed') {
                    alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.");
                } else {
                    alert(`회원가입에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
                }
            } finally {
                setIsCreatingAccount(false);
            }
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleIdentityVerification = async () => {
        try {
            const IMP = window.IMP;
            if (!IMP) {
                alert('PortOne SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
                return;
            }
            
            // IMP_CODE 확인
            if (!PORTONE_IMP_CODE || PORTONE_IMP_CODE === 'imp00000000') {
                alert('PortOne 가맹점 코드가 설정되지 않았습니다. 관리자에게 문의해주세요.');
                return;
            }
            
            IMP.init(PORTONE_IMP_CODE);
            
            IMP.certification({
                // pg를 지정하지 않으면 PortOne 기본 PG 사용
                merchant_uid: `cert_${Date.now()}`,
                m_redirect_url: window.location.href,
                popup: true,
                name: formData.name || '본인인증',
                phone: formData.phone || '',
            }, (rsp) => {
                if (rsp.success) {
                    setFormData({
                        ...formData,
                        isIdentityVerified: true,
                        verifiedName: rsp.name,
                        verifiedPhone: rsp.phone,
                        verifiedBirthday: rsp.birthday,
                        verifiedGender: rsp.gender,
                        impUid: rsp.imp_uid
                    });
                    
                    alert(`본인인증이 완료되었습니다.\n인증된 이름: ${rsp.name}\n인증된 전화번호: ${rsp.phone}`);
                } else {
                    alert(`본인인증에 실패했습니다.\n에러 메시지: ${rsp.error_msg || '알 수 없는 오류'}`);
                }
            });
            
        } catch (error) {
            alert('본인인증에 실패했습니다. 다시 시도해주세요.');
        }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        
        if (!firebaseUser) {
            return alert("회원가입 오류가 발생했습니다. 처음부터 다시 시도해주세요.");
        }
        
        if (!formData.roadAddress) {
            return alert("주소를 입력해주세요. 주소 검색 버튼을 클릭하여 주소를 선택해주세요.");
        }
        
        if (formData.userType === '사업자') {
            if (!formData.businessType || !formData.businessCategory || !formData.company) {
                return alert("사업자 정보를 모두 입력해주세요.");
            }
            if (!formData.businessRegistrationNumber) {
                return alert("사업자등록번호를 입력해주세요.");
            }
            const cleanedBN = formData.businessRegistrationNumber.replace(/[^0-9]/g, '');
            if (cleanedBN.length !== 10) {
                return alert("사업자등록번호는 10자리 숫자여야 합니다.");
            }
            if (formData.businessVerificationStatus !== 'api_verified') {
                return alert("사업자등록번호 검증을 완료해주세요. 검증하기 버튼을 클릭하여 검증을 진행해주세요.");
            }
        }
        
        try {
            const userData = {
                uid: firebaseUser.uid,
                email: formData.email,
                name: formData.name,
                phone: formData.phone,
                userType: formData.userType,
                roadAddress: formData.roadAddress,
                detailAddress: formData.detailAddress,
                zipCode: formData.zipCode,
                img: formData.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
                approvalStatus: 'pending',
                createdAt: new Date().toISOString()
            };
            
            if (formData.userType === '사업자') {
                userData.businessRegistrationNumber = formData.businessRegistrationNumber.replace(/[^0-9]/g, '');
                userData.businessVerified = formData.businessVerified;
                userData.businessType = formData.businessType;
                userData.businessCategory = formData.businessCategory;
                userData.company = formData.company;
                userData.role = formData.role;
            }
            
            if (firebaseService && firebaseService.updateUser) {
                const users = await firebaseService.getUsers();
                const userDoc = users.find(u => u.uid === firebaseUser.uid);
                if (userDoc) {
                    await firebaseService.updateUser(userDoc.id, userData);
                } else {
                    await firebaseService.createUser(userData);
                }
            }
            
            if (onSignUp) {
                onSignUp(userData);
            }
            
            alert("회원가입이 완료되었습니다.\n관리자 승인 후 서비스를 이용하실 수 있습니다.\n승인 상태는 마이페이지에서 확인하실 수 있습니다.");
            onClose(); 
        } catch (error) {
            alert(`회원가입 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        }
    };
    
    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-lg"></div>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl z-10 relative border-[0.5px] border-brand max-h-[95vh] overflow-hidden flex flex-col" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-brand to-blue-600 text-white p-6 relative">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-all">
                            <Icons.X size={20}/>
                        </button>
                        <div className="text-center">
                            <h3 className="text-3xl font-bold mb-2">회원가입</h3>
                            <p className="text-blue-100 text-sm">부청사 커뮤니티에 가입하세요</p>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-6">
                            {[1, 2].map(step => (
                                <div key={step} className="flex items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${currentStep >= step ? 'bg-white text-brand' : 'bg-white/20 text-white/60'}`}>
                                        {currentStep > step ? <CheckCircle size={18} /> : step}
                                    </div>
                                    {step < 2 && <div className={`w-8 h-1 mx-1 transition-all ${currentStep > step ? 'bg-white' : 'bg-white/20'}`} />}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-center gap-4 mt-3 text-xs">
                            <span className={currentStep === 1 ? 'font-bold' : 'opacity-70'}>기본정보</span>
                            <span className={currentStep === 2 ? 'font-bold' : 'opacity-70'}>상세정보</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto modal-scroll p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {currentStep === 1 ? (
                                <div className="space-y-5 animate-fade-in">
                                    <div className="mb-6 text-center">
                                        <h4 className="text-2xl font-bold text-dark mb-2">회원 유형 선택</h4>
                                        <p className="text-sm text-gray-500">본인의 분류를 선택해주세요</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, userType: '사업자', businessType: '개인사업자'})}
                                            className={`p-6 rounded-2xl border-2 transition-all text-left ${
                                                formData.userType === '사업자' 
                                                    ? 'border-brand bg-brand/5 shadow-lg' 
                                                    : 'border-gray-200 hover:border-brand/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${formData.userType === '사업자' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <Icons.Users size={24} />
                                                </div>
                                                <h5 className="text-lg font-bold text-dark">사업자</h5>
                                            </div>
                                            <p className="text-sm text-gray-600">현재 사업을 운영 중이신 분</p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, userType: '예비창업자', businessType: ''})}
                                            className={`p-6 rounded-2xl border-2 transition-all text-left ${
                                                formData.userType === '예비창업자' 
                                                    ? 'border-brand bg-brand/5 shadow-lg' 
                                                    : 'border-gray-200 hover:border-brand/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${formData.userType === '예비창업자' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <Star size={24} />
                                                </div>
                                                <h5 className="text-lg font-bold text-dark">예비창업자</h5>
                                            </div>
                                            <p className="text-sm text-gray-600">창업을 준비 중이신 분</p>
                                        </button>
                                    </div>

                                    {formData.userType ? (
                                        <>
                                            <div className="mb-6">
                                                <h4 className="text-xl font-bold text-dark mb-1">기본 정보</h4>
                                                <p className="text-sm text-gray-500">로그인에 필요한 기본 정보를 입력해주세요</p>
                                            </div>
                                            
                                            <div className="flex flex-col items-center mb-6 p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand/20 to-brand/10 overflow-hidden mb-3 relative group border-4 border-brand/20">
                                                    {formData.img ? <img src={formData.img} className="w-full h-full object-cover" alt="Profile" /> : <Icons.Users className="w-12 h-12 text-brand/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                        <Icons.Camera className="text-white w-5 h-5" />
                                                    </div>
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                                </div>
                                                <span className="text-xs text-gray-500 font-medium">프로필 사진 (선택사항)</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">이메일 <span className="text-red-500">*</span> <span className="text-xs text-gray-500 font-normal">(로그인에 사용)</span></label>
                                                    <input type="email" placeholder="example@email.com" className="w-full p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                                                    <input type="text" placeholder="이름을 입력하세요" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 <span className="text-red-500">*</span> <span className="text-xs text-gray-500 font-normal">(최소 8자, 영문+숫자+특수문자)</span></label>
                                                    <div className="relative">
                                                        <input type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요" className="w-full p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors pr-12 text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                            {showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                                                        </button>
                                                    </div>
                                                    {formData.password && (() => {
                                                        const validation = validatePassword(formData.password);
                                                        return (
                                                            <div className={`mt-2 text-xs ${validation.valid ? 'text-green-600' : 'text-red-500'}`}>
                                                                {validation.valid ? '✓ 비밀번호가 안전합니다' : validation.message}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 확인 <span className="text-red-500">*</span></label>
                                                    <div className="relative">
                                                        <input type={showPasswordConfirm ? "text" : "password"} placeholder="비밀번호를 다시 입력하세요" className="w-full p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors pr-12 text-sm" value={formData.passwordConfirm} onChange={e => setFormData({...formData, passwordConfirm: e.target.value})} />
                                                        <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                            {showPasswordConfirm ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                                                        </button>
                                                    </div>
                                                    {formData.passwordConfirm && formData.password !== formData.passwordConfirm ? (
                                                        <div className="mt-2 text-xs text-red-500">비밀번호가 일치하지 않습니다.</div>
                                                    ) : null}
                                                    {formData.passwordConfirm && formData.password === formData.passwordConfirm && formData.passwordConfirm.length > 0 ? (
                                                        <div className="mt-2 text-xs text-green-600">✓ 비밀번호가 일치합니다.</div>
                                                    ) : null}
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">전화번호 <span className="text-red-500">*</span></label>
                                                    <input type="tel" placeholder="010-1234-5678" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                                </div>
                                            </div>
                                            
                                            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.privacyAgreed}
                                                        onChange={e => setFormData({...formData, privacyAgreed: e.target.checked})}
                                                        className="mt-1 w-5 h-5 text-brand border-gray-300 rounded focus:ring-brand"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-sm font-bold text-gray-700">
                                                            개인정보 수집 및 이용에 동의합니다 <span className="text-red-500">*</span>
                                                        </span>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            부청사는 회원가입을 위해 최소한의 개인정보를 수집합니다. 
                                                            <a href="#" className="text-brand hover:underline ml-1" onClick={(e) => { e.preventDefault(); alert('개인정보처리방침 페이지로 이동합니다.'); }}>
                                                                자세한 내용 보기
                                                            </a>
                                                        </p>
                                                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                                                            <p>• 수집 항목: 이메일(로그인용), 비밀번호(해시), 이름, 전화번호, 주소, 사업자정보(사업자만)</p>
                                                            <p>• 수집 목적: 회원 관리, 서비스 제공, 본인 확인</p>
                                                            <p>• 보관 기간: 회원 탈퇴 시까지 (법정 보관 기간이 있는 경우 해당 기간)</p>
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}

                            {currentStep === 2 ? (
                                <div className="space-y-5 animate-fade-in">
                                    <div className="mb-6">
                                        <h4 className="text-xl font-bold text-dark mb-1">상세 정보</h4>
                                        <p className="text-sm text-gray-500">
                                            {formData.userType === '사업자' ? '사업자 정보를 입력해주세요' : '예비창업자 정보를 입력해주세요'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {formData.userType === '사업자' ? (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">사업자 유형 <span className="text-red-500">*</span></label>
                                                    <select className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors bg-white text-sm" value={formData.businessType} onChange={e => setFormData({...formData, businessType: e.target.value})}>
                                                        <option value="개인사업자">개인사업자</option>
                                                        <option value="법인사업자">법인사업자</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">사업형태 <span className="text-red-500">*</span></label>
                                                    <select className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors bg-white text-sm" value={formData.businessCategory} onChange={e => setFormData({...formData, businessCategory: e.target.value})}>
                                                        <optgroup label="제조업">
                                                            <option>식품제조업</option>
                                                            <option>의류제조업</option>
                                                            <option>화학제조업</option>
                                                            <option>전자제품제조업</option>
                                                            <option>기계제조업</option>
                                                            <option>기타 제조업</option>
                                                        </optgroup>
                                                        <optgroup label="도매 및 소매업">
                                                            <option>도매업</option>
                                                            <option>소매업</option>
                                                            <option>온라인 쇼핑몰</option>
                                                            <option>편의점/마트</option>
                                                        </optgroup>
                                                        <optgroup label="서비스업">
                                                            <option>IT/소프트웨어</option>
                                                            <option>웹/앱 개발</option>
                                                            <option>디자인/광고</option>
                                                            <option>컨설팅</option>
                                                            <option>교육/학원</option>
                                                            <option>의료/병원</option>
                                                            <option>미용/네일</option>
                                                            <option>요식업 (한식)</option>
                                                            <option>요식업 (양식)</option>
                                                            <option>요식업 (중식)</option>
                                                            <option>요식업 (일식)</option>
                                                            <option>요식업 (카페)</option>
                                                            <option>숙박업</option>
                                                            <option>운송업</option>
                                                            <option>부동산</option>
                                                            <option>법률/회계</option>
                                                            <option>기타 서비스업</option>
                                                        </optgroup>
                                                        <optgroup label="건설업">
                                                            <option>건설업</option>
                                                            <option>인테리어</option>
                                                            <option>토목공사</option>
                                                        </optgroup>
                                                        <optgroup label="농업/임업/어업">
                                                            <option>농업</option>
                                                            <option>축산업</option>
                                                            <option>임업</option>
                                                            <option>어업</option>
                                                        </optgroup>
                                                        <optgroup label="기타">
                                                            <option>기타 사업</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">업체명 <span className="text-red-500">*</span></label>
                                                    <input type="text" placeholder="회사/사업체 이름" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">직책</label>
                                                    <input type="text" placeholder="대표, 이사, 팀장 등" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">업체주소 <span className="text-red-500">*</span></label>
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text" 
                                                                readOnly 
                                                                placeholder="도로명 주소 검색" 
                                                                className="flex-1 p-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm cursor-pointer" 
                                                                value={formData.roadAddress} 
                                                                onClick={() => {
                                                                    openDaumPostcode((data) => {
                                                                        if (data && data.roadAddress) {
                                                                            setFormData({
                                                                                ...formData, 
                                                                                roadAddress: data.roadAddress, 
                                                                                zipCode: data.zipCode || ''
                                                                            });
                                                                        } else {
                                                                            alert('주소를 선택해주세요.');
                                                                        }
                                                                    });
                                                                }} 
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => {
                                                                    openDaumPostcode((data) => {
                                                                        if (data && data.roadAddress) {
                                                                            setFormData({
                                                                                ...formData, 
                                                                                roadAddress: data.roadAddress, 
                                                                                zipCode: data.zipCode || ''
                                                                            });
                                                                        } else {
                                                                            alert('주소를 선택해주세요.');
                                                                        }
                                                                    });
                                                                }} 
                                                                className="px-4 py-3.5 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                                                            >
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin size={16} />
                                                                    주소 검색
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {formData.zipCode ? (
                                                            <p className="text-xs text-gray-500">우편번호: {formData.zipCode}</p>
                                                        ) : null}
                                                        <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
                                                    </div>
                                                </div>
                                            </>
                                        ) : null}
                                        {formData.userType === '예비창업자' ? (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">집주소 <span className="text-red-500">*</span></label>
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            readOnly 
                                                            placeholder="도로명 주소 검색" 
                                                            className="flex-1 p-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm cursor-pointer" 
                                                            value={formData.roadAddress} 
                                                            onClick={() => {
                                                                openDaumPostcode((data) => {
                                                                    if (data && data.roadAddress) {
                                                                        setFormData({
                                                                            ...formData, 
                                                                            roadAddress: data.roadAddress, 
                                                                            zipCode: data.zipCode || ''
                                                                        });
                                                                    } else {
                                                                        alert('주소를 선택해주세요.');
                                                                    }
                                                                });
                                                            }} 
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                openDaumPostcode((data) => {
                                                                    if (data && data.roadAddress) {
                                                                        setFormData({
                                                                            ...formData, 
                                                                            roadAddress: data.roadAddress, 
                                                                            zipCode: data.zipCode || ''
                                                                        });
                                                                    } else {
                                                                        alert('주소를 선택해주세요.');
                                                                    }
                                                                });
                                                            }} 
                                                            className="px-4 py-3.5 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                <MapPin size={16} />
                                                                주소 검색
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {formData.zipCode ? (
                                                        <p className="text-xs text-gray-500">우편번호: {formData.zipCode}</p>
                                                    ) : null}
                                                    <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className={`mt-4 p-6 rounded-2xl border-2 ${
                                        formData.userType === '사업자' 
                                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' 
                                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
                                    }`}>
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                                formData.userType === '사업자' ? 'bg-blue-500' : 'bg-gray-400'
                                            }`}>
                                                {formData.userType === '사업자' ? (
                                                    <CheckCircle className="w-6 h-6 text-white" />
                                                ) : (
                                                    <Info className="w-6 h-6 text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="font-bold text-dark mb-2">
                                                    {formData.userType === '사업자' ? '사업자등록번호 입력' : '사업자등록번호 입력 (선택)'}
                                                </h5>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    {formData.userType === '사업자' 
                                                        ? '사업자등록번호를 입력하시면 형식 검증과 API 검증을 진행합니다.' 
                                                        : '보유하신 사업자등록번호가 있다면 입력해주세요. 없으시면 건너뛰셔도 됩니다.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                사업자등록번호 
                                                {formData.userType === '사업자' ? (
                                                    <span className="text-red-500"> *</span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs"> (선택사항)</span>
                                                )}
                                            </label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="123-45-67890" 
                                                    className={`flex-1 p-3.5 border-2 rounded-xl focus:outline-none transition-colors text-sm ${
                                                        formData.userType === '사업자' 
                                                            ? 'border-gray-200 focus:border-blue-400' 
                                                            : 'border-gray-200 focus:border-gray-400'
                                                    } ${formData.businessVerificationStatus === 'api_verified' ? 'bg-gray-100' : ''}`}
                                                    value={formData.businessRegistrationNumber} 
                                                    onChange={e => {
                                                        let value = e.target.value.replace(/[^0-9]/g, '');
                                                        if (value.length > 10) value = value.slice(0, 10);
                                                        if (value.length > 5) {
                                                            value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5);
                                                        } else if (value.length > 3) {
                                                            value = value.slice(0, 3) + '-' + value.slice(3);
                                                        }
                                                        setFormData({
                                                            ...formData, 
                                                            businessRegistrationNumber: value, 
                                                            businessVerified: false,
                                                            businessVerificationStatus: 'not_started'
                                                        });
                                                    }}
                                                    maxLength="12"
                                                    disabled={formData.userType === '사업자' && formData.businessVerificationStatus === 'api_verified'}
                                                />
                                                {formData.userType === '사업자' && formData.businessRegistrationNumber.length === 12 ? (
                                                    <button
                                                        type="button"
                                                        onClick={async (event) => {
                                                            if (!formData.businessRegistrationNumber) {
                                                                return alert("사업자등록번호를 입력해주세요.");
                                                            }
                                                            
                                                            if (!validateBusinessNumber(formData.businessRegistrationNumber)) {
                                                                setFormData({...formData, businessVerificationStatus: 'api_failed'});
                                                                return alert("올바른 사업자등록번호 형식이 아닙니다.");
                                                            }
                                                            
                                                            setFormData({...formData, businessVerificationStatus: 'format_valid'});
                                                            setFormData({...formData, businessVerificationStatus: 'api_verifying'});
                                                            
                                                            const button = event.target;
                                                            const originalText = button.textContent;
                                                            button.disabled = true;
                                                            
                                                            try {
                                                                const result = await verifyBusinessNumberAPI(formData.businessRegistrationNumber);
                                                                
                                                                if (result.success) {
                                                                    setFormData({
                                                                        ...formData, 
                                                                        businessVerified: true,
                                                                        businessVerificationStatus: 'api_verified'
                                                                    });
                                                                    alert(result.message);
                                                                } else {
                                                                    setFormData({...formData, businessVerificationStatus: 'api_failed'});
                                                                    alert(result.message);
                                                                }
                                                            } catch (error) {
                                                                setFormData({...formData, businessVerificationStatus: 'api_failed'});
                                                                alert('사업자등록번호 검증에 실패했습니다. 다시 시도해주세요.');
                                                            } finally {
                                                                button.disabled = false;
                                                                button.textContent = originalText;
                                                            }
                                                        }}
                                                        disabled={
                                                            formData.businessVerificationStatus === 'api_verifying' || 
                                                            formData.businessVerificationStatus === 'api_verified' ||
                                                            formData.businessRegistrationNumber.length !== 12
                                                        }
                                                        className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors ${
                                                            formData.businessVerificationStatus === 'api_verified'
                                                                ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                                                            : formData.businessVerificationStatus === 'api_verifying'
                                                                ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                                                                : 'bg-brand text-white hover:bg-blue-700'
                                                        }`}
                                                    >
                                                        {formData.businessVerificationStatus === 'api_verified' ? (
                                                            <span className="flex items-center gap-2">
                                                                <CheckCircle size={16} />
                                                                검증완료
                                                            </span>
                                                        ) : formData.businessVerificationStatus === 'api_verifying' ? (
                                                            <span className="flex items-center gap-2">
                                                                검증 중...
                                                            </span>
                                                        ) : (
                                                            '검증하기'
                                                        )}
                                                    </button>
                                                ) : null}
                                            </div>
                                            
                                            {formData.userType === '사업자' && formData.businessRegistrationNumber ? (
                                                <div className="mt-3 space-y-2">
                                                    {formData.businessVerificationStatus === 'format_valid' ? (
                                                        <p className="text-xs text-blue-600 flex items-center gap-1">
                                                            <CheckCircle size={12} />
                                                            형식 검증 완료
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'api_verified' ? (
                                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                                            <CheckCircle size={12} />
                                                            운영 중인 사업자로 확인되었습니다.
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'api_failed' ? (
                                                        <p className="text-xs text-red-600 flex items-center gap-1">
                                                            <Icons.X size={12} />
                                                            검증 실패. 다시 시도해주세요.
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'not_started' && formData.businessRegistrationNumber.length === 12 ? (
                                                        <p className="text-xs text-gray-500">
                                                            검증하기 버튼을 클릭하여 사업자등록번호를 검증해주세요.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            
                                            <p className="text-xs text-gray-500 mt-2">
                                                사업자등록번호는 10자리 숫자입니다. (예: 123-45-67890)
                                                {formData.userType === '사업자' && ' 검증 완료 후 다음 단계로 진행할 수 있습니다.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </form>
                    </div>

                    <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
                        {currentStep > 1 ? (
                            <button type="button" onClick={handlePrevStep} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">
                                이전
                            </button>
                        ) : null}
                        {currentStep === 1 ? (
                            <button 
                                type="button" 
                                onClick={handleNextStep} 
                                disabled={isCreatingAccount || !formData.userType}
                                className={`flex-1 py-3 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all ${
                                    isCreatingAccount || !formData.userType ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                {isCreatingAccount ? '계정 생성 중...' : '다음 단계'}
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                onClick={handleSubmit} 
                                disabled={
                                    formData.userType === '사업자' && 
                                    formData.businessVerificationStatus !== 'api_verified'
                                }
                                className={`flex-1 py-3 font-bold rounded-xl transition-all ${
                                    formData.userType === '사업자' && formData.businessVerificationStatus !== 'api_verified'
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-brand to-blue-600 text-white hover:shadow-lg hover:shadow-brand/30'
                                }`}
                            >
                                가입하기
                            </button>
                        )}
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors">
                            취소
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

const DonationView = ({ onBack, currentUser, setCurrentUser, setMembersData, membersData, saveCurrentUserToStorage, pageTitles }) => {
    const [donationAmount, setDonationAmount] = useState(10000);
    const [customAmount, setCustomAmount] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [donationType, setDonationType] = useState('one-time'); // 'one-time' | 'recurring'
    const [recurringInterval, setRecurringInterval] = useState('monthly'); // 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

    const handleDonation = () => {
        // 비회원인 경우 이름과 이메일 입력 확인
        if (!currentUser) {
            if (!guestName.trim()) {
                alert('이름을 입력해주세요.');
                return;
            }
            if (!guestEmail.trim() || !guestEmail.includes('@')) {
                alert('올바른 이메일을 입력해주세요.');
                return;
            }
        }

        // 정기후원인 경우 회원만 가능
        if (donationType === 'recurring' && !currentUser) {
            alert('정기 후원은 회원만 가능합니다. 로그인 후 이용해주세요.');
            return;
        }

        if (window.IMP) {
            const paymentData = {
                pg: 'html5_inicis',
            pay_method: 'card',
            merchant_uid: `donation_${donationType}_${Date.now()}`,
                name: donationType === 'recurring' ? '부청사 정기 후원' : '부청사 후원',
                amount: donationAmount,
                buyer_email: currentUser ? (currentUser.email || '') : guestEmail,
                buyer_name: currentUser ? (currentUser.name || '') : guestName,
            };
            
            // 정기후원인 경우 customer_uid 추가
            if (donationType === 'recurring') {
                paymentData.customer_uid = `customer_${currentUser.id}`;
            }
            
            window.IMP.request_pay(paymentData, (rsp) => {
            if (rsp.success) {
                    if (donationType === 'recurring') {
                        // 정기후원 처리
                        const nextPaymentDate = new Date();
                        switch (recurringInterval) {
                            case 'monthly':
                                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
                                break;
                            case 'quarterly':
                                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
                                break;
                            case 'half-yearly':
                                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 6);
                                break;
                            case 'yearly':
                                nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
                                break;
                        }
                        
                        const updatedUser = { 
                            ...currentUser, 
                            hasDonated: true,
                            donationAmount: (currentUser.donationAmount || 0) + donationAmount,
                            recurringDonation: {
                                enabled: true,
                                amount: donationAmount,
                                interval: recurringInterval,
                                nextPaymentDate: nextPaymentDate.toISOString().split('T')[0],
                                billingKey: rsp.billing_key || rsp.imp_uid,
                                customerUid: paymentData.customer_uid
                            }
                        };
                        setCurrentUser(updatedUser);
                        saveCurrentUserToStorage(updatedUser);
                        const updatedMembers = membersData.map(m => m.id === currentUser.id ? updatedUser : m);
                        setMembersData(updatedMembers);
                        alert('정기 후원이 등록되었습니다. 감사합니다!');
                    } else {
                        // 일시후원 처리
                        alert('후원이 완료되었습니다. 감사합니다!');
                if (currentUser) {
                            const updatedUser = { ...currentUser, hasDonated: true, donationAmount: (currentUser.donationAmount || 0) + donationAmount };
                    setCurrentUser(updatedUser);
                    saveCurrentUserToStorage(updatedUser);
                            const updatedMembers = membersData.map(m => m.id === currentUser.id ? updatedUser : m);
                    setMembersData(updatedMembers);
                }
                        // 비회원 후원 완료 후 폼 초기화
                        if (!currentUser) {
                            setGuestName('');
                            setGuestEmail('');
                        }
                    }
            } else {
                    alert('결제가 취소되었습니다.');
            }
        });
        } else {
            alert('결제 시스템을 준비 중입니다.');
        }
    };

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-4xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="donation" pageTitles={pageTitles} defaultText="후원" />
                        <p className="text-gray-500 text-sm">부청사와 함께 성장하세요</p>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로
                    </button>
                </div>

                <div className="bg-white rounded-3xl shadow-card p-8 md:p-12">
                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-dark mb-4">후원을 통해 더 많은 청년 사업가들이 꿈을 이룰 수 있도록 도와주세요</h3>
                        <p className="text-gray-600">후원금은 커뮤니티 운영 및 프로그램 지원에 사용됩니다.</p>
                    </div>

                    <div className="space-y-6">
                        {/* 비회원인 경우 이름과 이메일 입력 필드 */}
                        {!currentUser ? (
                            <div className="space-y-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                <h4 className="font-bold text-dark mb-4">후원자 정보</h4>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">이름 *</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        placeholder="이름을 입력하세요"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">이메일 *</label>
                                    <input 
                                        type="email" 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none" 
                                        value={guestEmail}
                                        onChange={(e) => setGuestEmail(e.target.value)}
                                        placeholder="이메일을 입력하세요"
                                    />
                                </div>
                            </div>
                        ) : null}
                        
                        {/* 후원 타입 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-4">후원 방식 선택</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setDonationType('one-time')}
                                    className={`py-4 rounded-xl font-bold transition-colors ${
                                    donationType === 'one-time'
                                            ? 'bg-brand text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                    일시 후원
                            </button>
                            <button
                                type="button"
                                    onClick={() => setDonationType('recurring')}
                                    className={`py-4 rounded-xl font-bold transition-colors ${
                                        donationType === 'recurring'
                                            ? 'bg-brand text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    정기 후원
                            </button>
                        </div>
                            {donationType === 'recurring' ? (
                                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-sm text-blue-700 mb-3">
                                        정기 후원을 선택하시면 선택한 주기에 따라 자동으로 후원금이 결제됩니다. 언제든지 해지하실 수 있습니다.
                                    </p>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">결제 주기</label>
                                    <select
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                        value={recurringInterval}
                                        onChange={(e) => setRecurringInterval(e.target.value)}
                                    >
                                        <option value="monthly">매월</option>
                                        <option value="quarterly">분기별 (3개월)</option>
                                        <option value="half-yearly">반기별 (6개월)</option>
                                        <option value="yearly">연간</option>
                                    </select>
                                </div>
                            ) : null}
                    </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-4">후원 금액 선택</label>
                                <div className="grid grid-cols-4 gap-3 mb-4">
                                    {[10000, 30000, 50000, 100000].map(amount => (
                                <button
                                            key={amount}
                                    type="button"
                                            onClick={() => { setDonationAmount(amount); setCustomAmount(''); }}
                                            className={`py-3 rounded-xl font-bold transition-colors ${
                                                donationAmount === amount && !customAmount
                                                    ? 'bg-brand text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {amount.toLocaleString()}원
                                </button>
                            ))}
                        </div>
                                <div className="flex gap-3">
                            <input
                                type="number"
                                        placeholder="직접 입력"
                                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                value={customAmount}
                                onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                    setCustomAmount(e.target.value);
                                            if (val > 0) setDonationAmount(val);
                                        }}
                                    />
                        <button
                            type="button"
                                        onClick={() => {
                                            const val = parseInt(customAmount) || 0;
                                            if (val > 0) setDonationAmount(val);
                                        }}
                                        className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700"
                                    >
                                        적용
                        </button>
                    </div>
                </div>

                            <div className="bg-soft p-6 rounded-2xl border border-brand/5">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold text-gray-700">후원 금액</span>
                                    <span className="text-2xl font-bold text-brand">{donationAmount.toLocaleString()}원</span>
            </div>
        </div>

                        <button
                            type="button"
                                onClick={handleDonation}
                                className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-lg"
                            >
                                후원하기
                        </button>
                </div>
            </div>
                        </div>
        </div>
    );
};


const App = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    
    // PortOne 초기화
    useEffect(() => {
        const initPortOne = () => {
            if (typeof window !== 'undefined' && window.IMP) {
                try {
                    // IMP_CODE가 기본값이 아닌 경우에만 초기화
                    if (PORTONE_IMP_CODE && PORTONE_IMP_CODE !== 'imp00000000') {
                        window.IMP.init(PORTONE_IMP_CODE);
                        console.log('PortOne 초기화 완료');
                    } else {
                        console.warn('PortOne IMP_CODE가 설정되지 않았습니다. config.js에서 설정해주세요.');
                    }
                } catch (error) {
                    console.error('PortOne 초기화 오류:', error);
                }
            } else {
                // SDK가 아직 로드되지 않은 경우, 로드될 때까지 대기
                const checkInterval = setInterval(() => {
                    if (typeof window !== 'undefined' && window.IMP) {
                        clearInterval(checkInterval);
                        initPortOne();
                    }
                }, 100);
                
                // 5초 후 타임아웃
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (typeof window === 'undefined' || !window.IMP) {
                        console.warn('PortOne SDK가 로드되지 않았습니다.');
                    }
                }, 5000);
            }
        };
        
        initPortOne();
    }, []);
    
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
            loadUsersFromStorage().then(users => {
                if (users && users.length > 0) {
                    const filteredUsers = filterApprovedMembers(users);
                    setUsers(filteredUsers);
                    setMembersData(filteredUsers);
                }
            });
        }
    }, []);
    
    // Settings 실시간 구독 (메인 페이지 텍스트 실시간 업데이트)
    useEffect(() => {
        if (firebaseService && firebaseService.subscribeSettings) {
            const unsubscribe = firebaseService.subscribeSettings((settings) => {
                if (settings && Object.keys(settings).length > 0) {
                    // 기본값과 Firebase Settings 병합 (기본값을 기준으로 Firebase 설정으로 덮어쓰기)
                    setContent(prevContent => {
                        // prevContent가 이미 defaultContent를 포함하고 있을 수 있으므로,
                        // 기본값부터 시작하여 Firebase 설정으로 덮어쓰기
                        return { ...defaultContent, ...settings };
                    });
                    
                    // menuNames도 Firebase에서 가져오기 (우선 사용)
                    if (settings.menuNames) {
                        setMenuNames(prev => ({ ...defaultMenuNames, ...settings.menuNames }));
                    } else {
                        // Firebase에 menuNames가 없으면 localStorage 사용 (폴백)
                        const localMenuNames = loadMenuNamesFromStorage();
                        setMenuNames(localMenuNames);
                    }
                    
                    // menuEnabled도 Firebase에서 가져오기 (우선 사용)
                    if (settings.menuEnabled) {
                        setMenuEnabled(prev => ({ ...loadMenuEnabledFromStorage(), ...settings.menuEnabled }));
                    }
                }
            });
            
            return () => unsubscribe();
        } else {
            // Firebase Service가 없으면 초기 로드 시 Settings 가져오기
            const loadSettings = async () => {
                        if (firebaseService && firebaseService.getSettings) {
                    try {
                                const settings = await firebaseService.getSettings();
                        if (settings && Object.keys(settings).length > 0) {
                            // 기본값과 Firebase Settings 병합 (기본값을 기준으로 Firebase 설정으로 덮어쓰기)
                            setContent(prevContent => ({ ...defaultContent, ...settings }));
                            
                            // menuNames도 Firebase에서 가져오기
                            if (settings.menuNames) {
                                setMenuNames(prev => ({ ...defaultMenuNames, ...settings.menuNames }));
                            } else {
                                // Firebase에 없으면 localStorage 사용
                                const localMenuNames = loadMenuNamesFromStorage();
                                setMenuNames(localMenuNames);
                            }
                            
                            // menuEnabled도 Firebase에서 가져오기
                            if (settings.menuEnabled) {
                                setMenuEnabled(prev => ({ ...loadMenuEnabledFromStorage(), ...settings.menuEnabled }));
                            }
                        }
                    } catch (error) {
                        
                    }
                }
            };
            loadSettings();
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
    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pendingView, setPendingView] = useState(null); // 로그인 후 이동할 뷰
    const [mySeminars, setMySeminars] = useState([]);
    const [myPosts, setMyPosts] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchStatus, setSearchStatus] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [popupPrograms, setPopupPrograms] = useState([]); // 최대 3개 프로그램 팝업
    const [applySeminarFromPopup, setApplySeminarFromPopup] = useState(null);
    const [isPopupApplyModalOpen, setIsPopupApplyModalOpen] = useState(false);
    const [popupApplicationData, setPopupApplicationData] = useState({ 
        reason: '', 
        questions: ['', ''] // 사전 질문 2개
    });
    const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
    const popupShownRef = useRef(false); // 팝업 설정 중복 실행 방지용 ref
    
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
            
            // 스크립트가 있으면 onload 이벤트를 기다림
            if (existingScript) {
                // 이미 로드되었는지 확인
                if (window.kakao && window.kakao.maps) {
                    resolve(window.kakao);
                    return;
                }
                
                // onload 이벤트 리스너 추가
                const onScriptLoad = () => {
                    if (window.kakao && window.kakao.maps) {
                        resolve(window.kakao);
                    } else {
                        // 추가 대기 (스크립트 로드 후 kakao 객체 초기화까지 시간 필요)
                        let attempts = 0;
                        const maxAttempts = 50; // 5초 대기
                        const checkInterval = setInterval(() => {
                            attempts++;
                            if (window.kakao && window.kakao.maps) {
                                clearInterval(checkInterval);
                                resolve(window.kakao);
                            } else if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                reject(new Error('카카오맵 SDK가 로드되었지만 초기화에 실패했습니다.'));
                            }
                        }, 100);
                    }
                };
                
                const onScriptError = () => {
                    reject(new Error('카카오맵 SDK 스크립트 로드에 실패했습니다.'));
                };
                
                existingScript.addEventListener('load', onScriptLoad, { once: true });
                existingScript.addEventListener('error', onScriptError, { once: true });
                
                    // 스크립트가 이미 로드되었을 수도 있으므로 즉시 확인
                    if (existingScript.readyState && (existingScript.readyState === 'complete' || existingScript.readyState === 'loaded')) {
                        setTimeout(() => {
                            if (window.kakao && window.kakao.maps) {
                                resolve(window.kakao);
                            } else {
                                onScriptLoad();
                            }
                        }, 100);
                    } else {
                        // readyState가 없거나 아직 로드 중인 경우 짧은 대기 후 확인
                        setTimeout(() => {
                            if (window.kakao && window.kakao.maps) {
                                resolve(window.kakao);
                            }
                            // 그렇지 않으면 onload 이벤트를 기다림
                        }, 200);
                    }
                
                return;
            }
            
            // 스크립트가 없으면 동적으로 로드
            loadKakaoMapScript()
                .then(() => {
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
                })
                .catch(reject);
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
                // 이미 스크립트가 있으면 로드 완료를 기다림
                existingScript.addEventListener('load', resolve);
                existingScript.addEventListener('error', reject);
                return;
            }
            
            // 스크립트 동적 생성 및 로드
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=f35b8c9735d77cced1235c5775c7c3b1&libraries=services';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };
    
    // 카카오맵 Places API를 활용한 장소 검색 함수
    const openKakaoPlacesSearch = async (onComplete) => {
        try {
            // 카카오맵 SDK 로드 완료 대기
            await waitForKakaoMap();
            
            // Places 서비스 초기화 확인
            if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
                alert('카카오맵 API가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
        } catch (error) {
            alert('카카오맵 API를 로드할 수 없습니다. 페이지를 새로고침해주세요.');
            console.error('카카오맵 SDK 로드 오류:', error);
            return;
        }
        
        // 검색 모달 생성
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/70';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-dark">장소 검색</h3>
                    <button type="button" class="p-2 hover:bg-gray-100 rounded-lg" onclick="this.closest('.fixed').remove()">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="mb-4">
                    <input 
                        type="text" 
                        id="place-search-input" 
                        placeholder="장소명, 주소, 건물명 등을 입력하세요" 
                        class="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                    />
                </div>
                <div id="place-search-results" class="flex-1 overflow-y-auto space-y-2"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const searchInput = modal.querySelector('#place-search-input');
        const resultsContainer = modal.querySelector('#place-search-results');
        const placesService = new window.kakao.maps.services.Places();
        
        // 검색 실행 함수
        const performSearch = (keyword) => {
            if (!keyword.trim()) {
                resultsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">검색어를 입력해주세요.</p>';
                return;
            }
            
            placesService.keywordSearch(keyword, (data, status) => {
                resultsContainer.innerHTML = '';
                
                if (status === window.kakao.maps.services.Status.OK) {
                    if (data.length === 0) {
                        resultsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">검색 결과가 없습니다.</p>';
                        return;
                    }
                    
                    data.forEach((place) => {
                        const item = document.createElement('div');
                        item.className = 'p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer';
                        item.innerHTML = `
                            <div class="font-bold text-dark mb-1">${place.place_name}</div>
                            <div class="text-sm text-gray-600">${place.address_name || place.road_address_name || ''}</div>
                            ${place.phone ? `<div class="text-xs text-gray-500 mt-1">${place.phone}</div>` : ''}
                        `;
                        item.onclick = () => {
                            onComplete({
                                name: place.place_name,
                                address: place.road_address_name || place.address_name,
                                lat: parseFloat(place.y),
                                lng: parseFloat(place.x),
                                phone: place.phone || '',
                                placeUrl: place.place_url || ''
                            });
                            modal.remove();
                        };
                        resultsContainer.appendChild(item);
                    });
                } else {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">검색 중 오류가 발생했습니다.</p>';
                }
            });
        };
        
        // 엔터 키로 검색
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(searchInput.value);
            }
        });
        
        // 검색 버튼 추가 (선택사항)
        const searchButton = document.createElement('button');
        searchButton.type = 'button';
        searchButton.className = 'mt-2 w-full py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700';
        searchButton.textContent = '검색';
        searchButton.onclick = () => performSearch(searchInput.value);
        modal.querySelector('.mb-4').appendChild(searchButton);
        
        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // 포커스
        setTimeout(() => searchInput.focus(), 100);
    };
    
    // 카테고리별 컬러 반환 함수
    const getCategoryColor = (category) => {
        const colorMap = {
            '교육/세미나': 'bg-blue-100 text-blue-700',
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
    
    // 마감임박 판단 함수
    const isDeadlineSoon = (seminar) => {
        if (!seminar.dateObj) return false;
        const today = new Date();
        const daysLeft = Math.ceil((seminar.dateObj - today) / (1000 * 60 * 60 * 24));
        const participantRatio = (seminar.currentParticipants || 0) / (seminar.maxParticipants || 999);
        return daysLeft <= 3 || participantRatio >= 0.8;
    };
    
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
            
            const upcomingSeminars = seminarsData
                .filter(s => s.status !== '종료')
                .map(s => {
                    const matches = s.date ? s.date.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/) : null;
                    if (!matches) return null;
                    const year = parseInt(matches[1]);
                    const month = parseInt(matches[2]) - 1;
                    const day = parseInt(matches[3]);
                    const seminarDate = new Date(year, month, day);
                    seminarDate.setHours(0, 0, 0, 0);
                    if (seminarDate >= today) {
                        return { ...s, dateObj: seminarDate };
                    }
                    return null;
                })
                .filter(s => s !== null)
                .filter(s => !!s.img)
                .filter(s => {
                    const isFull = (s.currentParticipants || 0) >= (s.maxParticipants || 999);
                    return !isFull;
                })
                .sort((a, b) => a.dateObj - b.dateObj)
                .slice(0, 3);
            
                if (Array.isArray(upcomingSeminars) && upcomingSeminars.length > 0) {
                const seminarsWithDeadline = upcomingSeminars.map(s => ({
                    ...s,
                    isDeadlineSoon: isDeadlineSoon(s)
                }));
                // 팝업 설정 전에 ref를 true로 설정하여 중복 방지
                popupShownRef.current = true;
                setPopupPrograms(seminarsWithDeadline);
            } else {
                setPopupPrograms([]);
            }
        }
    }, [currentView, seminarsData]);
    
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
                firebaseService.getUsers().then(users => {
                    const members = filterApprovedMembers(users);
                    setMembersData(members);
                });
            }
        }
    }, []);
    
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
                        }
                    } catch (error) {
                    }
                } else {
                    // 사용자가 로그아웃했으면 상태 초기화
                    setCurrentUser(null);
                    setMyPosts([]);
                }
            });
            
            return () => unsubscribe();
        }
    }, [communityPosts]);
    
    // Load seminars from Firebase
    useEffect(() => {
        // 기존 데이터 호환성: img 필드를 images 배열로 변환하는 함수
        const normalizeSeminarImages = (seminar) => {
            if (!seminar) {
                return null;
            }
            
            let images = [];
            
            // images 필드 처리
            if (seminar.images) {
                if (Array.isArray(seminar.images)) {
                    // 배열인 경우: 빈 문자열, null, undefined 필터링
                    images = seminar.images.filter(img => 
                        img !== null && 
                        img !== undefined && 
                        typeof img === 'string' && 
                        img.trim() !== ''
                    );
                } else if (typeof seminar.images === 'string' && seminar.images.trim() !== '') {
                    // 문자열인 경우 배열로 변환
                    try {
                        const parsed = JSON.parse(seminar.images);
                        if (Array.isArray(parsed)) {
                            images = parsed.filter(img => 
                                img !== null && 
                                img !== undefined && 
                                typeof img === 'string' && 
                                img.trim() !== ''
                            );
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
                status: seminar.status || calculateStatus(seminar.date || '')
            };
        };
        
        if (firebaseService && firebaseService.subscribeSeminars) {
            const unsubscribe = firebaseService.subscribeSeminars((seminars) => {
                const normalizedSeminars = seminars.map(normalizeSeminarImages);
                setSeminarsData(normalizedSeminars);
            });
            return () => unsubscribe();
        } else {
            if (firebaseService && firebaseService.getSeminars) {
                firebaseService.getSeminars().then(seminars => {
                    const normalizedSeminars = seminars.map(normalizeSeminarImages);
                    setSeminarsData(normalizedSeminars);
                });
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
                firebaseService.getPosts().then(posts => {
                    setCommunityPosts(posts);
                });
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
                firebaseService.getRestaurants().then(restaurants => {
                    setRestaurantsData(restaurants);
                });
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
                    '입찰공고': parsed['입찰공고'] !== undefined ? parsed['입찰공고'] : true,
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
            '입찰공고': true,
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
        '입찰공고': '입찰공고',
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
    const defaultMenuOrder = ['홈', '소개', '프로그램', '부청사 회원', '커뮤니티', '입찰공고', '후원', '부산맛집'];
    
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

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const storedUsers = loadUsersFromStorage();
        if (storedUsers.length > 0) {
            setUsers(storedUsers);
        }
        
        // 자동 로그인 제거 - 사용자가 직접 로그인해야 함
        // Firebase Auth의 onAuthStateChanged로만 처리
    }, []);

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
                        company: row.company || row.Company || row.회사명 || '',
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
    
    // Firebase 세미나 구독 및 Google Sheets 세미나와 병합
    useEffect(() => {
        let firebaseUnsubscribe = null;
        
        // Firebase 세미나 구독
        if (firebaseService && firebaseService.subscribeSeminars) {
            firebaseUnsubscribe = firebaseService.subscribeSeminars((firebaseSeminars) => {
                setSeminarsData(prev => {
                    // Google Sheets 세미나와 병합
                    const merged = [...prev, ...firebaseSeminars];
                    // 중복 제거 (id 또는 title + date 기준)
                    const unique = merged.filter((seminar, index, self) =>
                        index === self.findIndex(s => 
                            (s.id && seminar.id && s.id === seminar.id) || 
                            (s.title === seminar.title && s.date === seminar.date)
                        )
                    );
                    return unique;
                });
            });
        }
        
        return () => {
            if (firebaseUnsubscribe) {
                firebaseUnsubscribe();
            }
        };
    }, []);
    
    useEffect(() => {
        const loadCSVData = async () => {
            const csvUrl = CONFIG.SHEET_URLS?.SEMINAR || '';
            
            if (csvUrl) {
                const csvSeminars = await loadSeminarsFromCSV();
                if (csvSeminars && csvSeminars.length > 0) {
                    setSeminarsData(prev => {
                        // Firebase 세미나와 병합
                        const merged = [...csvSeminars, ...prev];
                        // 중복 제거
                        const unique = merged.filter((seminar, index, self) =>
                            index === self.findIndex(s => 
                                (s.id && seminar.id && s.id === seminar.id) || 
                                (s.title === seminar.title && s.date === seminar.date)
                            )
                        );
                        return unique;
                    });
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
                                setSeminarsData(prev => {
                                    // Firebase 세미나와 병합
                                    const merged = [...filtered, ...prev];
                                    const unique = merged.filter((seminar, index, self) =>
                                        index === self.findIndex(s => 
                                            (s.id && seminar.id && s.id === seminar.id) || 
                                            (s.title === seminar.title && s.date === seminar.date)
                                        )
                                    );
                                    return unique;
                                });
                                
                            }
                        }
                    } catch (e) {
                        
                    }
                }
            } else {
                // CSV URL이 없으면 localStorage에서 로드
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
                            setSeminarsData(prev => {
                                // Firebase 세미나와 병합
                                const merged = [...filtered, ...prev];
                                const unique = merged.filter((seminar, index, self) =>
                                    index === self.findIndex(s => 
                                        (s.id && seminar.id && s.id === seminar.id) || 
                                        (s.title === seminar.title && s.date === seminar.date)
                                    )
                                );
                                return unique;
                            });
                        }
                    }
                } catch (e) {
                    
                }
            }
        };
        
        loadCSVData();
        
        // 주기적 갱신
        const cacheDuration = CONFIG.SHEET_LOADING?.CACHE_DURATION || 5 * 60 * 1000; // 기본 5분
        
        const intervalId = setInterval(() => {
            loadCSVData();
        }, cacheDuration);
        
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
            
            // Check for existing user by email
            const allUsers = await loadUsersFromStorage();
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
            
            // Add to members data
            setMembersData(prev => [...prev, newMember]);
            
            // Update users list
            const updatedUsers = await loadUsersFromStorage();
            setUsers(updatedUsers);
            
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
    
    const handleWithdraw = () => {
         // 세미나 후기와 사진은 유지하고, 나머지 게시글만 삭제
         const updatedPosts = communityPosts.filter(p => {
             // 프로그램 후기는 유지 (작성자가 탈퇴 회원이어도)
             if (p.category === '프로그램 후기' && p.author === currentUser.name) {
                 return true; // 세미나 후기는 유지
             }
             // 나머지 게시글은 작성자가 탈퇴 회원이면 삭제
             return p.author !== currentUser.name;
         });
         setCommunityPosts(updatedPosts);
         
         // 사용자 및 멤버 데이터에서 제거
         const updatedUsers = users.filter(u => u.id !== currentUser.id);
         setUsers(updatedUsers);
         saveUsersToStorage(updatedUsers);
         
         const updatedMembers = membersData.filter(m => m.name !== currentUser.name);
         setMembersData(updatedMembers);
         
         handleLogout();
         alert("회원 탈퇴가 완료되었습니다.\n세미나 후기와 사진은 유지됩니다.");
    };

    const handleSeminarApply = async (seminar, applicationData = null) => {
        if (!currentUser) { alert("로그인이 필요한 서비스입니다."); return false; }
        if (mySeminars.find(s => s.id === seminar.id)) { alert("이미 신청한 세미나입니다."); return false; }
        if (seminar.status === '종료') { alert("종료된 프로그램입니다."); return false; }
        
        // 신청 정보 저장
        const application = {
            id: Date.now().toString(),
            seminarId: seminar.id,
            userId: currentUser.id,
            userName: currentUser.name,
            userEmail: currentUser.email,
            userPhone: currentUser.phone || '',
            reason: applicationData?.reason || '',
            questions: applicationData?.questions || ['', ''], // 사전 질문 2개로 변경
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
        
        setMySeminars([...mySeminars, seminar]);
        alert("신청이 완료되었습니다.");
        return true;
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
        
        // 팝업 닫기 및 신청 모달 표시
        closePopupAndMarkAsShown();
        setApplySeminar(program);
        handleOpenApplyModal(program);
    };

    // 팝업 신청 제출
    const handlePopupApplySubmit = () => {
        if (!popupApplicationData.reason.trim()) {
            alert('신청사유를 입력해주세요.');
            return;
        }
        if (!popupApplicationData.questions[0].trim() || !popupApplicationData.questions[1].trim()) {
            alert('사전질문 2개를 모두 입력해주세요.');
            return;
        }
        
        // 신청 처리
        const success = handleSeminarApply(applySeminarFromPopup, popupApplicationData);
        
        if (success) {
            // 캘린더 파일 생성 및 다운로드
            generateAndDownloadCalendar(applySeminarFromPopup);
            
            // 팝업 닫기 및 표시 기록
            setIsPopupApplyModalOpen(false);
            closePopupAndMarkAsShown();
            setApplySeminarFromPopup(null);
            setPopupApplicationData({ reason: '', questions: ['', ''] });
        }
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

    const handleSeminarCancel = (seminarId) => {
        setMySeminars(mySeminars.filter(s => s.id !== seminarId));
        alert("세미나 신청이 취소되었습니다.");
    };

    const handleUpdateProfile = async (updatedData) => {
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        try {
            // 로컬 스토리지에서 사용자 정보 업데이트
            const storedUsers = loadUsersFromStorage();
            const userIndex = storedUsers.findIndex(u => 
                u.id === currentUser.id || 
                u.impUid === currentUser.impUid ||
                u.verifiedPhone === currentUser.verifiedPhone
            );

            if (userIndex === -1) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            // 사용자 정보 업데이트
            const updatedUser = {
                ...storedUsers[userIndex],
                ...updatedData,
                updatedAt: new Date().toISOString()
            };

            storedUsers[userIndex] = updatedUser;
            saveUsersToStorage(storedUsers);

            // 현재 사용자 상태 업데이트
            const newCurrentUser = { ...currentUser, ...updatedData };
            setCurrentUser(newCurrentUser);
            saveCurrentUserToStorage(newCurrentUser);
            setUsers(storedUsers);

            alert("프로필이 수정되었습니다.");
        } catch (error) {
            
            alert(`프로필 수정 실패: ${error.message}`);
        }
    };

    const handleSearch = () => {
        if (!searchKeyword && !searchStatus && !searchCategory) {
            setSearchResults(seminarsData);
            setIsSearchExpanded(true);
            return; 
        }
        const results = seminarsData.filter(seminar => {
            const text = (seminar.title + seminar.desc).toLowerCase();
            const matchKeyword = !searchKeyword || text.includes(searchKeyword.toLowerCase());
            const matchStatus = !searchStatus || seminar.status === searchStatus;
            const matchCategory = !searchCategory || seminar.category === searchCategory;
            return matchKeyword && matchStatus && matchCategory;
        });
        setSearchResults(results);
        setIsSearchExpanded(true);
    };

    const handleCommunityCreate = (newPost) => {
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
            firebaseService.createPost(post).then((postId) => {
                // Firebase에서 반환된 ID를 사용하여 게시글 업데이트
                const savedPost = { ...post, id: postId };
                setCommunityPosts([savedPost, ...communityPosts]);
                if(currentUser) setMyPosts([savedPost, ...myPosts]);
                alert('게시글이 등록되었습니다.');
            }).catch(error => {
                
                const errorMessage = translateFirebaseError(error);
                alert(`게시글 저장에 실패했습니다.\n${errorMessage}`);
            });
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
                setCommunityPosts(communityPosts.map(p => p.id === id ? { ...p, ...updatedPost } : p));
                setMyPosts(myPosts.map(p => p.id === id ? { ...p, ...updatedPost } : p));
                alert('게시글이 수정되었습니다.');
                setIsEditModalOpen(false);
                setEditingPost(null);
            } catch (error) {
                
                const errorMessage = translateFirebaseError(error);
                alert(`게시글 수정에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            // Firebase service not available, update locally
            setCommunityPosts(communityPosts.map(p => p.id === id ? { ...p, ...updatedPost } : p));
            setMyPosts(myPosts.map(p => p.id === id ? { ...p, ...updatedPost } : p));
            alert('게시글이 수정되었습니다.');
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


    
    // 🌟 모바일 메뉴 열기/닫기 컴포넌트
    const MobileMenu = ({ isOpen, onClose, onNavigate, menuEnabled, menuNames, menuOrder }) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="absolute top-6 right-6 p-2 text-dark hover:bg-gray-100 rounded-full"><Icons.X size={32}/></button>
                <nav className="flex flex-col gap-6 text-center" onClick={(e) => e.stopPropagation()}>
                    {menuOrder.filter(item => menuEnabled[item]).map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigate(item); onClose(); }} className="text-2xl font-bold text-dark hover:text-brand transition-colors">
                                {menuNames[item] || item}
                            </button>
                        </div>
                    ))}
                    {!currentUser ? (
                        <div className="flex flex-col gap-4 mt-8 w-64">
                            <button type="button" onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                
                                setShowLoginModal(true); 
                                onClose(); 
                            }} className="w-full py-3 border-[0.5px] border-dark text-dark font-bold rounded-xl hover:bg-gray-50">로그인</button>
                            <button type="button" onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                
                                setShowSignUpModal(true); 
                                onClose(); 
                            }} className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">가입하기</button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 mt-8 w-64">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('myPage'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); onClose(); }} className="w-full py-3 border-2 border-brand text-brand font-bold rounded-xl hover:bg-brand/5">마이페이지</button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); onClose(); }} className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">로그아웃</button>
                        </div>
                    )}
                </nav>
            </div>
        );
    };

    const handleNavigation = (item) => {
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
        } else if (item === '입찰공고') { 
            setCurrentView('bidSearch'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '후원') { 
            setCurrentView('donation'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        } else if (item === '부산맛집') { 
            setCurrentView('restaurants'); 
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
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
            if (currentView === 'myPage') {
                const result = <MyPageView onBack={() => setCurrentView('home')} user={currentUser} mySeminars={mySeminars} myPosts={myPosts} onWithdraw={handleWithdraw} onUpdateProfile={handleUpdateProfile} onCancelSeminar={handleSeminarCancel} pageTitles={pageTitles} />;
                return result || null;
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
            return <AllMembersView onBack={() => setCurrentView('home')} members={displayMembers} currentUser={currentUser} pageTitles={pageTitles} />;
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
                    onBack={() => setCurrentView('home')} 
                    seminars={safeSeminarsData} 
                    menuNames={menuNames} 
                    onApply={(seminar, applicationData) => {
                        try {
                            const success = handleSeminarApply(seminar, applicationData);
                            if (success) {
                                generateAndDownloadCalendar(seminar);
                            }
                            return success;
                        } catch (error) {
                            console.error('프로그램 신청 오류:', error);
                            alert('프로그램 신청 중 오류가 발생했습니다.');
                            return false;
                        }
                    }} 
                    currentUser={currentUser}
                    onAddProgram={async (programData) => {
                        if (!currentUser) {
                            alert('로그인이 필요한 서비스입니다.');
                            return false;
                        }
                        try {
                            if (firebaseService && firebaseService.createSeminar) {
                                await firebaseService.createSeminar(programData);
                                alert('프로그램이 등록되었습니다.');
                                return true;
                            } else {
                                alert('서비스에 연결할 수 없습니다.');
                                return false;
                            }
                        } catch (error) {
                            console.error('프로그램 등록 오류:', error);
                            alert('프로그램 등록에 실패했습니다.');
                            return false;
                        }
                    }}
                    waitForKakaoMap={waitForKakaoMap}
                    openKakaoPlacesSearch={openKakaoPlacesSearch}
                    pageTitles={pageTitles}
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
            alert('로그인이 필요한 서비스입니다.');
            setPendingView('community'); // 로그인 후 커뮤니티로 이동할 의도 저장
            setShowLoginModal(true);
            setCurrentView('home');
            return null;
        }
        if (currentView === 'community') return <CommunityView onBack={() => setCurrentView('home')} posts={communityPosts} onCreate={handleCommunityCreate} onDelete={handleCommunityDelete} currentUser={currentUser} onNotifyAdmin={handleNotifyAdmin} seminars={seminarsData} setShowLoginModal={setShowLoginModal} pageTitles={pageTitles} menuNames={menuNames} />;
        if (currentView === 'notice') return <NoticeView onBack={() => setCurrentView('home')} posts={communityPosts} menuNames={menuNames} pageTitles={pageTitles} />;
        if (currentView === 'bidSearch' && !menuEnabled['입찰공고']) {
            alert('준비중인 서비스입니다.');
            setCurrentView('home');
            return null;
        }
        if (currentView === 'bidSearch' && !currentUser) {
            alert('로그인이 필요한 서비스입니다.');
            setShowLoginModal(true);
                setCurrentView('home');
                return null;
            }
        if (currentView === 'bidSearch') return <BidSearchView onBack={() => setCurrentView('home')} currentUser={currentUser} pageTitles={pageTitles} />;
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
            console.warn(`알 수 없는 뷰: ${currentView}, 홈으로 리다이렉트`);
            setCurrentView('home');
            return null;
        }
        
        // currentView가 'home'이거나 null/undefined인 경우 홈 화면 렌더링
        const homeView = (
            <React.Fragment>
                {/* ============================================
                    📍 섹션 1: HERO & SEARCH (메인 히어로 + 검색)
                    ============================================
                    이 섹션은 페이지 최상단에 표시됩니다.
                    메인 타이틀, 설명, 배경 이미지, 검색 기능이 포함되어 있습니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="pt-32 pb-16 px-4 md:px-6">
                     <div className="container mx-auto max-w-7xl relative mb-52 md:mb-20">
                        <div className="flex flex-col md:flex-row items-center md:items-center justify-between mb-8 px-2 text-center md:text-right">
                            <div className="flex-1">
                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight break-keep text-dark whitespace-pre-line text-center md:text-left">
                                    {content.hero_title ? content.hero_title.split('\n').map((line, idx) => (
                                        <span key={idx}>
                                            {idx === content.hero_title.split('\n').length - 1 ? (
                                                <span className="text-brand">{line}</span>
                                            ) : (
                                                <React.Fragment>{line}<br/></React.Fragment>
                                            )}
                                        </span>
                                    )) : (
                                        <React.Fragment>함께 성장하는<br/>청년 사업가 커뮤니티<br/><span className="text-brand">부산청년사업가들</span></React.Fragment>
                                    )}
                                </h1>
                                <p className="text-gray-500 text-base sm:text-lg md:text-left max-w-md mt-4 break-keep">{content.hero_desc}</p>
                            </div>
                        </div>
                        <div className="relative w-full">
                            <div className="relative w-full h-[500px] md:h-[600px] rounded-4xl md:rounded-5xl overflow-hidden shadow-deep-blue group z-0">
                                {content.hero_image && <img src={content.hero_image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Hero" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                            </div>
                            
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[800px] bg-white rounded-3xl shadow-float flex flex-col transition-all duration-300 ease-in-out z-20 overflow-hidden -mt-10 md:-mt-12">
                                <div className="flex flex-col md:flex-row gap-2 md:gap-0 items-center p-3 relative bg-white z-30">
                                    <div className="flex-1 w-full px-4 border-b md:border-b-0 md:border-r border-brand/10 py-2 md:py-0">
                                        <div className="flex items-center gap-3 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.Search size={14} className="text-accent" /> 키워드 검색</div>
                                        <input type="text" className="w-full font-bold text-dark bg-transparent outline-none text-sm placeholder-gray-300" placeholder="관심 주제를 입력하세요 (예: 투자, 마케팅)" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()}/>
                                    </div>
                                    <div className="w-full md:w-48 px-4 border-b md:border-b-0 md:border-r border-brand/10 py-2 md:py-0">
                                        <div className="flex items-center gap-3 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.Tag size={14} className="text-accent" /> 카테고리</div>
                                        <select className="w-full font-bold text-dark bg-transparent outline-none cursor-pointer text-sm" value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}><option value="">전체 카테고리</option><option value="교육/세미나">📚 교육 · 세미나</option><option value="네트워킹/모임">🤝 네트워킹 · 모임</option><option value="투자/IR">💰 투자 · IR</option><option value="멘토링/상담">💡 멘토링 · 상담</option><option value="기타">🎸 기타</option></select>
                                    </div>
                                    <div className="w-full md:w-40 px-4 py-2 md:py-0">
                                        <div className="flex items-center gap-3 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap"><Icons.CheckCircle size={14} className="text-accent" /> 모집 상태</div>
                                        <select className="w-full font-bold text-dark bg-transparent outline-none cursor-pointer text-sm" value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)}><option value="">전체 상태</option><option value="모집중">모집중</option><option value="마감임박">마감임박</option><option value="종료">종료</option></select>
                                    </div>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSearch(); }} className="w-full md:w-16 h-12 md:h-14 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/30 hover:bg-blue-800 transition-colors shrink-0"><Icons.Search /></button>
                                </div>
                                <div className={`transition-all duration-300 ease-in-out bg-soft ${isSearchExpanded ? 'max-h-[400px] opacity-100 border-t border-brand/10' : 'max-h-0 opacity-0'}`}>
                                    <div className="p-4 md:p-6 overflow-y-auto max-h-[400px]">
                                        <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-3"><h3 className="text-sm font-bold text-gray-500">검색 결과 <span className="text-brand">{searchResults.length}</span>건</h3></div><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSearchExpanded(false); }} className="text-xs text-gray-400 hover:text-dark flex items-center gap-1">닫기 <Icons.X size={14}/></button></div>
                                        {searchResults.length > 0 ? (<div className="grid grid-cols-1 gap-3">{searchResults.map((result, idx) => (<div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-brand/30 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}><div className="flex-1"><div className="flex gap-2 mb-2"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${result.status === '모집중' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{result.status}</span><span className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-500 rounded-full flex items-center gap-1"><Icons.Calendar size={10}/> {result.date}</span><span className="text-[10px] font-bold px-2 py-1 bg-brand/10 text-brand rounded-full">{result.category}</span></div><h4 className="font-bold text-dark text-lg mb-1 break-keep">{result.title}</h4><div className="text-xs text-gray-500 mb-1 font-medium">신청: {result.currentParticipants || 0} / {result.maxParticipants}명</div><p className="text-xs text-gray-500 line-clamp-1 break-keep">{result.desc}</p></div><div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-0 border-gray-50"><span className="text-xs text-brand font-bold hover:underline flex items-center gap-1">상세보기 <Icons.ArrowRight size={12} /></span></div></div>))}</div>) : (<div className="py-10 text-center text-gray-400 flex flex-col items-center gap-3"><div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"><Icons.Info className="w-6 h-6 text-gray-300" /></div><p className="text-sm">조건에 맞는 세미나가 없습니다.</p></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* ============================================
                    📍 섹션 2: SEMINAR REVIEWS (세미나 후기 자동 슬라이드)
                    ============================================
                    세미나 후기 자동 슬라이드입니다 (5초 간격, 왼쪽→오른쪽).
                    별점과 함께 표시되며, 이미지는 최대 2장만 표시됩니다.
                    ============================================ */}
                {(() => {
                    if (!menuEnabled['프로그램'] || !menuEnabled['커뮤니티']) {
                        return null;
                    }
                    
                    const reviewPosts = communityPosts.filter(p => p.category === '프로그램 후기' && p.rating);
                    if (reviewPosts.length === 0) {
                        return null;
                    }
                    
                    const ReviewSlider = () => {
                        const [currentIndex, setCurrentIndex] = React.useState(0);
                        const [nextIndex, setNextIndex] = React.useState(null);
                        const [isTransitioning, setIsTransitioning] = React.useState(false);
                        const [animationKey, setAnimationKey] = React.useState(0); // animation 재시작을 위한 키
                        const [nextOpacity, setNextOpacity] = React.useState(0); // 다음 슬라이드의 opacity
                        const [currentOpacity, setCurrentOpacity] = React.useState(1); // 현재 슬라이드의 opacity
                        
                        React.useEffect(() => {
                            const interval = setInterval(() => {
                                setCurrentIndex((prev) => {
                                    const newNextIndex = (prev + 1) % reviewPosts.length;
                                    // 크로스 디졸브 시작: 다음 슬라이드 준비 및 애니메이션 시작
                                    setNextIndex(newNextIndex);
                                    setIsTransitioning(true);
                                    setAnimationKey(prev => prev + 1); // 애니메이션 재시작
                                    setCurrentOpacity(1); // 현재 슬라이드는 1에서 시작
                                    setNextOpacity(0); // 다음 슬라이드는 0에서 시작
                                    
                                    // 브라우저가 초기 상태를 렌더링한 후 transition 시작
                                    setTimeout(() => {
                                        // 동시에 현재는 0으로, 다음은 1로 변경 (크로스 디졸브)
                                        setCurrentOpacity(0); // 현재 슬라이드 페이드 아웃
                                        setNextOpacity(1); // 다음 슬라이드 페이드 인
                                    }, 50);
                                    
                                    // 크로스 디졸브: 순차 디졸브 완료 후 전환 종료
                                    // 셀 2의 delay(2400ms) + transition(2000ms) + 여유(100ms) = 4500ms
                                    setTimeout(() => {
                                        setCurrentIndex(newNextIndex);
                                        setNextIndex(null);
                                        setIsTransitioning(false);
                                        setCurrentOpacity(1);
                                        setNextOpacity(0);
                                    }, 4600); // 셀2 delay(2400ms) + transition(2000ms) + 여유(200ms)
                                    
                                    return prev; // currentIndex는 setTimeout 내부에서 업데이트
                                });
                            }, 7000); // 7초 간격 (순차 크로스 디졸브 전체 시간 4.6초 + 대기 2.4초)
                            
                            return () => clearInterval(interval);
                        }, [reviewPosts.length]);
                        
                        // currentIndex가 유효한지 확인
                        if (currentIndex < 0 || currentIndex >= reviewPosts.length) {
                            return null;
                        }
                        
                        const currentReview = reviewPosts[currentIndex];
                        const transitioningReview = nextIndex !== null ? reviewPosts[nextIndex] : null;
                    
                        const renderReviewCard = (review, animationClass, zIndex, animKey, isTransitioning = false) => {
                            // review가 없는 경우 null 반환
                            if (!review) {
                                return null;
                            }
                    return (
                            <div 
                                key={`${review.id}-${animKey}`}
                                className={`bg-white shadow-md border border-blue-100 cursor-pointer hover:shadow-lg flex flex-col ${animationClass || ''}`}
                                style={{ 
                                    zIndex: zIndex,
                                    height: '830px',
                                    overflow: 'hidden',
                                    pointerEvents: isTransitioning ? 'none' : 'auto',
                                    borderRadius: '20px'
                                }} 
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    setCurrentView('community'); 
                                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); 
                                }}
                            >
                                        <div className="p-4 flex flex-col">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500 text-white rounded">프로그램 후기</span>
                                                {review.rating ? (
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            review.rating >= star ? (
                                                                <Icons.Star key={star} className="w-3 h-3 text-yellow-400" style={{ fill: 'currentColor' }} />
                                                            ) : (
                                                                <Icons.Star key={star} className="w-3 h-3 text-gray-300" />
                                                            )
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <h4 className="font-bold text-dark text-base mb-2 break-keep">{review.title}</h4>
                                            <p className="text-sm text-gray-600 break-keep">{review.content}</p>
                                        </div>
                                        {review.images && review.images.length > 0 ? (
                                            <div className="flex flex-col px-4 pb-4 gap-[10px]" style={{ marginTop: '10px' }}>
                                                {review.images.slice(0, 2).map((img, imgIdx) => (
                                                    <div 
                                                        key={imgIdx} 
                                                        className="relative w-full"
                                                        style={{ aspectRatio: '3/2' }}
                                                    >
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-50 overflow-hidden" style={{ borderRadius: '20px' }}>
                                                            <img 
                                                                src={img} 
                                                                alt={`${review.title} 이미지 ${imgIdx + 1}`} 
                                                                className="w-full h-full object-cover"
                                                            />
                                        </div>
                                    </div>
                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                        );
                    };
                    
                    // 모바일 감지
                    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
                    
                    React.useEffect(() => {
                        const handleResize = () => setIsMobile(window.innerWidth < 768);
                        window.addEventListener('resize', handleResize);
                        return () => window.removeEventListener('resize', handleResize);
                    }, []);
                    
                    // 최대 3개 후기를 동시에 표시하기 위한 로직 (모바일은 1개)
                    const getVisibleReviews = () => {
                        const maxVisible = isMobile ? 1 : 3;
                        const visibleSet = new Set();
                        const visible = [];
                        
                        // currentIndex부터 시작하여 최대 maxVisible개 추가
                        for (let i = 0; i < maxVisible; i++) {
                            const idx = (currentIndex + i) % reviewPosts.length;
                            if (!visibleSet.has(idx)) {
                                visibleSet.add(idx);
                                visible.push({ review: reviewPosts[idx], index: idx, position: i });
                            }
                        }
                        return visible;
                    };
                    
                    const visibleReviews = getVisibleReviews();
                    if (!visibleReviews || visibleReviews.length === 0) {
                        return null;
                    }
                    return (
                        <div className="relative w-full bg-gradient-to-r from-blue-50 to-indigo-50 py-6 overflow-hidden border-t border-b border-blue-200/30 mb-20">
                                <div className="container mx-auto px-4">
                                    {/* Grid 레이아웃: 모바일 1열, 태블릿 2열, 데스크톱 3열 */}
                                    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`} style={{ height: isMobile ? '500px' : '830px' }}>
                                        {visibleReviews.map(({ review, index, position }) => {
                                            // 각 셀은 자신의 인덱스에 해당하는 후기를 표시하고, 전환 시 다음 후기로 이동
                                            // 모든 셀에 대해 크로스 디졸브 적용 (전환 중일 때)
                                            const showOverlay = isTransitioning && nextIndex !== null;
                                            
                                            // 전환 중일 때 모든 셀에 크로스 디졸브 적용
                                            if (showOverlay) {
                                                
                                                // 각 셀의 현재 후기와 다음 후기
                                                const currentReview = reviewPosts[index];
                                                const cellNextIndex = (index + 1) % reviewPosts.length;
                                                const nextReview = reviewPosts[cellNextIndex];
                                                
                                                // review가 없는 경우 null 반환
                                                if (!currentReview || !nextReview) {
                                                    return null;
                                                }
                                                
                                                // 각 셀의 position에 따라 순차적 디졸브 적용 (1.2초 간격)
                                                const transitionDelay = position * 1200; // 셀 0: 0ms, 셀 1: 1200ms, 셀 2: 2400ms
                                                
                                                return (
                                                    <div key={`review-overlay-${index}-${animationKey}`} className="relative" style={{ height: isMobile ? '480px' : '830px', willChange: 'opacity' }}>
                                                        {/* 현재 슬라이드 (페이드 아웃) */}
                                                        <div 
                                                            className="absolute inset-0"
                                                            style={{
                                                                opacity: currentOpacity,
                                                                transition: `opacity 2000ms ease-in-out ${transitionDelay}ms`,
                                                                zIndex: 1,
                                                                willChange: 'opacity'
                                                            }}
                                                        >
                                                            {renderReviewCard(currentReview, '', 1, animationKey, true)}
                                                    </div>
                                                        {/* 다음 슬라이드 (페이드 인) */}
                                                        <div 
                                                            className="absolute inset-0"
                                                            style={{
                                                                opacity: nextOpacity,
                                                                transition: `opacity 2000ms ease-in-out ${transitionDelay}ms`,
                                                                zIndex: 2,
                                                                willChange: 'opacity'
                                                            }}
                                                        >
                                                            {renderReviewCard(nextReview, '', 2, animationKey, true)}
                                            </div>
                                        </div>
                                                );
                                            }
                                            
                                            // 일반 슬라이드 (겹치지 않음)
                                            // review가 없는 경우 null 반환
                                            if (!review) {
                                                return null;
                                            }
                                            return (
                                                <div 
                                                    key={`review-${review.id}-${index}`} 
                                                    className="relative"
                                                    style={{ height: isMobile ? '480px' : '830px' }}
                                                >
                                                    {renderReviewCard(review, '', 1, animationKey)}
                                        </div>
                                            );
                                        })}
                                    </div>
                                    {/* 슬라이드 인디케이터 */}
                                    {reviewPosts.length > 1 ? (
                                        <div className="flex justify-center gap-2 mt-4">
                                            {reviewPosts.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsTransitioning(false);
                                                        setNextIndex(null);
                                                        setCurrentIndex(idx);
                                                    }}
                                                    className={`w-2 h-2 rounded-full transition-all ${
                                                        idx === currentIndex ? 'bg-brand w-6' : 'bg-gray-300'
                                                    }`}
                                                />
                                ))}
                                            </div>
                                        ) : null}
                            </div>
                        </div>
                    );
                        };
                        
                        return <ReviewSlider />;
                    })()}

                {/* ============================================
                    📍 섹션 3: STATS (통계 숫자)
                    ============================================
                    활동중인 사업가, 진행된 세미나, 투자 성공 사례 등의 통계를 표시합니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                <section className="py-20 bg-soft/50">
                    <div className="container mx-auto max-w-6xl px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
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
                <section className="py-20 px-6 bg-white">
                    <div className="container mx-auto max-w-6xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                            <div className="relative h-[300px] md:h-[500px]">
                                {content.features_image_1 && <div className="absolute top-0 left-0 w-3/5 rounded-3xl overflow-hidden shadow-deep-blue z-10" style={{ aspectRatio: '1/1' }}><img src={content.features_image_1} className="w-full h-full object-cover" alt="Office"/></div>}
                                {content.features_image_2 && <div className="absolute bottom-0 right-0 w-3/5 rounded-3xl overflow-hidden shadow-deep-blue z-20 border-4 border-white" style={{ aspectRatio: '1/1' }}><img src={content.features_image_2} className="w-full h-full object-cover" alt="Meeting"/></div>}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-50 rounded-full -z-10 blur-3xl"></div>
                            </div>
                            <div><h2 className="text-2xl md:text-5xl font-bold text-dark mb-6 leading-tight break-keep">{content.features_title || '함께할 때 더 멀리 갈 수 있습니다'}</h2><div className="space-y-8 mt-10"><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-brand shrink-0"><Icons.Users /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_network_title || '다양한 네트워크'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_network_desc || 'IT, 제조, 유통 등 다양한 산업군의 대표님들과 연결되어 새로운 비즈니스 기회를 창출합니다.'}</p></div></div><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><Icons.CheckCircle /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_expert_title || '검증된 전문가'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_expert_desc || '세무, 노무, 마케팅 등 각 분야 전문가 멘토링을 통해 사업 운영의 어려움을 해결해드립니다.'}</p></div></div><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 shrink-0"><Icons.Star /></div><div><h3 className="text-lg md:text-xl font-bold text-dark mb-1">{content.features_success_title || '성공 사례 공유'}</h3><p className="text-gray-500 text-sm leading-relaxed break-keep">{content.features_success_desc || '선배 창업가들의 생생한 성공 및 실패 사례를 통해 시행착오를 줄이고 빠르게 성장하세요.'}</p></div></div></div></div>
                        </div>
                    </div>
                </section>

                {/* ============================================
                    📍 섹션 5: ACTIVITIES (주요 활동 카드)
                    ============================================
                    "커뮤니티 주요 활동" 섹션입니다.
                    비즈니스 세미나, 투자/지원사업, 네트워킹 등의 카드가 표시됩니다.
                    순서를 바꾸려면 이 전체 <section> 블록을 이동하세요.
                    ============================================ */}
                {menuEnabled['프로그램'] ? (
                <section className="py-20 px-6">
                    <div className="container mx-auto max-w-7xl">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                            <div><h2 className="text-2xl md:text-3xl font-bold text-dark mb-3 break-keep">{content.activities_title || '커뮤니티 주요 활동'}</h2><p className="text-gray-500 text-sm md:text-base break-keep">{content.activities_subtitle || '사업 역량 강화와 네트워크 확장을 위한 다양한 프로그램'}</p></div>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="text-sm font-bold text-gray-500 hover:text-brand flex items-center gap-1 transition-colors">{content.activities_view_all || '전체 프로그램 보기'} <Icons.ArrowRight size={16} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative h-64 rounded-2xl overflow-hidden mb-4 card-zoom">{content.activity_seminar_image && <img src={content.activity_seminar_image} className="w-full h-full object-cover" alt="비즈니스 세미나"/>}<div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-brand shadow-sm">SEMINAR</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-lg font-bold text-dark group-hover:text-brand transition-colors">{content.activity_seminar_title || '비즈니스 세미나'}</h3></div><p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10 break-keep">{content.activity_seminar_desc || '매월 진행되는 창업 트렌드 및 마케팅 실무 세미나'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_seminar_schedule || '매월 2째주 목요일'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative h-64 rounded-2xl overflow-hidden mb-4 card-zoom">{content.activity_investment_image && <img src={content.activity_investment_image} className="w-full h-full object-cover" alt="투자 & 지원사업"/>}<div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-green-600 shadow-sm">INVESTMENT</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-lg font-bold text-dark group-hover:text-brand transition-colors">{content.activity_investment_title || '투자 & 지원사업'}</h3></div><p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10 break-keep">{content.activity_investment_desc || '최신 정부 지원사업 큐레이션 및 IR 피칭 기회'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_investment_schedule || '수시 모집'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-white rounded-3xl p-3 shadow-deep-blue hover:shadow-deep-blue-hover transition-all duration-300 group cursor-pointer border-none text-left w-full"><div className="relative h-64 rounded-2xl overflow-hidden mb-4 card-zoom">{content.activity_networking_image && <img src={content.activity_networking_image} className="w-full h-full object-cover" alt="사업가 네트워킹"/>}<div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-accent shadow-sm">NETWORK</div></div><div className="px-2 pb-2"><div className="flex justify-between items-start mb-2"><h3 className="text-lg font-bold text-dark group-hover:text-brand transition-colors">{content.activity_networking_title || '사업가 네트워킹'}</h3></div><p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10 break-keep">{content.activity_networking_desc || '다양한 업종의 대표님들과 교류하며 비즈니스 기회'}</p><div className="flex items-center justify-between"><span className="text-sm font-bold text-dark">{content.activity_networking_schedule || '매주 금요일'}</span></div></div></button>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="bg-soft rounded-3xl p-6 flex flex-col justify-center items-center text-center hover:bg-brand hover:text-white transition-colors duration-300 cursor-pointer group shadow-deep-blue border-none w-full"><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-brand mb-4 shadow-sm group-hover:scale-110 transition-transform"><Icons.ArrowRight size={24} /></div><h3 className="text-lg font-bold mb-2">{content.activity_more_title || 'More Programs'}</h3><p className="text-sm opacity-70 group-hover:opacity-90 break-keep">{content.activity_more_desc || '멘토링, 워크샵 등 더 많은 활동 보기'}</p></button>
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
                {menuEnabled['후원'] ? (
                <section className="py-24 px-6 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="container mx-auto max-w-6xl">
                        <div className="relative rounded-4xl overflow-hidden bg-gradient-to-br from-green-600 to-emerald-600 h-[350px] flex items-center justify-center text-center px-6 shadow-2xl shadow-green-500/40">
                            {content.donation_image && <div className="absolute inset-0"><img src={content.donation_image} className="w-full h-full object-cover opacity-20 mix-blend-overlay" alt="Support"/></div>}
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
                <section className="py-24 px-6">
                    <div className="container mx-auto max-w-6xl">
                        <div className="relative rounded-4xl overflow-hidden bg-brand h-[400px] flex items-center justify-center text-center px-6 shadow-2xl shadow-brand/40">
                            {content.cta_image && <div className="absolute inset-0"><img src={content.cta_image} className="w-full h-full object-cover opacity-30 mix-blend-overlay" alt="Building"/></div>}
                            <div className="relative z-10 max-w-2xl">
                                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight break-keep">{content.cta_title}</h2>
                                <p className="text-blue-100 text-base md:text-lg mb-10 break-keep">{content.cta_desc}</p>
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <button type="button" onClick={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        
                                        setShowSignUpModal(true); 
                                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); 
                                    }} className="px-8 py-4 bg-white text-brand font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-lg btn-hover">{content.cta_join_button || '지금 가입하기'}</button>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsInquiryModalOpen(true); }} className="px-8 py-4 bg-transparent border border-white/30 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">{content.cta_contact_button || '문의하기'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </React.Fragment>
        );
        return homeView || null;
        } catch (error) {
            console.error('renderView error:', error);
            console.error('Error stack:', error.stack);
            console.error('Current view:', currentView);
            // 오류 발생 시 홈으로 리다이렉트
            if (currentView !== 'home') {
                setCurrentView('home');
            }
            return null;
        }
    };
    
    return (
        <div className="min-h-screen bg-white text-dark font-sans selection:bg-accent/30 selection:text-brand relative">
            {/* 프로그램 팝업 (최대 3개 동시 표시, 1회만 표시) */}
            {popupPrograms && popupPrograms.length > 0 ? (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) closePopupAndMarkAsShown(); }}>
                    <div className="flex flex-col md:flex-row gap-4 max-w-6xl w-full overflow-x-auto py-4" onClick={(e) => e.stopPropagation()}>
                        {popupPrograms.map((program, idx) => {
                            const isMobile = window.innerWidth < 768;
                            
                            if (isMobile) {
                                // 모바일: 간단한 팝업 (이미지 + 더 자세히 알아보기 버튼만)
                                return (
                                    <div 
                                        key={program.id || idx} 
                                        className="bg-white rounded-2xl shadow-2xl w-[85vw] max-w-sm overflow-hidden relative mx-auto"
                                    >
                                        {/* 이미지 영역 (3:4 비율) */}
                                        <div className="w-full relative" style={{ aspectRatio: '3/4' }}>
                                            {/* 마감임박 마크 */}
                                            {program.isDeadlineSoon ? (
                                                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                                                    마감임박
                                                </div>
                                            ) : null}
                                            {/* 닫기 버튼 */}
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const remaining = popupPrograms.filter((_, i) => i !== idx);
                                                    if (remaining.length === 0) {
                                                        closePopupAndMarkAsShown();
                                                    } else {
                                                        setPopupPrograms(remaining);
                                                    }
                                                }} 
                                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-white text-gray-700 z-10 shadow-md"
                                            >
                                                <Icons.X size={18} />
                                            </button>
                                            {/* 이미지 */}
                                            {program.img ? (
                                                <img 
                                                    src={program.img} 
                                                    alt={program.title} 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : null}
                                        </div>
                                        {/* 더 자세히 알아보기 버튼 */}
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                closePopupAndMarkAsShown();
                                                setCurrentView('allSeminars');
                                                // 해당 프로그램을 선택하여 상세 모달 열기
                                                setTimeout(() => {
                                                    const allSeminarsView = document.querySelector('[data-view="allSeminars"]');
                                                    if (allSeminarsView) {
                                                        // 프로그램 상세 모달을 열기 위해 이벤트 트리거
                                                        const programCard = Array.from(allSeminarsView.querySelectorAll('[data-program-id]')).find(
                                                            el => el.getAttribute('data-program-id') === String(program.id)
                                                        );
                                                        if (programCard) {
                                                            programCard.click();
                                                        }
                                                    }
                                                }, 100);
                                            }}
                                            className="w-full py-4 bg-brand text-white font-bold rounded-b-2xl hover:bg-blue-700 transition-colors"
                                        >
                                            더 자세히 알아보기
                                        </button>
                                    </div>
                                );
                            } else {
                                // 데스크톱: 가로 레이아웃
                                return (
                                    <div 
                                        key={program.id || idx} 
                                        className="bg-white rounded-3xl shadow-2xl w-full md:w-auto md:max-w-5xl flex-shrink-0 overflow-hidden relative mx-auto flex flex-col md:flex-row"
                                        style={{ maxHeight: '90vh' }}
                                    >
                                        {/* 이미지 영역 (왼쪽) */}
                                        <div className="w-full md:flex-[0_0_400px] lg:flex-[0_0_450px] relative bg-gray-50 flex items-center justify-center overflow-hidden" style={{ minHeight: '400px' }}>
                                            {/* 마감임박 마크 */}
                                            {program.isDeadlineSoon ? (
                                                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                                                    마감임박
                                                </div>
                                            ) : null}
                                            {/* 닫기 버튼 */}
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const remaining = popupPrograms.filter((_, i) => i !== idx);
                                                    if (remaining.length === 0) {
                                                        closePopupAndMarkAsShown();
                                                    } else {
                                                        setPopupPrograms(remaining);
                                                    }
                                                }} 
                                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-white text-gray-700 z-10 shadow-md"
                                            >
                                                <Icons.X size={18} />
                                            </button>
                                            {/* 이미지 */}
                                            {program.img ? (
                                                <img 
                                                    src={program.img} 
                                                    alt={program.title} 
                                                    className="w-full h-full object-contain"
                                                    style={{ maxHeight: '90vh' }}
                                                />
                                            ) : null}
                                        </div>
                                        
                                        {/* 정보 영역 (오른쪽) */}
                                        <div className="flex-1 p-6 overflow-y-auto modal-scroll" style={{ minWidth: '300px', maxHeight: '90vh' }}>
                                            <h3 className="text-xl font-bold text-dark mb-3">{program.title}</h3>
                                            
                                            {/* 카테고리 및 유료/무료 배지 */}
                                            <div className="flex items-center gap-2 mb-3">
                                                {program.category ? (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${getCategoryColor(program.category)}`}>
                                                        {program.category}
                                                    </span>
                                                ) : null}
                                                <span className="text-xs font-bold px-2 py-1 bg-brand/10 text-brand rounded-full">
                                                    {program.requiresPayment ? (program.price ? `${program.price.toLocaleString()}원` : '유료') : '무료'}
                                                </span>
                                            </div>
                                            
                                            {/* 날짜, 장소, 신청현황 */}
                                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Icons.Calendar size={16} className="text-brand" /> {program.date}
                                                </div>
                                                {program.location ? (
                                                    <div className="flex items-center gap-2">
                                                        <Icons.MapPin size={16} className="text-brand" /> {program.location}
                                                    </div>
                                                ) : null}
                                                <div className="flex items-center gap-2">
                                                    <Icons.Users size={16} className="text-brand" /> {program.currentParticipants || 0} / {program.maxParticipants || 0}명
                                                </div>
                                            </div>
                                            
                                            {/* 프로그램 설명 */}
                                            {program.desc ? (
                                                <div className="mb-4">
                                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{program.desc}</p>
                                                </div>
                                            ) : null}
                                            
                                            {/* 신청하기 버튼 */}
                                            {currentUser ? (
                                                <button 
                                                    type="button"
                                                    onClick={() => handlePopupApply(program)}
                                                    className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                                >
                                                    신청하기
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        closePopupAndMarkAsShown();
                                                        setShowLoginModal(true);
                                                    }}
                                                    className="w-full py-3 bg-gray-300 text-gray-500 font-bold rounded-xl cursor-not-allowed"
                                                    disabled
                                                >
                                                    로그인 후 신청 가능
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                    {/* 전체 닫기 버튼 */}
                    {popupPrograms.length > 1 ? (
                        <button 
                            type="button" 
                            onClick={() => closePopupAndMarkAsShown()} 
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/90 hover:bg-white text-gray-700 rounded-full font-bold shadow-lg z-20"
                        >
                            모두 닫기
                        </button>
                    ) : null}
                </div>
            ) : null}
            
            {/* 팝업 신청 모달 */}
            {isPopupApplyModalOpen && applySeminarFromPopup ? (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setIsPopupApplyModalOpen(false); }}>
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-scroll">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-dark">프로그램 신청</h3>
                            <button type="button" onClick={() => setIsPopupApplyModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <Icons.X size={24} />
                            </button>
                        </div>
                        <div className="mb-6">
                            <h4 className="text-lg font-bold text-dark mb-2">{applySeminarFromPopup.title}</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div><span className="font-bold">일시:</span> {applySeminarFromPopup.date}</div>
                                {applySeminarFromPopup.location && <div><span className="font-bold">장소:</span> {applySeminarFromPopup.location}</div>}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">신청사유 *</label>
                                <textarea 
                                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none h-32 resize-none" 
                                    value={popupApplicationData.reason}
                                    onChange={(e) => setPopupApplicationData({...popupApplicationData, reason: e.target.value})}
                                    placeholder="이 프로그램에 신청하는 이유를 작성해주세요"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">사전질문 *</label>
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                        value={popupApplicationData.questions[0]}
                                        onChange={(e) => {
                                            const newQuestions = [...popupApplicationData.questions];
                                            newQuestions[0] = e.target.value;
                                            setPopupApplicationData({...popupApplicationData, questions: newQuestions});
                                        }}
                                        placeholder="사전질문 1"
                                    />
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                                        value={popupApplicationData.questions[1]}
                                        onChange={(e) => {
                                            const newQuestions = [...popupApplicationData.questions];
                                            newQuestions[1] = e.target.value;
                                            setPopupApplicationData({...popupApplicationData, questions: newQuestions});
                                        }}
                                        placeholder="사전질문 2"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => setIsPopupApplyModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">
                                    취소
                                </button>
                                <button type="button" onClick={handlePopupApplySubmit} className="flex-1 py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">
                                    신청하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
            
            <header className={`fixed top-0 w-full z-50 transition-all duration-300 ease-in-out px-4 md:px-6 py-5 ${scrolled ? 'bg-white/80 backdrop-blur-lg shadow-glass' : 'bg-transparent'}`}>
                <div className="container mx-auto flex justify-between items-center relative">
                    <div className="flex items-center cursor-pointer group h-[75px] overflow-hidden" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('home'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}>
                        {/* 🌟 Logo Image: 부산청년사업가들 로고 */}
                        <img 
                            src="/assets/images/logo.png" 
                            alt="부산청년사업가들" 
                            className="h-full w-auto object-contain hover:opacity-90 transition-opacity" 
                            onError={(e) => {
                                e.target.onerror = null;
                                // 절대 경로 사용 (Vite가 public을 루트로 복사)
                                if (e.target.src.includes('/assets/')) {
                                    e.target.src = '/assets/images/logo.png';
                                } else {
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'text-xl md:text-2xl font-black text-brand';
                                fallback.textContent = '부청사';
                                e.target.parentNode.appendChild(fallback);
                                }
                            }}
                        />
                    </div>
                    <nav className={`hidden md:flex items-center px-2 py-1.5 rounded-full transition-all duration-300 gap-3 relative whitespace-nowrap ${scrolled ? 'bg-transparent' : 'bg-white/40 backdrop-blur-md shadow-glass'}`}>
                        {menuOrder.filter(item => menuEnabled[item]).map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1 relative flex-shrink-0 min-w-fit">
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigation(item); }} className={`${getNavClass(item)} relative`}>
                                    {menuNames[item] || item}
                                </button>
                            </div>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                        {currentUser ? (
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('myPage'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hidden md:block text-xs font-bold text-gray-600 hover:text-brand transition-colors px-2 flex-shrink-0">마이페이지</button>
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }} className="px-3 md:px-4 py-2 bg-gray-200 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-300 transition-colors whitespace-nowrap flex-shrink-0">로그아웃</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    setShowLoginModal(true); 
                                }} className="text-xs font-semibold text-gray-600 hover:text-brand transition-colors px-2 flex-shrink-0">로그인</button>
                                <button type="button" onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    setShowSignUpModal(true); 
                                }} className="px-3 md:px-4 py-2 bg-brand text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-brand/20 btn-hover whitespace-nowrap flex-shrink-0">가입하기</button>
                            </div>
                        )}
                        <button type="button" className="md:hidden p-2 text-dark flex-shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(true); }}><Icons.Menu /></button>
                    </div>
                </div>
            </header>
            
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

            <footer className="py-12 bg-white px-6 shadow-[0_-4px_25px_rgba(0,69,165,0.05)] border-none">
                <div className="container mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-4 h-20 overflow-hidden">
                                <img 
                                    src="/assets/images/logo.png" 
                                    alt="부산청년사업가들" 
                                    className="h-full w-auto object-contain" 
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        // 절대 경로 사용 (Vite가 public을 루트로 복사)
                                        if (e.target.src.includes('/assets/')) {
                                            e.target.src = '/assets/images/logo.png';
                                        } else {
                                        e.target.style.display = 'none';
                                        const fallback = document.createElement('div');
                                        fallback.className = 'text-xl font-black text-brand';
                                        fallback.textContent = '부청사';
                                        e.target.parentNode.appendChild(fallback);
                                        }
                                    }}
                                />
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed max-w-xs break-keep">부산 지역 청년 사업가들이 모여 함께 성장하는<br/>비즈니스 커뮤니티입니다.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
                            {(menuEnabled['부청사 회원'] || menuEnabled['커뮤니티']) ? (
                                <div>
                                    <h4 className="font-bold text-dark mb-4">커뮤니티</h4>
                                    <ul className="space-y-2 text-sm text-gray-500">
                                        {menuEnabled['부청사 회원'] ? (
                                            <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allMembers'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">부청사 회원</button></li>
                                        ) : null}
                                        {menuEnabled['커뮤니티'] ? (
                                            <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('community'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">커뮤니티 게시판</button></li>
                                        ) : null}
                                    </ul>
                                </div>
                            ) : null}
                            {menuEnabled['프로그램'] ? (
                                <div>
                                    <h4 className="font-bold text-dark mb-4">프로그램</h4>
                                    <ul className="space-y-2 text-sm text-gray-500">
                                        <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('allSeminars'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">세미나 일정</button></li>
                                    </ul>
                                </div>
                            ) : null}
                            {(menuEnabled['후원'] || menuEnabled['소개']) ? (
                                <div>
                                    <h4 className="font-bold text-dark mb-4">지원</h4>
                                    <ul className="space-y-2 text-sm text-gray-500">
                                        <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('notice'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">공지사항</button></li>
                                        {menuEnabled['후원'] ? (
                                            <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('donation'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">후원하기</button></li>
                                        ) : null}
                                        {menuEnabled['소개'] ? (
                                            <li><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentView('about'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }} className="hover:text-brand text-left">소개</button></li>
                                        ) : null}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="pt-8 border-t border-brand/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
                        <span>&copy; 2025 BCSA. All rights reserved.</span>
                        <div className="flex gap-4 items-center">
                            <a href="#" className="hover:text-dark">이용약관</a>
                            <a href="#" className="hover:text-dark">개인정보처리방침</a>
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = 'admin.html';
                                }}
                                className="hover:text-dark opacity-50 hover:opacity-100 transition-opacity"
                                title="관리자 페이지"
                            >
                                Admin
                            </button>
                        </div>
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
                    onClose={() => {
                        
                        setShowLoginModal(false);
                    }} 
                    onLogin={handleLogin} 
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
            {/* 🌟 모바일 메뉴 오버레이 */}
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onNavigate={handleNavigation} menuEnabled={menuEnabled} menuNames={menuNames} menuOrder={menuOrder} />

            {/* 플로팅 소셜 아이콘 (오른쪽 고정, 스크롤 따라다님) */}
            <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-3">
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
        </div>
    );
}
export default App;
