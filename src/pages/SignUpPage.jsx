import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { authService } from '../services/authService';
import { firebaseService } from '../services/firebaseService';
import { loadUsersFromStorage } from '../utils/authUtils';

const normalizePhone = (p) => (p || '').replace(/\D/g, '');

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

const SignUpPage = ({ onSignUp }) => {
    const navigate = useNavigate();
    const [userType, setUserType] = useState('');
    const [form, setForm] = useState({
        name: '',
        nickname: '',
        birthdate: '',
        phone: '',
        email: '',
        password: '',
        passwordConfirm: '',
        company: '',
        businessRegistrationNumber: '',
        position: '',
        businessCategory: '',
        collaborationIndustry: '',
        keyCustomers: '',
        desiredIndustry: '',
        businessRegistrationDoc: '',
        businessRegistrationFileName: '',
        termsAgreed: false,
        privacyAgreed: false,
        marketingAgreed: false,
    });
    const [termsModal, setTermsModal] = useState({ open: false, type: '' }); // 'service' | 'privacy' | 'marketing'
    const BUSINESS_DOC_MAX_SIZE = 600 * 1024; // 600KB (base64 시 문서 크기 제한 고려)
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
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

    const isRequiredFilled = useMemo(() => {
        const validBirthdate = parseBirthdateInput(form.birthdate);
        if (!userType || !form.name?.trim() || !validBirthdate || !form.phone?.trim() || !form.email?.trim()) return false;
        if (!form.password || !form.passwordConfirm) return false;
        if (!validateEmail(form.email)) return false;
        if (!validatePassword(form.password).valid) return false;
        if (form.password !== form.passwordConfirm) return false;
        if (!validatePhone(form.phone)) return false;
        if (userType === '사업자' && (!form.businessCategory || !form.company?.trim() || !isBusinessNumberValid)) return false;
        if (!form.termsAgreed || !form.privacyAgreed) return false;
        return true;
    }, [userType, form, isBusinessNumberValid]);

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
        if (!isRequiredFilled) {
            setError('필수 항목(*)을 모두 올바르게 입력해주세요.');
            return;
        }
        const pv = validatePassword(form.password);
        if (!pv.valid) {
            setError(pv.message);
            return;
        }
        if (form.password !== form.passwordConfirm) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (!validateEmail(form.email)) {
            setError('올바른 이메일 형식을 입력해주세요.');
            return;
        }
        if (!validatePhone(form.phone)) {
            setError('연락처는 숫자 11자리만 입력 가능합니다. (예: 01012345678)');
            return;
        }
        if (!parseBirthdateInput(form.birthdate)) {
            setError('생년월일을 YYYY-MM-DD 형식으로 입력해주세요.');
            return;
        }
        if (!form.termsAgreed) {
            setError('이용약관 동의에 체크해주세요.');
            return;
        }
        if (!form.privacyAgreed) {
            setError('개인정보 수집 및 이용 동의에 체크해주세요.');
            return;
        }
        if (userType === '사업자') {
            if (!form.company?.trim()) {
                setError('상호명을 입력해주세요.');
                return;
            }
            if (!isBusinessNumberValid) {
                setError('사업자등록번호 10자리 숫자를 입력해주세요.');
                return;
            }
            if (!form.businessCategory) {
                setError('업종/업태를 선택해주세요.');
                return;
            }
        }

        setSubmitting(true);
        try {
            const allUsers = firebaseService?.getUsers ? await firebaseService.getUsers() : await loadUsersFromStorage();
            const users = Array.isArray(allUsers) ? allUsers : [];
            const existsEmail = users.some(u => (u.email || '').toLowerCase() === form.email.trim().toLowerCase());
            const phoneNorm = normalizePhone(form.phone);
            const existsPhone = phoneNorm ? users.some(u => normalizePhone(u.phone || u.phoneNumber) === phoneNorm) : false;
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
                phone: form.phone.trim(),
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
                businessRegistrationDoc: (userType === '사업자' && form.businessRegistrationDoc) || '',
                businessRegistrationFileName: (userType === '사업자' && form.businessRegistrationFileName) || '',
                termsAgreed: form.termsAgreed,
                marketingAgreed: form.marketingAgreed,
                approvalStatus: 'pending',
                img: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name.trim())}&background=random`,
            };
            const user = await authService.signUp(form.email, form.password, userData);
            const fullUserData = { uid: user.uid, ...userData, createdAt: new Date().toISOString() };
            if (onSignUp) onSignUp(fullUserData);
            alert('회원가입이 완료되었습니다.\n관리자 승인 후 서비스를 이용하실 수 있습니다.');
            navigate('/', { replace: true });
        } catch (err) {
            const msg = err.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일입니다.' : (err.message || '회원가입에 실패했습니다.');
            setError(msg);
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
                    <p className="text-sm text-gray-500 mt-1">표시(*)된 항목은 필수 입력입니다. 협업 업종·핵심고객은 선택입니다.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 md:p-8">
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                            <Icons.AlertCircle className="w-5 h-5 shrink-0" />
                            이름, 생년월일, 연락처, 이메일, 비밀번호, {userType === '사업자' ? '상호명, 사업자등록번호, 업종/업태' : '희망업종(선택)'} 및 약관 동의 등 필수 항목을 입력해주세요.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 회원 유형 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">회원 유형 <span className="text-red-500">*</span></label>
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
                                        <label className="block text-sm font-bold text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="이름 입력" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">닉네임 <span className="text-gray-400 text-xs">(선택, 부청사 활동용)</span></label>
                                        <input type="text" placeholder="닉네임 입력" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">생년월일 <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(청년 확인용)</span></label>
                                        <input type="text" inputMode="numeric" placeholder="YYYY-MM-DD (예: 1990-01-15)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.birthdate} onChange={e => { const v = e.target.value; const parsed = parseBirthdateInput(v); setForm(f => ({ ...f, birthdate: parsed || v })); }} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">연락처 <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(숫자 11자리)</span></label>
                                        <input type="tel" inputMode="numeric" required placeholder="01012345678" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.phone} onChange={e => {
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
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
                                        <input type="email" required placeholder="example@email.com" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} required placeholder="8자 이상, 영문+숫자+특수문자" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none pr-10" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.password && !validatePassword(form.password).valid && <p className="text-xs text-red-500 mt-1">{validatePassword(form.password).message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 확인 <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input type={showPasswordConfirm ? 'text' : 'password'} required className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none pr-10" value={form.passwordConfirm} onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))} />
                                            <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPasswordConfirm ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}</button>
                                        </div>
                                        {form.passwordConfirm && form.password !== form.passwordConfirm && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
                                    </div>
                                </div>

                                {userType === '사업자' && (
                                    <div className="space-y-5 pt-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">상호명 <span className="text-red-500">*</span></label>
                                            <input type="text" required placeholder="회사 또는 사업체 이름" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">사업자등록번호 <span className="text-red-500">*</span></label>
                                            <input type="text" inputMode="numeric" maxLength={10} placeholder="숫자 10자리 (예: 1234567890)" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.businessRegistrationNumber} onChange={e => setForm(f => ({ ...f, businessRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                                            {form.businessRegistrationNumber && !isBusinessNumberValid && <p className="text-xs text-red-500 mt-1">숫자 10자리를 입력해주세요.</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">직책/직함 <span className="text-gray-400 text-xs">(선택)</span></label>
                                            <input type="text" placeholder="예: 대표, 이사, 팀장" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">업종 / 업태 <span className="text-red-500">*</span></label>
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
                                            <label className="block text-sm font-bold text-gray-700 mb-2">협업 업종 <span className="text-gray-400 text-xs">(선택)</span></label>
                                            <input type="text" placeholder="협업 희망 업종" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.collaborationIndustry} onChange={e => setForm(f => ({ ...f, collaborationIndustry: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">핵심고객 <span className="text-gray-400 text-xs">(선택)</span></label>
                                            <input type="text" placeholder="핵심 고객층" className="w-full p-3 border border-blue-200 rounded-xl focus:border-brand focus:outline-none" value={form.keyCustomers} onChange={e => setForm(f => ({ ...f, keyCustomers: e.target.value }))} />
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
                                            <div className="flex-1">
                                                <label htmlFor="termsAgreed" className="text-sm font-bold text-gray-700 cursor-pointer">(필수) 이용약관 동의 <span className="text-red-500">*</span></label>
                                                <button type="button" onClick={() => setTermsModal({ open: true, type: 'service' })} className="ml-2 text-xs text-brand font-medium hover:underline">내용보기</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" id="privacyAgreed" checked={form.privacyAgreed} onChange={e => setForm(f => ({ ...f, privacyAgreed: e.target.checked }))} className="mt-1 w-5 h-5 text-brand rounded" />
                                            <div className="flex-1">
                                                <label htmlFor="privacyAgreed" className="text-sm font-bold text-gray-700 cursor-pointer">(필수) 개인정보 수집 및 이용 동의 <span className="text-red-500">*</span></label>
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

                                {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">취소</button>
                                    <button type="submit" disabled={!isRequiredFilled || submitting} className="flex-1 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
