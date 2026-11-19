import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { authService } from '../services/authService';
import { firebaseService } from '../services/firebaseService';
import { openDaumPostcode } from '../utils/daumPostcode';
import { TERMS_SECTIONS, sectionsToText } from '../constants/legal';
import { MgPageHead, MgWrap } from '../components/mg/Mg';

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

/** 필수 항목 번호 표시(작은 네모): 미입력 흰 바탕 회색 테두리, 입력완료 로얄블루 */
const RequiredFieldBadge = ({ number, isFilled }) => (
    <span aria-hidden="true" className={`inline-flex w-6 h-6 items-center justify-center text-[12px] font-semibold shrink-0 ${isFilled ? 'bg-royal text-white' : 'border border-line2 bg-white text-sub'}`}>
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
// 가입 화면에서도 사이트 약관 전문을 그대로 보여준다 (예전에는 "이하 생략" 미완성본이었다)
const TERMS_SERVICE = sectionsToText(TERMS_SECTIONS);

const TERMS_PRIVACY = `개인정보 수집 및 이용 동의
수집 항목: 이름, 생년월일, 성별, 연락처, 이메일, 비밀번호(암호화 저장), 주소 / 사업자 회원: 상호, 사업자등록번호, 업종, 사업자등록증 사본(사업자 확인 후 삭제)
수집 목적: 회원 식별과 사업자 확인, 만 14세 이상 확인, 프로그램·그룹 운영, 결제·환불
보관 기간: 회원 탈퇴 시까지 (법령상 보관 의무가 있는 정보는 해당 기간)
회원명단에는 이름·회사·업종·지역(구 단위)이 로그인 회원에게 보이며, 연락처는 공개를 선택한 경우에만 보입니다.
귀하는 동의를 거부할 권리가 있으며, 거부 시 회원가입이 제한됩니다.
위탁·국외 이전 등 자세한 내용은 개인정보처리방침에서 확인하실 수 있습니다.`;

const TERMS_MARKETING = `마케팅 정보 수신 및 활용 동의 (선택)
부청사 및 제휴사의 이벤트, 혜택, 사업자 지원 프로그램 등 마케팅 정보를 이메일·문자·앱 푸시로 수신하는 것에 동의합니다. 미동의 시에도 회원가입 및 서비스 이용에 제한이 없습니다.`;

/** 이메일에서 @ 앞부분과 도메인 분리 (도메인 목록에 있으면 해당 키, 없으면 직접입력) */
function parseEmailForForm(email) {
    const e = (email || '').toString().trim();
    if (!e || !e.includes('@')) return { emailId: '', emailDomain: 'naver.com', emailDomainCustom: '', email: e };
    const [id, domain] = e.split('@');
    const found = EMAIL_DOMAINS.find(d => d !== '직접입력' && d === domain);
    return {
        emailId: (id || '').trim(),
        emailDomain: found ? domain : '직접입력',
        emailDomainCustom: (domain || '').trim(),
        email: e
    };
}

const KAKAO_PROFILE_KEY = 'kakao_signup_profile';

const SignUpPage = ({ onSignUp }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fromKakao = searchParams.get('from') === 'kakao';
    const [kakaoProfile, setKakaoProfile] = useState(null);
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

    // 카카오 가입: 콜백에서 보관한 프로필(이름/연락처/이메일/kakaoId)로 폼 프리필
    useEffect(() => {
        if (!fromKakao || typeof sessionStorage === 'undefined') return;
        try {
            const raw = sessionStorage.getItem(KAKAO_PROFILE_KEY);
            if (!raw) return;
            const profile = JSON.parse(raw);
            setKakaoProfile(profile);
            setForm((prev) => {
                const next = { ...prev };
                const name = (profile.name || '').toString().trim();
                if (name) next.name = name;
                const phone = (profile.phone || '').toString().replace(/\D/g, '').slice(0, 11);
                if (phone) next.phone = phone;
                const email = (profile.email || '').toString().trim();
                if (email) {
                    const parsed = parseEmailForForm(email);
                    next.email = parsed.email;
                    next.emailId = parsed.emailId;
                    next.emailDomain = parsed.emailDomain;
                    next.emailDomainCustom = parsed.emailDomainCustom;
                }
                return next;
            });
        } catch (_) {}
    }, [fromKakao]);
    const BUSINESS_DOC_MAX_SIZE = 600 * 1024; // 600KB (base64 시 문서 크기 제한 고려)
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

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

    /** 만 나이 14세 미만 여부 (약관 제4조·개인정보보호법상 법정대리인 동의 대상은 가입 제한) */
    const isUnder14 = (ymd) => {
        const [y, m, d] = String(ymd || '').split('-').map(Number);
        if (!y || !m || !d) return false;
        const today = new Date();
        let age = today.getFullYear() - y;
        if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
        return age < 14;
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

    const inputClass = 'w-full h-[52px] px-4 bg-white border border-line2 rounded-lg text-[16px] text-ink placeholder:text-[#9a9893] focus:outline-none focus:border-royal transition-colors';
    const selectClass = `${inputClass} pr-3`;
    const labelClass = 'mb-2 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink';
    const optClass = 'text-[13px] font-normal text-sub';
    const fieldErrorClass = 'mt-1.5 text-[14px] text-red-600';

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
        else if (isUnder14(parseBirthdateInput(form.birthdate))) missing.push('만 14세 이상만 가입할 수 있습니다');
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
            // 회원 원본은 직접 읽을 수 없으므로 서버(checkSignupDuplicates)에서 일치 여부만 확인
            const dup = await firebaseService.checkSignupDuplicates({
                email: form.email || '',
                phone: normalizePhone(form.phone),
            });
            const existsEmail = dup.emailTaken;
            const existsPhone = dup.phoneTaken;
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

            const blockCheck = firebaseService.checkBlockedRegistration
                ? await firebaseService.checkBlockedRegistration({
                    email: form.email?.trim(),
                    phone: form.phone?.trim()
                })
                : { blocked: false };
            if (blockCheck.blocked) {
                const until = blockCheck.blockedUntil ? new Date(blockCheck.blockedUntil).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                setError(`관리자에 의해 강제 탈퇴된 계정입니다. ${until ? until + '까지' : '1년 동안'} 재가입이 제한됩니다. 문의는 관리자에게 해 주세요.`);
                setSubmitting(false);
                return;
            }
            if (fromKakao) {
                // 카카오 가입: 이미 Custom Token으로 Firebase Auth 세션이 있으므로 Firestore 문서만 생성
                const currentAuthUser = authService?.getCurrentUser?.();
                if (!currentAuthUser?.uid) {
                    setError('카카오 로그인 세션이 만료되었습니다. 카카오로 회원가입을 다시 시도해 주세요.');
                    setSubmitting(false);
                    return;
                }
                const kakaoUserData = {
                    ...userData,
                    ...(kakaoProfile?.kakaoId ? { kakaoId: String(kakaoProfile.kakaoId) } : {}),
                    providers: ['kakao'],
                    lastLoginProvider: 'kakao',
                };
                await firebaseService.createUser({ uid: currentAuthUser.uid, ...kakaoUserData });
                try { sessionStorage.removeItem(KAKAO_PROFILE_KEY); } catch (_) {}
                const fullUserData = { uid: currentAuthUser.uid, ...kakaoUserData, createdAt: new Date().toISOString() };
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

    const openPostcode = () => openDaumPostcode((data) => { if (data?.roadAddress) setForm(f => ({ ...f, roadAddress: data.roadAddress, zipCode: data.zipCode || '' })); });

    return (
        <div className="min-h-screen bg-white">
            <MgPageHead
                crumbs={
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[15px] text-white/75 hover:text-white"
                    >
                        <Icons.ArrowLeft size={18} aria-hidden="true" /> 이전
                    </button>
                }
                eyebrow={<span className="font-logo text-[18px] text-white md:text-[20px]">먼저가본</span>}
                title="회원가입"
                desc="표시(*)된 항목은 필수 입력입니다."
            />

            <MgWrap className="pb-20 pt-8 md:pt-12">
              <div className="mx-auto max-w-[720px]">
                    <div className="mb-6 space-y-2">
                        {fromKakao && (
                            <p className="flex items-start gap-2.5 rounded-xl bg-card px-4 py-3.5 text-[15px] leading-relaxed text-ink">
                                <span className="mt-0.5 inline-flex w-6 h-6 shrink-0 items-center justify-center bg-[#FEE500] text-[12px] font-semibold text-[#191919]" aria-hidden="true">K</span>
                                <span>카카오 계정으로 가입 중입니다. 카카오에서 가져온 정보가 미리 채워졌으며, 비밀번호는 입력하지 않아도 됩니다.</span>
                            </p>
                        )}
                        {fromKakao && (!kakaoProfile?.email || !kakaoProfile?.phone) && (
                            <p className="text-[15px] text-red-600">
                                카카오에서 {[!kakaoProfile?.email ? '이메일' : null, !kakaoProfile?.phone ? '연락처' : null].filter(Boolean).join('·')} 정보가 제공되지 않았습니다. 해당 항목은 직접 입력해 주세요.
                            </p>
                        )}
                        <p className="text-[13px] text-sub">자진 탈퇴 시 언제든 재가입 가능하며, 강제 탈퇴 시 1년간 재가입이 제한됩니다. (이용약관 제6조의2)</p>
                    </div>

                <div className="mb-8 rounded-xl bg-sky px-4 py-4 md:px-5">
                    <p className="flex items-start gap-2 text-[15px] font-semibold leading-relaxed text-ink">
                        <Icons.AlertCircle className="mt-0.5 w-5 h-5 shrink-0 text-royal" aria-hidden="true" />
                        이름, 생년월일, 성별, 연락처, 이메일, 비밀번호, 주소, {userType === '사업자' ? '상호명, 사업자등록번호, 업종/업태, 협업 업종, 핵심고객' : '희망업종(선택)'} 및 약관 동의 등 필수 항목을 입력해주세요.
                    </p>
                </div>

                    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                        {/* 회원 유형 */}
                        <div role="group" aria-labelledby="signup-page-usertype-label">
                            <p id="signup-page-usertype-label" className={labelClass}>
                                <RequiredFieldBadge number={1} isFilled={!!userType} />
                                회원 유형 <span className="text-red-600">*</span>
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    aria-pressed={userType === '사업자'}
                                    onClick={() => setUserType('사업자')}
                                    className={`min-h-[88px] rounded-lg border p-4 text-left transition-colors ${userType === '사업자' ? 'border-royal bg-sky ring-1 ring-royal' : 'border-line2 bg-white hover:border-ink'}`}
                                >
                                    <span className="text-[17px] font-semibold text-ink">사업자</span>
                                    <p className="mt-1 text-[14px] text-sub">현재 사업을 운영 중이신 분</p>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={userType === '예창'}
                                    onClick={() => setUserType('예창')}
                                    className={`min-h-[88px] rounded-lg border p-4 text-left transition-colors ${userType === '예창' ? 'border-royal bg-sky ring-1 ring-royal' : 'border-line2 bg-white hover:border-ink'}`}
                                >
                                    <span className="text-[17px] font-semibold text-ink">예비창업자</span>
                                    <p className="mt-1 text-[14px] text-sub">창업을 준비 중이신 분</p>
                                </button>
                            </div>
                        </div>

                        {userType && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label htmlFor="signup-page-name" className={labelClass}>
                                            <RequiredFieldBadge number={2} isFilled={!!(form.name || '').trim()} />
                                            이름 <span className="text-red-600">*</span>
                                        </label>
                                        <input id="signup-page-name" type="text" required autoComplete="name" placeholder="이름 입력" className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-nickname" className={labelClass}>닉네임 <span className={optClass}>(선택, 먼저가본 활동용)</span></label>
                                        <input id="signup-page-nickname" type="text" placeholder="닉네임 입력" className={inputClass} value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-birthdate" className={labelClass}>
                                            <RequiredFieldBadge number={3} isFilled={!!(form.birthdate || '').trim() && !!parseBirthdateInput(form.birthdate)} />
                                            생년월일 <span className="text-red-600">*</span>
                                        </label>
                                        <input id="signup-page-birthdate" type="text" inputMode="numeric" placeholder="YYYY-MM-DD (예: 1990-01-15)" className={inputClass} value={form.birthdate} onChange={e => { const v = e.target.value; const parsed = parseBirthdateInput(v); setForm(f => ({ ...f, birthdate: parsed || v })); }} />
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-gender" className={labelClass}>
                                            <RequiredFieldBadge number={4} isFilled={!!form.gender} />
                                            성별 <span className="text-red-600">*</span>
                                        </label>
                                        <select id="signup-page-gender" required className={selectClass} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                                            <option value="">선택</option>
                                            <option value="남성">남성</option>
                                            <option value="여성">여성</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-phone" className={labelClass}>
                                            <RequiredFieldBadge number={5} isFilled={!!(form.phone || '').trim() && validatePhone(form.phone)} />
                                            연락처 <span className="text-red-600">*</span> <span className={optClass}>(숫자 11자리)</span>
                                        </label>
                                        <input id="signup-page-phone" type="tel" inputMode="numeric" autoComplete="tel" required placeholder="01012345678" className={inputClass} value={form.phone} onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            if (raw.length > 11) {
                                                setError('연락처는 숫자 11자리만 입력 가능합니다.');
                                                setForm(f => ({ ...f, phone: raw.slice(0, 11) }));
                                            } else {
                                                setError(prev => prev === '연락처는 숫자 11자리만 입력 가능합니다.' ? '' : prev);
                                                setForm(f => ({ ...f, phone: raw }));
                                            }
                                        }} maxLength={11} />
                                        {form.phone && form.phone.length === 11 && !validatePhone(form.phone) && <p className={fieldErrorClass}>010, 011 등으로 시작하는 11자리 번호를 입력해주세요.</p>}
                                        <div className="mt-2 flex min-h-[44px] items-center gap-2.5">
                                            <input type="checkbox" id="signup-page-phonePublic" checked={form.phonePublic} onChange={e => setForm(f => ({ ...f, phonePublic: e.target.checked }))} className="w-5 h-5 accent-[#2d4fe0]" />
                                            <label htmlFor="signup-page-phonePublic" className="text-[15px] text-ink cursor-pointer">회원명단에서 연락처 공개 (선택)</label>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-email-id" className={labelClass}>
                                            <RequiredFieldBadge number={6} isFilled={!!(form.email || '').trim() && validateEmail(form.email)} />
                                            이메일 <span className="text-red-600">*</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <input id="signup-page-email-id" type="text" inputMode="email" autoComplete="username" required placeholder="example" className={`${inputClass} !w-auto flex-1 min-w-[110px]`} value={form.emailId} onChange={e => setForm(f => ({ ...f, emailId: e.target.value, email: composeEmail(e.target.value, f.emailDomain, f.emailDomainCustom) }))} />
                                            <span className="text-[16px] text-sub" aria-hidden="true">@</span>
                                            <select aria-label="이메일 도메인" className={`${selectClass} !w-auto min-w-[130px] flex-1`} value={form.emailDomain} onChange={e => setForm(f => ({ ...f, emailDomain: e.target.value, email: composeEmail(f.emailId, e.target.value, f.emailDomainCustom) }))}>
                                                {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            {form.emailDomain === '직접입력' && (
                                                <input type="text" aria-label="이메일 도메인 직접 입력" placeholder="도메인 입력" className={`${inputClass} !w-full`} value={form.emailDomainCustom} onChange={e => setForm(f => ({ ...f, emailDomainCustom: e.target.value, email: composeEmail(f.emailId, f.emailDomain, e.target.value) }))} />
                                            )}
                                        </div>
                                    </div>
                                    {!fromKakao && (
                                    <>
                                    <div>
                                        <label htmlFor="signup-page-password" className={labelClass}>
                                            <RequiredFieldBadge number={7} isFilled={!!(form.password || '').trim() && validatePassword(form.password).valid} />
                                            비밀번호 <span className="text-red-600">*</span>
                                        </label>
                                        <div className="relative">
                                            <input id="signup-page-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required placeholder="8자 이상, 영문+숫자+특수문자" className={`${inputClass} pr-12`} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                                            <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 flex w-11 h-11 items-center justify-center text-[#8a8883] hover:text-ink">{showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.password && !validatePassword(form.password).valid && <p className={fieldErrorClass}>{validatePassword(form.password).message}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="signup-page-password-confirm" className={labelClass}>
                                            <RequiredFieldBadge number={8} isFilled={!!(form.passwordConfirm || '').trim() && form.password === form.passwordConfirm} />
                                            비밀번호 확인 <span className="text-red-600">*</span>
                                        </label>
                                        <div className="relative">
                                            <input id="signup-page-password-confirm" type={showPasswordConfirm ? 'text' : 'password'} autoComplete="new-password" required className={`${inputClass} pr-12`} value={form.passwordConfirm} onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))} />
                                            <button type="button" aria-label={showPasswordConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'} onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-1 top-1/2 -translate-y-1/2 flex w-11 h-11 items-center justify-center text-[#8a8883] hover:text-ink">{showPasswordConfirm ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.passwordConfirm && form.password !== form.passwordConfirm && <p className={fieldErrorClass}>비밀번호가 일치하지 않습니다.</p>}
                                    </div>
                                    </>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label htmlFor="signup-page-road-address" className={labelClass}>
                                        <RequiredFieldBadge number={9} isFilled={!!(form.roadAddress || '').trim()} />
                                        주소 <span className="text-red-600">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input id="signup-page-road-address" type="text" readOnly placeholder="도로명 주소 검색" className={`${inputClass} flex-1 bg-card cursor-pointer`} value={form.roadAddress} onClick={openPostcode} />
                                            <button type="button" onClick={openPostcode} className="h-[52px] shrink-0 px-4 bg-[#1a1a1a] text-white rounded-lg font-bold hover:bg-black transition-colors text-[15px] whitespace-nowrap flex items-center gap-1.5">
                                                <Icons.MapPin size={16} aria-hidden="true" /> 주소 검색
                                            </button>
                                        </div>
                                        {form.zipCode ? <p className="text-[13px] text-sub">우편번호: {form.zipCode}</p> : null}
                                        <input type="text" aria-label="상세주소" placeholder="상세주소 입력 (동/호수 등)" className={inputClass} value={form.detailAddress} onChange={e => setForm(f => ({ ...f, detailAddress: e.target.value }))} />
                                    </div>
                                </div>

                                {userType === '사업자' && (
                                    <div className="space-y-5 border-t border-line pt-6">
                                        <div>
                                            <label htmlFor="signup-page-company" className={labelClass}>
                                                <RequiredFieldBadge number={11} isFilled={!!(form.company || '').trim()} />
                                                상호명 <span className="text-red-600">*</span>
                                            </label>
                                            <input id="signup-page-company" type="text" required autoComplete="organization" placeholder="회사 또는 사업체 이름" className={inputClass} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-bizno" className={labelClass}>
                                                <RequiredFieldBadge number={12} isFilled={isBusinessNumberValid} />
                                                사업자등록번호 <span className="text-red-600">*</span>
                                            </label>
                                            <input id="signup-page-bizno" type="text" inputMode="numeric" maxLength={10} placeholder="숫자 10자리 (예: 1234567890)" className={inputClass} value={form.businessRegistrationNumber} onChange={e => setForm(f => ({ ...f, businessRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                                            {form.businessRegistrationNumber && !isBusinessNumberValid && <p className={fieldErrorClass}>숫자 10자리를 입력해주세요.</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-position" className={labelClass}>직책/직함 <span className={optClass}>(선택)</span></label>
                                            <input id="signup-page-position" type="text" placeholder="예: 대표, 이사, 팀장" className={inputClass} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-company-phone" className={labelClass}>회사 전화번호 <span className={optClass}>(선택, 기입 시 회원명단에 노출)</span></label>
                                            <input id="signup-page-company-phone" type="tel" inputMode="numeric" placeholder="예: 02-1234-5678, 031-123-4567" className={inputClass} value={form.companyPhone} onChange={e => setForm(f => ({ ...f, companyPhone: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-company-website" className={labelClass}>회사 홈페이지 <span className={optClass}>(선택, 기입 시 회원명단에서 미리보기)</span></label>
                                            <input id="signup-page-company-website" type="url" placeholder="https://www.example.com" className={inputClass} value={form.companyWebsite} onChange={e => setForm(f => ({ ...f, companyWebsite: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-category" className={labelClass}>
                                                <RequiredFieldBadge number={13} isFilled={!!form.businessCategory} />
                                                업종 / 업태 <span className="text-red-600">*</span>
                                            </label>
                                            <select id="signup-page-category" required className={selectClass} value={form.businessCategory} onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))}>
                                                <option value="">선택</option>
                                                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-bizdoc" className={labelClass}>사업자등록증 <span className={optClass}>(선택, 이미지 또는 PDF)</span></label>
                                            <div className="flex flex-col gap-2">
                                                <input id="signup-page-bizdoc" type="file" accept="image/*,.pdf,application/pdf" className="w-full rounded-lg border border-line2 bg-white p-2.5 text-[15px] text-sub focus:border-royal focus:outline-none file:mr-3 file:h-10 file:px-4 file:rounded-lg file:border-0 file:bg-[#1a1a1a] file:text-white file:font-semibold file:text-[14px]" onChange={handleBusinessDocChange} />
                                                {form.businessRegistrationFileName && <p className="text-[14px] text-sub">등록됨: {form.businessRegistrationFileName}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-collab" className={labelClass}>
                                                <RequiredFieldBadge number={14} isFilled={!!(form.collaborationIndustry || '').trim()} />
                                                협업 업종 <span className="text-red-600">*</span>
                                            </label>
                                            <input id="signup-page-collab" type="text" required placeholder="협업 희망 업종" className={inputClass} value={form.collaborationIndustry} onChange={e => setForm(f => ({ ...f, collaborationIndustry: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label htmlFor="signup-page-customers" className={labelClass}>
                                                <RequiredFieldBadge number={15} isFilled={!!(form.keyCustomers || '').trim()} />
                                                핵심고객 <span className="text-red-600">*</span>
                                            </label>
                                            <input id="signup-page-customers" type="text" required placeholder="핵심 고객층" className={inputClass} value={form.keyCustomers} onChange={e => setForm(f => ({ ...f, keyCustomers: e.target.value }))} />
                                        </div>
                                    </div>
                                )}

                                {userType === '예창' && (
                                    <div>
                                        <label htmlFor="signup-page-desired" className={labelClass}>희망업종 <span className={optClass}>(선택)</span></label>
                                        <input id="signup-page-desired" type="text" placeholder="희망 업종 또는 분야" className={inputClass} value={form.desiredIndustry} onChange={e => setForm(f => ({ ...f, desiredIndustry: e.target.value }))} />
                                    </div>
                                )}

                                {/* PIPA 준수: 약관 동의 섹션 분리 */}
                                <div className="border border-line divide-y divide-line rounded-xl">
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <input type="checkbox" id="termsAgreed" checked={form.termsAgreed} onChange={e => setForm(f => ({ ...f, termsAgreed: e.target.checked }))} className="w-5 h-5 shrink-0 accent-[#2d4fe0]" />
                                        <RequiredFieldBadge number={9} isFilled={form.termsAgreed} />
                                        <label htmlFor="termsAgreed" className="flex-1 min-h-[44px] flex items-center text-[15px] font-semibold text-ink cursor-pointer">(필수) 이용약관 동의 <span className="ml-1 text-red-600">*</span></label>
                                        <button type="button" onClick={() => setTermsModal({ open: true, type: 'service' })} className="shrink-0 min-h-[44px] px-1 text-[14px] text-royal font-semibold underline-offset-2 hover:underline">내용보기</button>
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <input type="checkbox" id="privacyAgreed" checked={form.privacyAgreed} onChange={e => setForm(f => ({ ...f, privacyAgreed: e.target.checked }))} className="w-5 h-5 shrink-0 accent-[#2d4fe0]" />
                                        <RequiredFieldBadge number={10} isFilled={form.privacyAgreed} />
                                        <label htmlFor="privacyAgreed" className="flex-1 min-h-[44px] flex items-center text-[15px] font-semibold text-ink cursor-pointer">(필수) 개인정보처리방침을 읽었으며 동의합니다 <span className="ml-1 text-red-600">*</span></label>
                                        <button type="button" onClick={() => setTermsModal({ open: true, type: 'privacy' })} className="shrink-0 min-h-[44px] px-1 text-[14px] text-royal font-semibold underline-offset-2 hover:underline">내용보기</button>
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <input type="checkbox" id="marketingAgreed" checked={form.marketingAgreed} onChange={e => setForm(f => ({ ...f, marketingAgreed: e.target.checked }))} className="w-5 h-5 shrink-0 accent-[#2d4fe0]" />
                                        <label htmlFor="marketingAgreed" className="flex-1 min-h-[44px] flex items-center text-[15px] font-semibold text-ink cursor-pointer">(선택) 마케팅 정보 수신 및 활용 동의</label>
                                        <button type="button" onClick={() => setTermsModal({ open: true, type: 'marketing' })} className="shrink-0 min-h-[44px] px-1 text-[14px] text-royal font-semibold underline-offset-2 hover:underline">내용보기</button>
                                    </div>
                                </div>

                                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700 whitespace-pre-line">{error}</p>}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => navigate(-1)} className="h-[52px] px-6 bg-white border border-line2 text-ink text-[16px] font-semibold rounded-lg hover:border-ink transition-colors">취소</button>
                                    <button type="submit" disabled={submitting} className="flex-1 h-[52px] bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {submitting ? '가입 처리 중...' : '가입하기'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
              </div>
            </MgWrap>

            {/* 약관 내용보기 모달 */}
            {termsModal.open && (
                <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={() => setTermsModal({ open: false, type: '' })}>
                    <div role="dialog" aria-modal="true" aria-labelledby="signup-page-terms-title" className="bg-white rounded-t-[18px] md:rounded-[18px] max-w-[560px] w-full max-h-[85vh] md:max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <h3 id="signup-page-terms-title" className="px-6 pt-6 pb-4 border-b border-line text-[22px] font-bold text-ink">
                            {termsModal.type === 'service' && '이용약관'}
                            {termsModal.type === 'privacy' && '개인정보 수집 및 이용'}
                            {termsModal.type === 'marketing' && '마케팅 정보 수신 및 활용'}
                        </h3>
                        <div className="px-6 py-4 overflow-y-auto text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                            {termsModal.type === 'service' && TERMS_SERVICE}
                            {termsModal.type === 'privacy' && TERMS_PRIVACY}
                            {termsModal.type === 'marketing' && TERMS_MARKETING}
                        </div>
                        <div className="px-6 py-4 border-t border-line">
                            <button type="button" onClick={() => setTermsModal({ open: false, type: '' })} className="w-full h-[52px] bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignUpPage;
