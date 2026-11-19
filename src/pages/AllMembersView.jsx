import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { firebaseService } from '../services/firebaseService';
import { translateFirebaseError } from '../utils/errorUtils';
import ModalPortal from '../components/ModalPortal';
import { MgWrap, MgPageHead, MgInfoTable } from '../components/mg/Mg';

const PAGE_SIZE = 10;

/** 회원 문서에서 주소 문자열 수집 — 예전 가입자 포함, 모든 가능한 필드와 값 기준 수집 */
const getMemberAddressString = (member) => {
    if (!member) return '';
    const toStr = (v) => (v != null && typeof v === 'string' ? v.trim() : '');
    const parts = [];
    const seen = new Set();

    // 1) 알려진 주소 필드명 (다양한 표기)
    const knownKeys = [
        'roadAddress', 'road_address', 'RoadAddress', 'address', 'Address', 'region', 'Region',
        'detailAddress', 'detail_address', 'DetailAddress', 'locationAddress', 'location_address',
        'addr', 'location', '주소', 'addressDetail', 'fullAddress', 'jibunAddress', 'autoJibunAddress'
    ];
    for (const k of knownKeys) {
        const s = toStr(member[k]);
        if (s && s.length > 0 && s.length < 600 && !seen.has(s)) {
            seen.add(s);
            parts.push(s);
        }
    }

    // 2) 주소가 객체로 저장된 경우
    if (member.address && typeof member.address === 'object') {
        const o = member.address;
        for (const k of ['roadAddress', 'address', 'region', 'detailAddress', 'road_address', 'address_name']) {
            const s = toStr(o[k]);
            if (s && !seen.has(s)) { seen.add(s); parts.push(s); }
        }
    }

    // 3) 문서 전체에서 문자열 값 중 "○○구" 패턴이 들어있는 것만 수집 (예전 가입자용)
    const nonAddressKeys = new Set([
        'uid', 'id', 'email', 'name', 'phone', 'password', 'img', 'createdAt', 'updatedAt',
        'approvalStatus', 'memberGrade', 'role', 'company', 'industry', 'businessCategory',
        'position', 'keyCustomers', 'collaborationIndustry', 'companyPhone', 'companyWebsite',
        'phonePublic', 'userType', 'businessRegistrationNumber', 'businessVerified', 'businessType',
        'verifiedName', 'verifiedPhone', 'verifiedBirthday', 'verifiedGender', 'impUid', 'isIdentityVerified',
        'title', 'desc', 'description', 'category'
    ]);
    for (const key of Object.keys(member)) {
        if (nonAddressKeys.has(key)) continue;
        const v = member[key];
        if (v == null || typeof v !== 'string') continue;
        const s = v.trim();
        if (s.length < 10 || s.length > 600) continue;
        if (!/[가-힣]+구/.test(s)) continue; // 지역구 패턴이 있을 때만
        if (/^https?:\/\//i.test(s) || s.includes('@') || /^\d+[-.]?\d+[-.]?\d+$/.test(s.replace(/\s/g, ''))) continue; // URL, 이메일, 전화만 있는 값 제외
        if (!seen.has(s)) { seen.add(s); parts.push(s); }
    }

    return parts.join(' ').trim() || '';
};

/** 주소 문자열에서 "○○구"만 추출 — 구로 끝나는 항목(해운대구, 부산진구 등) */
const getDistrictFromAddress = (addressStr) => {
    if (!addressStr || typeof addressStr !== 'string') return '';
    // "해운대구", "부산진구" 형태: 한글+구 (공백 허용: "해운대 구" → 해운대구)
    const tight = addressStr.match(/([가-힣]+구)/);
    if (tight) return tight[1];
    const withSpace = addressStr.match(/([가-힣]+)\s*구\b/);
    if (withSpace) return withSpace[1].trim() + '구';
    return '';
};

/** 연락처 비공개 시 표시용 포맷 (실제 번호는 블러 처리로만 가림) */
const formatPhoneDisplay = (phone) => {
    if (!phone) return '010-0000-0000';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 8) return '010-0000-0000';
    return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(-4);
};

/** 등급 표시(개편 규칙: 검정·로얄블루·하늘·회색만 사용) */
const gradeBadgeClass = (grade) => (
    grade === '마스터' ? 'bg-[#0c0c0e] text-white' :
    grade === '운영진' ? 'bg-royal text-white' :
    grade === '파트너사' ? 'border border-royal bg-white text-royal' :
    grade === '사업자' ? 'bg-sky text-royal' :
    'bg-card text-sub'
);

const formatJoinDate = (member) => (
    member.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? (typeof member.createdAt === 'string' ? new Date(member.createdAt).toLocaleDateString('ko-KR') : null) ?? '-'
);

const SORT_OPTIONS = [
    ['memberGrade', '회원등급'],
    ['name', '회원명'],
    ['district', '지역구'],
    ['company', '회사명'],
    ['industry', '업종/업태'],
    ['createdAt', '가입일자'],
];

const FIELD_LABEL = 'mb-2 flex items-center gap-1.5 text-[14px] font-bold text-[#1a1a1a]';
const FIELD_INPUT = 'h-12 w-full rounded-lg border border-line2 bg-white px-3.5 text-[15px] text-[#222] outline-none placeholder:text-[#9a9893] focus:border-royal';

const AllMembersView = ({ onBack, members, currentUser, pageTitles, currentPage: currentPageProp, onPageChange }) => {
    const [searchName, setSearchName] = useState('');
    const [searchIndustry, setSearchIndustry] = useState('');
    const [searchRegion, setSearchRegion] = useState('');
    const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('전체');
    const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('전체');
    const [selectedGradeFilter, setSelectedGradeFilter] = useState('전체');
    const [selectedMember, setSelectedMember] = useState(null);
    const [filteredMembers, setFilteredMembers] = useState(members);
    const [sortKey, setSortKey] = useState('memberGrade');
    const [sortOrder, setSortOrder] = useState('asc');
    const [internalPage, setInternalPage] = useState(1);
    const isPageControlled = currentPageProp != null && typeof onPageChange === 'function';
    const currentPage = isPageControlled ? currentPageProp : internalPage;
    const setCurrentPage = isPageControlled ? (v) => { const next = typeof v === 'function' ? v(currentPage) : v; onPageChange(next); } : setInternalPage;
    const prevFilterRef = React.useRef({ searchName: '', searchIndustry: '', searchRegion: '', selectedDistrictFilter: '전체', selectedIndustryFilter: '전체', selectedGradeFilter: '전체' });
    const isOwnProfile = currentUser && selectedMember && (currentUser.uid === selectedMember.uid || currentUser.id === selectedMember.id);
    const hasSite = !!selectedMember?.companyWebsite;

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && selectedMember) {
                setSelectedMember(null);
            }
        };
        
        if (selectedMember) {
            window.addEventListener('keydown', handleEscKey);
            return () => {
                window.removeEventListener('keydown', handleEscKey);
            };
        }
    }, [selectedMember]);
    
    // 회원 강퇴 핸들러 (Auth 삭제 후 Firestore 삭제 → 재가입 가능)
    const handleDeleteMember = async (member) => {
        if (!confirm('정말 이 회원을 강퇴하시겠습니까? 강제 탈퇴 시 1년간 재가입이 제한됩니다.')) {
            return;
        }

        // 명단은 공개 프로필(publicProfiles)이라 이메일·연락처가 없다 → 관리자 권한으로 회원 원본을 다시 읽는다
        let fullMember = member;
        try {
            const memberDocId = member?.id || member?.uid;
            const full = memberDocId && firebaseService?.getUser ? await firebaseService.getUser(memberDocId) : null;
            if (full) fullMember = { ...member, ...full };
        } catch (_) {}
        member = fullMember;
        const uid = member?.uid || member?.id;
        const memberId = member?.id || member?.uid;
        const email = (member?.email || '').toString().trim();
        const phone = (member?.phone || member?.phoneNumber || '').toString().trim();

        if (firebaseService && firebaseService.deleteUser) {
            try {
                if (firebaseService.purgeUserRelatedData) {
                    await firebaseService.purgeUserRelatedData({
                        id: memberId,
                        uid: uid || memberId,
                        name: member.name,
                        email: member.email,
                        phone: member.phone || member.phoneNumber,
                    });
                }
                if (firebaseService.addBlockedRegistration && uid) {
                    await firebaseService.addBlockedRegistration(uid, email, phone);
                }
                if (firebaseService.deleteAuthUser && uid) {
                    await firebaseService.deleteAuthUser(uid);
                }
                await firebaseService.deleteUser(memberId);
                setFilteredMembers(filteredMembers.filter(m => m.id !== memberId && m.uid !== memberId));
                alert('회원이 강퇴되었습니다. 해당 회원은 1년간 재가입이 제한됩니다.');
            } catch (error) {
                const errorMessage = translateFirebaseError ? translateFirebaseError(error) : (error?.message || '회원 강퇴 중 오류가 발생했습니다.');
                alert(`회원 강퇴에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            alert('회원 강퇴 기능을 사용할 수 없습니다.');
        }
    };

    // 업종 목록 추출
    const industries = ['전체', ...new Set(members.map(m => m.industry || m.businessCategory || '기타').filter(Boolean))];
    // 등급 목록·정렬 순서: 마스터 → 운영진(운영자) → 파트너사 → 사업자 → 예창(예비창업자) → 대기자(대기)
    const grades = ['전체', '마스터', '운영진', '파트너사', '사업자', '예창', '대기자'];
    const GRADE_PRIORITY = { '마스터': 0, '운영진': 1, '파트너사': 2, '사업자': 3, '예창': 4, '대기자': 5 };

    // 회원가입 시 입력된 주소에서 지역구(○○구) 추출하여 목록 생성
    const districts = React.useMemo(() => {
        const addrToDistrict = (m) => getDistrictFromAddress(getMemberAddressString(m));
        const set = new Set(members.map(addrToDistrict).filter(Boolean));
        return ['전체', ...[...set].sort((a, b) => a.localeCompare(b, 'ko'))];
    }, [members]);

    useEffect(() => {
        let filtered = members.filter(member => {
            const fullAddress = getMemberAddressString(member);
            const matchName = !searchName || member.name.toLowerCase().includes(searchName.toLowerCase());
            const matchIndustry = !searchIndustry || (member.industry || member.businessCategory || '').toLowerCase().includes(searchIndustry.toLowerCase());
            const matchRegion = !searchRegion || fullAddress.includes(searchRegion);
            const matchDistrict = selectedDistrictFilter === '전체' || getDistrictFromAddress(fullAddress) === selectedDistrictFilter;
            const matchIndustryFilter = selectedIndustryFilter === '전체' || (member.industry || member.businessCategory || '기타') === selectedIndustryFilter;
            const matchGradeFilter = selectedGradeFilter === '전체' || (member.memberGrade || '') === selectedGradeFilter;
            return matchName && matchIndustry && matchRegion && matchDistrict && matchIndustryFilter && matchGradeFilter;
        });
        setFilteredMembers(filtered);
        const prev = prevFilterRef.current;
        const filterChanged = prev.searchName !== searchName || prev.searchIndustry !== searchIndustry || prev.searchRegion !== searchRegion || prev.selectedDistrictFilter !== selectedDistrictFilter || prev.selectedIndustryFilter !== selectedIndustryFilter || prev.selectedGradeFilter !== selectedGradeFilter;
        if (filterChanged) {
            prevFilterRef.current = { searchName, searchIndustry, searchRegion, selectedDistrictFilter, selectedIndustryFilter, selectedGradeFilter };
            setCurrentPage(1);
        }
    }, [searchName, searchIndustry, searchRegion, selectedDistrictFilter, selectedIndustryFilter, selectedGradeFilter, members]);

    const hasActiveFilter = Boolean(searchName || searchIndustry || searchRegion || selectedDistrictFilter !== '전체' || selectedIndustryFilter !== '전체' || selectedGradeFilter !== '전체');

    const sortedMembers = React.useMemo(() => {
        const getVal = (m, k) => {
            if (k === 'createdAt') {
                const c = m.createdAt;
                if (!c) return 0;
                if (typeof c.toDate === 'function') return c.toDate().getTime();
                if (typeof c === 'string') return new Date(c).getTime();
                return 0;
            }
            if (k === 'industry') {
                return (m.industry || m.businessCategory || '').toString().trim().toLowerCase();
            }
            if (k === 'memberGrade') {
                const g = (m.memberGrade || '').toString().trim();
                return GRADE_PRIORITY[g] ?? 99;
            }
            if (k === 'district') {
                return (getDistrictFromAddress(getMemberAddressString(m)) || '').toString().trim().toLowerCase();
            }
            return (m[k] || '').toString().trim().toLowerCase();
        };
        const list = [...filteredMembers];
        const order = sortOrder === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            const va = getVal(a, sortKey);
            const vb = getVal(b, sortKey);
            if (sortKey === 'createdAt') return order * (va - vb);
            if (sortKey === 'memberGrade') {
                const gradeCompare = order * (va - vb);
                if (gradeCompare !== 0) return gradeCompare;
                return getVal(a, 'createdAt') - getVal(b, 'createdAt');
            }
            if (va < vb) return -1 * order;
            if (va > vb) return 1 * order;
            return 0;
        });
        return list;
    }, [filteredMembers, sortKey, sortOrder]);

    const totalPages = Math.max(1, Math.ceil(sortedMembers.length / PAGE_SIZE));
    const paginatedMembers = sortedMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    // 관리자가 바꾼 화면 제목(pageTitles.members)이 있으면 그 글을 쓴다(글 크기·굵기는 개편 규칙을 따름)
    const pageTitleText = pageTitles?.members?.text || '먼저가본 회원';

    return (
        <div className="min-h-screen min-h-0 overflow-y-auto bg-white">
            <MgPageHead
                eyebrow="MEMBERS"
                title={<span style={{ whiteSpace: 'pre-line' }}>{pageTitleText}</span>}
                desc="신뢰 기반의 인맥 네트워킹"
            >
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-[15px] font-semibold text-white transition-colors hover:border-white">
                    <Icons.ArrowLeft size={18} /> 메인으로 돌아가기
                </button>
            </MgPageHead>

            <section className="py-10 md:py-14" aria-label="회원 명단">
                <MgWrap>
                    {/* 검색·거르기 */}
                    <div className="rounded-xl bg-card p-4 md:p-6">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                            <div>
                                <label htmlFor="members-search-name" className={FIELD_LABEL}><Icons.Search size={15} className="text-royal" aria-hidden="true" /> 이름 검색</label>
                                <input id="members-search-name" type="text" placeholder="이름을 입력하세요" className={FIELD_INPUT} value={searchName} onChange={e => setSearchName(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="members-search-industry" className={FIELD_LABEL}><Icons.Briefcase size={15} className="text-royal" aria-hidden="true" /> 업종 검색</label>
                                <input id="members-search-industry" type="text" placeholder="업종을 입력하세요" className={FIELD_INPUT} value={searchIndustry} onChange={e => setSearchIndustry(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="members-search-region" className={FIELD_LABEL}><Icons.MapPin size={15} className="text-royal" aria-hidden="true" /> 지역</label>
                                <input id="members-search-region" type="text" placeholder="지역을 입력하세요" className={FIELD_INPUT} value={searchRegion} onChange={e => setSearchRegion(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="members-filter-district" className={FIELD_LABEL}><Icons.MapPin size={15} className="text-royal" aria-hidden="true" /> 지역구</label>
                                <select id="members-filter-district" className={`cursor-pointer ${FIELD_INPUT}`} value={selectedDistrictFilter} onChange={e => setSelectedDistrictFilter(e.target.value)}>
                                    {districts.map(district => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="members-filter-industry" className={FIELD_LABEL}><Icons.Tag size={15} className="text-royal" aria-hidden="true" /> 업종</label>
                                <select id="members-filter-industry" className={`cursor-pointer ${FIELD_INPUT}`} value={selectedIndustryFilter} onChange={e => setSelectedIndustryFilter(e.target.value)}>
                                    {industries.map(industry => (
                                        <option key={industry} value={industry}>{industry}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="members-filter-grade" className={FIELD_LABEL}><Icons.Award size={15} className="text-royal" aria-hidden="true" /> 등급</label>
                                <select id="members-filter-grade" className={`cursor-pointer ${FIELD_INPUT}`} value={selectedGradeFilter} onChange={e => setSelectedGradeFilter(e.target.value)}>
                                    {grades.map(grade => (
                                        <option key={grade} value={grade}>{grade}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 인원 · 정렬 */}
                    <div className="mt-6 flex flex-col gap-3 border-b border-[#0c0c0e] pb-4 md:flex-row md:items-center md:justify-between">
                        <p className="text-[16px] text-ink" aria-live="polite">
                            {hasActiveFilter ? '검색 결과' : '전체'} <span className="font-bold text-royal">{filteredMembers.length}</span>명
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="정렬">
                            <span className="mr-1 text-[14px] text-sub">정렬</span>
                            {SORT_OPTIONS.map(([key, label]) => {
                                const on = sortKey === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={on}
                                        aria-label={`${label} ${on ? (sortOrder === 'asc' ? '오름차순' : '내림차순') : ''}으로 정렬`}
                                        onClick={() => handleSort(key)}
                                        className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3.5 text-[14px] transition-colors ${on ? 'border-royal font-semibold text-royal' : 'border-line2 text-[#333] hover:border-ink'}`}
                                    >
                                        {label}
                                        {on ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} aria-hidden="true" /> : <Icons.ChevronDown size={14} aria-hidden="true" />) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 회원 카드 목록: 회원등급 | 회원명 | 지역구 | 회사명 | 업종/업태 | 가입일자 */}
                    {paginatedMembers.length === 0 ? (
                        <p className="mt-6 rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">조건에 맞는 회원이 없습니다.</p>
                    ) : (
                        <ul className="mt-5 grid gap-2.5 md:grid-cols-2 md:gap-3">
                            {paginatedMembers.map((member, idx) => {
                                const district = getDistrictFromAddress(getMemberAddressString(member));
                                return (
                                    <li key={member.id || member.uid || idx} className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMember(member)}
                                            className="flex h-full min-h-[108px] w-full min-w-0 flex-col rounded-xl border border-line bg-white px-4 py-4 text-left transition-colors hover:border-ink md:px-5"
                                        >
                                            <span className="flex w-full items-center gap-2">
                                                {member.memberGrade ? (
                                                    <span className={`shrink-0 px-2 py-0.5 text-[13px] font-semibold ${gradeBadgeClass(member.memberGrade)}`}>{member.memberGrade}</span>
                                                ) : null}
                                                <span className="min-w-0 truncate text-[17px] font-semibold text-ink md:text-[18px]">{member.name || '-'}</span>
                                                <span className="ml-auto shrink-0 text-[13px] text-sub">{formatJoinDate(member)}</span>
                                            </span>
                                            <span className="mt-2 block w-full truncate text-[15px] text-[#333]">{member.company || '-'}</span>
                                            <span className="mt-1 block w-full truncate text-[14px] text-sub">
                                                {[district || null, member.industry || member.businessCategory || null].filter(Boolean).join(' · ') || '-'}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* 페이지 넘기기: 10명 초과 시 표시 */}
                    {totalPages > 1 && (
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:gap-6">
                            <p className="order-2 text-[14px] text-sub sm:order-1">
                                전체 <span className="font-bold text-royal">{sortedMembers.length}</span>명
                                {sortedMembers.length > PAGE_SIZE && (
                                    <> · {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, sortedMembers.length)}번 표시</>
                                )}
                            </p>
                            <div className="order-1 flex items-center justify-center gap-3 sm:order-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="h-11 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    이전
                                </button>
                                <span className="min-w-[56px] text-[15px] text-ink">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="h-11 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    다음
                                </button>
                            </div>
                        </div>
                    )}
                </MgWrap>
            </section>

            {/* 회원 상세 창 (ESC로 닫기) */}
            {selectedMember && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedMember(null); }}>
                        {/* 예전 구조 유지: 바깥 눌러 닫기 동작이 바뀌지 않도록 덮개 층을 그대로 둔다 */}
                        <div className="absolute inset-0" aria-hidden="true"></div>
                        <div role="dialog" aria-modal="true" aria-labelledby="member-detail-name" className={`z-10 flex w-full flex-col rounded-[18px] bg-white ${hasSite ? 'max-h-[calc(100dvh-32px)] max-w-7xl md:max-h-[92vh]' : 'max-h-[calc(100dvh-32px)] max-w-6xl md:max-h-[calc(90vh-100px)]'}`} style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
                                {/* 선택된 회원 상세 정보 */}
                                <div className="mb-6 flex flex-col gap-5 md:flex-row md:gap-6">
                                    <div className="mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-card md:mx-0 md:h-32 md:w-32">
                                        <img
                                            src={selectedMember.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || '회원')}&background=random`}
                                            alt={selectedMember.name || '회원 프로필'}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => {
                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || '회원')}&background=random`;
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 id="member-detail-name" className="mb-1.5 text-[24px] font-bold text-ink md:text-[28px]">{selectedMember.name || '이름 없음'}</h3>
                                        <p className="mb-3 text-[16px] font-semibold text-royal">
                                            {selectedMember.company || selectedMember.role
                                                ? [selectedMember.company, selectedMember.role].filter(Boolean).join(' | ')
                                                : '정보 없음'}
                                        </p>
                                        <div className="mb-4 flex flex-wrap items-center gap-2">
                                            <span className="inline-block bg-sky px-3 py-1 text-[14px] font-semibold text-royal">{selectedMember.industry || selectedMember.businessCategory || '업종 미지정'}</span>
                                            {selectedMember.memberGrade && (
                                                <span className={`inline-block px-3 py-1 text-[14px] font-semibold ${gradeBadgeClass(selectedMember.memberGrade)}`}>
                                                    {selectedMember.memberGrade}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mb-3 flex flex-wrap items-center gap-4 text-[15px] text-[#333]">
                                            <div className="flex items-center gap-1.5">
                                                <Icons.Phone className="h-4 w-4 text-sub" aria-hidden="true" />
                                                <span>
                                                    {selectedMember.phonePublic
                                                        ? (selectedMember.phone || '010-****-****')
                                                        : (
                                                            <span
                                                                className="inline-block select-none"
                                                                style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}
                                                                aria-label="연락처 비공개"
                                                            >
                                                                {formatPhoneDisplay(selectedMember.phone || selectedMember.verifiedPhone)}
                                                            </span>
                                                        )}
                                                </span>
                                            </div>
                                            {selectedMember.companyPhone && (
                                                <div className="flex items-center gap-1.5">
                                                    <Icons.Phone className="h-4 w-4 text-sub" aria-hidden="true" />
                                                    <span>회사 {selectedMember.companyPhone}</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* PortOne 본인인증 상태 표시 */}
                                        {selectedMember.isIdentityVerified ? (
                                            <div className="inline-flex items-center gap-2 rounded-lg border border-skyLine bg-sky px-3 py-2">
                                                <Icons.CheckCircle className="h-4 w-4 text-royal" aria-hidden="true" />
                                                <span className="text-[14px] font-semibold text-royal">PortOne 본인인증 완료</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
                                                <Icons.X className="h-4 w-4 text-sub" aria-hidden="true" />
                                                <span className="text-[14px] text-sub">본인인증 미완료</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* PortOne 본인인증 정보 상세 (인증 완료 시에만 표시) */}
                                {selectedMember.isIdentityVerified && (
                                    <div className="mb-6 rounded-xl bg-sky p-4 md:p-6">
                                        <div className="mb-4 flex items-center gap-2.5">
                                            <Icons.CheckCircle className="h-5 w-5 text-royal" aria-hidden="true" />
                                            <div>
                                                <h4 className="text-[18px] font-semibold text-ink">PortOne 본인인증 정보</h4>
                                                <p className="text-[13px] text-sub">인증된 개인정보 확인</p>
                                            </div>
                                        </div>
                                        {/* 이름-값 정보 표: 이름 칸 너비·줄 높이 고정(MgInfoTable) */}
                                        <MgInfoTable
                                            className="bg-white px-4 md:px-5"
                                            rows={[
                                                ['이름', <span className="font-semibold">{selectedMember.verifiedName || selectedMember.name || '-'}</span>],
                                                ['전화번호', <span className="font-semibold">
                                                    {selectedMember.phonePublic
                                                        ? (selectedMember.verifiedPhone || selectedMember.phone || '-')
                                                        : (
                                                            <span
                                                                className="inline-block select-none"
                                                                style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}
                                                                aria-label="연락처 비공개"
                                                            >
                                                                {formatPhoneDisplay(selectedMember.verifiedPhone || selectedMember.phone)}
                                                            </span>
                                                        )}
                                                </span>],
                                                ['생년월일', selectedMember.verifiedBirthday ? <span className="font-semibold">
                                                    {typeof selectedMember.verifiedBirthday === 'string' && /^\d{8}$/.test(selectedMember.verifiedBirthday)
                                                        ? selectedMember.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')
                                                        : selectedMember.verifiedBirthday}
                                                </span> : null],
                                                ['성별', selectedMember.verifiedGender ? <span className="font-semibold">{selectedMember.verifiedGender === 'M' ? '남성' : '여성'}</span> : null],
                                                ['고유번호', selectedMember.impUid ? <span className="break-all font-mono text-[13px] text-[#333]">{selectedMember.impUid}</span> : null],
                                            ]}
                                        />
                                    </div>
                                )}

                                {/* 사이트 (기입한 경우에만 노출) */}
                                {selectedMember.companyWebsite && (
                                    <div className="mb-6 rounded-xl bg-card p-4 md:p-6">
                                        <div className="mb-3 flex items-center gap-2.5">
                                            <Icons.Info className="h-5 w-5 text-royal" aria-hidden="true" />
                                            <div>
                                                <h4 className="text-[18px] font-semibold text-ink">사이트</h4>
                                                <p className="text-[13px] text-sub">회원이 등록한 사이트</p>
                                            </div>
                                        </div>
                                        <div className="mb-2">
                                            <a href={selectedMember.companyWebsite.startsWith('http') ? selectedMember.companyWebsite : `https://${selectedMember.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="break-all text-[15px] font-semibold text-royal hover:underline">
                                                {selectedMember.companyWebsite}
                                            </a>
                                        </div>
                                        <p className="mb-2 text-[13px] text-sub">아래에서 미리보기 (일부 사이트는 보안 설정으로 표시되지 않을 수 있습니다)</p>
                                        <div className={`w-full overflow-hidden border border-line bg-white ${isOwnProfile ? 'aspect-video' : ''}`} style={isOwnProfile ? undefined : { height: '320px' }}>
                                            <div style={{ width: '125%', height: '125%', transform: 'scale(0.8)', transformOrigin: '0 0' }}>
                                                <iframe
                                                    title="회사 홈페이지 미리보기"
                                                    src={selectedMember.companyWebsite.startsWith('http') ? selectedMember.companyWebsite : `https://${selectedMember.companyWebsite}`}
                                                    className="h-full w-full"
                                                    style={{ width: '100%', height: '100%' }}
                                                    sandbox="allow-scripts allow-same-origin allow-forms"
                                                    referrerPolicy="no-referrer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex shrink-0 justify-end border-t border-line p-4">
                                <button type="button" onClick={() => setSelectedMember(null)} className="h-12 rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white transition-colors hover:bg-black">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default AllMembersView;
