import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { authService } from '../services/authService';
import { firebaseService } from '../services/firebaseService';
import { loadUsersFromStorage } from '../utils/authUtils';
import { openDaumPostcode } from '../utils/daumPostcode';

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

/** 필수 항목 번호 뱃지: 미입력 파란색, 입력완료 초록색 */
const RequiredFieldBadge = ({ number, isFilled }) => (
    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold text-white shrink-0 ${isFilled ? 'bg-green-500' : 'bg-blue-500'}`}>
        {number}
    </span>
);

/** 이메일 도메인 선택 (드롭다운 + 직접입력) */
const EMAIL_DOMAINS = ['naver.com', 'daum.net', 'gmail.com', 'kakao.com', 'nate.com', 'hanmail.net', 'yahoo.co.kr', '직접입력'];

const BUSINESS_CATEGORIES = [
    '식품제조업', '의류제조업', '화학제조업', '전자제품제조업', '기계제조업', '기타 제조업',
    '도매업', '소매업', '온라인 쇼핑몰', '편의점/마트',
    'IT/소프트웨어', '웹/앱 개발', '디자인/광고', '컨설팅', '교육/학원', '의료/병원', '미용/네일',
    '요식업 (한식)', '요식업 (양식)', '요식업 (중식)', '요식업 (일식)', '요식업 (카페)',
    '숙박업', '운송업', '부동산', '법률/회계', '기타 서비스업',
    '건설업', '인테리어', '토목공사', '농업', '축산업', '임업', '어업', '기타 사업',
];

/** PIPA 준수: 이용약관 / 개인정보 수집·이용 / 마케팅 안내 문구 (내용보기용) */
const TERMS_SERVICE = `제1조 (목적) 이 약관은 부청사 사업자 전용 커뮤니티 서비스(이하 "서비스")의 이용 조건 및 절차, 회원과 운영자 간의 권리·의무를 규정함을 목적으로 합니다.
제2조 (정의) "회원"이란 서비스에 가입하여 이용자 인증을 완료한 자를 말합니다. "사업자"란 사업자등록을 보유한 회원을 말합니다.
제3조 (약관의 효력) 약관은 서비스 화면에 공지하거나 전자우편 등으로 통지함으로써 효력이 발생합니다. 회원은 가입 시 본 약관에 동의한 것으로 간주됩니다.
(이하 생략 - 실제 서비스에서는 전문을 게시해 주세요.)`;

const TERMS_PRIVACY = `개인정보 수집 및 이용 동의
수집 항목: 이름, 생년월일(청년 확인용), 연락처, 이메일, 비밀번호(암호화 저장), 상호명·사업자등록번호·직책(사업자 한함)
수집 목적: 회원 식별, 서비스 제공, 사업자 신원 확인, 청년 정책 대상 확인
보관 기간: 회원 탈퇴 시까지 (관련 법령에 따라 보관이 필요한 경우 해당 기간)
귀하는 동의를 거부할 권리가 있으며, 거부 시 회원가입 및 서비스 이용이 제한됩니다.
(전문은 개인정보처리방침에서 확인하실 수 있습니다.)`;

const TERMS_MARKETING = `마케팅 정보 수신 및 활용 동의 (선택)
부청사 및 제휴사의 이벤트, 혜택, 사업자 지원 프로그램 등 마케팅 정보를 이메일·문자·앱 푸시로 수신하는 것에 동의합니다. 미동의 시에도 회원가입 및 서비스 이용에 제한이 없습니다.`;

const KAKAO_PROFILE_KEY = 'kakao_signup_profile';

const SignUpPage = ({ onSignUp }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fromKakao = searchParams.get('from') === 'kakao';
    const [kakaoFilledFields, setKakaoFilledFields] = useState({});
    const [userType, setUserType] = useState('');
    const [form, setForm] = useState({
        name: '',
        nickname: '',
        birthdate: '',
        gender: '',
        phone: '',
        email: '',
        emailId: '',
        emailDomain: 'naver.com',
        emailDomainCustom: '',
        password: '',
        passwordConfirm: '',
        company: '',
        companyPhone: '',
        companyWebsite: '',
        businessRegistrationNumber: '',
        position: '',
        businessCategory: '',
        collaborationIndustry: '',
        keyCustomers: '',
        desiredIndustry: '',
        businessRegistrationDoc: '',
        businessRegistrationFileName: '',
        roadAddress: '',
        detailAddress: '',
        zipCode: '',
        termsAgreed: false,
        privacyAgreed: false,
        marketingAgreed: false,
        phonePublic: false,
    });
    const [termsModal, setTermsModal] = useState({ open: false, type: '' }); // 'service' | 'privacy' | 'marketing'
    const BUSINESS_DOC_MAX_SIZE = 600 * 1024; // 600KB (base64 시 문서 크기 제한 고려)
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!fromKakao || typeof sessionStorage === 'undefined') return;
        try {
            const raw = sessionStorage.getItem(KAKAO_PROFILE_KEY);
            if (!raw) return;
            const profile = JSON.parse(raw);
            const filled = {};
            setForm((prev) => {
                const next = { ...prev };
                const name = (profile.name && profile.name.trim()) || '';
                if (name) { next.name = name; filled.name = true; }
                const phone = (profile.phone && String(profile.phone).replace(/\D/g, '').slice(0, 11)) || '';
                if (phone) { next.phone = phone; filled.phone = true; }
                const email = (profile.email && String(profile.email).trim()) || '';
                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    next.email = email;
                    const at = email.indexOf('@');
                    next.emailId = email.slice(0, at);
                    const domain = email.slice(at + 1);
                    const inList = EMAIL_DOMAINS.filter((d) => d !== '직접입력').includes(domain);
                    next.emailDomain = inList ? domain : '직접입력';
                    next.emailDomainCustom = inList ? '' : domain;
                    filled.email = true;
                }
                return next;
            });
            setKakaoFilledFields((f) => ({ ...f, ...filled }));
        } catch (_) {}
    }, [fromKakao]);

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
    /** 이메일 앞부분 + 도메인(드롭다운/직접입력) 조합 */
    const composeEmail = (id, domain, custom) => {
        const i = (id || '').trim();
        const d = domain === '직접입력' ? (custom || '').trim() : (domain || '');
        if (!i || !d) return '';
        return `${i}@${d}`;
    };
    const validatePassword = (password) => {
        if (!password || password.length < 8) return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
        if (!/[a-zA-Z]/.test(password)) return { valid: false, message: '비밀번호에 영문이 포함되어야 합니다.' };
        if (!/[0-9]/.test(password)) return { valid: false, message: '비밀번호에 숫자가 포함되어야 합니다.' };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, message: '비밀번호에 특수문자가 포함되어야 합니다.' };
        return { valid: true };
    };
    const validatePhone = (phone) => {
        const cleaned = (phone || '').replace(/[^0-9]/g, '');
        return cleaned.length === 11 && /^01[0-9][0-9]{8}$/.test(cleaned);
    };

    /** 생년월일 입력 파싱: "19870625" 또는 "1987-06-25" → "1987-06-25" (유효할 때만) */
    const parseBirthdateInput = (value) => {
        if (!value || typeof value !== 'string') return '';
        const trimmed = value.trim();
        const digitsOnly = trimmed.replace(/\D/g, '');
        if (digitsOnly.length >= 8) {
            const yyyy = digitsOnly.slice(0, 4);
            const mm = digitsOnly.slice(4, 6);
            const dd = digitsOnly.slice(6, 8);
            const y = parseInt(yyyy, 10);
            const m = parseInt(mm, 10);
            const d = parseInt(dd, 10);
            if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${yyyy}-${mm}-${dd}`;
            }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return trimmed;
        }
        return value;
    };

    /** 사업자등록번호: 숫자만 허용, 10자리 */
    const businessNumberDigits = (form.businessRegistrationNumber || '').replace(/\D/g, '');
    const isBusinessNumberValid = businessNumberDigits.length === 10;

    const inputClass = 'w-full p-3 border border-blue-200 rounded-xl focus:outline-none focus:border-brand';
    const inputClassKakao = (fieldKey) => {
        const base = 'w-full p-3 border rounded-xl focus:outline-none';
        const green = 'border-green-500 bg-green-50/50 focus:border-green-600 focus:ring-2 focus:ring-green-200';
        const normal = 'border-blue-200 focus:border-brand';
        return `${base} ${kakaoFilledFields[fieldKey] ? green : normal}`;
    };

    const isRequiredFilled = useMemo(() => {
        if (!userType) return false;
        if (!(form.name || '').trim()) return false;
        const validBirthdate = parseBirthdateInput(form.birthdate);
        if (!validBirthdate || !(form.birthdate || '').trim()) return false;
        if (!form.gender) return false;
        if (!(form.phone || '').trim() || !validatePhone(form.phone)) return false;
        if (!(form.email || '').trim() || !validateEmail(form.email)) return false;
        if (!fromKakao) {
            if (!(form.password || '').trim() || !(form.passwordConfirm || '').trim()) return false;
            if (!validatePassword(form.password).valid) return false;
            if (form.password !== form.passwordConfirm) return false;
        }
        if (!form.termsAgreed || !form.privacyAgreed) return false;
        if (!(form.roadAddress || '').trim()) return false;
        if (userType === '사업자') {
            if (!(form.company || '').trim() || !isBusinessNumberValid || !form.businessCategory) return false;
            if (!(form.collaborationIndustry || '').trim() || !(form.keyCustomers || '').trim()) return false;
        }
        return true;
    }, [userType, form, isBusinessNumberValid, fromKakao]);

    /** 누락 필수 항목 수집 → "1. 회원 유형을 입력해주십시오.\n2. ..." */
    const getMissingMessages = () => {
        const missing = [];
        if (!userType) missing.push('회원 유형');
        if (!(form.name || '').trim()) missing.push('이름');
        if (!(form.birthdate || '').trim()) missing.push('생년월일');
        else if (!parseBirthdateInput(form.birthdate)) missing.push('생년월일(YYYY-MM-DD 형식)');
        if (!form.gender) missing.push('성별');
        if (!(form.phone || '').trim()) missing.push('연락처');
        else if (!validatePhone(form.phone)) missing.push('연락처(숫자 11자리)');
        if (!(form.email || '').trim()) missing.push('이메일');
        else if (!validateEmail(form.email)) missing.push('이메일(올바른 형식)');
        if (!fromKakao) {
            if (!(form.password || '').trim()) missing.push('비밀번호');
            else if (!validatePassword(form.password).valid) missing.push('비밀번호(요건 충족)');
            if (!(form.passwordConfirm || '').trim()) missing.push('비밀번호 확인');
            else if (form.password !== form.passwordConfirm) missing.push('비밀번호 일치');
        }
        if (!form.termsAgreed) missing.push('이용약관 동의');
        if (!form.privacyAgreed) missing.push('개인정보 수집 및 이용 동의');
        if (!(form.roadAddress || '').trim()) missing.push('주소');
        if (userType === '사업자') {
            if (!(form.company || '').trim()) missing.push('상호명');
            if (!isBusinessNumberValid) missing.push('사업자등록번호');
            if (!form.businessCategory) missing.push('업종/업태');
            if (!(form.collaborationIndustry || '').trim()) missing.push('협업 업종');
            if (!(form.keyCustomers || '').trim()) missing.push('핵심고객');
        }
        return missing.map((label, i) => `${i + 1}. ${label}을(를) 입력해주십시오.`).join('\n');
    };

    const handleBusinessDocChange = (e) => {
        const file = e.target?.files?.[0];
        if (!file) {
            setForm(f => ({ ...f, businessRegistrationDoc: '', businessRegistrationFileName: '' }));
            return;
        }
        if (file.size > BUSINESS_DOC_MAX_SIZE) {
            alert(`사업자등록증 파일 크기는 ${Math.round(BUSINESS_DOC_MAX_SIZE / 1024)}KB 이하여야 합니다. 더 큰 파일은 용량을 줄이거나 촬영 화질을 낮춰 주세요.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setForm(f => ({ ...f, businessRegistrationDoc: reader.result || '', businessRegistrationFileName: file.name }));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const msg = getMissingMessages();
        if (msg) {
            setError(msg);
            return;
        }

        setSubmitting(true);
        try {
            let existsEmail = false;
            let existsPhone = false;
            if (firebaseService?.getUserByEmail && firebaseService?.getUserByPhone) {
                const [emailUser, phoneUser] = await Promise.all([
                    firebaseService.getUserByEmail(form.email || ''),
                    firebaseService.getUserByPhone(normalizePhone(form.phone))
                ]);
                existsEmail = !!emailUser;
                existsPhone = !!phoneUser;
            } else {
                const allUsers = firebaseService?.getUsers ? await firebaseService.getUsers() : await loadUsersFromStorage();
                const users = Array.isArray(allUsers) ? allUsers : [];
                existsEmail = users.some(u => (u.email || '').toLowerCase() === form.email.trim().toLowerCase());
                const phoneNorm = normalizePhone(form.phone);
                existsPhone = phoneNorm ? users.some(u => normalizePhone(u.phone || u.phoneNumber) === phoneNorm) : false;
            }
            if (existsEmail) {
                setError('이미 사용 중인 이메일입니다.');
                setSubmitting(false);
                return;
            }
            if (existsPhone) {
                setError('이미 사용 중인 연락처입니다.');
                setSubmitting(false);
                return;
            }

            const normalizedBirthdate = parseBirthdateInput(form.birthdate) || form.birthdate;
            const userData = {
                name: form.name.trim(),
                nickname: form.nickname?.trim() || '',
                birthdate: normalizedBirthdate,
                gender: form.gender || '',
                phone: form.phone.trim(),
                phonePublic: !!form.phonePublic,
                email: form.email.trim(),
                userType,
                businessCategory: userType === '사업자' ? form.businessCategory : '',
                industry: userType === '사업자' ? form.businessCategory : '',
                collaborationIndustry: (userType === '사업자' && form.collaborationIndustry?.trim()) || '',
                keyCustomers: (userType === '사업자' && form.keyCustomers?.trim()) || '',
                desiredIndustry: (userType === '예창' && form.desiredIndustry?.trim()) || '',
                company: userType === '사업자' ? (form.company?.trim() || '') : '',
                businessRegistrationNumber: userType === '사업자' ? businessNumberDigits : '',
                position: userType === '사업자' ? (form.position?.trim() || '') : '',
                companyPhone: userType === '사업자' ? (form.companyPhone?.trim() || '') : '',
                companyWebsite: userType === '사업자' ? (form.companyWebsite?.trim() || '') : '',
                roadAddress: (form.roadAddress || '').trim(),
                detailAddress: (form.detailAddress || '').trim(),
                zipCode: (form.zipCode || '').trim(),
                businessRegistrationDoc: (userType === '사업자' && form.businessRegistrationDoc) || '',
                businessRegistrationFileName: (userType === '사업자' && form.businessRegistrationFileName) || '',
                termsAgreed: form.termsAgreed,
                marketingAgreed: form.marketingAgreed,
                approvalStatus: 'pending',
                img: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name.trim())}&background=random`,
            };

            if (fromKakao) {
                const currentUser = authService?.getCurrentUser?.();
                if (!currentUser?.uid) {
                    setError('카카오 로그인 세션이 만료되었습니다. 카카오로 회원가입을 다시 시도해 주세요.');
                    setSubmitting(false);
                    return;
                }
                await firebaseService.createUser({ uid: currentUser.uid, ...userData });
                try { sessionStorage.removeItem(KAKAO_PROFILE_KEY); } catch (_) {}
                const fullUserData = { uid: currentUser.uid, ...userData, createdAt: new Date().toISOString() };
                if (onSignUp) onSignUp(fullUserData);
                alert('회원가입이 완료되었습니다.\n관리자 승인 후 서비스를 이용하실 수 있습니다.');
                navigate('/', { replace: true });
            } else {
                const user = await authService.signUp(form.email, form.password, userData);
                const fullUserData = { uid: user.uid, ...userData, createdAt: new Date().toISOString() };
                if (onSignUp) onSignUp(fullUserData);
                alert('회원가입이 완료되었습니다.\n관리자 승인 후 서비스를 이용하실 수 있습니다.');
                navigate('/', { replace: true });
            }
        } catch (err) {
            const code = err?.code ?? '없음';
            console.error('SignUp failed', { code, message: err?.message, error: err });
            const msg = err.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : (err.message || '회원가입에 실패했습니다.');
            setError(`(코드: ${code}) ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
            <div className="container mx-auto max-w-2xl">
                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-brand font-bold hover:underline mb-4"
                    >
                        <Icons.ArrowLeft size={20} /> 이전
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-dark">회원가입</h1>
                    <p className="text-sm text-gray-500 mt-1">표시(*)된 항목은 필수 입력입니다.</p>
                    {fromKakao && (
                        <p className="text-sm text-green-700 mt-2 flex items-center gap-2">
                            <span className="inline-flex w-6 h-6 rounded-full bg-[#FEE500] items-center justify-center text-[#191919] text-xs font-bold">K</span>
                            카카오에서 가져온 정보는 초록색으로 표시됩니다. 회원 유형(사업자/예비창업자)을 선택한 뒤 나머지를 입력해 주세요.
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 md:p-8">
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                            <Icons.AlertCircle className="w-5 h-5 shrink-0" />
                            이름, 생년월일, 성별, 연락처, 이메일, 비밀번호, 주소, {userType === '사업자' ? '상호명, 사업자등록번호, 업종/업태, 협업 업종, 핵심고객' : '희망업종(선택)'} 및 약관 동의 등 필수 항목을 입력해주세요.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {/* 회원 유형 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <RequiredFieldBadge number={1} isFilled={!!userType} />
                                회원 유형 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setUserType('사업자')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${userType === '사업자' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50'}`}
                                >
                                    <span className="font-bold text-dark">사업자</span>
                                    <p className="text-xs text-gray-500 mt-1">현재 사업을 운영 중이신 분</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserType('예창')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${userType === '예창' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50'}`}
                                >
                                    <span className="font-bold text-dark">예비창업자</span>
                                    <p className="text-xs text-gray-500 mt-1">창업을 준비 중이신 분</p>
                                </button>
                            </div>
                        </div>

                        {userType && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={2} isFilled={!!(form.name || '').trim()} />
                                            이름 <span className="text-red-500">*</span>
                                            {kakaoFilledFields.name && <span className="text-xs text-green-600 font-normal">(카카오에서 가져옴)</span>}
                                        </label>
                                        <input type="text" required placeholder="이름 입력" className={fromKakao ? inputClassKakao('name') : inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">닉네임 <span className="text-gray-400 text-xs">(선택, 부청사 활동용)</span></label>
                                        <input type="text" placeholder="닉네임 입력" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={3} isFilled={!!(form.birthdate || '').trim() && !!parseBirthdateInput(form.birthdate)} />
                                            생년월일 <span className="text-red-500">*</span>
                                        </label>
                                        <input type="text" inputMode="numeric" placeholder="YYYY-MM-DD (예: 1990-01-15)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.birthdate} onChange={e => { const v = e.target.value; const parsed = parseBirthdateInput(v); setForm(f => ({ ...f, birthdate: parsed || v })); }} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={4} isFilled={!!form.gender} />
                                            성별 <span className="text-red-500">*</span>
                                        </label>
                                        <select required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                                            <option value="">선택</option>
                                            <option value="남성">남성</option>
                                            <option value="여성">여성</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={5} isFilled={!!(form.phone || '').trim() && validatePhone(form.phone)} />
                                            연락처 <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(숫자 11자리)</span>
                                            {kakaoFilledFields.phone && <span className="text-xs text-green-600 font-normal">(카카오에서 가져옴)</span>}
                                        </label>
                                        <input type="tel" inputMode="numeric" required placeholder="01012345678" className={fromKakao ? inputClassKakao('phone') : inputClass} value={form.phone} onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            if (raw.length > 11) {
                                                setError('연락처는 숫자 11자리만 입력 가능합니다.');
                                                setForm(f => ({ ...f, phone: raw.slice(0, 11) }));
                                            } else {
                                                setError(prev => prev === '연락처는 숫자 11자리만 입력 가능합니다.' ? '' : prev);
                                                setForm(f => ({ ...f, phone: raw }));
                                            }
                                        }} maxLength={11} />
                                        {form.phone && form.phone.length === 11 && !validatePhone(form.phone) && <p className="text-xs text-red-500 mt-1">010, 011 등으로 시작하는 11자리 번호를 입력해주세요.</p>}
                                        <div className="mt-3 flex items-center gap-2">
                                            <input type="checkbox" id="signup-page-phonePublic" checked={form.phonePublic} onChange={e => setForm(f => ({ ...f, phonePublic: e.target.checked }))} className="w-5 h-5 text-brand rounded focus:ring-brand" />
                                            <label htmlFor="signup-page-phonePublic" className="text-sm text-gray-700 cursor-pointer">회원명단에서 연락처 공개 (선택)</label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={6} isFilled={!!(form.email || '').trim() && validateEmail(form.email)} />
                                            이메일 <span className="text-red-500">*</span>
                                            {kakaoFilledFields.email && <span className="text-xs text-green-600 font-normal">(카카오에서 가져옴)</span>}
                                        </label>
                                        <div className={`flex flex-wrap gap-2 items-center p-2 rounded-xl ${kakaoFilledFields.email ? 'bg-green-50/50 border border-green-200' : ''}`}>
                                            <input type="text" inputMode="email" required placeholder="example" className={`flex-1 min-w-[100px] p-3 rounded-xl focus:outline-none ${kakaoFilledFields.email ? 'border border-green-500 bg-white' : 'border border-blue-200 focus:border-brand'}`} value={form.emailId} onChange={e => setForm(f => ({ ...f, emailId: e.target.value, email: composeEmail(e.target.value, f.emailDomain, f.emailDomainCustom) }))} />
                                            <span className="text-slate-500">@</span>
                                            <select className={`p-3 rounded-xl focus:outline-none bg-white ${kakaoFilledFields.email ? 'border border-green-500' : 'border border-blue-200 focus:border-brand'}`} value={form.emailDomain} onChange={e => setForm(f => ({ ...f, emailDomain: e.target.value, email: composeEmail(f.emailId, e.target.value, f.emailDomainCustom) }))}>
                                                {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            {form.emailDomain === '직접입력' && (
                                                <input type="text" placeholder="도메인 입력" className={`flex-1 min-w-[120px] p-3 rounded-xl focus:outline-none ${kakaoFilledFields.email ? 'border border-green-500 bg-white' : 'border border-blue-200 focus:border-brand'}`} value={form.emailDomainCustom} onChange={e => setForm(f => ({ ...f, emailDomainCustom: e.target.value, email: composeEmail(f.emailId, f.emailDomain, e.target.value) }))} />
                                            )}
                                        </div>
                                    </div>
                                    {!fromKakao && (
                                    <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={7} isFilled={!!(form.password || '').trim() && validatePassword(form.password).valid} />
                                            비밀번호 <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} required placeholder="8자 이상, 영문+숫자+특수문자" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none pr-10" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.password && !validatePassword(form.password).valid && <p className="text-xs text-red-500 mt-1">{validatePassword(form.password).message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <RequiredFieldBadge number={8} isFilled={!!(form.passwordConfirm || '').trim() && form.password === form.passwordConfirm} />
                                            비밀번호 확인 <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input type={showPasswordConfirm ? 'text' : 'password'} required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none pr-10" value={form.passwordConfirm} onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))} />
                                            <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPasswordConfirm ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.passwordConfirm && form.password !== form.passwordConfirm && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
                                    </div>
                                    </>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <RequiredFieldBadge number={9} isFilled={!!(form.roadAddress || '').trim()} />
                                        주소 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input type="text" readOnly placeholder="도로명 주소 검색" className="flex-1 p-3 border border-blue-200 rounded-xl bg-gray-50 text-sm cursor-pointer" value={form.roadAddress} onClick={() => openDaumPostcode((data) => { if (data?.roadAddress) setForm(f => ({ ...f, roadAddress: data.roadAddress, zipCode: data.zipCode || '' })); })} />
                                            <button type="button" onClick={() => openDaumPostcode((data) => { if (data?.roadAddress) setForm(f => ({ ...f, roadAddress: data.roadAddress, zipCode: data.zipCode || '' })); })} className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap flex items-center gap-1">
                                                <Icons.MapPin size={16} /> 주소 검색
                                            </button>
                                        </div>
                                        {form.zipCode ? <p className="text-xs text-gray-500">우편번호: {form.zipCode}</p> : null}
                                        <input type="text" placeholder="상세주소 입력 (동/호수 등)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-blue-400 focus:outline-none text-sm" value={form.detailAddress} onChange={e => setForm(f => ({ ...f, detailAddress: e.target.value }))} />
                                    </div>
                                </div>

                                {userType === '사업자' && (
                                    <div className="space-y-5 pt-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                <RequiredFieldBadge number={11} isFilled={!!(form.company || '').trim()} />
                                                상호명 <span className="text-red-500">*</span>
                                            </label>
                                            <input type="text" required placeholder="회사 또는 사업체 이름" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                <RequiredFieldBadge number={12} isFilled={isBusinessNumberValid} />
                                                사업자등록번호 <span className="text-red-500">*</span>
                                            </label>
                                            <input type="text" inputMode="numeric" maxLength={10} placeholder="숫자 10자리 (예: 1234567890)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.businessRegistrationNumber} onChange={e => setForm(f => ({ ...f, businessRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                                            {form.businessRegistrationNumber && !isBusinessNumberValid && <p className="text-xs text-red-500 mt-1">숫자 10자리를 입력해주세요.</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">직책/직함 <span className="text-gray-400 text-xs">(선택)</span></label>
                                            <input type="text" placeholder="예: 대표, 이사, 팀장" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">회사 전화번호 <span className="text-gray-400 text-xs">(선택, 기입 시 회원명단에 노출)</span></label>
                                            <input type="tel" inputMode="numeric" placeholder="예: 02-1234-5678, 031-123-4567" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.companyPhone} onChange={e => setForm(f => ({ ...f, companyPhone: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">회사 홈페이지 <span className="text-gray-400 text-xs">(선택, 기입 시 회원명단에서 미리보기)</span></label>
                                            <input type="url" placeholder="https://www.example.com" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.companyWebsite} onChange={e => setForm(f => ({ ...f, companyWebsite: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                <RequiredFieldBadge number={13} isFilled={!!form.businessCategory} />
                                                업종 / 업태 <span className="text-red-500">*</span>
                                            </label>
                                            <select required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white" value={form.businessCategory} onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))}>
                                                <option value="">선택</option>
                                                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록증 <span className="text-gray-400 text-xs">(선택, 이미지 또는 PDF)</span></label>
                                            <div className="flex flex-col gap-2">
                                                <input type="file" accept="image/*,.pdf,application/pdf" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand file:text-white file:font-medium file:text-sm" onChange={handleBusinessDocChange} />
                                                {form.businessRegistrationFileName && <p className="text-xs text-gray-500">등록됨: {form.businessRegistrationFileName}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                <RequiredFieldBadge number={14} isFilled={!!(form.collaborationIndustry || '').trim()} />
                                                협업 업종 <span className="text-red-500">*</span>
                                            </label>
                                            <input type="text" required placeholder="협업 희망 업종" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.collaborationIndustry} onChange={e => setForm(f => ({ ...f, collaborationIndustry: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                                <RequiredFieldBadge number={15} isFilled={!!(form.keyCustomers || '').trim()} />
                                                핵심고객 <span className="text-red-500">*</span>
                                            </label>
                                            <input type="text" required placeholder="핵심 고객층" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.keyCustomers} onChange={e => setForm(f => ({ ...f, keyCustomers: e.target.value }))} />
                                        </div>
                                    </div>
                                )}

                                {userType === '예창' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">희망업종 <span className="text-gray-400 text-xs">(선택)</span></label>
                                        <input type="text" placeholder="희망 업종 또는 분야" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.desiredIndustry} onChange={e => setForm(f => ({ ...f, desiredIndustry: e.target.value }))} />
                                    </div>
                                )}

                                {/* PIPA 준수: 약관 동의 섹션 분리 */}
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" id="termsAgreed" checked={form.termsAgreed} onChange={e => setForm(f => ({ ...f, termsAgreed: e.target.checked }))} className="mt-1 w-5 h-5 text-brand rounded" />
                                            <div className="flex-1 flex items-start gap-2">
                                                <RequiredFieldBadge number={9} isFilled={form.termsAgreed} />
                                                <label htmlFor="termsAgreed" className="text-sm font-bold text-gray-700 cursor-pointer">(필수) 이용약관 동의 <span className="text-red-500">*</span></label>
                                                <button type="button" onClick={() => setTermsModal({ open: true, type: 'service' })} className="ml-2 text-xs text-brand font-medium hover:underline">내용보기</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" id="privacyAgreed" checked={form.privacyAgreed} onChange={e => setForm(f => ({ ...f, privacyAgreed: e.target.checked }))} className="mt-1 w-5 h-5 text-brand rounded" />
                                            <div className="flex-1 flex items-start gap-2">
                                                <RequiredFieldBadge number={10} isFilled={form.privacyAgreed} />
                                                <label htmlFor="privacyAgreed" className="text-sm font-bold text-gray-700 cursor-pointer">(필수) 개인정보처리방침을 읽었으며 동의합니다 <span className="text-red-500">*</span></label>
                                                <button type="button" onClick={() => setTermsModal({ open: true, type: 'privacy' })} className="ml-2 text-xs text-brand font-medium hover:underline">내용보기</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" id="marketingAgreed" checked={form.marketingAgreed} onChange={e => setForm(f => ({ ...f, marketingAgreed: e.target.checked }))} className="mt-1 w-5 h-5 text-brand rounded" />
                                            <div className="flex-1">
                                                <label htmlFor="marketingAgreed" className="text-sm font-bold text-gray-700 cursor-pointer">(선택) 마케팅 정보 수신 및 활용 동의</label>
                                                <button type="button" onClick={() => setTermsModal({ open: true, type: 'marketing' })} className="ml-2 text-xs text-brand font-medium hover:underline">내용보기</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {error && <p className="text-sm text-red-600 font-medium whitespace-pre-line">{error}</p>}

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">취소</button>
                                    <button type="submit" disabled={submitting} className="flex-1 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {submitting ? '가입 처리 중...' : '가입하기'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>

            {/* 약관 내용보기 모달 */}
            {termsModal.open && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setTermsModal({ open: false, type: '' })}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-blue-100 font-bold text-dark">
                            {termsModal.type === 'service' && '이용약관'}
                            {termsModal.type === 'privacy' && '개인정보 수집 및 이용'}
                            {termsModal.type === 'marketing' && '마케팅 정보 수신 및 활용'}
                        </div>
                        <div className="p-4 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
                            {termsModal.type === 'service' && TERMS_SERVICE}
                            {termsModal.type === 'privacy' && TERMS_PRIVACY}
                            {termsModal.type === 'marketing' && TERMS_MARKETING}
                        </div>
                        <div className="p-4 border-t border-blue-100">
                            <button type="button" onClick={() => setTermsModal({ open: false, type: '' })} className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignUpPage;
