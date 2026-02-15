import React, { useState, useEffect } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import { firebaseService } from '../services/firebaseService';
import { translateFirebaseError } from '../utils/errorUtils';
import ModalPortal from '../components/ModalPortal';

const PAGE_SIZE = 10;

const AllMembersView = ({ onBack, members, currentUser, pageTitles, currentPage: currentPageProp, onPageChange }) => {
    const [searchName, setSearchName] = useState('');
    const [searchIndustry, setSearchIndustry] = useState('');
    const [searchRegion, setSearchRegion] = useState('');
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
    const prevFilterRef = React.useRef({ searchName: '', searchIndustry: '', searchRegion: '', selectedIndustryFilter: '전체', selectedGradeFilter: '전체' });

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
        if (!confirm('정말 이 회원을 강퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        const uid = member?.uid || member?.id;
        const memberId = member?.id || member?.uid;

        if (firebaseService && firebaseService.deleteUser) {
            try {
                if (firebaseService.deleteAuthUser && uid) {
                    await firebaseService.deleteAuthUser(uid);
                }
                await firebaseService.deleteUser(memberId);
                setFilteredMembers(filteredMembers.filter(m => m.id !== memberId && m.uid !== memberId));
                alert('회원이 강퇴되었습니다.');
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

    useEffect(() => {
        let filtered = members.filter(member => {
            const matchName = !searchName || member.name.toLowerCase().includes(searchName.toLowerCase());
            const matchIndustry = !searchIndustry || (member.industry || member.businessCategory || '').toLowerCase().includes(searchIndustry.toLowerCase());
            const matchRegion = !searchRegion || (member.address || '').includes(searchRegion);
            const matchIndustryFilter = selectedIndustryFilter === '전체' || (member.industry || member.businessCategory || '기타') === selectedIndustryFilter;
            const matchGradeFilter = selectedGradeFilter === '전체' || (member.memberGrade || '') === selectedGradeFilter;
            return matchName && matchIndustry && matchRegion && matchIndustryFilter && matchGradeFilter;
        });
        setFilteredMembers(filtered);
        const prev = prevFilterRef.current;
        const filterChanged = prev.searchName !== searchName || prev.searchIndustry !== searchIndustry || prev.searchRegion !== searchRegion || prev.selectedIndustryFilter !== selectedIndustryFilter || prev.selectedGradeFilter !== selectedGradeFilter;
        if (filterChanged) {
            prevFilterRef.current = { searchName, searchIndustry, searchRegion, selectedIndustryFilter, selectedGradeFilter };
            setCurrentPage(1);
        }
    }, [searchName, searchIndustry, searchRegion, selectedIndustryFilter, selectedGradeFilter, members]);

    const hasActiveFilter = Boolean(searchName || searchIndustry || searchRegion || selectedIndustryFilter !== '전체' || selectedGradeFilter !== '전체');

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
            return (m[k] || '').toString().trim().toLowerCase();
        };
        const list = [...filteredMembers];
        const order = sortOrder === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            const va = getVal(a, sortKey);
            const vb = getVal(b, sortKey);
            if (sortKey === 'createdAt') return order * (va - vb);
            if (sortKey === 'memberGrade') return order * (va - vb);
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
                    <div>
                        <PageTitle pageKey="members" pageTitles={pageTitles} defaultText="부청사 회원" />
                        <p className="text-gray-500 text-sm">신뢰 기반의 인맥 네트워킹</p>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로 돌아가기
                    </button>
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

                {/* 회원명단: CSS Grid (모바일 3열, PC 5열), 중앙정렬 + 오른쪽 정렬 버튼 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden mb-6">
                    <div className="overflow-x-auto">
                        <div role="grid" aria-label="회원명단" className="min-w-0">
                            {/* 헤더 행 */}
                            <div role="row" className="grid grid-cols-3 md:grid-cols-5 border-b border-blue-200 bg-blue-50/50 h-14 min-h-[3.5rem]">
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
                                <div role="row" className="grid grid-cols-3 md:grid-cols-5 h-14 min-h-[3.5rem] border-b border-blue-100">
                                    <div role="gridcell" className="col-span-3 md:col-span-5 flex items-center justify-center px-4 py-3 text-gray-500 text-sm">
                                        조건에 맞는 회원이 없습니다.
                                    </div>
                                </div>
                            ) : (
                                paginatedMembers.map((member, idx) => (
                                    <div
                                        key={member.id || member.uid || idx}
                                        role="row"
                                        className="grid grid-cols-3 md:grid-cols-5 border-b border-blue-100 hover:bg-brand/5 cursor-pointer transition-colors h-14 min-h-[3.5rem]"
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
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 w-full max-w-6xl z-10 flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
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
                                                <Icons.Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                                <span className="font-bold">4.5</span>
                                                <span className="text-gray-400">(12개 후기)</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Icons.Phone className="w-4 h-4" />
                                                <span>{selectedMember.phone || '연락처 미공개'}</span>
                                            </div>
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
                                                <div className="font-bold text-lg text-green-600">{selectedMember.verifiedPhone || selectedMember.phone || '-'}</div>
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
                                
                                {/* 후원 회원의 회사 소개 섹션 */}
                                {selectedMember.hasDonated && (
                                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <Icons.Star className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-yellow-700 text-lg">회사 소개</h4>
                                                <p className="text-xs text-yellow-600">후원 회원 전용 소개 공간</p>
                                            </div>
                                        </div>
                                        
                                        {/* 대표 이미지 */}
                                        {selectedMember.companyMainImage && (
                                            <div className="mb-4">
                                                <label className="block text-xs font-bold text-gray-700 mb-2">대표 이미지</label>
                                                <div className="relative w-full h-64 rounded-xl overflow-hidden">
                                                    <img src={selectedMember.companyMainImage} alt="회사 대표 이미지" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* 회사 소개 텍스트 */}
                                        {selectedMember.companyDescription && (
                                            <div className="mb-4">
                                                <label className="block text-xs font-bold text-gray-700 mb-2">회사 소개</label>
                                                <p className="text-sm text-gray-700 bg-white/80 rounded-xl p-4 border border-yellow-100 whitespace-pre-line">
                                                    {selectedMember.companyDescription}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {/* 추가 사진 3장 */}
                                        {selectedMember.companyImages && selectedMember.companyImages.length > 0 && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-2">추가 사진</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {selectedMember.companyImages.slice(0, 3).map((img, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden">
                                                            <img src={img} alt={`회사 사진 ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="border-t border-blue-200 pt-6">
                                    <h4 className="text-lg font-bold text-dark mb-4">평가 요약</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <span className="text-sm text-gray-600">전문성</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-400" style={{ width: '90%' }}></div>
                                                </div>
                                                <span className="text-sm font-bold text-gray-700">4.5</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <span className="text-sm text-gray-600">신뢰도</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-400" style={{ width: '85%' }}></div>
                                                </div>
                                                <span className="text-sm font-bold text-gray-700">4.3</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

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
