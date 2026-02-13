import React, { useState, useMemo, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { authService } from '../services/authService';
import { hashPassword, loadUsersFromStorage } from '../utils/authUtils';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

/** 이메일 도메인 선택 (드롭다운 + 직접입력) */
const EMAIL_DOMAINS = ['naver.com', 'daum.net', 'gmail.com', 'kakao.com', 'nate.com', 'hanmail.net', 'yahoo.co.kr', '직접입력'];

const SignUpModal = ({ onClose, onSignUp, existingUsers = [] }) => {
    const [formData, setFormData] = useState({ 
        userType: '',
        email: '',
        emailId: '',
        emailDomain: 'naver.com',
        emailDomainCustom: '',
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
        isIdentityVerified: false,
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
    const [emailCheckResult, setEmailCheckResult] = useState(null);
    const [phoneCheckResult, setPhoneCheckResult] = useState(null);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [duplicateCheckModal, setDuplicateCheckModal] = useState({ open: false, message: '', isError: false });

    const showDuplicateCheckModal = (message, isError = false) => {
        setDuplicateCheckModal({ open: true, message, isError });
    };

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
    /** 이메일 앞부분 + 도메인(드롭다운/직접입력) 조합 */
    const composeEmail = (id, domain, custom) => {
        const i = (id || '').trim();
        const d = domain === '직접입력' ? (custom || '').trim() : (domain || '');
        if (!i || !d) return '';
        return `${i}@${d}`;
    };

    const validatePassword = (password) => {
        if (password.length < 8) return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
        if (!/[a-zA-Z]/.test(password)) return { valid: false, message: '비밀번호에 영문이 포함되어야 합니다.' };
        if (!/[0-9]/.test(password)) return { valid: false, message: '비밀번호에 숫자가 포함되어야 합니다.' };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, message: '비밀번호에 특수문자가 포함되어야 합니다.' };
        return { valid: true, message: '' };
    };

    const validatePhone = (phone) => {
        const cleaned = (phone || '').replace(/[^0-9]/g, '');
        return cleaned.length === 11 && /^01[0-9][0-9]{8}$/.test(cleaned);
    };

    const fetchAllUsers = async () => {
        if (firebaseService?.getUsers) return await firebaseService.getUsers();
        return await loadUsersFromStorage();
    };

    const handleCheckEmailDuplicate = async () => {
        if (!formData.email?.trim()) {
            showDuplicateCheckModal('이메일을 입력한 뒤 중복 확인해주세요.', true);
            return;
        }
        if (!validateEmail(formData.email)) {
            showDuplicateCheckModal('올바른 이메일 형식을 입력해주세요.', true);
            return;
        }
        setIsCheckingDuplicate(true);
        try {
            const allUsers = await fetchAllUsers();
            const exists = allUsers.some(u => (u.email || '').toLowerCase() === formData.email.trim().toLowerCase());
            setEmailCheckResult(exists ? 'duplicate' : 'available');
            if (exists) showDuplicateCheckModal('이미 사용 중인 이메일(아이디)입니다.', true);
            else showDuplicateCheckModal('사용 가능한 이메일입니다.', false);
        } catch (e) {
            showDuplicateCheckModal('중복 확인에 실패했습니다. 다시 시도해주세요.', true);
        } finally {
            setIsCheckingDuplicate(false);
        }
    };

    const handleCheckPhoneDuplicate = async () => {
        if (!formData.phone?.trim()) {
            showDuplicateCheckModal('연락처를 입력한 뒤 중복 확인해주세요.', true);
            return;
        }
        if (!validatePhone(formData.phone)) {
            showDuplicateCheckModal('연락처는 숫자 11자리만 입력 가능합니다. (예: 01012345678)', true);
            return;
        }
        setIsCheckingDuplicate(true);
        try {
            const allUsers = await fetchAllUsers();
            const inputNorm = normalizePhone(formData.phone);
            const exists = allUsers.some(u => normalizePhone(u.phone || u.phoneNumber) === inputNorm);
            setPhoneCheckResult(exists ? 'duplicate' : 'available');
            if (exists) showDuplicateCheckModal('이미 사용 중인 연락처입니다.', true);
            else showDuplicateCheckModal('사용 가능한 연락처입니다.', false);
        } catch (e) {
            showDuplicateCheckModal('중복 확인에 실패했습니다. 다시 시도해주세요.', true);
        } finally {
            setIsCheckingDuplicate(false);
        }
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

    // 1단계 필수 항목 모두 충족 여부 (다음 버튼 활성화용)
    const isStep1RequiredFilled = useMemo(() => {
        if (!formData.userType || !formData.email?.trim() || !formData.name?.trim() || !formData.phone?.trim()) return false;
        if (!formData.password || !formData.passwordConfirm) return false;
        if (!validateEmail(formData.email)) return false;
        const pv = validatePassword(formData.password);
        if (!pv.valid) return false;
        if (formData.password !== formData.passwordConfirm) return false;
        if (!validatePhone(formData.phone)) return false;
        if (!formData.privacyAgreed) return false;
        return true;
    }, [formData.userType, formData.email, formData.name, formData.phone, formData.password, formData.passwordConfirm, formData.privacyAgreed]);

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
                return alert("연락처는 숫자 11자리만 입력 가능합니다. (예: 01012345678)");
            }
            if (!formData.privacyAgreed) {
                return alert("개인정보 수집 및 이용에 동의해주세요.");
            }
            
            setIsCreatingAccount(true);
            try {
                const raw = firebaseService?.getUsers
                    ? await firebaseService.getUsers()
                    : await loadUsersFromStorage();
                const allUsers = Array.isArray(raw) ? raw : [];
                const existingByEmail = allUsers.find(u => (u.email || '').toLowerCase() === (formData.email || '').toLowerCase());
                const phoneNorm = normalizePhone(formData.phone);
                const existingByPhone = phoneNorm ? allUsers.find(u => normalizePhone(u.phone || u.phoneNumber) === phoneNorm) : null;
                if (existingByEmail && existingByPhone) {
                    setIsCreatingAccount(false);
                    return alert("이미 사용 중인 이메일(아이디)과 연락처입니다. 로그인을 시도해주세요.");
                }
                if (existingByEmail) {
                    setIsCreatingAccount(false);
                    return alert("이미 사용 중인 이메일(아이디)입니다. 로그인을 시도해주세요.");
                }
                if (existingByPhone) {
                    setIsCreatingAccount(false);
                    return alert("이미 사용 중인 연락처입니다. 다른 번호를 입력해주세요.");
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
        
        if (!formData.isIdentityVerified) {
            return alert("개인정보 확인을 위해 본인인증을 완료해주세요.\n본인인증 버튼을 눌러 휴대폰 본인확인을 진행해주세요.");
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
        <ModalPortal>
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-lg"></div>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl z-10 relative border-[0.5px] border-brand max-h-[95vh] overflow-hidden flex flex-col max-md:scale-[0.8] origin-center" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                    {/* 글 작성 모달이므로 ESC 키 미적용 */}
                    <div className="bg-gradient-to-r from-brand to-blue-600 text-white p-6 relative">
                        <div className="text-center">
                            <h3 className="text-3xl font-bold mb-2">회원가입</h3>
                            <p className="text-blue-100 text-sm">필수 항목(*)을 모두 입력해주세요</p>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-6">
                            {[1, 2].map(step => (
                                <div key={step} className="flex items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${currentStep >= step ? 'bg-white text-brand' : 'bg-white/20 text-white/60'}`}>
                                        {currentStep > step ? <Icons.CheckCircle size={18} /> : step}
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

                    <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {currentStep === 1 ? (
                                <div className="space-y-5 animate-fade-in">
                                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                            <Icons.AlertCircle className="w-5 h-5 shrink-0" />
                                            표시(*)된 항목은 필수 입력입니다. 모두 입력한 후 다음 단계로 진행할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="mb-6 text-center">
                                        <h4 className="text-2xl font-bold text-dark mb-2">회원 유형 선택 <span className="text-red-500">*</span></h4>
                                        <p className="text-sm text-gray-500">본인의 분류를 선택해주세요</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, userType: '사업자', businessType: '개인사업자'})}
                                            className={`p-6 rounded-2xl border-2 transition-all text-left ${
                                                formData.userType === '사업자' 
                                                    ? 'border-brand bg-brand/5 shadow-lg' 
                                                    : 'border-blue-200 hover:border-brand/50'
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
                                                    : 'border-blue-200 hover:border-brand/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${formData.userType === '예비창업자' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <Icons.Star size={24} />
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
                                            
                                            <div className="flex flex-col items-center mb-6 p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-blue-200">
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand/20 to-brand/10 overflow-hidden mb-3 relative group border-4 border-brand/20">
                                                    {formData.img ? <img src={formData.img} className="w-full h-full object-cover" alt="Profile" loading="lazy" decoding="async" /> : <Icons.Users className="w-12 h-12 text-brand/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                        <Icons.Camera className="text-white w-5 h-5" />
                                                    </div>
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                                </div>
                                                <span className="text-xs text-gray-500 font-medium">프로필 사진 (선택사항)</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">이메일(아이디) <span className="text-red-500">*</span> <span className="text-xs text-gray-500 font-normal">(로그인에 사용)</span></label>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <input type="text" inputMode="email" placeholder="example" className="flex-1 min-w-[100px] p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm" value={formData.emailId} onChange={e => { setFormData(f => ({ ...f, emailId: e.target.value, email: (() => { const i = e.target.value.trim(); const d = f.emailDomain === '직접입력' ? (f.emailDomainCustom || '').trim() : (f.emailDomain || ''); return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }} />
                                                        <span className="text-slate-500">@</span>
                                                        <select className="p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none bg-white text-sm" value={formData.emailDomain} onChange={e => { setFormData(f => ({ ...f, emailDomain: e.target.value, email: (() => { const i = (f.emailId || '').trim(); const d = e.target.value === '직접입력' ? (f.emailDomainCustom || '').trim() : e.target.value; return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }}>
                                                            {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                                        </select>
                                                        {formData.emailDomain === '직접입력' && (
                                                            <input type="text" placeholder="도메인 입력" className="flex-1 min-w-[120px] p-3.5 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none text-sm" value={formData.emailDomainCustom} onChange={e => { setFormData(f => ({ ...f, emailDomainCustom: e.target.value, email: (() => { const i = (f.emailId || '').trim(); const d = (e.target.value || '').trim(); return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }} />
                                                        )}
                                                        <button type="button" onClick={handleCheckEmailDuplicate} disabled={isCheckingDuplicate} className="shrink-0 px-4 py-3.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-50 transition-colors">중복 확인</button>
                                                    </div>
                                                    {emailCheckResult === 'available' && <p className="mt-1.5 text-xs text-green-600 font-medium">사용 가능한 이메일입니다.</p>}
                                                    {emailCheckResult === 'duplicate' && <p className="mt-1.5 text-xs text-red-600 font-medium">이미 사용 중인 이메일입니다.</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                                                    <input type="text" placeholder="이름을 입력하세요" className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
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
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">연락처(전화번호) <span className="text-red-500">*</span> <span className="text-xs text-gray-500 font-normal">(숫자 11자리)</span></label>
                                                    <div className="flex gap-2">
                                                        <input type="tel" inputMode="numeric" placeholder="01012345678" maxLength={11} className="flex-1 p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.phone} onChange={e => {
                                                            const raw = e.target.value.replace(/\D/g, '');
                                                            if (raw.length > 11) {
                                                                alert('연락처는 숫자 11자리만 입력 가능합니다.');
                                                                setFormData({ ...formData, phone: raw.slice(0, 11) });
                                                                setPhoneCheckResult(null);
                                                            } else {
                                                                setFormData({ ...formData, phone: raw });
                                                                setPhoneCheckResult(null);
                                                            }
                                                        }} />
                                                        <button type="button" onClick={handleCheckPhoneDuplicate} disabled={isCheckingDuplicate} className="shrink-0 px-4 py-3.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-50 transition-colors">중복 확인</button>
                                                    </div>
                                                    {phoneCheckResult === 'available' && <p className="mt-1.5 text-xs text-green-600 font-medium">사용 가능한 연락처입니다.</p>}
                                                    {phoneCheckResult === 'duplicate' && <p className="mt-1.5 text-xs text-red-600 font-medium">이미 사용 중인 연락처입니다.</p>}
                                                </div>
                                            </div>
                                            
                                            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.privacyAgreed}
                                                        onChange={e => setFormData({...formData, privacyAgreed: e.target.checked})}
                                                        className="mt-1 w-5 h-5 text-brand border-blue-300 rounded focus:ring-brand"
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
                                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                            <Icons.AlertCircle className="w-5 h-5 shrink-0" />
                                            본인인증, 주소{formData.userType === '사업자' ? ', 사업자 정보' : ''} 등 표시(*)된 항목을 모두 완료한 후 가입하기를 눌러주세요.
                                        </p>
                                    </div>
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
                                                    <select className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors bg-white text-sm" value={formData.businessType} onChange={e => setFormData({...formData, businessType: e.target.value})}>
                                                        <option value="개인사업자">개인사업자</option>
                                                        <option value="법인사업자">법인사업자</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">사업형태 <span className="text-red-500">*</span></label>
                                                    <select className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors bg-white text-sm" value={formData.businessCategory} onChange={e => setFormData({...formData, businessCategory: e.target.value})}>
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
                                                    <input type="text" placeholder="회사/사업체 이름" className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">직책</label>
                                                    <input type="text" placeholder="대표, 이사, 팀장 등" className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-bold text-gray-700 mb-2">업체주소 <span className="text-red-500">*</span></label>
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text" 
                                                                readOnly 
                                                                placeholder="도로명 주소 검색" 
                                                                className="flex-1 p-3.5 border border-blue-200 rounded-xl bg-gray-50 text-sm cursor-pointer" 
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
                                                        <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
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
                                                            className="flex-1 p-3.5 border border-blue-200 rounded-xl bg-gray-50 text-sm cursor-pointer" 
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
                                                    <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3.5 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none transition-colors text-sm" value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className={`mt-4 p-6 rounded-2xl border-2 ${
                                        formData.userType === '사업자' 
                                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' 
                                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-blue-200'
                                    }`}>
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                                formData.userType === '사업자' ? 'bg-blue-500' : 'bg-gray-400'
                                            }`}>
                                                {formData.userType === '사업자' ? (
                                                    <Icons.CheckCircle className="w-6 h-6 text-white" />
                                                ) : (
                                                    <Icons.Info className="w-6 h-6 text-white" />
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
                                                            ? 'border-blue-200 focus:border-blue-400' 
                                                            : 'border-blue-200 focus:border-blue-400'
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
                                                                <Icons.CheckCircle size={16} />
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
                                                            <Icons.CheckCircle size={12} />
                                                            형식 검증 완료
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'api_verified' ? (
                                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                                            <Icons.CheckCircle size={12} />
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

                    <div className="shrink-0 border-t border-blue-200 p-6 bg-gray-50 flex justify-between gap-3">
                        <div className="flex gap-3">
                            {currentStep > 1 ? (
                                <button type="button" onClick={handlePrevStep} className="py-3 px-6 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">
                                    이전
                                </button>
                            ) : null}
                            {currentStep === 1 ? (
                                <button 
                                    type="button" 
                                    onClick={handleNextStep} 
                                    disabled={isCreatingAccount || !isStep1RequiredFilled}
                                    className={`py-3 px-8 bg-gradient-to-r from-brand to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all ${
                                        isCreatingAccount || !isStep1RequiredFilled ? 'opacity-50 cursor-not-allowed' : ''
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
                                    className={`py-3 px-8 font-bold rounded-xl transition-all ${
                                        formData.userType === '사업자' && formData.businessVerificationStatus !== 'api_verified'
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-brand to-blue-600 text-white hover:shadow-lg hover:shadow-brand/30'
                                    }`}
                                >
                                    가입하기
                                </button>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>

        {/* 중복 확인 안내 모달 (화면 중앙) */}
        {duplicateCheckModal.open && (
            <ModalPortal>
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDuplicateCheckModal({ open: false, message: '', isError: false })}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center transform animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <p className={`text-base font-medium mb-6 ${duplicateCheckModal.isError ? 'text-red-600' : 'text-gray-800'}`}>
                            {duplicateCheckModal.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => setDuplicateCheckModal({ open: false, message: '', isError: false })}
                            className={`w-full py-3 rounded-xl font-bold transition-colors ${duplicateCheckModal.isError ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-brand text-white hover:bg-blue-700'}`}
                        >
                            확인
                        </button>
                    </div>
                </div>
            </ModalPortal>
        )}
        </>
    );
};

export default SignUpModal;
