import React, { useState, Fragment, useEffect, useCallback, useRef } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import { uploadImageToStorage } from '../utils/imageUtils';
import { firebaseService } from '../services/firebaseService';
import { apiGet } from '../utils/api';

const COMPANY_IMAGES_MAX = 10;

const MyPageView = ({ onBack, user, mySeminars, myPosts, onWithdraw, onUpdateProfile, onCancelSeminar, pageTitles, onUpdatePost }) => {
    const [activeTab, setActiveTab] = useState('seminars');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [companyIntro, setCompanyIntro] = useState({
        companyMainImage: user.companyMainImage || '',
        companyDescription: user.companyDescription || '',
        companyImages: Array.isArray(user.companyImages) ? user.companyImages : (user.companyImages ? [user.companyImages] : [])
    });
    const [companyImageUploading, setCompanyImageUploading] = useState(false);
    const companyMainImageInputRef = useRef(null);
    const companyImagesInputRef = useRef(null);
    const [editFormData, setEditFormData] = useState({
        name: user.name || '',
        company: user.company || '',
        role: user.role || '',
        industry: user.industry || user.businessCategory || '',
        address: user.address || '',
        phone: user.phone || '',
        img: user.img || ''
    });
    
    // 즐겨찾기 관련 상태
    const [bookmarks, setBookmarks] = useState([]);
    const [bookmarksLoading, setBookmarksLoading] = useState(false);
    const [bookmarkDetails, setBookmarkDetails] = useState([]);
    
    // 즐겨찾기 로드
    const loadBookmarks = useCallback(async () => {
        if (!user || !user.id) {
            setBookmarkDetails([]);
            return;
        }
        
        setBookmarksLoading(true);
        try {
            // Firestore에서 즐겨찾기 목록 가져오기
            const bookmarkList = await firebaseService.getBookmarks(user.id);
            setBookmarks(bookmarkList);
            
            // 각 bidNtceNo로 API 호출하여 상세 정보 가져오기
            if (bookmarkList.length > 0) {
                const details = await Promise.all(
                    bookmarkList.map(async (bookmark) => {
                        try {
                            const response = await apiGet('/api/bid-search', {
                                inqryDiv: '2',
                                bidNtceNo: bookmark.bidNtceNo,
                                pageNo: 1,
                                numOfRows: 1
                            });
                            
                            const items = response.data?.data?.items || response.data?.response?.body?.items?.item || [];
                            const item = Array.isArray(items) ? items[0] : items;
                            
                            return {
                                ...bookmark,
                                details: item || { bidNtceNo: bookmark.bidNtceNo, bidNtceNm: '공고 정보를 불러올 수 없습니다.' }
                            };
                        } catch (error) {
                            console.error('❌ 즐겨찾기 상세 정보 로드 실패:', bookmark.bidNtceNo, error);
                            return {
                                ...bookmark,
                                details: { bidNtceNo: bookmark.bidNtceNo, bidNtceNm: '공고 정보를 불러올 수 없습니다.' }
                            };
                        }
                    })
                );
                setBookmarkDetails(details);
            } else {
                // 즐겨찾기가 없을 때 빈 배열로 초기화
                setBookmarkDetails([]);
            }
        } catch (error) {
            console.error('❌ 즐겨찾기 로드 실패:', error);
            alert('즐겨찾기를 불러오는데 실패했습니다.');
            setBookmarkDetails([]);
        } finally {
            setBookmarksLoading(false);
        }
    }, [user]);
    
    useEffect(() => {
        if (user && user.id && activeTab === 'bookmarks') {
            loadBookmarks();
        } else if (activeTab !== 'bookmarks') {
            // 다른 탭으로 전환할 때 즐겨찾기 데이터 초기화
            setBookmarkDetails([]);
            setBookmarks([]);
        }
    }, [user, activeTab, loadBookmarks]);

    useEffect(() => {
        if (user) {
            setCompanyIntro({
                companyMainImage: user.companyMainImage || '',
                companyDescription: user.companyDescription || '',
                companyImages: Array.isArray(user.companyImages) ? user.companyImages : (user.companyImages ? [user.companyImages] : [])
            });
        }
    }, [user?.companyMainImage, user?.companyDescription, user?.companyImages]);

    const handleCompanyMainImageChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        setCompanyImageUploading(true);
        try {
            const url = await uploadImageToStorage(file, 'company');
            setCompanyIntro(prev => ({ ...prev, companyMainImage: url }));
        } catch (err) {
            console.error(err);
            alert('대표 이미지 업로드에 실패했습니다.');
        } finally {
            setCompanyImageUploading(false);
        }
    };

    const handleCompanyImagesChange = async (e) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        e.target.value = '';
        const current = companyIntro.companyImages || [];
        if (current.length + files.length > COMPANY_IMAGES_MAX) {
            alert(`추가 사진은 최대 ${COMPANY_IMAGES_MAX}장까지 등록할 수 있습니다.`);
            return;
        }
        setCompanyImageUploading(true);
        try {
            const uploaded = [];
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const url = await uploadImageToStorage(file, 'company');
                uploaded.push(url);
            }
            setCompanyIntro(prev => ({ ...prev, companyImages: [...prev.companyImages, ...uploaded] }));
        } catch (err) {
            console.error(err);
            alert('이미지 업로드에 실패했습니다.');
        } finally {
            setCompanyImageUploading(false);
        }
    };

    const removeCompanyImage = (index) => {
        setCompanyIntro(prev => ({
            ...prev,
            companyImages: prev.companyImages.filter((_, i) => i !== index)
        }));
    };
    
    const handleRemoveBookmark = async (bidNtceNo) => {
        if (!confirm('즐겨찾기에서 삭제하시겠습니까?')) return;
        
        try {
            await firebaseService.removeBookmark(user.id, bidNtceNo);
            // 목록 새로고침
            loadBookmarks();
        } catch (error) {
            console.error('❌ 즐겨찾기 삭제 실패:', error);
            alert('즐겨찾기 삭제에 실패했습니다.');
        }
    };
    
    const handleWithdrawClick = () => {
        if(confirm("정말로 탈퇴하시겠습니까? 모든 정보가 삭제됩니다.")) {
            onWithdraw();
        }
    }

    const handleSaveProfile = async () => {
        if (!editFormData.name) {
            return alert("이름은 필수 항목입니다.");
        }
        if (onUpdateProfile) {
            await onUpdateProfile(editFormData);
            setIsEditingProfile(false);
        } else {
            alert("프로필 수정 기능이 준비되지 않았습니다.");
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            alert("이미지 크기는 1MB 이하로 제한됩니다.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditFormData({...editFormData, img: reader.result});
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="pt-32 pb-20 px-6 md:px-8 min-h-screen bg-white animate-fade-in">
            <div className="container mx-auto max-w-5xl">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
                    <div>
                        <PageTitle pageKey="myPage" pageTitles={pageTitles} defaultText="마이페이지" />
                        <p className="text-sm text-gray-500 mt-2">회원 정보와 활동 내역을 확인하세요</p>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-gray-600 text-sm border border-blue-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <Icons.ArrowLeft size={18} /> 메인으로
                    </button>
                </div>
                
                {/* 프로필 섹션 */}
                <div className="bg-gray-50 border border-blue-100 p-10 mb-20">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-5xl overflow-hidden border border-blue-300">
                                {editFormData.img ? <img src={editFormData.img} className="w-full h-full object-cover"/> : "👤"}
                            </div>
                            {isEditingProfile && (
                                <label className="absolute bottom-0 right-0 w-10 h-10 bg-gray-800 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors border-2 border-white">
                                    <Icons.Camera size={18} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>
                        <div className="flex-1">
                            {isEditingProfile ? (
                                <div className="space-y-4">
                                    <input type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="이름" />
                                    <input type="text" value={editFormData.company} onChange={e => setEditFormData({...editFormData, company: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="회사명" />
                                    <input type="text" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="직책" />
                                    <input type="text" value={editFormData.industry} onChange={e => setEditFormData({...editFormData, industry: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="업종" />
                                    <input type="text" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="주소" />
                                    <input type="text" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full px-4 py-3 border border-blue-200 focus:border-blue-400 focus:outline-none text-sm" placeholder="전화번호" />
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={handleSaveProfile} className="px-6 py-3 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">저장</button>
                                        <button type="button" onClick={() => { setIsEditingProfile(false); setEditFormData({name: user.name || '', company: user.company || '', role: user.role || '', industry: user.industry || user.businessCategory || '', address: user.address || '', phone: user.phone || '', img: user.img || ''}); }} className="px-6 py-3 border border-blue-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">취소</button>
                                    </div>
                                </div>
                            ) : (
                                <Fragment>
                                    <h3 className="text-3xl font-light text-gray-900 mb-2">{user.name} <span className="text-sm font-normal text-gray-400">({user.id})</span></h3>
                                    <p className="text-sm text-gray-600 mb-3">{user.company} · {user.role}</p>
                                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium mt-1">{user.industry}</span>
                                    <button type="button" onClick={() => setIsEditingProfile(true)} className="mt-6 px-5 py-2 border border-blue-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                                        개인정보 수정
                                    </button>
                                    {user.approvalStatus === 'pending' && (
                                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200">
                                            <div className="flex items-start gap-3">
                                                <Icons.Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-sm font-medium text-yellow-900 block mb-1">승인 대기 중</span>
                                                    <p className="text-xs text-yellow-700 leading-relaxed">회원가입 신청이 관리자 승인 대기 중입니다. 승인 후 서비스를 이용하실 수 있습니다.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {user.approvalStatus === 'rejected' && (
                                        <div className="mt-6 p-4 bg-red-50 border border-red-200">
                                            <div className="flex items-start gap-3">
                                                <Icons.X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-sm font-medium text-red-900 block mb-1">승인 거절</span>
                                                    <p className="text-xs text-red-700 leading-relaxed">회원가입 신청이 거절되었습니다. 관리자에게 문의하세요.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* PortOne 본인인증 정보 시각화 */}
                                    {user.isIdentityVerified && (
                                        <div className="mt-6 p-5 bg-green-50 border border-green-200">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-green-600 flex items-center justify-center">
                                                    <Icons.CheckCircle className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-green-900">PortOne 본인인증 완료</h4>
                                                    <p className="text-xs text-green-700 mt-0.5">인증된 개인정보</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div className="bg-white border border-green-100 p-3">
                                                    <div className="text-xs text-gray-500 mb-1">인증된 이름</div>
                                                    <div className="font-medium text-sm text-gray-900">{user.verifiedName || user.name}</div>
                                                </div>
                                                <div className="bg-white border border-green-100 p-3">
                                                    <div className="text-xs text-gray-500 mb-1">인증된 전화번호</div>
                                                    <div className="font-medium text-sm text-gray-900">{user.verifiedPhone || user.phone || '-'}</div>
                                                </div>
                                                {user.verifiedBirthday && (
                                                    <div className="bg-white border border-green-100 p-3">
                                                        <div className="text-xs text-gray-500 mb-1">생년월일</div>
                                                        <div className="font-medium text-sm text-gray-900">
                                                            {user.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')}
                                                        </div>
                                                    </div>
                                                )}
                                                {user.verifiedGender && (
                                                    <div className="bg-white border border-green-100 p-3">
                                                        <div className="text-xs text-gray-500 mb-1">성별</div>
                                                        <div className="font-medium text-sm text-gray-900">{user.verifiedGender === 'M' ? '남성' : '여성'}</div>
                                                    </div>
                                                )}
                                            </div>
                                            {user.impUid && (
                                                <div className="mt-4 pt-4 border-t border-green-200">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-600">인증 거래번호</span>
                                                        <span className="text-xs font-mono text-gray-700 bg-white px-2 py-1 border border-green-100">{user.impUid.substring(0, 12)}...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Fragment>
                            )}
                        </div>
                    </div>
                </div>

                {/* 탭 메뉴 */}
                <div className="border-t border-blue-200 mb-16">
                    <div className="flex gap-8 overflow-x-auto">
                        <button onClick={() => setActiveTab('seminars')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'seminars' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>신청한 모임</button>
                        <button onClick={() => setActiveTab('posts')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'posts' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>내 게시글</button>
                        <button onClick={() => setActiveTab('bookmarks')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'bookmarks' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>즐겨찾기</button>
                        <button onClick={() => setActiveTab('verification')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'verification' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>본인인증 정보</button>
                        {user.hasDonated && (
                            <button onClick={() => setActiveTab('company')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'company' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>회사 소개</button>
                        )}
                    </div>
                </div>

                {/* 탭 컨텐츠 */}
                <div className="min-h-[400px] mb-20">
                    {activeTab === 'seminars' && (
                        <ul className="space-y-3">
                            {mySeminars.length > 0 ? mySeminars.map((s, idx) => (
                                <li key={idx} className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md hover:bg-gray-50 transition-all">
                                    <div>
                                        <div className="font-medium text-gray-900 text-base mb-1">{s.title}</div>
                                        <div className="text-xs text-gray-500">{s.date} · {s.location}</div>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 font-medium">신청완료</span>
                                        <button type="button" onClick={() => {
                                            if(confirm("세미나 신청을 취소하시겠습니까?")) {
                                                if (onCancelSeminar) {
                                                    onCancelSeminar(s.id);
                                                }
                                            }
                                        }} className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1 border border-blue-300 hover:bg-gray-50 transition-colors">취소</button>
                                    </div>
                                </li>
                            )) : <li className="text-center text-gray-500 py-16 text-sm">신청한 모임이 없습니다.</li>}
                        </ul>
                    )}
                    {activeTab === 'posts' && (
                        <ul className="space-y-3">
                            {myPosts.length > 0 ? myPosts.map((p, idx) => (
                                <li key={idx} className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md hover:bg-gray-50 transition-all">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] bg-gray-100 px-2 py-1 text-gray-600 font-medium">{p.category}</span>
                                            <div className="font-medium text-gray-900 text-base">{p.title}</div>
                                        </div>
                                        <div className="text-xs text-gray-500">{p.date}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-3 py-1 font-medium ${p.reply ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-500'}`}>{p.reply ? '답변완료' : '답변대기'}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingPost({
                                                    ...p,
                                                    storeImages: p.storeImages || [],
                                                    itemImages: p.itemImages || [],
                                                    reviewImages: p.reviewImages || p.images || [],
                                                    // 카테고리별 필드도 함께 초기화
                                                    ...(p.category === '인력구인' && {
                                                        jobDetails: p.jobDetails || '',
                                                        recruitCount: p.recruitCount || '',
                                                        workHours: p.workHours || '',
                                                        salary: p.salary || '',
                                                        preferred: p.preferred || '',
                                                        deadline: p.deadline || '',
                                                        storeLocation: p.storeLocation || '',
                                                        storePhone: p.storePhone || ''
                                                    }),
                                                    ...(p.category === '중고거래' && {
                                                        itemName: p.itemName || '',
                                                        itemCategory: p.itemCategory || '',
                                                        price: p.price || '',
                                                        itemCondition: p.itemCondition || '',
                                                        tradeMethod: p.tradeMethod || '',
                                                        tradeLocation: p.tradeLocation || '',
                                                        businessNumber: p.businessNumber || ''
                                                    }),
                                                    ...(p.category === '프로그램 후기' && {
                                                        rating: p.rating || 0,
                                                        seminarId: p.seminarId || null,
                                                        seminarTitle: p.seminarTitle || null
                                                    })
                                                });
                                                setIsEditModalOpen(true);
                                            }}
                                            className="p-2 border border-blue-300 text-gray-600 hover:bg-gray-50 transition-colors"
                                            title="수정"
                                        >
                                            <Icons.Edit size={16} />
                                        </button>
                                    </div>
                                </li>
                            )) : <li className="text-center text-gray-500 py-16 text-sm">작성한 게시글이 없습니다.</li>}
                        </ul>
                    )}
                    {activeTab === 'bookmarks' && (
                        <div>
                            {bookmarksLoading ? (
                                <div className="text-center py-16">
                                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
                                    <p className="text-sm text-gray-500 mt-4">즐겨찾기를 불러오는 중...</p>
                                </div>
                            ) : bookmarkDetails.length > 0 ? (
                                <ul className="space-y-3">
                                    {bookmarkDetails.map((bookmark, idx) => (
                                        <li key={bookmark.id || idx} className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md hover:bg-gray-50 transition-all">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Icons.Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                                    <div className="font-medium text-gray-900 text-base">{bookmark.details?.bidNtceNm || '-'}</div>
                                                </div>
                                                <div className="text-xs text-gray-500 space-y-1">
                                                    <div>공고번호: {bookmark.details?.bidNtceNo || bookmark.bidNtceNo}</div>
                                                    <div>공고기관: {bookmark.details?.ntceInsttNm || '-'}</div>
                                                    <div>게시일시: {bookmark.details?.bidNtceDt || '-'} | 마감일시: {bookmark.details?.bidClseDt || '-'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveBookmark(bookmark.bidNtceNo)}
                                                    className="text-xs text-red-600 hover:text-red-900 px-3 py-1 border border-red-300 hover:bg-red-50 transition-colors"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center text-gray-500 py-16 text-sm">
                                    즐겨찾기한 공고가 없습니다.
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'company' && user.hasDonated && (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 border border-yellow-200 p-8">
                                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                                    <Icons.Star className="w-5 h-5 text-yellow-600" /> 회사 소개 작성
                                </h3>
                                <p className="text-sm text-gray-600 mb-8">후원 회원 전용 기능입니다. 회사를 소개해주세요.</p>
                                
                                {/* 대표 이미지 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">대표 이미지 (1장)</label>
                                    <input
                                        ref={companyMainImageInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleCompanyMainImageChange}
                                    />
                                    {companyIntro.companyMainImage ? (
                                        <div className="relative inline-block">
                                            <img src={companyIntro.companyMainImage} alt="대표 이미지" className="w-full max-w-md h-64 object-cover border border-blue-200 rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={() => setCompanyIntro(prev => ({ ...prev, companyMainImage: '' }))}
                                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                                aria-label="삭제"
                                            >
                                                <Icons.X size={18} />
                                            </button>
                                        </div>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={companyImageUploading}
                                        onClick={() => companyMainImageInputRef.current?.click()}
                                        className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {companyImageUploading ? (
                                            <>
                                                <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                업로드 중...
                                            </>
                                        ) : (
                                            <>
                                                <Icons.Plus size={18} />
                                                대표 이미지 선택
                                            </>
                                        )}
                                    </button>
                                </div>
                                
                                {/* 회사 소개 텍스트 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">회사 소개</label>
                                    <textarea
                                        placeholder="회사에 대한 소개를 작성해주세요"
                                        className="w-full px-4 py-3 border border-blue-300 focus:border-blue-400 focus:outline-none h-32 resize-none text-sm"
                                        value={companyIntro.companyDescription}
                                        onChange={(e) => setCompanyIntro({...companyIntro, companyDescription: e.target.value})}
                                    />
                                </div>
                                
                                {/* 추가 사진 (최대 10장) */}
                                <div className="mb-8">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">추가 사진 (최대 {COMPANY_IMAGES_MAX}장)</label>
                                    <input
                                        ref={companyImagesInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleCompanyImagesChange}
                                    />
                                    <div className="flex flex-wrap gap-3 mb-3">
                                        {(companyIntro.companyImages || []).map((url, idx) => (
                                            <div key={idx} className="relative group">
                                                <img src={url} alt={`추가 사진 ${idx + 1}`} className="w-24 h-24 object-cover rounded-lg border border-blue-200" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCompanyImage(idx)}
                                                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                                    aria-label="삭제"
                                                >
                                                    <Icons.X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={(companyIntro.companyImages?.length || 0) >= COMPANY_IMAGES_MAX || companyImageUploading}
                                        onClick={() => companyImagesInputRef.current?.click()}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Icons.Plus size={18} />
                                        추가 사진
                                    </button>
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const updatedUser = {
                                            ...user,
                                            companyMainImage: companyIntro.companyMainImage,
                                            companyDescription: companyIntro.companyDescription,
                                            companyImages: companyIntro.companyImages.filter(img => img)
                                        };
                                        await onUpdateProfile(updatedUser);
                                        alert('회사 소개가 저장되었습니다.');
                                    }}
                                    className="w-full py-3 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                                >
                                    저장하기
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'verification' && (
                        <div className="space-y-8">
                            {user.isIdentityVerified ? (
                                <Fragment>
                                    {/* 인증 상태 카드 */}
                                    <div className="bg-green-50 border border-green-200 p-8">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 bg-green-600 flex items-center justify-center">
                                                <Icons.CheckCircle className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-light text-gray-900 mb-1">본인인증 완료</h3>
                                                <p className="text-sm text-gray-600">PortOne을 통한 본인인증이 완료되었습니다</p>
                                            </div>
                                        </div>
                                        {user.impUid && (
                                            <div className="bg-white border border-green-100 p-4 mt-4">
                                                <div className="text-xs text-gray-600 mb-1">인증 거래 고유번호</div>
                                                <div className="font-mono text-sm text-gray-900">{user.impUid}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 인증 정보 상세 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 border border-blue-200 p-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Icons.Users className="w-5 h-5 text-gray-600" />
                                                <h4 className="text-sm font-medium text-gray-900">인증된 이름</h4>
                                            </div>
                                            <div className="text-2xl font-light text-gray-900">{user.verifiedName || user.name}</div>
                                            <div className="text-xs text-gray-500 mt-3">PortOne 본인인증으로 확인된 이름</div>
                                        </div>

                                        <div className="bg-gray-50 border border-blue-200 p-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Icons.Phone className="w-5 h-5 text-gray-600" />
                                                <h4 className="text-sm font-medium text-gray-900">인증된 전화번호</h4>
                                            </div>
                                            <div className="text-xl font-light text-gray-900">{user.verifiedPhone || user.phone || '-'}</div>
                                            <div className="text-xs text-gray-500 mt-3">본인인증으로 확인된 전화번호</div>
                                        </div>

                                        {user.verifiedBirthday && (
                                            <div className="bg-gray-50 border border-blue-200 p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Icons.Calendar className="w-5 h-5 text-gray-600" />
                                                    <h4 className="text-sm font-medium text-gray-900">생년월일</h4>
                                                </div>
                                                <div className="text-xl font-light text-gray-900">
                                                    {user.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-3">본인인증으로 확인된 생년월일</div>
                                            </div>
                                        )}

                                        {user.verifiedGender && (
                                            <div className="bg-gray-50 border border-blue-200 p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Icons.Users className="w-5 h-5 text-gray-600" />
                                                    <h4 className="text-sm font-medium text-gray-900">성별</h4>
                                                </div>
                                                <div className="text-xl font-light text-gray-900">{user.verifiedGender === 'M' ? '남성' : '여성'}</div>
                                                <div className="text-xs text-gray-500 mt-3">본인인증으로 확인된 성별</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 인증 일시 */}
                                    {user.createdAt && (
                                        <div className="bg-gray-50 border border-blue-200 p-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs text-gray-600 mb-2">인증 완료 일시</div>
                                                    <div className="text-base font-medium text-gray-900">
                                                        {new Date(user.createdAt).toLocaleString('ko-KR', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                <Icons.CheckCircle className="w-8 h-8 text-gray-400" />
                                            </div>
                                        </div>
                                    )}
                                </Fragment>
                            ) : (
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center mx-auto mb-6">
                                        <Icons.Info className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-light text-gray-900 mb-2">본인인증이 필요합니다</h3>
                                    <p className="text-sm text-gray-600 mb-8">PortOne 본인인증을 통해 개인정보를 확인해주세요</p>
                                    <div className="bg-yellow-50 border border-yellow-200 p-6 max-w-md mx-auto">
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            본인인증은 회원가입 시 자동으로 진행됩니다.<br/>
                                            인증 정보는 안전하게 보관되며, 서비스 이용을 위해 필수입니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="border-t border-blue-200 pt-10 text-center">
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWithdrawClick(); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">회원 탈퇴하기</button>
                </div>
            </div>

            {/* 게시글 수정 모달 (ESC 미적용) */}
            {isEditModalOpen && editingPost ? (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) { setIsEditModalOpen(false); setEditingPost(null); } }}>
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 max-w-3xl w-full flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                            <h3 className="text-2xl font-bold text-dark mb-6">게시글 수정</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">제목 *</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 border border-blue-300 focus:border-blue-400 focus:outline-none text-sm" 
                                    value={editingPost.title || ''} 
                                    onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">내용 *</label>
                                <textarea 
                                    className="w-full px-4 py-3 border border-blue-300 focus:border-blue-400 focus:outline-none h-48 resize-none text-sm" 
                                    value={editingPost.content || ''} 
                                    onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} 
                                />
                            </div>
                            
                            {/* 이미지 수정 섹션 */}
                            {editingPost.category === '인력구인' && editingPost.storeImages !== undefined ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">매장 사진 (최대 10장)</label>
                                    <div className="flex gap-4 flex-wrap">
                                        {(editingPost.storeImages || []).map((img, idx) => (
                                            <div key={idx} className="relative">
                                                <img src={img} alt={`매장 사진 ${idx + 1}`} className="w-32 h-32 object-cover border border-blue-200" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        const newImages = [...(editingPost.storeImages || [])];
                                                        newImages.splice(idx, 1);
                                                        setEditingPost({...editingPost, storeImages: newImages});
                                                    }} 
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 text-white flex items-center justify-center text-xs hover:bg-gray-700"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {(editingPost.storeImages || []).length < 10 ? (
                                            <label className="w-32 h-32 border border-dashed border-blue-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
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
                                                        const currentImages = editingPost.storeImages || [];
                                                        if (currentImages.length + files.length > 10) {
                                                            alert(`최대 10장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
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
                                        {(editingPost.itemImages || []).length < 10 ? (
                                            <label className="w-32 h-32 border border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                        if (files.length + (editingPost.itemImages || []).length > 10) {
                                                            alert('최대 10장까지만 선택할 수 있습니다.');
                                                            return;
                                                        }
                                                        const currentImages = editingPost.itemImages || [];
                                                        if (currentImages.length + files.length > 10) {
                                                            alert(`최대 10장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
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
                                        {((editingPost.reviewImages || editingPost.images || []).length < 10) ? (
                                            <label className="w-32 h-32 border border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
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
                                                        if (files.length + ((editingPost.reviewImages || editingPost.images || []).length) > 10) {
                                                            alert('최대 10장까지만 선택할 수 있습니다.');
                                                            return;
                                                        }
                                                        const currentImages = editingPost.reviewImages || editingPost.images || [];
                                                        if (currentImages.length + files.length > 10) {
                                                            alert(`최대 10장까지만 업로드할 수 있습니다. (현재 ${currentImages.length}장)`);
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
                                onClick={async () => {
                                    if (onUpdatePost) {
                                        await onUpdatePost(editingPost.id, editingPost);
                                        setIsEditModalOpen(false);
                                        setEditingPost(null);
                                    } else {
                                        alert('게시글 수정 기능이 준비되지 않았습니다.');
                                    }
                                }} 
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
        </div>
    );
};

export default MyPageView;
