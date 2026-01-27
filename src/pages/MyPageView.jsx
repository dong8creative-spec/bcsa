import React, { useState, Fragment } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';

const MyPageView = ({ onBack, user, mySeminars, myPosts, onWithdraw, onUpdateProfile, onCancelSeminar, pageTitles }) => {
    const [activeTab, setActiveTab] = useState('seminars');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [companyIntro, setCompanyIntro] = useState({
        companyMainImage: user.companyMainImage || '',
        companyDescription: user.companyDescription || '',
        companyImages: user.companyImages || []
    });
    const [editFormData, setEditFormData] = useState({
        name: user.name || '',
        company: user.company || '',
        role: user.role || '',
        industry: user.industry || user.businessCategory || '',
        address: user.address || '',
        phone: user.phone || '',
        img: user.img || ''
    });
    
    const handleWithdrawClick = () => {
        if(confirm("정말로 탈퇴하시겠습니까? 모든 정보가 삭제됩니다.")) {
            onWithdraw();
        }
    }

    const handleSaveProfile = async () => {
        if (!editFormData.name) {
            return alert("이름은 필수 항목입니다.");
        }
        if (onUpdateProfile) {
            await onUpdateProfile(editFormData);
            setIsEditingProfile(false);
        } else {
            alert("프로필 수정 기능이 준비되지 않았습니다.");
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            alert("이미지 크기는 1MB 이하로 제한됩니다.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditFormData({...editFormData, img: reader.result});
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-4xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <PageTitle pageKey="myPage" pageTitles={pageTitles} defaultText="마이페이지" />
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로
                    </button>
                </div>
                
                {/* 프로필 섹션 */}
                <div className="bg-white rounded-3xl p-8 shadow-card mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-4xl overflow-hidden">
                                {editFormData.img ? <img src={editFormData.img} className="w-full h-full object-cover"/> : "👤"}
                            </div>
                            {isEditingProfile && (
                                <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors">
                                    <Icons.Camera size={16} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>
                        <div className="text-center md:text-left flex-1">
                            {isEditingProfile ? (
                                <div className="space-y-3">
                                    <input type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="이름" />
                                    <input type="text" value={editFormData.company} onChange={e => setEditFormData({...editFormData, company: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="회사명" />
                                    <input type="text" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="직책" />
                                    <input type="text" value={editFormData.industry} onChange={e => setEditFormData({...editFormData, industry: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="업종" />
                                    <input type="text" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="주소" />
                                    <input type="text" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-brand focus:outline-none" placeholder="전화번호" />
                                    <div className="flex gap-2">
                                        <button type="button" onClick={handleSaveProfile} className="flex-1 py-2 bg-brand text-white font-bold rounded-lg hover:bg-blue-700">저장</button>
                                        <button type="button" onClick={() => { setIsEditingProfile(false); setEditFormData({name: user.name || '', company: user.company || '', role: user.role || '', industry: user.industry || user.businessCategory || '', address: user.address || '', phone: user.phone || '', img: user.img || ''}); }} className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">취소</button>
                                    </div>
                                </div>
                            ) : (
                                <Fragment>
                                    <h3 className="text-2xl font-bold text-dark">{user.name} <span className="text-base font-normal text-gray-500">({user.id})</span></h3>
                                    <p className="text-gray-600 mt-1">{user.company} | {user.role}</p>
                                    <span className="inline-block px-3 py-1 bg-brand/10 text-brand text-xs font-bold rounded-full mt-2">{user.industry}</span>
                                    <button type="button" onClick={() => setIsEditingProfile(true)} className="mt-4 px-4 py-2 bg-brand/10 text-brand font-bold rounded-lg hover:bg-brand/20 transition-colors text-sm">
                                        개인정보 수정
                                    </button>
                                    {user.approvalStatus === 'pending' && (
                                        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icons.Info className="w-5 h-5 text-yellow-600" />
                                                <span className="font-bold text-yellow-700">승인 대기 중</span>
                                            </div>
                                            <p className="text-xs text-yellow-600">회원가입 신청이 관리자 승인 대기 중입니다. 승인 후 서비스를 이용하실 수 있습니다.</p>
                                        </div>
                                    )}
                                    {user.approvalStatus === 'rejected' && (
                                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icons.X className="w-5 h-5 text-red-600" />
                                                <span className="font-bold text-red-700">승인 거절</span>
                                            </div>
                                            <p className="text-xs text-red-600">회원가입 신청이 거절되었습니다. 관리자에게 문의하세요.</p>
                                        </div>
                                    )}
                                    
                                    {/* PortOne 본인인증 정보 시각화 */}
                                    {user.isIdentityVerified && (
                                        <div className="mt-4 p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                                    <Icons.CheckCircle className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-green-700">PortOne 본인인증 완료</h4>
                                                    <p className="text-xs text-green-600">인증된 개인정보</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                                                    <div className="text-xs text-gray-500 mb-1">인증된 이름</div>
                                                    <div className="font-bold text-sm text-dark">{user.verifiedName || user.name}</div>
                                                </div>
                                                <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                                                    <div className="text-xs text-gray-500 mb-1">인증된 전화번호</div>
                                                    <div className="font-bold text-sm text-dark">{user.verifiedPhone || user.phone || '-'}</div>
                                                </div>
                                                {user.verifiedBirthday && (
                                                    <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                                                        <div className="text-xs text-gray-500 mb-1">생년월일</div>
                                                        <div className="font-bold text-sm text-dark">
                                                            {user.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')}
                                                        </div>
                                                    </div>
                                                )}
                                                {user.verifiedGender && (
                                                    <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                                                        <div className="text-xs text-gray-500 mb-1">성별</div>
                                                        <div className="font-bold text-sm text-dark">{user.verifiedGender === 'M' ? '남성' : '여성'}</div>
                                                    </div>
                                                )}
                                            </div>
                                            {user.impUid && (
                                                <div className="mt-3 pt-3 border-t border-green-200">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-500">인증 거래번호</span>
                                                        <span className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded">{user.impUid.substring(0, 12)}...</span>
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
                <div className="flex gap-2 mb-6 border-b border-gray-200 pb-1 overflow-x-auto">
                    <button onClick={() => setActiveTab('seminars')} className={`px-4 py-2 font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'seminars' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>신청한 모임</button>
                    <button onClick={() => setActiveTab('posts')} className={`px-4 py-2 font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'posts' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>내 게시글</button>
                    <button onClick={() => setActiveTab('verification')} className={`px-4 py-2 font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'verification' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>본인인증 정보</button>
                    {user.hasDonated && (
                        <button onClick={() => setActiveTab('company')} className={`px-4 py-2 font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'company' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>회사 소개</button>
                    )}
                </div>

                {/* 탭 컨텐츠 */}
                <div className="bg-white rounded-3xl shadow-sm p-6 min-h-[300px] mb-8">
                    {activeTab === 'seminars' && (
                        <ul className="space-y-4">
                            {mySeminars.length > 0 ? mySeminars.map((s, idx) => (
                                <li key={idx} className="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50">
                                    <div>
                                        <div className="font-bold text-dark">{s.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">{s.date} | {s.location}</div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">신청완료</span>
                                        <button type="button" onClick={() => {
                                            if(confirm("세미나 신청을 취소하시겠습니까?")) {
                                                if (onCancelSeminar) {
                                                    onCancelSeminar(s.id);
                                                }
                                            }
                                        }} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">취소</button>
                                    </div>
                                </li>
                            )) : <li className="text-center text-gray-400 py-10">신청한 모임이 없습니다.</li>}
                        </ul>
                    )}
                    {activeTab === 'posts' && (
                        <ul className="space-y-4">
                            {myPosts.length > 0 ? myPosts.map((p, idx) => (
                                <li key={idx} className="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{p.category}</span>
                                            <div className="font-bold text-dark">{p.title}</div>
                                        </div>
                                        <div className="text-xs text-gray-400">{p.date}</div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${p.reply ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{p.reply ? '답변완료' : '답변대기'}</span>
                                </li>
                            )) : <li className="text-center text-gray-400 py-10">작성한 게시글이 없습니다.</li>}
                        </ul>
                    )}
                    {activeTab === 'company' && user.hasDonated && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-6">
                                <h3 className="text-xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
                                    <Icons.Star className="w-5 h-5" /> 회사 소개 작성
                                </h3>
                                <p className="text-sm text-yellow-600 mb-6">후원 회원 전용 기능입니다. 회사를 소개해주세요.</p>
                                
                                {/* 대표 이미지 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">대표 이미지 (1장)</label>
                                    <input
                                        type="text"
                                        placeholder="이미지 URL을 입력하세요"
                                        className="w-full p-3 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors text-sm mb-2"
                                        value={companyIntro.companyMainImage}
                                        onChange={(e) => setCompanyIntro({...companyIntro, companyMainImage: e.target.value})}
                                    />
                                    {companyIntro.companyMainImage && (
                                        <div className="relative w-full h-64 rounded-xl overflow-hidden mt-2">
                                            <img src={companyIntro.companyMainImage} alt="대표 이미지" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* 회사 소개 텍스트 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">회사 소개</label>
                                    <textarea
                                        placeholder="회사에 대한 소개를 작성해주세요"
                                        className="w-full p-4 border-[0.5px] border-brand/30 rounded-xl focus:border-brand focus:outline-none transition-colors h-32 resize-none text-sm"
                                        value={companyIntro.companyDescription}
                                        onChange={(e) => setCompanyIntro({...companyIntro, companyDescription: e.target.value})}
                                    />
                                </div>
                                
                                {/* 추가 사진 3장 */}
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">추가 사진 (최대 3장)</label>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {[0, 1, 2].map((idx) => (
                                            <div key={idx}>
                                                <input
                                                    type="text"
                                                    placeholder={`사진 ${idx + 1} URL`}
                                                    className="w-full p-2 border-[0.5px] border-brand/30 rounded-lg focus:border-brand focus:outline-none transition-colors text-xs mb-2"
                                                    value={companyIntro.companyImages[idx] || ''}
                                                    onChange={(e) => {
                                                        const newImages = [...companyIntro.companyImages];
                                                        newImages[idx] = e.target.value;
                                                        setCompanyIntro({...companyIntro, companyImages: newImages});
                                                    }}
                                                />
                                                {companyIntro.companyImages[idx] && (
                                                    <div className="relative aspect-square rounded-lg overflow-hidden">
                                                        <img src={companyIntro.companyImages[idx]} alt={`추가 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const updatedUser = {
                                            ...user,
                                            companyMainImage: companyIntro.companyMainImage,
                                            companyDescription: companyIntro.companyDescription,
                                            companyImages: companyIntro.companyImages.filter(img => img)
                                        };
                                        await onUpdateProfile(updatedUser);
                                        alert('회사 소개가 저장되었습니다.');
                                    }}
                                    className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                >
                                    저장하기
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'verification' && (
                        <div className="space-y-6">
                            {user.isIdentityVerified ? (
                                <Fragment>
                                    {/* 인증 상태 카드 */}
                                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                <Icons.CheckCircle className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold mb-1">본인인증 완료</h3>
                                                <p className="text-green-100 text-sm">PortOne을 통한 본인인증이 완료되었습니다</p>
                                            </div>
                                        </div>
                                        {user.impUid && (
                                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 mt-4">
                                                <div className="text-xs text-green-100 mb-1">인증 거래 고유번호</div>
                                                <div className="font-mono text-sm break-all">{user.impUid}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 인증 정보 상세 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white border-2 border-green-200 rounded-xl p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Icons.Users className="w-5 h-5 text-green-600" />
                                                <h4 className="font-bold text-dark">인증된 이름</h4>
                                            </div>
                                            <div className="text-2xl font-bold text-green-600">{user.verifiedName || user.name}</div>
                                            <div className="text-xs text-gray-500 mt-2">PortOne 본인인증으로 확인된 이름</div>
                                        </div>

                                        <div className="bg-white border-2 border-green-200 rounded-xl p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Icons.Phone className="w-5 h-5 text-green-600" />
                                                <h4 className="font-bold text-dark">인증된 전화번호</h4>
                                            </div>
                                            <div className="text-xl font-bold text-green-600">{user.verifiedPhone || user.phone || '-'}</div>
                                            <div className="text-xs text-gray-500 mt-2">본인인증으로 확인된 전화번호</div>
                                        </div>

                                        {user.verifiedBirthday && (
                                            <div className="bg-white border-2 border-green-200 rounded-xl p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Icons.Calendar className="w-5 h-5 text-green-600" />
                                                    <h4 className="font-bold text-dark">생년월일</h4>
                                                </div>
                                                <div className="text-xl font-bold text-green-600">
                                                    {user.verifiedBirthday.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일')}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-2">본인인증으로 확인된 생년월일</div>
                                            </div>
                                        )}

                                        {user.verifiedGender && (
                                            <div className="bg-white border-2 border-green-200 rounded-xl p-5">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Icons.Users className="w-5 h-5 text-green-600" />
                                                    <h4 className="font-bold text-dark">성별</h4>
                                                </div>
                                                <div className="text-xl font-bold text-green-600">{user.verifiedGender === 'M' ? '남성' : '여성'}</div>
                                                <div className="text-xs text-gray-500 mt-2">본인인증으로 확인된 성별</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 인증 일시 */}
                                    {user.createdAt && (
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1">인증 완료 일시</div>
                                                    <div className="font-bold text-dark">
                                                        {new Date(user.createdAt).toLocaleString('ko-KR', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                <Icons.CheckCircle className="w-8 h-8 text-green-500" />
                                            </div>
                                        </div>
                                    )}
                                </Fragment>
                            ) : (
                                <div className="text-center py-20">
                                    <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Icons.Info className="w-12 h-12 text-yellow-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-dark mb-2">본인인증이 필요합니다</h3>
                                    <p className="text-gray-500 mb-6">PortOne 본인인증을 통해 개인정보를 확인해주세요</p>
                                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 max-w-md mx-auto">
                                        <p className="text-sm text-yellow-700">
                                            본인인증은 회원가입 시 자동으로 진행됩니다.<br/>
                                            인증 정보는 안전하게 보관되며, 서비스 이용을 위해 필수입니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWithdrawClick(); }} className="text-xs text-red-400 hover:text-red-600 underline">회원 탈퇴하기</button>
                </div>
            </div>
        </div>
    );
};

export default MyPageView;
