import React, { useState, useEffect, Fragment } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';
import { firebaseService } from '../services/firebaseService';
import { translateFirebaseError } from '../utils/errorUtils';

const AllMembersView = ({ onBack, members, currentUser, pageTitles }) => {
    const [searchName, setSearchName] = useState('');
    const [searchIndustry, setSearchIndustry] = useState('');
    const [searchRegion, setSearchRegion] = useState('');
    const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('전체');
    const [selectedGradeFilter, setSelectedGradeFilter] = useState('전체');
    const [selectedMember, setSelectedMember] = useState(null);
    const [filteredMembers, setFilteredMembers] = useState(members);
    
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
    
    // 회원 강퇴 핸들러
    const handleDeleteMember = async (memberId) => {
        if (!confirm('정말 이 회원을 강퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }
        
        if (firebaseService && firebaseService.deleteUser) {
            try {
                await firebaseService.deleteUser(memberId);
                setFilteredMembers(filteredMembers.filter(m => m.id !== memberId && m.uid !== memberId));
                alert('회원이 강퇴되었습니다.');
            } catch (error) {
                const errorMessage = translateFirebaseError ? translateFirebaseError(error) : '회원 강퇴 중 오류가 발생했습니다.';
                alert(`회원 강퇴에 실패했습니다.\n${errorMessage}`);
            }
        } else {
            alert('회원 강퇴 기능을 사용할 수 없습니다.');
        }
    };

    // 업종 목록 추출
    const industries = ['전체', ...new Set(members.map(m => m.industry || m.businessCategory || '기타').filter(Boolean))];
    // 등급 목록 추출
    const grades = ['전체', '파트너사', '운영진', '사업자', '예창'];

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
    }, [searchName, searchIndustry, searchRegion, selectedIndustryFilter, selectedGradeFilter, members]);
    
    // 등급별로 그룹화
    const membersByGrade = {
        '파트너사': filteredMembers.filter(m => m.memberGrade === '파트너사'),
        '운영진': filteredMembers.filter(m => m.memberGrade === '운영진'),
        '사업자': filteredMembers.filter(m => m.memberGrade === '사업자'),
        '예창': filteredMembers.filter(m => m.memberGrade === '예창'),
        '등급 없음': filteredMembers.filter(m => !m.memberGrade)
    };

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
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
                    <div className="text-xs text-gray-500 mt-4 px-4">
                        검색 결과: <span className="font-bold text-brand">{filteredMembers.length}</span>명
                    </div>
                </div>

                {/* 등급별 회원 목록 */}
                {selectedGradeFilter === '전체' ? (
                    <div className="space-y-12">
                        {Object.entries(membersByGrade).map(([grade, gradeMembers]) => {
                            if (gradeMembers.length === 0) return null;
                            return (
                                <div key={grade}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <h3 className="text-2xl font-bold text-dark">
                                            {grade === '등급 없음' ? '등급 없음' : `${grade} 등급`}
                                        </h3>
                                        <span className="px-4 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-bold">
                                            {gradeMembers.length}명
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {gradeMembers.map((member, idx) => (
                                            <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md transition-all hover:border-brand/20 ${member.memberGrade === '파트너사' && member.hasDonated ? 'flex flex-row items-start gap-4 p-4' : 'flex flex-col items-center text-center p-6'} group cursor-pointer`} onClick={() => setSelectedMember(member)}>
                                                {member.memberGrade === '파트너사' && member.hasDonated ? (
                                                    <Fragment>
                                                        <div className="flex-shrink-0">
                                                            <div className="w-20 h-20 rounded-full overflow-hidden mb-2 border-4 border-soft group-hover:border-brand/20 transition-colors">
                                                                <img src={member.img} alt={member.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${member.name}&background=random`; }} />
                                                            </div>
                                                            <h3 className="text-lg font-bold text-dark mb-1 text-center">{member.name}</h3>
                                                            <p className="text-xs text-brand font-medium mb-2 text-center">{member.company}</p>
                                                            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">{member.industry || '업종 미지정'}</span>
                                                                <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-yellow-700 text-white rounded-full text-[10px] font-bold shadow-lg" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' }}>파트너사</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-1">
                                                                <Icons.Star className="w-4 h-4" /> 회사 소개
                                                            </h4>
                                                            {member.companyMainImage && (
                                                                <div className="relative w-full h-32 rounded-lg overflow-hidden mb-2">
                                                                    <img src={member.companyMainImage} alt="회사 대표 이미지" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            {member.companyDescription && (
                                                                <p className="text-xs text-gray-600 line-clamp-3 mb-2">{member.companyDescription}</p>
                                                            )}
                                                            {member.companyImages && member.companyImages.length > 0 && (
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    {member.companyImages.slice(0, 3).map((img, imgIdx) => (
                                                                        <div key={imgIdx} className="relative aspect-square rounded overflow-hidden">
                                                                            <img src={img} alt={`회사 사진 ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {!member.companyMainImage && !member.companyDescription && (
                                                                <p className="text-xs text-gray-400">회사 소개가 등록되지 않았습니다.</p>
                                                            )}
                                                        </div>
                                                    </Fragment>
                                                ) : (
                                                    <Fragment>
                                                        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-soft group-hover:border-brand/20 transition-colors">
                                                            <img src={member.img} alt={member.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${member.name}&background=random`; }} />
                                                        </div>
                                                        <h3 className="text-xl font-bold text-dark mb-1">{member.name}</h3>
                                                        <p className="text-sm text-brand font-medium mb-2">{member.company} {member.role}</p>
                                                        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                                                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">{member.industry || member.businessCategory || '업종 미지정'}</span>
                                                            {member.memberGrade && (
                                                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                                                    member.memberGrade === '파트너사' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white shadow-lg' :
                                                                    member.memberGrade === '운영진' ? 'bg-white text-red-600 border-2 border-red-600' :
                                                                    member.memberGrade === '사업자' ? 'bg-gray-200 text-blue-700' :
                                                                    'bg-gray-200 text-gray-900'
                                                                }`} style={member.memberGrade === '파트너사' ? { textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' } : {}}>
                                                                    {member.memberGrade}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 mb-4">
                                                            <Icons.Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                                            <span className="text-xs text-gray-500">4.5</span>
                                                            <span className="text-xs text-gray-400">(12)</span>
                                                        </div>
                                                        <div className="w-full flex gap-2">
                                                            <button className="flex-1 py-2.5 rounded-xl border border-blue-200 text-sm font-bold text-gray-600 hover:bg-brand hover:text-white hover:border-brand transition-all">프로필 보기</button>
                                                            {currentUser && member.id !== currentUser?.id && member.uid !== currentUser?.uid && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteMember(member.id || member.uid);
                                                                    }}
                                                                    className="px-3 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors"
                                                                    title="회원 강퇴"
                                                                >
                                                                    <Icons.Trash size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </Fragment>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : filteredMembers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredMembers.map((member, idx) => (
                            <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md transition-all hover:border-brand/20 ${member.memberGrade === '파트너사' && member.hasDonated ? 'flex flex-row items-start gap-4 p-4' : 'flex flex-col items-center text-center p-6'} group cursor-pointer`} onClick={() => setSelectedMember(member)}>
                                {member.memberGrade === '파트너사' && member.hasDonated ? (
                                    <Fragment>
                                        <div className="flex-shrink-0">
                                            <div className="w-20 h-20 rounded-full overflow-hidden mb-2 border-4 border-soft group-hover:border-brand/20 transition-colors">
                                                <img src={member.img} alt={member.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${member.name}&background=random`; }} />
                                            </div>
                                            <h3 className="text-lg font-bold text-dark mb-1 text-center">{member.name}</h3>
                                            <p className="text-xs text-brand font-medium mb-2 text-center">{member.company}</p>
                                            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">{member.industry || '업종 미지정'}</span>
                                                <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-yellow-700 text-white rounded-full text-[10px] font-bold shadow-lg" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' }}>파트너사</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-1">
                                                <Icons.Star className="w-4 h-4" /> 회사 소개
                                            </h4>
                                            {member.companyMainImage && (
                                                <div className="relative w-full h-32 rounded-lg overflow-hidden mb-2">
                                                    <img src={member.companyMainImage} alt="회사 대표 이미지" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            {member.companyDescription && (
                                                <p className="text-xs text-gray-600 line-clamp-3 mb-2">{member.companyDescription}</p>
                                            )}
                                            {member.companyImages && member.companyImages.length > 0 && (
                                                <div className="grid grid-cols-3 gap-1">
                                                    {member.companyImages.slice(0, 3).map((img, imgIdx) => (
                                                        <div key={imgIdx} className="relative aspect-square rounded overflow-hidden">
                                                            <img src={img} alt={`회사 사진 ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {!member.companyMainImage && !member.companyDescription && (
                                                <p className="text-xs text-gray-400">회사 소개가 등록되지 않았습니다.</p>
                                            )}
                                        </div>
                                    </Fragment>
                                ) : (
                                    <Fragment>
                                        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-soft group-hover:border-brand/20 transition-colors">
                                            <img src={member.img} alt={member.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${member.name}&background=random`; }} />
                                        </div>
                                        <h3 className="text-xl font-bold text-dark mb-1">{member.name}</h3>
                                        <p className="text-sm text-brand font-medium mb-2">{member.company} {member.role}</p>
                                        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">{member.industry || member.businessCategory || '업종 미지정'}</span>
                                            {member.memberGrade && (
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                                    member.memberGrade === '파트너사' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white shadow-lg' :
                                                    member.memberGrade === '운영진' ? 'bg-white text-red-600 border-2 border-red-600' :
                                                    member.memberGrade === '사업자' ? 'bg-gray-200 text-blue-700' :
                                                    'bg-gray-200 text-gray-900'
                                                }`} style={member.memberGrade === '파트너사' ? { textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' } : {}}>
                                                    {member.memberGrade}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 mb-4">
                                            <Icons.Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                            <span className="text-xs text-gray-500">4.5</span>
                                            <span className="text-xs text-gray-400">(12)</span>
                                        </div>
                                        <button className="w-full py-2.5 rounded-xl border border-blue-200 text-sm font-bold text-gray-600 hover:bg-brand hover:text-white hover:border-brand transition-all">프로필 보기</button>
                                    </Fragment>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>조건에 맞는 회원이 없습니다.</p>
                    </div>
                )}

                {/* 회원 상세 모달 (ESC로 닫기) */}
                {selectedMember && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedMember(null); }}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 w-full max-w-6xl z-10 flex flex-col max-h-[calc(90vh-100px)]" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 overflow-y-auto modal-scroll p-8">
                            
                            {/* 4등분 섹션 */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* 1등분: 후원한 회원 */}
                                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border-2 border-yellow-200">
                                    <h4 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-2">
                                        <Icons.Star className="w-4 h-4" /> 후원한 회원
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {filteredMembers.filter(m => m.hasDonated).map((m, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-yellow-50" onClick={() => setSelectedMember(m)}>
                                                <img src={m.img || `https://ui-avatars.com/api/?name=${m.name}&background=random`} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-dark truncate">{m.name}</div>
                                                    <div className="text-[10px] text-gray-500 truncate">{m.company}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredMembers.filter(m => m.hasDonated).length === 0 && (
                                            <p className="text-xs text-gray-400 text-center py-4">후원한 회원이 없습니다</p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* 2등분: 일반회원(사업자) */}
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-200">
                                    <h4 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
                                        <Icons.Briefcase className="w-4 h-4" /> 일반회원(사업자)
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {filteredMembers.filter(m => !m.hasDonated && m.businessType === '사업자').map((m, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-green-50" onClick={() => setSelectedMember(m)}>
                                                <img src={m.img || `https://ui-avatars.com/api/?name=${m.name}&background=random`} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-dark truncate">{m.name}</div>
                                                    <div className="text-[10px] text-gray-500 truncate">{m.company}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredMembers.filter(m => !m.hasDonated && m.businessType === '사업자').length === 0 && (
                                            <p className="text-xs text-gray-400 text-center py-4">일반회원(사업자)이 없습니다</p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* 3등분: 일반회원(예비창업자) */}
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                                    <h4 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                                        <Icons.User className="w-4 h-4" /> 일반회원(예비창업자)
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {filteredMembers.filter(m => !m.hasDonated && m.businessType === '예비창업자').map((m, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-purple-50" onClick={() => setSelectedMember(m)}>
                                                <img src={m.img || `https://ui-avatars.com/api/?name=${m.name}&background=random`} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-dark truncate">{m.name}</div>
                                                    <div className="text-[10px] text-gray-500 truncate">{m.company || '예비창업자'}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredMembers.filter(m => !m.hasDonated && m.businessType === '예비창업자').length === 0 && (
                                            <p className="text-xs text-gray-400 text-center py-4">일반회원(예비창업자)이 없습니다</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* 선택된 회원 상세 정보 */}
                            <div className="border-t border-blue-200 pt-6">
                                <div className="flex flex-col md:flex-row gap-6 mb-6">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand/20 shrink-0 mx-auto md:mx-0">
                                        <img 
                                            src={selectedMember.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || '회원')}&background=random`} 
                                            alt={selectedMember.name || '회원 프로필'} 
                                            className="w-full h-full object-cover" 
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
                                                selectedMember.memberGrade === '파트너사' ? 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-white shadow-lg' :
                                                selectedMember.memberGrade === '운영진' ? 'bg-white text-red-600 border-2 border-red-600' :
                                                selectedMember.memberGrade === '사업자' ? 'bg-gray-200 text-blue-700' :
                                                'bg-gray-200 text-gray-900'
                                            }`} style={selectedMember.memberGrade === '파트너사' ? { textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)' } : {}}>
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
                                                    <img src={selectedMember.companyMainImage} alt="회사 대표 이미지" className="w-full h-full object-cover" />
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
                                                            <img src={img} alt={`회사 사진 ${idx + 1}`} className="w-full h-full object-cover" />
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
                )}
            </div>
        </div>
    );
};

export default AllMembersView;
