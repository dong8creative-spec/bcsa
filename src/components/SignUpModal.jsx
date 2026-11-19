import React, { useState, useMemo, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { authService } from '../services/authService';
import { hashPassword } from '../utils/authUtils';
import { uploadImageToImgBB, encodeImageHalfWebpFromDataUrl, UPLOAD_WEBP_QUALITY } from '../utils/imageUtils';
import { openDaumPostcode } from '../utils/daumPostcode';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { PORTONE_IMP_CODE, PORTONE_CHANNEL_KEY } from '../constants';
/** 프로필 이미지 data URL을 ImgBB에 업로드 후 URL 반환. 실패 시 null 또는 throw */
async function uploadProfileImageToUrl(dataUrl, defaultAvatarUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return defaultAvatarUrl;
    try {
        const resized = await encodeImageHalfWebpFromDataUrl(dataUrl, UPLOAD_WEBP_QUALITY);
        const result = await uploadImageToImgBB(resized, 'profile.webp');
        const url = result?.url ?? (typeof result === 'string' ? result : null);
        return url || defaultAvatarUrl;
    } catch (err) {
        throw err;
    }
}

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

/** 필수 항목 번호 표시(작은 네모): 미입력 흰 바탕 회색 테두리, 입력완료 로얄블루 */
const RequiredFieldBadge = ({ number, isFilled }) => (
    <span aria-hidden="true" className={`inline-flex w-6 h-6 items-center justify-center text-[12px] font-semibold shrink-0 ${isFilled ? 'bg-royal text-white' : 'border border-line2 bg-white text-sub'}`}>
        {number}
    </span>
);

/* 먼저가본 개편: 입력칸·라벨 공통 모양 */
const INPUT = 'w-full h-[52px] px-4 bg-white border border-line2 rounded-lg text-[16px] text-ink placeholder:text-[#9a9893] focus:border-royal focus:outline-none transition-colors';
const LABEL = 'mb-2 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink';
const OPT = 'text-[13px] font-normal text-sub';
const SUB_BTN = 'shrink-0 h-[52px] px-4 bg-white border border-line2 rounded-lg text-[15px] font-semibold text-ink hover:border-ink disabled:opacity-50 transition-colors';

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
        phonePublic: false,
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
        companyPhone: '',
        companyWebsite: '',
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
            const { emailTaken: exists } = await firebaseService.checkSignupDuplicates({ email: formData.email.trim() });
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
            const { phoneTaken: exists } = await firebaseService.checkSignupDuplicates({ phone: normalizePhone(formData.phone) });
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

    // 1단계 필수 항목 모두 충족 여부
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

    /** 1단계 누락 항목 수집 → "1. 회원 유형을 입력해주십시오.\n2. ..." */
    const getStep1MissingMessages = () => {
        const missing = [];
        if (!formData.userType) missing.push('회원 유형');
        if (!formData.email?.trim()) missing.push('이메일');
        else if (!validateEmail(formData.email)) missing.push('올바른 이메일 형식');
        const pv = formData.password ? validatePassword(formData.password) : { valid: false };
        if (!formData.password) missing.push('비밀번호');
        else if (!pv.valid) missing.push('비밀번호(요건 충족)');
        if (!formData.passwordConfirm) missing.push('비밀번호 확인');
        else if (formData.password !== formData.passwordConfirm) missing.push('비밀번호 일치');
        if (!formData.name?.trim()) missing.push('이름');
        if (!formData.phone?.trim()) missing.push('연락처');
        else if (!validatePhone(formData.phone)) missing.push('연락처(숫자 11자리)');
        if (!formData.privacyAgreed) missing.push('개인정보 수집 및 이용 동의');
        return missing.map((label, i) => `${i + 1}. ${label}을(를) 입력해주십시오.`).join('\n');
    };

    /** 2단계 누락 항목 수집 */
    const getStep2MissingMessages = () => {
        const missing = [];
        if (!formData.isIdentityVerified) missing.push('본인인증');
        if (!formData.roadAddress?.trim()) missing.push('주소');
        if (formData.userType === '사업자') {
            if (!formData.businessType) missing.push('사업자 유형');
            if (!formData.businessCategory) missing.push('사업형태');
            if (!formData.company?.trim()) missing.push('업체명');
            if (!formData.businessRegistrationNumber?.trim()) missing.push('사업자등록번호');
            else if (formData.businessRegistrationNumber.replace(/[^0-9]/g, '').length !== 10) missing.push('사업자등록번호(10자리)');
            if (formData.businessVerificationStatus !== 'api_verified') missing.push('사업자등록번호 검증');
        }
        return missing.map((label, i) => `${i + 1}. ${label}을(를) 입력해주십시오.`).join('\n');
    };

    const handleNextStep = async () => {
        if (currentStep === 1) {
            const msg = getStep1MissingMessages();
            if (msg) {
                return alert(msg);
            }
            
            setIsCreatingAccount(true);
            try {
                // 회원 원본은 직접 읽을 수 없으므로 서버(checkSignupDuplicates)에서 일치 여부만 확인
                const dup = await firebaseService.checkSignupDuplicates({
                    email: formData.email || '',
                    phone: normalizePhone(formData.phone),
                });
                const existingByEmail = dup.emailTaken;
                const existingByPhone = dup.phoneTaken;
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
                const blockCheck = firebaseService?.checkBlockedRegistration
                    ? await firebaseService.checkBlockedRegistration({
                        email: formData.email?.trim(),
                        phone: formData.phone?.trim()
                    })
                    : { blocked: false };
                if (blockCheck.blocked) {
                    const until = blockCheck.blockedUntil ? new Date(blockCheck.blockedUntil).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                    setIsCreatingAccount(false);
                    return alert(`관리자에 의해 강제 탈퇴된 계정입니다. ${until ? until + '까지' : '1년 동안'} 재가입이 제한됩니다. 문의는 관리자에게 해 주세요.`);
                }
                const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`;
                let imgUrl = formData.img && !formData.img.startsWith('data:') ? formData.img : defaultAvatarUrl;
                if (formData.img && formData.img.startsWith('data:')) {
                    try {
                        imgUrl = await uploadProfileImageToUrl(formData.img, defaultAvatarUrl);
                    } catch (err) {
                        setIsCreatingAccount(false);
                        alert('프로필 사진 업로드에 실패했습니다. 사진 없이 진행하거나 다시 시도해 주세요.');
                        return;
                    }
                }
                if (authService && authService.signUp) {
                    const user = await authService.signUp(formData.email, formData.password, {
                        name: formData.name,
                        phone: formData.phone,
                        userType: formData.userType,
                        img: imgUrl,
                        approvalStatus: 'pending'
                    });
                    setFirebaseUser(user);
                    setCurrentStep(2);
                } else {
                    throw new Error('Firebase Auth가 초기화되지 않았습니다.');
                }
            } catch (error) {
                const msg = error?.message || '알 수 없는 오류';
                const code = error?.code ?? '없음';
                console.error('SignUp failed (Step 1)', { code, message: msg, error });
                if (error.code === 'auth/email-already-in-use') {
                    alert("이미 사용 중인 이메일입니다.");
                } else if (error.code === 'auth/weak-password') {
                    alert("비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.");
                } else if (error.code === 'auth/network-request-failed') {
                    alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.");
                } else if (msg.includes('payload') || msg.includes('size') || error?.code === 'invalid-argument') {
                    alert("회원가입에 실패했습니다.\n\n프로필 사진 크기가 너무 클 수 있습니다. 더 작은 사진을 선택하거나, 사진 없이 가입한 뒤 마이페이지에서 등록해 주세요.");
                } else {
                    alert(`회원가입에 실패했습니다. (코드: ${code})\n\n${msg}`);
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
            if (typeof window === 'undefined' || !window.PortOne) {
                alert('PortOne SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
                return;
            }
            if (!PORTONE_IMP_CODE || PORTONE_IMP_CODE === 'imp00000000') {
                alert('PortOne 가맹점 코드가 설정되지 않았습니다. 관리자에게 문의해주세요.');
                return;
            }
            const identityVerificationId = `cert_${Date.now()}`;
            const request = {
                storeId: PORTONE_IMP_CODE,
                identityVerificationId,
                customer: {
                    fullName: formData.name || '본인인증',
                    phoneNumber: formData.phone || ''
                },
                popup: true
            };
            if (PORTONE_CHANNEL_KEY) {
                request.channelKey = PORTONE_CHANNEL_KEY;
            }
            const response = await window.PortOne.requestIdentityVerification(request);
            if (response?.code != null) {
                alert(`본인인증에 실패했습니다.\n에러 메시지: ${response.message || '알 수 없는 오류'}`);
                return;
            }
            setFormData({
                ...formData,
                isIdentityVerified: true,
                verifiedName: formData.name,
                verifiedPhone: formData.phone,
                impUid: response?.identityVerificationTxId ?? response?.identityVerificationId
            });
            alert(`본인인증이 완료되었습니다.\n인증된 이름: ${formData.name || '-'}\n인증된 전화번호: ${formData.phone || '-'}`);
        } catch (error) {
            const msg = error?.message || error?.errorMessage || '다시 시도해주세요.';
            alert(`본인인증에 실패했습니다. ${msg}`);
        }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        
        if (!firebaseUser) {
            return alert("회원가입 오류가 발생했습니다. 처음부터 다시 시도해주세요.");
        }
        
        const msg = getStep2MissingMessages();
        if (msg) {
            return alert(msg);
        }
        
        try {
            const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`;
            let imgUrl = formData.img || defaultAvatarUrl;
            if (formData.img && formData.img.startsWith('data:')) {
                try {
                    imgUrl = await uploadProfileImageToUrl(formData.img, defaultAvatarUrl);
                } catch (err) {
                    if (!confirm('프로필 사진 업로드에 실패했습니다. 사진 없이 진행할까요?')) return;
                    imgUrl = defaultAvatarUrl;
                }
            }
            const userData = {
                uid: firebaseUser.uid,
                email: formData.email,
                name: formData.name,
                phone: formData.phone,
                phonePublic: !!formData.phonePublic,
                userType: formData.userType,
                roadAddress: formData.roadAddress,
                detailAddress: formData.detailAddress,
                zipCode: formData.zipCode,
                img: imgUrl,
                approvalStatus: 'pending',
                createdAt: new Date().toISOString()
            };
            
            if (formData.userType === '사업자') {
                userData.businessRegistrationNumber = formData.businessRegistrationNumber.replace(/[^0-9]/g, '');
                userData.businessVerified = formData.businessVerified;
                userData.businessType = formData.businessType;
                userData.businessCategory = formData.businessCategory;
                userData.company = formData.company;
                userData.companyPhone = (formData.companyPhone || '').trim();
                userData.companyWebsite = (formData.companyWebsite || '').trim();
                userData.role = formData.role;
            }
            
            if (firebaseService && firebaseService.updateUser) {
                const userDoc = firebaseService.getUser ? await firebaseService.getUser(firebaseUser.uid) : null;
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
            const msg = error?.message || '알 수 없는 오류';
            const code = error?.code ?? '없음';
            console.error('SignUp failed (Step 2)', { code, message: msg, error });
            if (msg.includes('payload') || msg.includes('size') || error?.code === 'invalid-argument') {
                alert(`회원가입 처리 중 오류가 발생했습니다.\n\n프로필 사진 크기가 너무 클 수 있습니다. 더 작은 사진을 선택하거나, 사진 없이 가입한 뒤 마이페이지에서 등록해 주세요.\n\n${msg}`);
            } else {
                alert(`회원가입 처리 중 오류가 발생했습니다. (코드: ${code})\n\n${msg}`);
            }
        }
    };
    
    return (
        <>
        <ModalPortal>
            <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 md:items-center md:p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                {/* 바깥 눌림 막이(작성 중 실수로 닫히지 않게 — 예전과 같은 동작) */}
                <div className="absolute inset-0" aria-hidden="true"></div>
                <div role="dialog" aria-modal="true" aria-labelledby="signup-modal-title" className="bg-white rounded-t-[18px] md:rounded-[18px] w-full max-w-[880px] z-10 relative max-h-[94dvh] md:max-h-[92vh] overflow-hidden flex flex-col" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                    {/* 글 작성 모달이므로 ESC 키 미적용 */}
                    <div className="shrink-0 border-b border-line px-5 pb-5 pt-6 md:px-8 md:pt-7">
                        <p className="font-logo text-[20px] leading-none text-ink mb-3" aria-hidden="true">먼저가본</p>
                        <h3 id="signup-modal-title" className="text-[23px] font-bold tracking-tight text-ink md:text-[24px]">회원가입</h3>
                        <p className="mt-1 text-[15px] text-sub">필수 항목(*)을 모두 입력해주세요</p>
                        <ol className="mt-5 grid grid-cols-2 border border-[#0c0c0e]" aria-label="가입 단계">
                            {[[1, '기본정보'], [2, '상세정보']].map(([step, label]) => (
                                <li key={step} aria-current={currentStep === step ? 'step' : undefined}
                                    className={`flex h-11 items-center justify-center gap-1.5 text-[15px] font-bold ${currentStep === step ? 'bg-[#0c0c0e] text-white' : 'bg-white text-[#666]'}`}>
                                    {currentStep > step ? <Icons.CheckCircle size={16} aria-hidden="true" /> : <span aria-hidden="true">{step}.</span>}
                                    {label}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 py-6 md:px-8 md:py-7">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {currentStep === 1 ? (
                                <div className="space-y-5 animate-fade-in">
                                    <div className="mb-4 rounded-xl bg-sky px-4 py-3.5">
                                        <p className="text-[15px] font-semibold text-ink flex items-start gap-2">
                                            <Icons.AlertCircle className="mt-0.5 w-5 h-5 shrink-0 text-royal" aria-hidden="true" />
                                            표시(*)된 항목은 필수 입력입니다. 모두 입력한 후 다음 단계로 진행할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="mb-4">
                                        <h4 id="signup-modal-usertype" className="text-[20px] font-bold text-ink mb-1 flex items-center gap-2">
                                            <RequiredFieldBadge number={1} isFilled={!!formData.userType} />
                                            회원 유형 선택 <span className="text-red-600">*</span>
                                        </h4>
                                        <p className="text-[15px] text-sub">본인의 분류를 선택해주세요</p>
                                    </div>

                                    <div role="group" aria-labelledby="signup-modal-usertype" className="grid grid-cols-2 gap-3 mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, userType: '사업자', businessType: '개인사업자'})}
                                            aria-pressed={formData.userType === '사업자'}
                                            className={`min-h-[96px] p-4 md:p-5 rounded-lg border transition-colors text-left ${
                                                formData.userType === '사업자' 
                                                    ? 'border-royal bg-sky ring-1 ring-royal' 
                                                    : 'border-line2 bg-white hover:border-ink'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 mb-1.5">
                                                <Icons.Users size={20} className={formData.userType === '사업자' ? 'text-royal' : 'text-[#9a9893]'} aria-hidden="true" />
                                                <h5 className="text-[17px] font-semibold text-ink">사업자</h5>
                                            </div>
                                            <p className="text-[14px] text-sub">현재 사업을 운영 중이신 분</p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, userType: '예비창업자', businessType: ''})}
                                            aria-pressed={formData.userType === '예비창업자'}
                                            className={`min-h-[96px] p-4 md:p-5 rounded-lg border transition-colors text-left ${
                                                formData.userType === '예비창업자' 
                                                    ? 'border-royal bg-sky ring-1 ring-royal' 
                                                    : 'border-line2 bg-white hover:border-ink'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 mb-1.5">
                                                <Icons.Star size={20} className={formData.userType === '예비창업자' ? 'text-royal' : 'text-[#9a9893]'} aria-hidden="true" />
                                                <h5 className="text-[17px] font-semibold text-ink">예비창업자</h5>
                                            </div>
                                            <p className="text-[14px] text-sub">창업을 준비 중이신 분</p>
                                        </button>
                                    </div>

                                    {formData.userType ? (
                                        <>
                                            <div className="mb-6">
                                                <h4 className="text-[20px] font-bold text-ink mb-1">기본 정보</h4>
                                                <p className="text-[15px] text-sub">로그인에 필요한 기본 정보를 입력해주세요</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 mb-6 rounded-xl bg-card p-4">
                                                <div className="w-20 h-20 shrink-0 rounded-full bg-white overflow-hidden relative group border border-line">
                                                    {formData.img ? <img src={formData.img} className="w-full h-full object-cover" alt="선택한 프로필 사진" loading="lazy" decoding="async" /> : <Icons.Users className="w-9 h-9 text-[#b5b3ae] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-hidden="true">
                                                        <Icons.Camera className="text-white w-5 h-5" />
                                                    </div>
                                                    <input id="signup-modal-photo" type="file" accept="image/*" aria-label="프로필 사진 선택" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                                </div>
                                                <label htmlFor="signup-modal-photo" className="cursor-pointer">
                                                    <span className="block text-[16px] font-semibold text-ink">프로필 사진 <span className={OPT}>(선택사항)</span></span>
                                                    <span className="mt-1 block text-[14px] text-sub">동그라미를 눌러 사진을 고르세요</span>
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label htmlFor="signup-modal-email-id" className={LABEL}>
                                                        <RequiredFieldBadge number={2} isFilled={!!formData.email?.trim() && validateEmail(formData.email)} />
                                                        이메일(아이디) <span className="text-red-600">*</span> <span className={OPT}>(로그인에 사용)</span>
                                                    </label>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <input type="text" inputMode="email" placeholder="example" id="signup-modal-email-id" autoComplete="username" aria-label="이메일 아이디" className={`${INPUT} !w-auto flex-1 min-w-[110px]`} value={formData.emailId} onChange={e => { setFormData(f => ({ ...f, emailId: e.target.value, email: (() => { const i = e.target.value.trim(); const d = f.emailDomain === '직접입력' ? (f.emailDomainCustom || '').trim() : (f.emailDomain || ''); return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }} />
                                                        <span className="text-[16px] text-sub" aria-hidden="true">@</span>
                                                        <select aria-label="이메일 도메인" className={`${INPUT} !w-auto flex-1 min-w-[130px] pr-3`} value={formData.emailDomain} onChange={e => { setFormData(f => ({ ...f, emailDomain: e.target.value, email: (() => { const i = (f.emailId || '').trim(); const d = e.target.value === '직접입력' ? (f.emailDomainCustom || '').trim() : e.target.value; return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }}>
                                                            {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                                        </select>
                                                        {formData.emailDomain === '직접입력' && (
                                                            <input type="text" aria-label="이메일 도메인 직접 입력" placeholder="도메인 입력" className={`${INPUT} flex-1 min-w-[120px]`} value={formData.emailDomainCustom} onChange={e => { setFormData(f => ({ ...f, emailDomainCustom: e.target.value, email: (() => { const i = (f.emailId || '').trim(); const d = (e.target.value || '').trim(); return (i && d) ? `${i}@${d}` : ''; })() })); setEmailCheckResult(null); }} />
                                                        )}
                                                        <button type="button" onClick={handleCheckEmailDuplicate} disabled={isCheckingDuplicate} className={SUB_BTN}>중복 확인</button>
                                                    </div>
                                                    {emailCheckResult === 'available' && <p className="mt-1.5 text-[14px] text-royal font-semibold" role="status">사용 가능한 이메일입니다.</p>}
                                                    {emailCheckResult === 'duplicate' && <p className="mt-1.5 text-[14px] text-red-600 font-semibold" role="alert">이미 사용 중인 이메일입니다.</p>}
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-name" className={LABEL}>
                                                        <RequiredFieldBadge number={5} isFilled={!!formData.name?.trim()} />
                                                        이름 <span className="text-red-600">*</span>
                                                    </label>
                                                    <input id="signup-modal-name" type="text" autoComplete="name" placeholder="이름을 입력하세요" className={INPUT} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-password" className={LABEL}>
                                                        <RequiredFieldBadge number={3} isFilled={!!formData.password && validatePassword(formData.password).valid} />
                                                        비밀번호 <span className="text-red-600">*</span> <span className={OPT}>(최소 8자, 영문+숫자+특수문자)</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input id="signup-modal-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="비밀번호를 입력하세요" className={`${INPUT} pr-12`} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                                        <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 flex w-11 h-11 items-center justify-center text-[#8a8883] hover:text-ink transition-colors">
                                                            {showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                                                        </button>
                                                    </div>
                                                    {formData.password && (() => {
                                                        const validation = validatePassword(formData.password);
                                                        return (
                                                            <div className={`mt-1.5 text-[14px] ${validation.valid ? 'text-royal' : 'text-red-600'}`}>
                                                                {validation.valid ? '✓ 비밀번호가 안전합니다' : validation.message}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-password-confirm" className={LABEL}>
                                                        <RequiredFieldBadge number={4} isFilled={!!formData.passwordConfirm && formData.password === formData.passwordConfirm} />
                                                        비밀번호 확인 <span className="text-red-600">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input id="signup-modal-password-confirm" type={showPasswordConfirm ? "text" : "password"} autoComplete="new-password" placeholder="비밀번호를 다시 입력하세요" className={`${INPUT} pr-12`} value={formData.passwordConfirm} onChange={e => setFormData({...formData, passwordConfirm: e.target.value})} />
                                                        <button type="button" aria-label={showPasswordConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'} onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-1 top-1/2 -translate-y-1/2 flex w-11 h-11 items-center justify-center text-[#8a8883] hover:text-ink transition-colors">
                                                            {showPasswordConfirm ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
                                                        </button>
                                                    </div>
                                                    {formData.passwordConfirm && formData.password !== formData.passwordConfirm ? (
                                                        <div className="mt-1.5 text-[14px] text-red-600">비밀번호가 일치하지 않습니다.</div>
                                                    ) : null}
                                                    {formData.passwordConfirm && formData.password === formData.passwordConfirm && formData.passwordConfirm.length > 0 ? (
                                                        <div className="mt-1.5 text-[14px] text-royal">✓ 비밀번호가 일치합니다.</div>
                                                    ) : null}
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label htmlFor="signup-modal-phone" className={LABEL}>
                                                        <RequiredFieldBadge number={6} isFilled={!!formData.phone?.trim() && validatePhone(formData.phone)} />
                                                        연락처(전화번호) <span className="text-red-600">*</span> <span className={OPT}>(숫자 11자리)</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <input id="signup-modal-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01012345678" maxLength={11} className={`${INPUT} !w-auto flex-1 min-w-0`} value={formData.phone} onChange={e => {
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
                                                        <button type="button" onClick={handleCheckPhoneDuplicate} disabled={isCheckingDuplicate} className={SUB_BTN}>중복 확인</button>
                                                    </div>
                                                    {phoneCheckResult === 'available' && <p className="mt-1.5 text-[14px] text-royal font-semibold" role="status">사용 가능한 연락처입니다.</p>}
                                                    {phoneCheckResult === 'duplicate' && <p className="mt-1.5 text-[14px] text-red-600 font-semibold" role="alert">이미 사용 중인 연락처입니다.</p>}
                                                    <div className="mt-2 flex min-h-[44px] items-center gap-2.5">
                                                        <input type="checkbox" id="signup-phonePublic" checked={formData.phonePublic} onChange={e => setFormData({ ...formData, phonePublic: e.target.checked })} className="w-5 h-5 accent-[#2d4fe0]" />
                                                        <label htmlFor="signup-phonePublic" className="text-[15px] text-ink cursor-pointer">회원명단에서 연락처 공개 (선택)</label>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-6 p-4 rounded-xl border border-line">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.privacyAgreed}
                                                        onChange={e => setFormData({...formData, privacyAgreed: e.target.checked})}
                                                        className="mt-0.5 w-5 h-5 shrink-0 accent-[#2d4fe0]"
                                                    />
                                                    <div className="flex-1 flex items-start gap-2">
                                                        <RequiredFieldBadge number={7} isFilled={formData.privacyAgreed} />
                                                        <div>
                                                            <span className="text-[15px] font-semibold text-ink">
                                                                개인정보처리방침을 읽었으며 동의합니다 <span className="text-red-600">*</span>
                                                            </span>
                                                            <p className="text-[14px] text-sub mt-1">
                                                                회원가입 전 개인정보처리방침을 반드시 읽어 주세요. 
                                                                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-royal font-semibold underline-offset-2 hover:underline ml-1">전문 보기</a>
                                                            </p>
                                                            <div className="text-[13px] leading-relaxed text-sub mt-2 space-y-1">
                                                                <p>• 수집 항목: 이메일(로그인용), 비밀번호(해시), 이름, 전화번호, 주소, 사업자정보(사업자만)</p>
                                                                <p>• 수집 목적: 회원 관리, 서비스 제공, 본인 확인</p>
                                                                <p>• 보관 기간: 회원 탈퇴 시까지 (법정 보관 기간이 있는 경우 해당 기간)</p>
                                                            </div>
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
                                    <div className="mb-4 rounded-xl bg-sky px-4 py-3.5">
                                        <p className="text-[15px] font-semibold text-ink flex items-center gap-2 flex-wrap">
                                            <Icons.AlertCircle className="w-5 h-5 shrink-0 text-royal" aria-hidden="true" />
                                            <RequiredFieldBadge number={1} isFilled={formData.isIdentityVerified} />
                                            본인인증, 주소{formData.userType === '사업자' ? ', 사업자 정보' : ''} 등 표시(*)된 항목을 모두 완료한 후 가입하기를 눌러주세요.
                                        </p>
                                    </div>
                                    <div className="mb-6">
                                        <h4 className="text-[20px] font-bold text-ink mb-1">상세 정보</h4>
                                        <p className="text-[15px] text-sub">
                                            {formData.userType === '사업자' ? '사업자 정보를 입력해주세요' : '예비창업자 정보를 입력해주세요'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {formData.userType === '사업자' ? (
                                            <>
                                                <div>
                                                    <label htmlFor="signup-modal-f1" className={LABEL}>
                                                        <RequiredFieldBadge number={3} isFilled={!!formData.businessType} />
                                                        사업자 유형 <span className="text-red-600">*</span>
                                                    </label>
                                                    <select id="signup-modal-f1" className={`${INPUT} pr-3`} value={formData.businessType} onChange={e => setFormData({...formData, businessType: e.target.value})}>
                                                        <option value="개인사업자">개인사업자</option>
                                                        <option value="법인사업자">법인사업자</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-f2" className={LABEL}>
                                                        <RequiredFieldBadge number={4} isFilled={!!formData.businessCategory} />
                                                        사업형태 <span className="text-red-600">*</span>
                                                    </label>
                                                    <select id="signup-modal-f2" className={`${INPUT} pr-3`} value={formData.businessCategory} onChange={e => setFormData({...formData, businessCategory: e.target.value})}>
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
                                                    <label htmlFor="signup-modal-f3" className={LABEL}>
                                                        <RequiredFieldBadge number={5} isFilled={!!formData.company?.trim()} />
                                                        업체명 <span className="text-red-600">*</span>
                                                    </label>
                                                    <input id="signup-modal-f3" type="text" placeholder="회사/사업체 이름" className={INPUT} value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-f4" className={LABEL}>직책</label>
                                                    <input id="signup-modal-f4" type="text" placeholder="대표, 이사, 팀장 등" className={INPUT} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-f5" className={LABEL}>회사 전화번호 <span className={OPT}>(선택, 기입 시 회원명단에 노출)</span></label>
                                                    <input id="signup-modal-f5" type="tel" inputMode="numeric" placeholder="예: 02-1234-5678, 031-123-4567" className={INPUT} value={formData.companyPhone || ''} onChange={e => setFormData({...formData, companyPhone: e.target.value})} />
                                                </div>
                                                <div>
                                                    <label htmlFor="signup-modal-f6" className={LABEL}>회사 홈페이지 <span className={OPT}>(선택, 기입 시 회원명단에서 미리보기)</span></label>
                                                    <input id="signup-modal-f6" type="url" placeholder="https://www.example.com" className={INPUT} value={formData.companyWebsite || ''} onChange={e => setFormData({...formData, companyWebsite: e.target.value})} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className={LABEL}>
                                                        <RequiredFieldBadge number={2} isFilled={!!formData.roadAddress?.trim()} />
                                                        업체주소 <span className="text-red-600">*</span>
                                                    </label>
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text" 
                                                                readOnly 
                                                                placeholder="도로명 주소 검색" 
                                                                aria-label="도로명 주소"
                                                                className={`${INPUT} !w-auto flex-1 min-w-0 bg-card cursor-pointer`} 
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
                                                                className="h-[52px] shrink-0 px-4 bg-[#1a1a1a] text-white rounded-lg font-bold hover:bg-black transition-colors text-[15px] whitespace-nowrap"
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <Icons.MapPin size={16} aria-hidden="true" />
                                                                    주소 검색
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {formData.zipCode ? (
                                                            <p className="text-[13px] text-sub">우편번호: {formData.zipCode}</p>
                                                        ) : null}
                                                        <input type="text" aria-label="상세주소" placeholder="상세주소 입력 (동/호수 등)" className={INPUT} value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
                                                    </div>
                                                </div>
                                            </>
                                        ) : null}
                                        {formData.userType === '예비창업자' ? (
                                            <div className="md:col-span-2">
                                                <label className={LABEL}>
                                                    <RequiredFieldBadge number={2} isFilled={!!formData.roadAddress?.trim()} />
                                                    집주소 <span className="text-red-600">*</span>
                                                </label>
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            readOnly 
                                                            placeholder="도로명 주소 검색" 
                                                            aria-label="도로명 주소"
                                                                className={`${INPUT} !w-auto flex-1 min-w-0 bg-card cursor-pointer`} 
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
                                                            className="h-[52px] shrink-0 px-4 bg-[#1a1a1a] text-white rounded-lg font-bold hover:bg-black transition-colors text-[15px] whitespace-nowrap"
                                                        >
                                                            <span className="flex items-center gap-1.5">
                                                                <Icons.MapPin size={16} aria-hidden="true" />
                                                                주소 검색
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {formData.zipCode ? (
                                                        <p className="text-[13px] text-sub">우편번호: {formData.zipCode}</p>
                                                    ) : null}
                                                    <input type="text" aria-label="상세주소" placeholder="상세주소 입력 (동/호수 등)" className={INPUT} value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className={`mt-4 p-4 md:p-6 rounded-xl ${
                                        formData.userType === '사업자' 
                                            ? 'bg-sky' 
                                            : 'bg-card'
                                    }`}>
                                        <div className="flex items-start gap-3 mb-4">
                                            {formData.userType === '사업자' ? (
                                                <Icons.CheckCircle className="mt-0.5 w-5 h-5 shrink-0 text-royal" aria-hidden="true" />
                                            ) : (
                                                <Icons.Info className="mt-0.5 w-5 h-5 shrink-0 text-sub" aria-hidden="true" />
                                            )}
                                            <div className="flex-1">
                                                <h5 className="text-[17px] font-semibold text-ink mb-1">
                                                    {formData.userType === '사업자' ? '사업자등록번호 입력' : '사업자등록번호 입력 (선택)'}
                                                </h5>
                                                <p className="text-[15px] text-sub">
                                                    {formData.userType === '사업자' 
                                                        ? '사업자등록번호를 입력하시면 형식 검증과 API 검증을 진행합니다.' 
                                                        : '보유하신 사업자등록번호가 있다면 입력해주세요. 없으시면 건너뛰셔도 됩니다.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="signup-modal-bizno" className={LABEL}>
                                                {formData.userType === '사업자' && (
                                                    <RequiredFieldBadge number={6} isFilled={formData.businessVerificationStatus === 'api_verified'} />
                                                )}
                                                사업자등록번호 
                                                {formData.userType === '사업자' ? (
                                                    <span className="text-red-600"> *</span>
                                                ) : (
                                                    <span className={OPT}> (선택사항)</span>
                                                )}
                                            </label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="123-45-67890" 
                                                    id="signup-modal-bizno"
                                                    inputMode="numeric"
                                                    className={`${INPUT} !w-auto flex-1 min-w-0 ${formData.businessVerificationStatus === 'api_verified' ? '!bg-card text-sub' : ''}`}
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
                                                        className={`h-[52px] shrink-0 px-5 rounded-lg font-bold text-[15px] transition-colors ${
                                                            formData.businessVerificationStatus === 'api_verified'
                                                                ? 'bg-royal text-white cursor-not-allowed' 
                                                            : formData.businessVerificationStatus === 'api_verifying'
                                                                ? 'bg-card text-sub cursor-not-allowed'
                                                                : 'bg-[#1a1a1a] text-white hover:bg-black'
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
                                                        <p className="text-[14px] text-royal flex items-center gap-1.5" role="status">
                                                            <Icons.CheckCircle size={14} aria-hidden="true" />
                                                            형식 검증 완료
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'api_verified' ? (
                                                        <p className="text-[14px] text-royal font-semibold flex items-center gap-1.5" role="status">
                                                            <Icons.CheckCircle size={14} aria-hidden="true" />
                                                            운영 중인 사업자로 확인되었습니다.
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'api_failed' ? (
                                                        <p className="text-[14px] text-red-600 flex items-center gap-1.5" role="alert">
                                                            <Icons.X size={14} aria-hidden="true" />
                                                            검증 실패. 다시 시도해주세요.
                                                        </p>
                                                    ) : null}
                                                    {formData.businessVerificationStatus === 'not_started' && formData.businessRegistrationNumber.length === 12 ? (
                                                        <p className="text-[14px] text-sub">
                                                            검증하기 버튼을 클릭하여 사업자등록번호를 검증해주세요.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            
                                            <p className="text-[13px] text-sub mt-2">
                                                사업자등록번호는 10자리 숫자입니다. (예: 123-45-67890)
                                                {formData.userType === '사업자' && ' 검증 완료 후 다음 단계로 진행할 수 있습니다.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </form>
                    </div>

                    <div className="shrink-0 border-t border-line px-5 py-4 md:px-8 bg-white flex justify-between gap-3">
                        <div className="flex gap-3">
                            {currentStep > 1 ? (
                                <button type="button" onClick={handlePrevStep} className="h-[52px] px-5 bg-white border border-line2 text-ink text-[16px] font-semibold rounded-lg hover:border-ink transition-colors">
                                    이전
                                </button>
                            ) : null}
                            {currentStep === 1 ? (
                                <button 
                                    type="button" 
                                    onClick={handleNextStep} 
                                    disabled={isCreatingAccount}
                                    className={`h-[52px] px-7 bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors ${
                                        isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''
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
                                    className={`h-[52px] px-7 text-[16px] font-bold rounded-lg transition-colors ${
                                        formData.userType === '사업자' && formData.businessVerificationStatus !== 'api_verified'
                                            ? 'bg-card text-[#9a9893] cursor-not-allowed'
                                            : 'bg-[#1a1a1a] text-white hover:bg-black'
                                    }`}
                                >
                                    가입하기
                                </button>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="h-[52px] px-5 bg-white border border-line2 text-ink text-[16px] font-semibold rounded-lg hover:border-ink transition-colors">
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>

        {/* 중복 확인 안내 모달 (화면 중앙) */}
        {duplicateCheckModal.open && (
            <ModalPortal>
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50" onClick={() => setDuplicateCheckModal({ open: false, message: '', isError: false })}>
                    <div role="alertdialog" aria-modal="true" aria-live="assertive" className="bg-white rounded-[18px] max-w-[380px] w-full px-6 pb-6 pt-7 text-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <p className={`text-[17px] font-semibold mb-6 ${duplicateCheckModal.isError ? 'text-red-600' : 'text-ink'}`}>
                            {duplicateCheckModal.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => setDuplicateCheckModal({ open: false, message: '', isError: false })}
                            className="w-full h-[52px] rounded-lg text-[16px] font-bold bg-[#1a1a1a] text-white hover:bg-black transition-colors"
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
