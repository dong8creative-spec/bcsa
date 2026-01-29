import React, { useState, useEffect, Fragment } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Icons } from './Icons';
import { uploadImageToStorage } from '../utils/imageUtils';

const CommunityView = ({ 
    onBack, 
    posts, 
    onCreate, 
    onDelete, 
    currentUser, 
    onNotifyAdmin, 
    seminars, 
    setShowLoginModal, 
    pageTitles, 
    menuNames, 
    reviewSeminar, 
    onReviewComplete,
    handleCommunityUpdate,
    handleCommunityDelete,
    openKakaoPlacesSearch,
    isCurrentUserAdmin
}) => {
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
    
    // reviewSeminar가 전달되면 자동으로 후기 작성 모달 열기
    useEffect(() => {
        if (reviewSeminar) {
            setFormData(prev => ({
                ...prev,
                category: '프로그램 후기',
                seminarId: reviewSeminar.id,
                seminarTitle: reviewSeminar.title,
                title: `[${reviewSeminar.title}] 후기`,
                rating: 0,
                reviewImages: []
            }));
            setSelectedCategory('프로그램 후기');
            setIsCreateModalOpen(true);
        }
    }, [reviewSeminar]);

    // ESC 키로 게시글 상세/이미지 확대 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                if (selectedImage) {
                    setSelectedImage(null);
                } else if (selectedPost) {
                    setSelectedPost(null);
                }
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [selectedPost, selectedImage]);
    
    // 신청한 프로그램 목록 가져오기 (Firestore 우선, localStorage 폴백)
    const getAppliedSeminars = async () => {
        if (!currentUser || !seminars) return [];
        try {
            // Firestore에서 먼저 시도
            if (firebaseService && firebaseService.getApplicationsByUserId) {
                try {
                    const applications = await firebaseService.getApplicationsByUserId(currentUser.id);
                    const appliedSeminarIds = applications.map(app => app.seminarId);
                    return seminars.filter(seminar => appliedSeminarIds.includes(seminar.id));
                } catch (firestoreError) {
                    console.error('Firestore에서 신청 목록 가져오기 실패:', firestoreError);
                    // Firestore 실패 시 localStorage 폴백
                }
            }
            
            // localStorage 폴백
            if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
                const applications = JSON.parse(localStorage.getItem('busan_ycc_seminar_applications') || '[]');
                const appliedSeminarIds = applications
                    .filter(app => app.userId === currentUser.id)
                    .map(app => app.seminarId);
                return seminars.filter(seminar => appliedSeminarIds.includes(seminar.id));
            }
            return [];
        } catch (error) {
            console.error('신청한 프로그램 목록 가져오기 실패:', error);
            return [];
        }
    };
    
    // 신청한 프로그램 목록 상태 (비동기 로딩)
    const [appliedSeminars, setAppliedSeminars] = useState([]);
    
    // 신청한 프로그램 목록 로드
    useEffect(() => {
        const loadAppliedSeminars = async () => {
            if (!currentUser || !seminars) {
                setAppliedSeminars([]);
                return;
            }
            const loaded = await getAppliedSeminars();
            setAppliedSeminars(loaded);
        };
        loadAppliedSeminars();
    }, [currentUser, seminars]);
    
    // 공지사항과 일반 게시글 분리
    const noticePosts = posts.filter(p => p.category === '공지사항');
    const categories = isCurrentUserAdmin 
        ? ['전체', '공지사항', '프로그램 후기', '인력구인', '중고거래', '건의사항']
        : ['전체', '프로그램 후기', '인력구인', '중고거래', '건의사항'];
    
    const filteredPosts = selectedCategory === '전체' 
        ? posts.filter(p => p.category !== '공지사항')
        : posts.filter(p => p.category === selectedCategory);
    
    const MAX_IMAGES = 10;
    const handleImageUpload = async (files, imageType) => {
        let currentImages;
        if (imageType === 'store') {
            currentImages = formData.storeImages;
        } else if (imageType === 'review') {
            currentImages = formData.reviewImages;
        } else {
            currentImages = formData.itemImages;
        }
        
        if (currentImages.length + files.length > MAX_IMAGES) {
            alert(`최대 ${MAX_IMAGES}장까지만 업로드할 수 있습니다.`);
            return;
        }

        setUploadingImages(true);
        const uploadPromises = Array.from(files).map(async (file) => {
            try {
                if (!file.type.startsWith('image/')) return null;
                const url = await uploadImageToStorage(file, 'community');
                return url;
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
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-12 text-center">
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
                                    {(isCurrentUserAdmin || (currentUser && (post.authorId === currentUser.id || post.authorId === currentUser.uid || (post.author && post.author === currentUser.name)))) ? (
                                        <div className="flex gap-2 ml-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                                    setEditingPost({
                                                        ...post,
                                                        storeImages: post.storeImages || [],
                                                        itemImages: post.itemImages || [],
                                                        reviewImages: post.reviewImages || post.images || []
                                                    });
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
                                                        }),
                                                        ...(post.category === '프로그램 후기' && {
                                                            reviewImages: post.reviewImages || post.images || [],
                                                            rating: post.rating || 0,
                                                            seminarId: post.seminarId || null,
                                                            seminarTitle: post.seminarTitle || null
                                                        })
                                                    });
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Icons.Edit size={14} />
                                    </button>
                                    {isCurrentUserAdmin ? (
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
                                    ) : null}
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
                                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-blue-200 hover:border-brand/20"
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
                                        {(isCurrentUserAdmin || (currentUser && (post.authorId === currentUser.id || post.authorId === currentUser.uid || (post.author && post.author === currentUser.name)))) ? (
                                            <Fragment>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingPost({
                                                            ...post,
                                                            storeImages: post.storeImages || [],
                                                            itemImages: post.itemImages || [],
                                                            reviewImages: post.reviewImages || post.images || []
                                                        });
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                                    title="수정"
                                                >
                                                    <Icons.Edit size={16} />
                                                </button>
                                                {isCurrentUserAdmin ? (
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
                                                ) : null}
                                            </Fragment>
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
            </div>

                {/* 게시글 작성 모달 (ESC 미적용) */}
                {isCreateModalOpen ? (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}>
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 max-w-3xl w-full flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                                <h3 className="text-2xl font-bold text-dark mb-6">게시글 작성</h3>
                                <div className="space-y-4">
                                    <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                                    <select 
                                        className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" 
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
                                    <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                                    </div>
                                    <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                                    <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-48 resize-none" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} />
                                    </div>

                                    {/* 인력구인 추가 필드 */}
                                    {formData.category === '인력구인' ? (
                                        <Fragment>
                                                <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">업무 내용 *</label>
                                                <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-32 resize-none" value={formData.jobDetails} onChange={(e) => setFormData({...formData, jobDetails: e.target.value})} placeholder="업무 내용을 상세히 입력해주세요" />
                                                </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">모집 인원 *</label>
                                                    <input type="number" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.recruitCount} onChange={(e) => setFormData({...formData, recruitCount: e.target.value})} placeholder="명" min="1" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">마감일 *</label>
                                                    <input type="date" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
                                            </div>
                                                </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">근무 시간 *</label>
                                                <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.workHours} onChange={(e) => setFormData({...formData, workHours: e.target.value})} placeholder="예: 09:00 ~ 18:00" />
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">급여/처우 *</label>
                                                <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} placeholder="예: 월 250만원, 주 5일" />
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">우대 사항</label>
                                                <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-24 resize-none" value={formData.preferred} onChange={(e) => setFormData({...formData, preferred: e.target.value})} placeholder="우대 사항을 입력해주세요" />
                                    </div>
                                            <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">매장 위치 *</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" 
                                                            value={formData.storeLocation} 
                                                            onChange={(e) => setFormData({...formData, storeLocation: e.target.value})} 
                                                            placeholder="매장 주소" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (typeof openKakaoPlacesSearch !== 'function') return;
                                                                openKakaoPlacesSearch((place) => {
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        storeLocation: `${place.name} (${place.address})`
                                                                    }));
                                                                });
                                                            }}
                                                            disabled={typeof openKakaoPlacesSearch !== 'function'}
                                                            className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            장소 검색
                                                        </button>
                                                    </div>
                                    </div>
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">전화번호 *</label>
                                                    <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.storePhone} onChange={(e) => setFormData({...formData, storePhone: e.target.value})} placeholder="010-1234-5678" />
                                                </div>
                                                    </div>
                                                <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">매장 사진 (최대 10장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.storeImages.map((img, idx) => (
                                                        <div key={idx} className="relative">
                                                            <img src={img} alt={`매장 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, storeImages: formData.storeImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                                    ))}
                                                    {formData.storeImages.length < MAX_IMAGES ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                                    if (files.length + formData.storeImages.length > MAX_IMAGES) {
                                                                        alert(`최대 ${MAX_IMAGES}장까지만 선택할 수 있습니다.`);
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
                                </Fragment>
                                    ) : null}

                                    {/* 중고거래 추가 필드 */}
                                    {formData.category === '중고거래' ? (
                                <Fragment>
                                            <div className="grid grid-cols-2 gap-4">
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">제품명 *</label>
                                                    <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} placeholder="제품명을 입력해주세요" />
                                    </div>
                                    <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">카테고리 *</label>
                                                    <select className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.itemCategory} onChange={(e) => setFormData({...formData, itemCategory: e.target.value})}>
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
                                                    <input type="number" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="원" min="0" />
                                        </div>
                                        <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">상태 *</label>
                                                    <select className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.itemCondition} onChange={(e) => setFormData({...formData, itemCondition: e.target.value})}>
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
                                                    <select className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.tradeMethod} onChange={(e) => setFormData({...formData, tradeMethod: e.target.value})}>
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
                                                            className="flex-1 p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" 
                                                            value={formData.tradeLocation} 
                                                            onChange={(e) => setFormData({...formData, tradeLocation: e.target.value})} 
                                                            placeholder="거래 지역을 입력해주세요" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (typeof openKakaoPlacesSearch !== 'function') return;
                                                                openKakaoPlacesSearch((place) => {
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        tradeLocation: `${place.name} (${place.address})`
                                                                    }));
                                                                });
                                                            }}
                                                            disabled={typeof openKakaoPlacesSearch !== 'function'}
                                                            className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            장소 검색
                                                        </button>
                                                    </div>
                                        </div>
                                    </div>
                                    <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">제품 사진 (최대 10장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.itemImages.map((img, idx) => (
                                                    <div key={idx} className="relative">
                                                            <img src={img} alt={`제품 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, itemImages: formData.itemImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                            ))}
                                                    {formData.itemImages.length < MAX_IMAGES ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                                    if (files.length + formData.itemImages.length > MAX_IMAGES) {
                                                                        alert(`최대 ${MAX_IMAGES}장까지만 선택할 수 있습니다.`);
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
                                                <input type="text" className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.businessNumber} onChange={(e) => setFormData({...formData, businessNumber: e.target.value})} placeholder="사업자등록번호를 입력해주세요" />
                                                {currentUser && currentUser.businessRegistrationNumber && formData.businessNumber && formData.businessNumber !== currentUser.businessRegistrationNumber ? (
                                                    <p className="text-red-500 text-xs mt-1">회원 정보의 사업자등록번호와 일치하지 않습니다.</p>
            ) : null}
        </div>
                                </Fragment>
                                    ) : null}

                                    {/* 프로그램 후기 추가 필드 */}
                                    {formData.category === '프로그램 후기' ? (
                                        <Fragment>
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
                                                        className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" 
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
                                                <label className="block text-sm font-bold text-gray-700 mb-2">후기 사진 (최대 10장)</label>
                                                <div className="flex gap-4 flex-wrap">
                                                    {formData.reviewImages.map((img, idx) => (
                                                        <div key={idx} className="relative">
                                                            <img src={img} alt={`후기 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                            <button type="button" onClick={() => setFormData({...formData, reviewImages: formData.reviewImages.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                                                </div>
                                            ))}
                                                    {formData.reviewImages.length < MAX_IMAGES ? (
                                                        <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                        </Fragment>
                                    ) : null}

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={formData.isSecret} onChange={(e) => setFormData({...formData, isSecret: e.target.checked})} />
                                        <span className="text-sm font-bold text-gray-700">비밀글</span>
                                                </label>
                                    {formData.isSecret ? (
                                        <input type="text" placeholder="비밀번호" className="flex-1 p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                                    ) : null}
                                </div>
                        <button type="button" onClick={handleCreatePost} className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 mt-6">
                                        작성
                                                </button>
                                        </div>
                            </div>
                            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* 게시글 수정 모달 (ESC 미적용) */}
                {isEditModalOpen && editingPost && (isCurrentUserAdmin || (currentUser && (editingPost.authorId === currentUser.id || editingPost.authorId === currentUser.uid || (editingPost.author && editingPost.author === currentUser.name)))) ? (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) { setIsEditModalOpen(false); setEditingPost(null); } }}>
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 max-w-3xl w-full flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                                <h3 className="text-2xl font-bold text-dark mb-6">게시글 수정</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none" 
                                        value={editingPost.title || ''} 
                                        onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                                    <textarea 
                                        className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-48 resize-none" 
                                        value={editingPost.content || ''} 
                                        onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} 
                                    />
                                </div>
                                
                                {/* 이미지 수정 섹션 */}
                                {editingPost.category === '인력구인' && editingPost.storeImages !== undefined ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">매장 사진 (최대 10장)</label>
                                        <div className="flex gap-4 flex-wrap">
                                            {(editingPost.storeImages || []).map((img, idx) => (
                                                <div key={idx} className="relative">
                                                    <img src={img} alt={`매장 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const newImages = [...(editingPost.storeImages || [])];
                                                            newImages.splice(idx, 1);
                                                            setEditingPost({...editingPost, storeImages: newImages});
                                                        }} 
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {(editingPost.storeImages || []).length < MAX_IMAGES ? (
                                                <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
if (files.length + (editingPost.storeImages || []).length > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 선택할 수 있습니다.`);
                                                            return;
                                                        }
                                                        const currentImages = editingPost.storeImages || [];
                                                        if (currentImages.length + files.length > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
                                                                return;
                                                            }
                                                            setUploadingImages(true);
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const url = await uploadImageToStorage(file, 'community');
                                                                    return url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
                                                            setEditingPost({...editingPost, storeImages: [...currentImages, ...uploadedUrls]});
                                                            setUploadingImages(false);
                                                            e.target.value = '';
                                                        }} 
                                                    />
                                                </label>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                                
                                {editingPost.category === '중고거래' && editingPost.itemImages !== undefined ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">제품 사진 (최대 10장)</label>
                                        <div className="flex gap-4 flex-wrap">
                                            {(editingPost.itemImages || []).map((img, idx) => (
                                                <div key={idx} className="relative">
                                                    <img src={img} alt={`제품 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const newImages = [...(editingPost.itemImages || [])];
                                                            newImages.splice(idx, 1);
                                                            setEditingPost({...editingPost, itemImages: newImages});
                                                        }} 
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {(editingPost.itemImages || []).length < MAX_IMAGES ? (
                                                <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
if (files.length + (editingPost.itemImages || []).length > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 선택할 수 있습니다.`);
                                                            return;
                                                        }
                                                        const currentImages = editingPost.itemImages || [];
                                                        if (currentImages.length + files.length > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
                                                                return;
                                                            }
                                                            setUploadingImages(true);
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const url = await uploadImageToStorage(file, 'community');
                                                                    return url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
                                                            setEditingPost({...editingPost, itemImages: [...currentImages, ...uploadedUrls]});
                                                            setUploadingImages(false);
                                                            e.target.value = '';
                                                        }} 
                                                    />
                                                </label>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                                
                                {editingPost.category === '프로그램 후기' && (editingPost.reviewImages !== undefined || editingPost.images !== undefined) ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">후기 사진 (최대 10장)</label>
                                        <div className="flex gap-4 flex-wrap">
                                            {(editingPost.reviewImages || editingPost.images || []).map((img, idx) => (
                                                <div key={idx} className="relative">
                                                    <img src={img} alt={`후기 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const currentImages = editingPost.reviewImages || editingPost.images || [];
                                                            const newImages = [...currentImages];
                                                            newImages.splice(idx, 1);
                                                            setEditingPost({...editingPost, reviewImages: newImages, images: newImages});
                                                        }} 
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {((editingPost.reviewImages || editingPost.images || []).length < MAX_IMAGES) ? (
                                                <label className="w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
if (files.length + ((editingPost.reviewImages || editingPost.images || []).length) > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 선택할 수 있습니다.`);
                                                            return;
                                                        }
                                                        const currentImages = editingPost.reviewImages || editingPost.images || [];
                                                        if (currentImages.length + files.length > MAX_IMAGES) {
                                                            alert(`최대 ${MAX_IMAGES}장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
                                                                return;
                                                            }
                                                            setUploadingImages(true);
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const url = await uploadImageToStorage(file, 'community');
                                                                    return url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
                                                            setEditingPost({...editingPost, reviewImages: [...currentImages, ...uploadedUrls], images: [...currentImages, ...uploadedUrls]});
                                                            setUploadingImages(false);
                                                            e.target.value = '';
                                                        }} 
                                                    />
                                                </label>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                                
                                <button 
                                        type="button" 
                                        onClick={() => handleCommunityUpdate(editingPost.id, editingPost)} 
                                        className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 mt-6"
                                    >
                                        수정
                                                </button>
                                            </div>
                            </div>
                            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingPost(null); }} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* 게시글 상세 모달 (ESC로 닫기) */}
            {selectedPost && currentUser ? (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
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
                            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                                <button type="button" onClick={() => setSelectedPost(null)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                    닫기
                                </button>
                            </div>
                        </div>
                        </div>
                                </div>
                            ) : null}

                {/* 이미지 확대 모달 (ESC로 닫기) */}
                {selectedImage ? (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) setSelectedImage(null); }}>
                        <div className="flex flex-col max-w-[90vw] max-h-[90vh] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 flex items-center justify-center mb-4">
                                <img src={selectedImage} alt="확대 이미지" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                            </div>
                            <div className="flex justify-end">
                                <button type="button" onClick={() => setSelectedImage(null)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
        </div>
    );
};

export default CommunityView;
