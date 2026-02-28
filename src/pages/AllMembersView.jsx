import React, { useState, useEffect } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import { firebaseService } from '../services/firebaseService';
import { translateFirebaseError } from '../utils/errorUtils';
import ModalPortal from '../components/ModalPortal';

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

        const uid = member?.uid || member?.id;
        const memberId = member?.id || member?.uid;
        const email = (member?.email || '').toString().trim();
        const phone = (member?.phone || member?.phoneNumber || '').toString().trim();

        if (firebaseService && firebaseService.deleteUser) {
            try {
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

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="w-full text-center md:text-left">
                        <PageTitle pageKey="members" pageTitles={pageTitles} defaultText="부청사 회원" />
                        <p className="text-gray-500 text-sm">신뢰 기반의 인맥 네트워킹</p>
                    </div>
                    <div className="w-full flex justify-end">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                            <Icons.ArrowLeft size={20} /> 메인으로 돌아가기
                        </button>
                    </div>
                </div>

                {/* 검색바 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-8">
                    <div className="flex flex-col md:flex-row gap-0 items-center">
                        <div className="flex-1 w-full px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Search size={14} className="text-gray-400" /> 이름 검색
                            </div>
                            <input 
                                type="text" 
                                placeholder="이름을 입력하세요" 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none text-sm placeholder-gray-300" 
                                value={searchName} 
                                onChange={e => setSearchName(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-48 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Briefcase size={14} className="text-gray-400" /> 업종 검색
                            </div>
                            <input 
                                type="text" 
                                placeholder="업종을 입력하세요" 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none text-sm placeholder-gray-300" 
                                value={searchIndustry} 
                                onChange={e => setSearchIndustry(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-40 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.MapPin size={14} className="text-gray-400" /> 지역
                            </div>
                            <input 
                                type="text" 
                                placeholder="지역을 입력하세요" 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none text-sm placeholder-gray-300" 
                                value={searchRegion} 
                                onChange={e => setSearchRegion(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-40 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.MapPin size={14} className="text-gray-400" /> 지역구
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={selectedDistrictFilter} 
                                onChange={e => setSelectedDistrictFilter(e.target.value)}
                            >
                                {districts.map(district => (
                                    <option key={district} value={district}>{district}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-40 px-4 border-b md:border-b-0 md:border-r border-blue-200 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Tag size={14} className="text-gray-400" /> 업종
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={selectedIndustryFilter} 
                                onChange={e => setSelectedIndustryFilter(e.target.value)}
                            >
                                {industries.map(industry => (
                                    <option key={industry} value={industry}>{industry}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-32 px-4 py-3">
                            <div className="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <Icons.Award size={14} className="text-gray-400" /> 등급
                            </div>
                            <select 
                                className="w-full font-medium text-gray-900 bg-transparent outline-none cursor-pointer text-sm" 
                                value={selectedGradeFilter} 
                                onChange={e => setSelectedGradeFilter(e.target.value)}
                            >
                                {grades.map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-4 px-4 text-center">
                        {hasActiveFilter ? (
                            <>검색 결과: <span className="font-bold text-brand">{filteredMembers.length}</span>명</>
                        ) : (
                            <>전체: <span className="font-bold text-brand">{filteredMembers.length}</span>명</>
                        )}
                    </div>
                </div>

                {/* 회원명단: 회원등급 | 회원명 | 지역구 | 회사명 | 업종/업태 | 가입일자 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden mb-6">
                    <div className="overflow-x-auto">
                        <div role="grid" aria-label="회원명단" className="min-w-0">
                            {/* 헤더 행 — 회원등급·지역구·가입일자 축소, 회사명 확대 */}
                            <div role="row" className="grid border-b border-blue-200 bg-blue-50/50 h-14 min-h-[3.5rem] grid-cols-[0.5fr_1fr_0.6fr_1.7fr] md:grid-cols-[0.5fr_1fr_0.6fr_1.9fr_1fr_0.75fr]">
                                <div role="columnheader" aria-sort={sortKey === 'memberGrade' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="relative flex items-center justify-center px-2 md:px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('memberGrade')}>
                                    <span className="text-center">회원등급</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'memberGrade' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                    </div>
                                    <div role="columnheader" aria-sort={sortKey === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="relative flex items-center justify-center px-2 md:px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('name')}>
                                        <span className="text-center">회원명</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'name' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                    </div>
                                    <div role="columnheader" aria-sort={sortKey === 'district' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="relative flex items-center justify-center px-2 md:px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('district')}>
                                        <span className="text-center">지역구</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'district' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                    </div>
                                    <div role="columnheader" aria-sort={sortKey === 'company' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="relative flex items-center justify-center px-2 md:px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('company')}>
                                        <span className="text-center">회사명</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'company' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                    </div>
                                    <div role="columnheader" aria-sort={sortKey === 'industry' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="hidden md:flex relative items-center justify-center px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('industry')}>
                                        <span className="text-center">업종/업태</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'industry' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                    </div>
                                    <div role="columnheader" aria-sort={sortKey === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined} className="hidden md:flex relative items-center justify-center px-4 py-3 text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none" onClick={() => handleSort('createdAt')}>
                                        <span className="text-center">가입일자</span>
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 shrink-0" aria-hidden="true">
                                            {sortKey === 'createdAt' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={14} className="text-brand" /> : <Icons.ChevronDown size={14} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-50" />}
                                        </span>
                                </div>
                            </div>
                            {/* 데이터 행 */}
                            {paginatedMembers.length === 0 ? (
                                <div role="row" className="grid h-14 min-h-[3.5rem] border-b border-blue-100 grid-cols-[0.5fr_1fr_0.6fr_1.7fr] md:grid-cols-[0.5fr_1fr_0.6fr_1.9fr_1fr_0.75fr]">
                                    <div role="gridcell" className="col-span-4 md:col-span-6 flex items-center justify-center px-4 py-3 text-gray-500 text-sm">
                                        조건에 맞는 회원이 없습니다.
                                    </div>
                                </div>
                            ) : (
                                paginatedMembers.map((member, idx) => (
                                    <div
                                        key={member.id || member.uid || idx}
                                        role="row"
                                        className="grid border-b border-blue-100 hover:bg-brand/5 cursor-pointer transition-colors h-14 min-h-[3.5rem] grid-cols-[0.5fr_1fr_0.6fr_1.7fr] md:grid-cols-[0.5fr_1fr_0.6fr_1.9fr_1fr_0.75fr]"
                                        onClick={() => setSelectedMember(member)}
                                    >
                                        <div role="gridcell" className="flex items-center justify-center px-2 md:px-4 py-3 text-sm text-gray-700">
                                            {member.memberGrade ? (
                                                <>
                                                    <span
                                                        className={`md:hidden inline-block w-4 h-4 rounded-full flex-shrink-0 ${
                                                            member.memberGrade === '마스터' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700' :
                                                            member.memberGrade === '운영진' ? 'bg-red-600 border border-red-700' :
                                                            member.memberGrade === '파트너사' ? 'bg-brand' :
                                                            member.memberGrade === '사업자' ? 'bg-blue-600' :
                                                            member.memberGrade === '예창' ? 'bg-gray-500' :
                                                            'bg-gray-400'
                                                        }`}
                                                        title={member.memberGrade}
                                                        aria-label={member.memberGrade}
                                                    />
                                                    <span className={`hidden md:inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
                                                        member.memberGrade === '마스터' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white' :
                                                        member.memberGrade === '운영진' ? 'bg-white text-red-600 border border-red-600' :
                                                        member.memberGrade === '파트너사' ? 'bg-brand text-white' :
                                                        member.memberGrade === '사업자' ? 'bg-gray-200 text-blue-700' :
                                                        member.memberGrade === '예창' ? 'bg-gray-200 text-gray-700' :
                                                        'bg-gray-200 text-gray-600'
                                                    }`}>
                                                        {member.memberGrade}
                                                    </span>
                                                </>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </div>
                                        <div role="gridcell" className="flex items-center justify-center px-2 md:px-4 py-3 text-sm font-medium text-dark">{member.name || '-'}</div>
                                        <div role="gridcell" className="flex items-center justify-center px-2 md:px-4 py-3 text-sm text-gray-600">{getDistrictFromAddress(getMemberAddressString(member)) || '-'}</div>
                                        <div role="gridcell" className="flex items-center justify-center px-2 md:px-4 py-3 text-sm text-gray-600">{member.company || '-'}</div>
                                        <div role="gridcell" className="hidden md:flex items-center justify-center px-4 py-3 text-sm text-gray-600">{member.industry || member.businessCategory || '-'}</div>
                                        <div role="gridcell" className="hidden md:flex items-center justify-center px-4 py-3 text-sm text-gray-600">
                                            {member.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? (typeof member.createdAt === 'string' ? new Date(member.createdAt).toLocaleDateString('ko-KR') : null) ?? '-'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 페이지네이션: 10명 초과 시 표시 */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-3 border-t border-blue-100 bg-gray-50/50 text-center">
                            <p className="text-sm text-gray-600 text-center order-2 sm:order-1">
                                전체 <span className="font-bold text-brand">{sortedMembers.length}</span>명
                                {sortedMembers.length > PAGE_SIZE && (
                                    <> · {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, sortedMembers.length)}번 표시</>
                                )}
                            </p>
                            <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-sm font-bold text-gray-700 hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    이전
                                </button>
                                <span className="text-sm text-gray-600 text-center">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-sm font-bold text-gray-700 hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    다음
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 회원 상세 모달 (ESC로 닫기) */}
                {selectedMember && (
                    <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedMember(null); }}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className={`bg-white rounded-2xl shadow-sm border border-blue-200 w-full z-10 flex flex-col max-md:scale-[0.8] origin-center ${hasSite ? 'max-w-7xl max-h-[92vh]' : 'max-w-6xl max-h-[calc(90vh-100px)]'}`} style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                            {/* 선택된 회원 상세 정보 */}
                            <div className="border-t border-blue-200 pt-6">
                                <div className="flex flex-col md:flex-row gap-6 mb-6">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand/20 shrink-0 mx-auto md:mx-0">
                                        <img 
                                            src={selectedMember.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || '회원')}&background=random`} 
                                            alt={selectedMember.name || '회원 프로필'} 
                                            className="w-full h-full object-cover" 
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => { 
                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || '회원')}&background=random`; 
                                            }} 
                                        />
                                    </div>
                                    <div className="flex-1">
                                    <h3 className="text-2xl font-bold text-dark mb-2">{selectedMember.name || '이름 없음'}</h3>
                                    <p className="text-brand font-medium mb-2">
                                        {selectedMember.company || selectedMember.role 
                                            ? [selectedMember.company, selectedMember.role].filter(Boolean).join(' | ')
                                            : '정보 없음'}
                                    </p>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="inline-block px-3 py-1 bg-brand/10 text-brand text-sm font-bold rounded-full">{selectedMember.industry || selectedMember.businessCategory || '업종 미지정'}</span>
                                        {selectedMember.memberGrade && (
                                            <span className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${
                                                selectedMember.memberGrade === '마스터' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white shadow-lg' :
                                                selectedMember.memberGrade === '운영진' ? 'bg-white text-red-600 border-2 border-red-600' :
                                                selectedMember.memberGrade === '파트너사' ? 'bg-brand text-white' :
                                                selectedMember.memberGrade === '사업자' ? 'bg-gray-200 text-blue-700' :
                                                selectedMember.memberGrade === '예창' ? 'bg-gray-200 text-gray-700' :
                                                'bg-gray-200 text-gray-600'
                                            }`} style={selectedMember.memberGrade === '마스터' ? { textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' } : {}}>
                                                {selectedMember.memberGrade}
                                            </span>
                                        )}
                                    </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                            <div className="flex items-center gap-1">
                                                <Icons.Phone className="w-4 h-4" />
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
                                                <div className="flex items-center gap-1">
                                                    <Icons.Phone className="w-4 h-4 text-gray-500" />
                                                    <span className="text-gray-600">회사 {selectedMember.companyPhone}</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* PortOne 본인인증 상태 표시 */}
                                        {selectedMember.isIdentityVerified ? (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                                                <Icons.CheckCircle className="w-4 h-4 text-green-600" />
                                                <span className="text-xs font-bold text-green-700">PortOne 본인인증 완료</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-blue-200 rounded-lg">
                                                <Icons.X className="w-4 h-4 text-gray-400" />
                                                <span className="text-xs text-gray-500">본인인증 미완료</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* PortOne 본인인증 정보 상세 (인증 완료 시에만 표시) */}
                                {selectedMember.isIdentityVerified && (
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                                <Icons.CheckCircle className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-green-700 text-lg">PortOne 본인인증 정보</h4>
                                                <p className="text-xs text-green-600">인증된 개인정보 확인</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/80 rounded-xl p-4 border border-green-100">
                                                <div className="text-xs text-gray-500 mb-2">인증된 이름</div>
                                                <div className="font-bold text-lg text-green-600">{selectedMember.verifiedName || selectedMember.name}</div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-4 border border-green-100">
                                                <div className="text-xs text-gray-500 mb-2">인증된 전화번호</div>
                                                <div className="font-bold text-lg text-green-600">
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
                                            </div>
                                            </div>
                                            {selectedMember.verifiedBirthday && (
                                                <div className="bg-white/80 rounded-xl p-4 border border-green-100">
                                                    <div className="text-xs text-gray-500 mb-2">생년월일</div>
                                                    <div className="font-bold text-lg text-green-600">
                                                        {selectedMember.verifiedBirthday && typeof selectedMember.verifiedBirthday === 'string' && /^\d{8}$/.test(selectedMember.verifiedBirthday)
                                                            ? selectedMember.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')
                                                            : selectedMember.verifiedBirthday || '-'}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedMember.verifiedGender && (
                                                <div className="bg-white/80 rounded-xl p-4 border border-green-100">
                                                    <div className="text-xs text-gray-500 mb-2">성별</div>
                                                    <div className="font-bold text-lg text-green-600">{selectedMember.verifiedGender === 'M' ? '남성' : '여성'}</div>
                                                </div>
                                            )}
                                        </div>
                                        {selectedMember.impUid && (
                                            <div className="mt-4 pt-4 border-t border-green-200">
                                                <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                                                    <span className="text-xs text-gray-500">인증 거래 고유번호</span>
                                                    <span className="text-xs font-mono text-gray-700 bg-white px-3 py-1 rounded border border-green-100">{selectedMember.impUid}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* 사이트 (기입한 경우에만 노출) */}
                                {selectedMember.companyWebsite && (
                                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <Icons.Info className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-yellow-700 text-lg">사이트</h4>
                                                <p className="text-xs text-yellow-600">회원이 등록한 사이트</p>
                                            </div>
                                        </div>
                                        <div className="mb-2">
                                            <a href={selectedMember.companyWebsite.startsWith('http') ? selectedMember.companyWebsite : `https://${selectedMember.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand font-medium hover:underline break-all">
                                                {selectedMember.companyWebsite}
                                            </a>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">아래에서 미리보기 (일부 사이트는 보안 설정으로 표시되지 않을 수 있습니다)</p>
                                        <div className={`rounded-xl overflow-hidden border border-yellow-200 bg-white w-full ${isOwnProfile ? 'aspect-video' : ''}`} style={isOwnProfile ? undefined : { height: '320px' }}>
                                            <div style={{ width: '125%', height: '125%', transform: 'scale(0.8)', transformOrigin: '0 0' }}>
                                                <iframe
                                                    title="회사 홈페이지 미리보기"
                                                    src={selectedMember.companyWebsite.startsWith('http') ? selectedMember.companyWebsite : `https://${selectedMember.companyWebsite}`}
                                                    className="w-full h-full"
                                                    style={{ width: '100%', height: '100%' }}
                                                    sandbox="allow-scripts allow-same-origin allow-forms"
                                                    referrerPolicy="no-referrer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                            </div>
                            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                                <button type="button" onClick={() => setSelectedMember(null)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                    </ModalPortal>
                )}
            </div>
        </div>
    );
};

export default AllMembersView;
