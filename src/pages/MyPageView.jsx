import React, { useState, Fragment, useEffect, useCallback, useRef } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import { uploadImage, uploadImageWithMeta, getDisplayImageUrl } from '../utils/imageUtils';
import { firebaseService } from '../services/firebaseService';
import ModalPortal from '../components/ModalPortal';
import { openDaumPostcode } from '../utils/daumPostcode';

// 회원가입 페이지와 동일한 상수·헬퍼 (회원정보 수정 폼 일치용)
const normalizePhone = (p) => (p || '').replace(/\D/g, '');
const EMAIL_DOMAINS = ['naver.com', 'daum.net', 'gmail.com', 'kakao.com', 'nate.com', 'hanmail.net', 'yahoo.co.kr', '직접입력'];
const BUSINESS_CATEGORIES = [
    '식품제조업', '의류제조업', '화학제조업', '전자제품제조업', '기계제조업', '기타 제조업',
    '도매업', '소매업', '온라인 쇼핑몰', '편의점/마트',
    'IT/소프트웨어', '웹/앱 개발', '디자인/광고', '컨설팅', '교육/학원', '의료/병원', '미용/네일',
    '요식업 (한식)', '요식업 (양식)', '요식업 (중식)', '요식업 (일식)', '요식업 (카페)',
    '숙박업', '운송업', '부동산', '법률/회계', '기타 서비스업',
    '건설업', '인테리어', '토목공사', '농업', '축산업', '임업', '어업', '기타 사업',
];
const BUSINESS_DOC_MAX_SIZE = 600 * 1024;

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
const composeEmail = (id, domain, custom) => {
    const i = (id || '').trim();
    const d = domain === '직접입력' ? (custom || '').trim() : (domain || '');
    if (!i || !d) return '';
    return `${i}@${d}`;
};
const validatePhone = (phone) => {
    const cleaned = (phone || '').replace(/[^0-9]/g, '');
    return cleaned.length === 11 && /^01[0-9][0-9]{8}$/.test(cleaned);
};
const parseBirthdateInput = (value) => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
        const yyyy = digitsOnly.slice(0, 4), mm = digitsOnly.slice(4, 6), dd = digitsOnly.slice(6, 8);
        const y = parseInt(yyyy, 10), m = parseInt(mm, 10), d = parseInt(dd, 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return trimmed;
    }
    return value;
};
/** user 객체로 수정 폼 초기값 생성 (이메일 id/도메인 분리) */
function getInitialEditForm(user) {
    const u = user || {};
    const email = (u.email || '').trim();
    let emailId = '', emailDomain = 'naver.com', emailDomainCustom = '';
    if (email && email.includes('@')) {
        const [id, domain] = email.split('@');
        emailId = id || '';
        emailDomain = EMAIL_DOMAINS.includes(domain) ? domain : '직접입력';
        if (emailDomain === '직접입력') emailDomainCustom = domain || '';
    }
    return {
        name: u.name || '',
        nickname: u.nickname || '',
        birthdate: u.birthdate || '',
        gender: u.gender || '',
        phone: (u.phone || u.phoneNumber || '').replace(/\D/g, '').slice(0, 11),
        phonePublic: u.phonePublic ?? false,
        email: email,
        emailId,
        emailDomain,
        emailDomainCustom,
        company: u.company || '',
        companyPhone: u.companyPhone || '',
        companyWebsite: u.companyWebsite || '',
        businessRegistrationNumber: (u.businessRegistrationNumber || '').replace(/\D/g, '').slice(0, 10),
        position: u.position || u.role || '',
        businessCategory: u.businessCategory || u.industry || '',
        collaborationIndustry: u.collaborationIndustry || '',
        keyCustomers: u.keyCustomers || '',
        desiredIndustry: u.desiredIndustry || '',
        businessRegistrationDoc: u.businessRegistrationDoc || '',
        businessRegistrationFileName: u.businessRegistrationFileName || '',
        roadAddress: u.roadAddress || '',
        detailAddress: u.detailAddress || '',
        zipCode: u.zipCode || '',
        img: u.img || '',
    };
}

/** 세미나 날짜 문자열을 날짜(자정) 타임스탬프로 변환 */
const parseSeminarDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = String(dateStr).trim().split(/[\sT]/)[0].replace(/-/g, '.').replace(/\//g, '.');
    const parts = trimmed.split('.');
    if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
            const date = new Date(y, m, d);
            return date.getTime();
        }
    }
    return null;
};
const getTodayStart = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
};

const MyPageView = ({ onBack, user, mySeminars, myApplications = [], onUpdateApplication, myPosts, onWithdraw, onUpdateProfile, onCancelSeminar, onWithdrawApplicationRecord, onWriteReview, pageTitles, onUpdatePost }) => {
    const [activeTab, setActiveTab] = useState('seminars');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [editingApplication, setEditingApplication] = useState(null); // { seminar, application } 신청 내용 정정 모달
    const [uploadingImages, setUploadingImages] = useState(false);
    const [profileImageUploading, setProfileImageUploading] = useState(false);
    const [editFormData, setEditFormData] = useState(() => getInitialEditForm(user));
    const [profileEditError, setProfileEditError] = useState('');
    const [editUserType, setEditUserType] = useState(user?.userType || '');

    // 알림 (관리자 정정 등)
    const [notifications, setNotifications] = useState([]);

    // 알림 구독 (관리자 정정 알림 등)
    useEffect(() => {
        const userId = user?.id ?? user?.uid;
        if (!user || !userId || !firebaseService.subscribeUserNotifications) return;
        const unsubscribe = firebaseService.subscribeUserNotifications(userId, (list) => {
            setNotifications(list || []);
        });
        return () => unsubscribe();
    }, [user?.id, user?.uid]);

    useEffect(() => {
        if (user && !isEditingProfile) {
            setEditFormData(getInitialEditForm(user));
            setEditUserType(user.userType || '');
        }
    }, [user?.id, user?.uid, isEditingProfile]);

    const handleWithdrawClick = () => {
        if(confirm("정말로 탈퇴하시겠습니까? 모든 정보가 삭제됩니다.")) {
            onWithdraw();
        }
    };

    const handleNotificationConfirm = async (notificationId) => {
        const userId = user?.id ?? user?.uid;
        if (!userId) return;
        try {
            await firebaseService.markNotificationRead(userId, notificationId);
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
        } catch (err) {
            console.error('알림 확인 처리 오류:', err);
        }
    };

    const businessNumberDigits = (editFormData.businessRegistrationNumber || '').replace(/\D/g, '');
    const isBusinessNumberValid = businessNumberDigits.length === 10;

    const handleSaveProfile = async () => {
        setProfileEditError('');
        const email = composeEmail(editFormData.emailId, editFormData.emailDomain, editFormData.emailDomainCustom);
        const normalizedBirthdate = parseBirthdateInput(editFormData.birthdate);

        if (!editFormData.name?.trim()) {
            setProfileEditError('이름을 입력해주세요.');
            return;
        }
        if (!normalizedBirthdate) {
            setProfileEditError('생년월일을 YYYY-MM-DD 형식으로 입력해주세요.');
            return;
        }
        if (!editFormData.gender) {
            setProfileEditError('성별을 선택해주세요.');
            return;
        }
        if (!validatePhone(editFormData.phone)) {
            setProfileEditError('연락처는 010 등 11자리 숫자로 입력해주세요.');
            return;
        }
        if (!validateEmail(email)) {
            setProfileEditError('올바른 이메일 형식을 입력해주세요.');
            return;
        }
        if (!(editFormData.roadAddress || '').trim()) {
            setProfileEditError('주소를 입력해주세요. 주소 검색 버튼으로 도로명 주소를 선택해주세요.');
            return;
        }
        if (editUserType === '사업자') {
            if (!editFormData.company?.trim()) {
                setProfileEditError('상호명을 입력해주세요.');
                return;
            }
            if (!isBusinessNumberValid) {
                setProfileEditError('사업자등록번호 10자리 숫자를 입력해주세요.');
                return;
            }
            if (!editFormData.businessCategory) {
                setProfileEditError('업종/업태를 선택해주세요.');
                return;
            }
            if (!editFormData.collaborationIndustry?.trim()) {
                setProfileEditError('협업 업종을 입력해주세요.');
                return;
            }
            if (!editFormData.keyCustomers?.trim()) {
                setProfileEditError('핵심고객을 입력해주세요.');
                return;
            }
        }
        if (!onUpdateProfile) {
            alert("프로필 수정 기능이 준비되지 않았습니다.");
            return;
        }

        const updatedData = {
            name: editFormData.name.trim(),
            nickname: (editFormData.nickname || '').trim(),
            birthdate: normalizedBirthdate,
            gender: editFormData.gender || '',
            phone: editFormData.phone.trim(),
            phonePublic: !!editFormData.phonePublic,
            email: email.trim(),
            userType: editUserType,
            img: editFormData.img || user?.img || '',
            company: editUserType === '사업자' ? (editFormData.company || '').trim() : '',
            companyPhone: editUserType === '사업자' ? (editFormData.companyPhone || '').trim() : '',
            companyWebsite: editUserType === '사업자' ? (editFormData.companyWebsite || '').trim() : '',
            businessRegistrationNumber: editUserType === '사업자' ? businessNumberDigits : '',
            position: editUserType === '사업자' ? (editFormData.position || '').trim() : '',
            role: editUserType === '사업자' ? (editFormData.position || '').trim() : '',
            businessCategory: editUserType === '사업자' ? editFormData.businessCategory : '',
            industry: editUserType === '사업자' ? editFormData.businessCategory : '',
            collaborationIndustry: editUserType === '사업자' ? (editFormData.collaborationIndustry || '').trim() : '',
            keyCustomers: editUserType === '사업자' ? (editFormData.keyCustomers || '').trim() : '',
            desiredIndustry: editUserType === '예창' ? (editFormData.desiredIndustry || '').trim() : '',
            businessRegistrationDoc: editUserType === '사업자' ? (editFormData.businessRegistrationDoc || '') : '',
            businessRegistrationFileName: editUserType === '사업자' ? (editFormData.businessRegistrationFileName || '') : '',
            roadAddress: (editFormData.roadAddress || '').trim(),
            detailAddress: (editFormData.detailAddress || '').trim(),
            zipCode: (editFormData.zipCode || '').trim(),
        };
        await onUpdateProfile(updatedData);
        setIsEditingProfile(false);
        setProfileEditError('');
    };

    const handleBusinessDocChange = (e) => {
        const file = e.target?.files?.[0];
        if (!file) {
            setEditFormData(f => ({ ...f, businessRegistrationDoc: '', businessRegistrationFileName: '' }));
            return;
        }
        if (file.size > BUSINESS_DOC_MAX_SIZE) {
            alert(`사업자등록증 파일 크기는 ${Math.round(BUSINESS_DOC_MAX_SIZE / 1024)}KB 이하여야 합니다.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditFormData(f => ({ ...f, businessRegistrationDoc: reader.result || '', businessRegistrationFileName: file.name }));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type?.startsWith('image/')) return;
        if (file.size > 1024 * 1024) {
            alert("이미지 크기는 1MB 이하로 제한됩니다.");
            return;
        }
        setProfileImageUploading(true);
        try {
            const url = await uploadImage(file, 'company');
            setEditFormData(prev => ({ ...prev, img: url }));
        } catch (err) {
            console.error(err);
            alert(err?.message || '프로필 사진 업로드에 실패했습니다.');
        } finally {
            setProfileImageUploading(false);
        }
    };

    return (
        <div className="pt-32 pb-20 px-6 md:px-8 min-h-screen bg-white animate-fade-in overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-5xl">
                {/* 헤더 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
                    <div className="w-full text-center md:text-left">
                        <PageTitle pageKey="myPage" pageTitles={pageTitles} defaultText="마이페이지" />
                        <p className="text-sm text-gray-500 mt-2">회원 정보와 활동 내역을 확인하세요</p>
                    </div>
                    <div className="w-full flex justify-end md:justify-start">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-gray-600 text-sm border border-blue-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <Icons.ArrowLeft size={18} /> 메인으로
                        </button>
                    </div>
                </div>

                {/* 알림 (관리자 정정 등) */}
                {notifications.filter(n => !n.read).length > 0 && (
                    <div className="mb-6 space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Icons.AlertCircle size={18} /> 알림
                        </h3>
                        {notifications.filter(n => !n.read).map((n) => (
                            <div key={n.id} className="flex items-start justify-between gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                <p className="text-sm text-gray-800 flex-1">{n.message || '회원정보가 정정되었습니다.'}</p>
                                <button type="button" onClick={() => handleNotificationConfirm(n.id)} className="shrink-0 px-3 py-1.5 text-sm font-bold text-brand border border-brand rounded-lg hover:bg-brand/5">
                                    확인
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* 프로필 섹션 */}
                <div className="bg-gray-50 border border-blue-100 p-10 mb-20">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-5xl overflow-hidden border border-blue-300">
                                {profileImageUploading ? (
                                    <span className="text-xs text-gray-500 px-2 text-center">업로드 중...</span>
                                ) : editFormData.img ? (
                                    <img src={editFormData.img} className="w-full h-full object-cover" loading="lazy" decoding="async" alt="프로필" />
                                ) : (
                                    "👤"
                                )}
                            </div>
                            {isEditingProfile && !profileImageUploading && (
                                <label className="absolute bottom-0 right-0 w-10 h-10 bg-gray-800 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors border-2 border-white">
                                    <Icons.Camera size={18} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>
                        <div className="flex-1">
                            {isEditingProfile ? (
                                <div className="w-full max-w-2xl">
                                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                            <Icons.AlertCircle className="w-5 h-5 shrink-0" />
                                            표시(*)된 항목은 필수입니다. 회원가입 시와 동일한 항목을 수정할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">회원 유형 <span className="text-red-500">*</span></label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button type="button" onClick={() => setEditUserType('사업자')} className={`p-4 rounded-xl border-2 text-left transition-all ${editUserType === '사업자' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50'}`}>
                                                    <span className="font-bold text-dark">사업자</span>
                                                    <p className="text-xs text-gray-500 mt-1">현재 사업을 운영 중이신 분</p>
                                                </button>
                                                <button type="button" onClick={() => setEditUserType('예창')} className={`p-4 rounded-xl border-2 text-left transition-all ${editUserType === '예창' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50'}`}>
                                                    <span className="font-bold text-dark">예비창업자</span>
                                                    <p className="text-xs text-gray-500 mt-1">창업을 준비 중이신 분</p>
                                                </button>
                                            </div>
                                        </div>
                                        {editUserType && (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                                                        <input type="text" required placeholder="이름 입력" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.name} onChange={e => setEditFormData(f => ({ ...f, name: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">닉네임 <span className="text-gray-400 text-xs">(선택)</span></label>
                                                        <input type="text" placeholder="닉네임 입력" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.nickname} onChange={e => setEditFormData(f => ({ ...f, nickname: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">생년월일 <span className="text-red-500">*</span></label>
                                                        <input type="text" inputMode="numeric" placeholder="YYYY-MM-DD (예: 1990-01-15)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.birthdate} onChange={e => { const v = e.target.value; const parsed = parseBirthdateInput(v); setEditFormData(f => ({ ...f, birthdate: parsed || v })); }} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">성별 <span className="text-red-500">*</span></label>
                                                        <select required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white" value={editFormData.gender} onChange={e => setEditFormData(f => ({ ...f, gender: e.target.value }))}>
                                                            <option value="">선택</option>
                                                            <option value="남성">남성</option>
                                                            <option value="여성">여성</option>
                                                            <option value="기타">기타</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">연락처 <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(숫자 11자리)</span></label>
                                                        <input type="tel" inputMode="numeric" placeholder="01012345678" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.phone} onChange={e => { const raw = e.target.value.replace(/\D/g, ''); setEditFormData(f => ({ ...f, phone: raw.length > 11 ? raw.slice(0, 11) : raw })); }} maxLength={11} />
                                                        {editFormData.phone && editFormData.phone.length === 11 && !validatePhone(editFormData.phone) && <p className="text-xs text-red-500 mt-1">010, 011 등으로 시작하는 11자리 번호를 입력해주세요.</p>}
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <input type="checkbox" id="mypage-phonePublic" checked={editFormData.phonePublic} onChange={e => setEditFormData(f => ({ ...f, phonePublic: e.target.checked }))} className="w-5 h-5 text-brand rounded focus:ring-brand" />
                                                            <label htmlFor="mypage-phonePublic" className="text-sm text-gray-700 cursor-pointer">회원명단에서 연락처 공개</label>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            <input type="text" inputMode="email" placeholder="example" className="flex-1 min-w-[100px] p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.emailId} onChange={e => setEditFormData(f => ({ ...f, emailId: e.target.value, email: composeEmail(e.target.value, f.emailDomain, f.emailDomainCustom) }))} />
                                                            <span className="text-slate-500">@</span>
                                                            <select className="p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white" value={editFormData.emailDomain} onChange={e => setEditFormData(f => ({ ...f, emailDomain: e.target.value, email: composeEmail(f.emailId, e.target.value, f.emailDomainCustom) }))}>
                                                                {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                            {editFormData.emailDomain === '직접입력' && (
                                                                <input type="text" placeholder="도메인 입력" className="flex-1 min-w-[120px] p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.emailDomainCustom} onChange={e => setEditFormData(f => ({ ...f, emailDomainCustom: e.target.value, email: composeEmail(f.emailId, f.emailDomain, e.target.value) }))} />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">주소 <span className="text-red-500">*</span></label>
                                                        <div className="space-y-2">
                                                            <div className="flex gap-2">
                                                                <input type="text" readOnly placeholder="도로명 주소 검색" className="flex-1 p-3 border border-blue-200 rounded-xl bg-gray-50 text-sm cursor-pointer" value={editFormData.roadAddress} onClick={() => openDaumPostcode((data) => { if (data?.roadAddress) setEditFormData(f => ({ ...f, roadAddress: data.roadAddress, zipCode: data.zipCode || '' })); })} />
                                                                <button type="button" onClick={() => openDaumPostcode((data) => { if (data?.roadAddress) setEditFormData(f => ({ ...f, roadAddress: data.roadAddress, zipCode: data.zipCode || '' })); })} className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap flex items-center gap-1">
                                                                    <Icons.MapPin size={16} /> 주소 검색
                                                                </button>
                                                            </div>
                                                            {editFormData.zipCode ? <p className="text-xs text-gray-500">우편번호: {editFormData.zipCode}</p> : null}
                                                            <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none text-sm" value={editFormData.detailAddress} onChange={e => setEditFormData(f => ({ ...f, detailAddress: e.target.value }))} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {editUserType === '사업자' && (
                                                    <div className="space-y-5 pt-2">
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">상호명 <span className="text-red-500">*</span></label>
                                                            <input type="text" required placeholder="회사 또는 사업체 이름" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.company} onChange={e => setEditFormData(f => ({ ...f, company: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록번호 <span className="text-red-500">*</span></label>
                                                            <input type="text" inputMode="numeric" maxLength={10} placeholder="숫자 10자리 (예: 1234567890)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.businessRegistrationNumber} onChange={e => setEditFormData(f => ({ ...f, businessRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                                                            {editFormData.businessRegistrationNumber && !isBusinessNumberValid && <p className="text-xs text-red-500 mt-1">숫자 10자리를 입력해주세요.</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">직책/직함 <span className="text-gray-400 text-xs">(선택)</span></label>
                                                            <input type="text" placeholder="예: 대표, 이사, 팀장" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.position} onChange={e => setEditFormData(f => ({ ...f, position: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">회사 전화번호 <span className="text-gray-400 text-xs">(선택, 기입 시 회원명단에 노출)</span></label>
                                                            <input type="tel" inputMode="numeric" placeholder="예: 02-1234-5678, 031-123-4567" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.companyPhone} onChange={e => setEditFormData(f => ({ ...f, companyPhone: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">사이트 <span className="text-gray-400 text-xs">(선택, 기입 시 회원명단에서 노출)</span></label>
                                                            <input type="url" placeholder="https://www.example.com" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.companyWebsite || ''} onChange={e => setEditFormData(f => ({ ...f, companyWebsite: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">업종 / 업태 <span className="text-red-500">*</span></label>
                                                            <select required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white" value={editFormData.businessCategory} onChange={e => setEditFormData(f => ({ ...f, businessCategory: e.target.value }))}>
                                                                <option value="">선택</option>
                                                                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록증 <span className="text-gray-400 text-xs">(선택)</span></label>
                                                            <input type="file" accept="image/*,.pdf,application/pdf" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand file:text-white file:font-medium file:text-sm" onChange={handleBusinessDocChange} />
                                                            {editFormData.businessRegistrationFileName && <p className="text-xs text-gray-500 mt-1">등록됨: {editFormData.businessRegistrationFileName}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">협업 업종 <span className="text-red-500">*</span></label>
                                                            <input type="text" required placeholder="협업 희망 업종" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.collaborationIndustry} onChange={e => setEditFormData(f => ({ ...f, collaborationIndustry: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">핵심고객 <span className="text-red-500">*</span></label>
                                                            <input type="text" required placeholder="핵심 고객층" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.keyCustomers} onChange={e => setEditFormData(f => ({ ...f, keyCustomers: e.target.value }))} />
                                                        </div>
                                                    </div>
                                                )}
                                                {editUserType === '예창' && (
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">희망업종 <span className="text-gray-400 text-xs">(선택)</span></label>
                                                        <input type="text" placeholder="희망 업종 또는 분야" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={editFormData.desiredIndustry} onChange={e => setEditFormData(f => ({ ...f, desiredIndustry: e.target.value }))} />
                                                    </div>
                                                )}
                                                {profileEditError && <p className="text-sm text-red-600 font-medium">{profileEditError}</p>}
                                                <div className="flex gap-3 pt-4">
                                                    <button type="button" onClick={() => { setIsEditingProfile(false); setEditFormData(getInitialEditForm(user)); setEditUserType(user?.userType || ''); setProfileEditError(''); }} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">취소</button>
                                                    <button type="button" onClick={handleSaveProfile} className="flex-1 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">저장</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <Fragment>
                                    <h3 className="text-3xl font-light text-gray-900 mb-2">{user.name}</h3>
                                    <p className="text-sm text-gray-600 mb-3">{user.company || ''} {user.company && (user.position || user.role) ? '·' : ''} {user.position || user.role || ''}</p>
                                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium mt-1">{user.industry || user.businessCategory || ''}</span>
                                    <button type="button" onClick={() => { setEditFormData(getInitialEditForm(user)); setEditUserType(user?.userType || (user?.company || user?.businessRegistrationNumber ? '사업자' : '예창')); setProfileEditError(''); setIsEditingProfile(true); }} className="mt-6 px-5 py-2 border border-blue-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
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
                        <button onClick={() => setActiveTab('verification')} className={`px-1 py-4 text-sm font-medium transition-colors border-t-2 whitespace-nowrap -mt-[1px] ${activeTab === 'verification' ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>본인인증 정보</button>
                    </div>
                </div>

                {/* 탭 컨텐츠 */}
                <div className="min-h-[400px] mb-20">
                    {activeTab === 'seminars' && (() => {
                        const categories = [
                            { key: '교육/세미나', label: '교육·세미나' },
                            { key: '네트워킹 모임', label: '네트워킹 모임' },
                            { key: '커피챗', label: '커피챗' },
                            { key: '', label: '기타' }
                        ];
                        const appForSeminar = (seminar) => (myApplications || []).find((a) => String(a.seminarId) === String(seminar.id));
                        const isSeminarEnded = (seminar) => {
                            const ts = parseSeminarDate(seminar?.date);
                            return ts != null && ts < getTodayStart();
                        };
                        const renderItem = (s, idx) => {
                            const app = appForSeminar(s);
                            const ended = isSeminarEnded(s);
                            return (
                                <li key={s.id || idx} className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md hover:bg-gray-50 transition-all">
                                    <div>
                                        <div className="font-medium text-gray-900 text-base mb-1">{s.title}</div>
                                        <div className="text-xs text-gray-500">{s.date} · {s.location}</div>
                                    </div>
                                    <div className="flex gap-3 items-center flex-wrap justify-end">
                                        <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 font-medium">신청완료</span>
                                        {app?.id && onUpdateApplication ? (
                                            <button
                                                type="button"
                                                onClick={() => setEditingApplication({ seminar: s, application: app })}
                                                className="text-xs text-brand hover:text-blue-700 px-3 py-1 border border-brand hover:bg-blue-50 transition-colors font-medium"
                                            >
                                                신청 내용 정정
                                            </button>
                                        ) : null}
                                        {ended && onWriteReview ? (
                                            <button
                                                type="button"
                                                onClick={() => onWriteReview(s)}
                                                className="text-xs text-emerald-700 hover:text-emerald-800 px-3 py-1 border border-emerald-400 hover:bg-emerald-50 transition-colors font-medium"
                                            >
                                                후기 작성
                                            </button>
                                        ) : null}
                                        {!ended && onCancelSeminar && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm('신청을 취소합니다.\n유료 프로그램은 결제 취소(환불)를 함께 요청합니다.\n이미 결제만 취소하신 경우에는 옆의 「신청 기록 삭제」를 이용해 주세요.')) {
                                                        onCancelSeminar(s.id);
                                                    }
                                                }}
                                                className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1 border border-blue-300 hover:bg-gray-50 transition-colors"
                                            >
                                                신청 취소
                                            </button>
                                        )}
                                        {!ended && onWithdrawApplicationRecord && (
                                            <button
                                                type="button"
                                                title="포트원·카드사에서 결제 취소를 이미 마친 뒤, 사이트에 남은 신청만 지울 때 사용"
                                                onClick={() => onWithdrawApplicationRecord(s.id)}
                                                className="text-xs text-amber-800 hover:text-amber-900 px-3 py-1 border border-amber-300 bg-amber-50/80 hover:bg-amber-100 transition-colors font-medium"
                                            >
                                                신청 기록 삭제
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        };
                        if (mySeminars.length === 0) {
                            return <ul className="space-y-3"><li className="text-center text-gray-500 py-16 text-sm">신청한 모임이 없습니다.</li></ul>;
                        }
                        return (
                            <div className="space-y-10">
                                {categories.map(({ key, label }) => {
                                    const items = mySeminars.filter((s) => (s.category || '') === key);
                                    if (items.length === 0) return null;
                                    return (
                                        <div key={key || 'other'}>
                                            <h4 className="text-lg font-bold text-dark mb-4">{label}</h4>
                                            <ul className="space-y-3">
                                                {items.map((s, idx) => renderItem(s, idx))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
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
                    <p className="text-xs text-gray-500 mb-2">자진 탈퇴 시 언제든 재가입할 수 있습니다. (강제 탈퇴 시 1년간 재가입 제한·이용약관 제6조의2)</p>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWithdrawClick(); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">회원 탈퇴하기</button>
                </div>
            </div>

            {/* 게시글 수정 모달 (ESC 미적용) */}
            {isEditModalOpen && editingPost ? (
                <ModalPortal>
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
                                                <img src={getDisplayImageUrl(img)} alt={`매장 사진 ${idx + 1}`} className="w-32 h-32 object-cover border border-blue-200" loading="lazy" decoding="async" />
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
                                                        try {
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const meta = await uploadImageWithMeta(file, 'community');
                                                                    if (meta.deleteUrl) return { url: meta.url, deleteUrl: meta.deleteUrl };
                                                                    return meta.url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter((u) => u !== null);
                                                            setEditingPost({...editingPost, storeImages: [...currentImages, ...uploadedUrls]});
                                                        } finally {
                                                            setUploadingImages(false);
                                                        }
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
                                                <img src={getDisplayImageUrl(img)} alt={`제품 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" loading="lazy" decoding="async" />
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
                                                        try {
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const meta = await uploadImageWithMeta(file, 'community');
                                                                    if (meta.deleteUrl) return { url: meta.url, deleteUrl: meta.deleteUrl };
                                                                    return meta.url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter((u) => u !== null);
                                                            setEditingPost({...editingPost, itemImages: [...currentImages, ...uploadedUrls]});
                                                        } finally {
                                                            setUploadingImages(false);
                                                        }
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
                                                <img src={getDisplayImageUrl(img)} alt={`후기 사진 ${idx + 1}`} className="w-32 h-32 object-cover rounded-xl border border-blue-200" loading="lazy" decoding="async" />
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
                                                        try {
                                                            const uploadPromises = files.map(async (file) => {
                                                                try {
                                                                    if (!file.type.startsWith('image/')) return null;
                                                                    const meta = await uploadImageWithMeta(file, 'community');
                                                                    if (meta.deleteUrl) return { url: meta.url, deleteUrl: meta.deleteUrl };
                                                                    return meta.url;
                                                                } catch (error) {
                                                                    alert(`${file.name} 업로드에 실패했습니다.`);
                                                                    return null;
                                                                }
                                                            });
                                                            const uploadedUrls = (await Promise.all(uploadPromises)).filter((u) => u !== null);
                                                            setEditingPost({...editingPost, reviewImages: [...currentImages, ...uploadedUrls], images: [...currentImages, ...uploadedUrls]});
                                                        } finally {
                                                            setUploadingImages(false);
                                                        }
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
                </ModalPortal>
            ) : null}

            {/* 신청 내용 정정 모달 */}
            {editingApplication && (
                <ApplicationEditModal
                    seminar={editingApplication.seminar}
                    application={editingApplication.application}
                    onClose={() => setEditingApplication(null)}
                    onSave={async (payload) => {
                        if (!onUpdateApplication || !editingApplication.application?.id) return;
                        await onUpdateApplication(editingApplication.application.id, payload);
                        setEditingApplication(null);
                        alert('신청 내용이 정정되었습니다.');
                    }}
                />
            )}
        </div>
    );
};

/** 신청 내용 정정 모달 (참여 경로, 신청 계기, 사전 질문, 식사 여부, 개인정보 동의) */
function ApplicationEditModal({ seminar, application, onClose, onSave }) {
    const [participationPath, setParticipationPath] = useState(application?.participationPath ?? '');
    const [applyReason, setApplyReason] = useState(application?.applyReason ?? '');
    const [preQuestions, setPreQuestions] = useState(application?.preQuestions ?? '');
    const [mealAfter, setMealAfter] = useState(application?.mealAfter ?? '');
    const [privacyAgreed, setPrivacyAgreed] = useState(application?.privacyAgreed === true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setParticipationPath(application?.participationPath ?? '');
        setApplyReason(application?.applyReason ?? '');
        setPreQuestions(application?.preQuestions ?? '');
        setMealAfter(application?.mealAfter ?? '');
        setPrivacyAgreed(application?.privacyAgreed === true);
    }, [application?.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                participationPath: participationPath.trim(),
                applyReason: applyReason.trim(),
                preQuestions: preQuestions.trim(),
                mealAfter: mealAfter.trim(),
                privacyAgreed: !!privacyAgreed,
                reason: [participationPath.trim(), applyReason.trim()].filter(Boolean).join(' / ') || '',
                questions: preQuestions.trim() ? [preQuestions.trim()] : [],
            });
        } catch (err) {
            alert('저장에 실패했습니다. 다시 시도해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="bg-white rounded-2xl shadow-xl border border-blue-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="shrink-0 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-dark">신청 내용 정정</h3>
                        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="닫기">
                            <Icons.X size={22} />
                        </button>
                    </div>
                    <div className="px-6 py-4 border-b border-blue-100">
                        <p className="text-sm text-gray-700 font-medium truncate" title={seminar?.title}>{seminar?.title}</p>
                    </div>
                    <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">참여 경로</label>
                            <input type="text" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none" value={participationPath} onChange={(e) => setParticipationPath(e.target.value)} placeholder="예: 부청사 오픈채팅, 지인 추천" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">강연 신청 계기</label>
                            <textarea className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none resize-none h-20" value={applyReason} onChange={(e) => setApplyReason(e.target.value)} placeholder="신청하신 이유를 적어 주세요." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">강연 사전 질문</label>
                            <textarea className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none resize-none h-20" value={preQuestions} onChange={(e) => setPreQuestions(e.target.value)} placeholder="강연 전에 궁금한 점이 있으면 적어 주세요." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">강연 후 식사 여부</label>
                            <input type="text" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none" value={mealAfter} onChange={(e) => setMealAfter(e.target.value)} placeholder="예: 참여함 / 불참" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="app-edit-privacy" checked={privacyAgreed} onChange={(e) => setPrivacyAgreed(e.target.checked)} className="rounded border-blue-300 text-brand focus:ring-brand" />
                            <label htmlFor="app-edit-privacy" className="text-sm text-gray-700">개인정보 수집·이용 동의</label>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={onClose} className="flex-1 py-3 border border-blue-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">취소</button>
                            <button type="submit" disabled={saving} className="flex-1 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60">
                                {saving ? '저장 중…' : '저장'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ModalPortal>
    );
}

export default MyPageView;
