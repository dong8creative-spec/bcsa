import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { getInitialMemberEditForm, EDITABLE_FIELD_LABELS, BUSINESS_CATEGORIES } from '../constants/memberFields';

const MEMBER_GRADE_OPTIONS = [
  { value: '', label: '등급 없음' },
  { value: '마스터', label: '마스터' },
  { value: '운영진', label: '운영진' },
  { value: '파트너사', label: '파트너사' },
  { value: '사업자', label: '사업자' },
  { value: '예창', label: '예창' },
  { value: '대기자', label: '대기자' },
];

/**
 * 회원정보 한눈에 보기: 회원 선택 후 전체 정보 열람 + 수정 가능 항목만 편집
 */
export const MemberDetailView = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState(() => getInitialMemberEditForm(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (firebaseService.subscribeUsers) {
      setIsLoading(true);
      const unsubscribe = firebaseService.subscribeUsers((usersData) => {
        setUsers(usersData || []);
        setIsLoading(false);
      });
      return () => unsubscribe();
    }
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await firebaseService.getUsers();
        setUsers(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      setEditForm(getInitialMemberEditForm(selectedUser));
    } else {
      setEditForm(getInitialMemberEditForm(null));
    }
  }, [selectedUser]);

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
  });

  const handleSave = async () => {
    if (!selectedUser) return;
    const u = selectedUser;
    const userId = u.id || u.uid;
    const payload = {};
    const correctedFields = [];
    const str = (v) => String(v ?? '').trim();
    const arr = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

    if (str(editForm.memberGrade) !== str(u.memberGrade)) { payload.memberGrade = editForm.memberGrade || ''; correctedFields.push('memberGrade'); }
    if (str(editForm.approvalStatus) !== str(u.approvalStatus)) { payload.approvalStatus = editForm.approvalStatus || 'pending'; correctedFields.push('approvalStatus'); }
    if (str(editForm.role) !== str(u.role)) { payload.role = editForm.role || 'user'; correctedFields.push('role'); }
    if (str(editForm.company) !== str(u.company)) { payload.company = editForm.company; correctedFields.push('company'); }
    if (str(editForm.companyPhone) !== str(u.companyPhone)) { payload.companyPhone = editForm.companyPhone; correctedFields.push('companyPhone'); }
    if (str(editForm.companyWebsite) !== str(u.companyWebsite)) { payload.companyWebsite = editForm.companyWebsite; correctedFields.push('companyWebsite'); }
    const nextCategory = str(editForm.businessCategory) || str(editForm.industry);
    const currCategory = str(u.businessCategory) || str(u.industry);
    if (nextCategory !== currCategory) { payload.businessCategory = nextCategory; payload.industry = nextCategory; correctedFields.push('businessCategory'); }
    if (str(editForm.position) !== str(u.position)) { payload.position = editForm.position; correctedFields.push('position'); }
    if (str(editForm.collaborationIndustry) !== str(u.collaborationIndustry)) { payload.collaborationIndustry = editForm.collaborationIndustry; correctedFields.push('collaborationIndustry'); }
    if (str(editForm.keyCustomers) !== str(u.keyCustomers)) { payload.keyCustomers = editForm.keyCustomers; correctedFields.push('keyCustomers'); }
    if (str(editForm.companyMainImage) !== str(u.companyMainImage)) { payload.companyMainImage = editForm.companyMainImage; correctedFields.push('companyMainImage'); }
    if (str(editForm.companyDescription) !== str(u.companyDescription)) { payload.companyDescription = editForm.companyDescription; correctedFields.push('companyDescription'); }
    const nextImages = arr(editForm.companyImages);
    const currImages = arr(u.companyImages);
    if (JSON.stringify(nextImages) !== JSON.stringify(currImages)) { payload.companyImages = nextImages; correctedFields.push('companyImages'); }

    if (Object.keys(payload).length === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }
    setSaving(true);
    try {
      await firebaseService.updateUser(userId, payload);
      const message = correctedFields.length > 0
        ? `${correctedFields.map((f) => EDITABLE_FIELD_LABELS[f] || f).join(', ')}가 정정되었습니다.`
        : '회원정보가 정정되었습니다.';
      if (firebaseService.addUserNotification) {
        await firebaseService.addUserNotification(userId, { type: 'profile_corrected', message, correctedFields });
      }
      alert('저장되었습니다.');
      setSelectedUser((prev) => (prev ? { ...prev, ...payload } : null));
      if (!firebaseService.subscribeUsers && firebaseService.getUsers) {
        const updated = await firebaseService.getUsers();
        setUsers(updated || []);
      }
    } catch (error) {
      console.error('회원 정보 수정 오류:', error);
      alert(error?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4" />
          <p className="text-gray-600">회원 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark flex items-center gap-3 mb-6">
        <Icons.FileSearch size={28} />
        회원정보 상세
      </h2>
      <p className="text-sm text-gray-600 mb-6">회원을 선택하면 기입한 정보를 한눈에 볼 수 있으며, 민감정보를 제외한 항목만 수정할 수 있습니다.</p>

      {/* 회원 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">회원 선택</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          className="w-full max-w-md px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
        <div className="mt-2 max-h-48 overflow-y-auto border border-blue-200 rounded-xl bg-white">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">회원이 없거나 검색 결과가 없습니다.</div>
          ) : (
            filteredUsers.slice(0, 50).map((u) => (
              <button
                key={u.id || u.uid}
                type="button"
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors ${selectedUser && (selectedUser.id === u.id || selectedUser.uid === u.uid) ? 'bg-brand/10 font-bold text-brand' : ''}`}
              >
                <span className="font-medium">{u.name || '-'}</span>
                <span className="text-gray-500 text-sm ml-2">{u.email || ''}</span>
                {u.memberGrade && <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 rounded">{u.memberGrade}</span>}
              </button>
            ))
          )}
        </div>
      </div>

      {!selectedUser ? (
        <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-12 text-center text-gray-600">
          위에서 회원을 선택하면 상세 정보가 표시됩니다.
        </div>
      ) : (
        <div className="space-y-6">
          {/* 개인정보 (열람 전용) */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h4 className="font-bold text-gray-700 mb-4">개인정보 (열람 전용)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">회원명</span><span className="text-dark">{selectedUser.name || '-'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">이메일</span><span className="text-dark">{selectedUser.email || '-'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">연락처</span><span className="text-dark">{selectedUser.phone || selectedUser.phoneNumber || '-'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">연락처 공개</span><span className="text-dark">{selectedUser.phonePublic ? '공개' : '비공개'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">생년월일</span><span className="text-dark">{selectedUser.birthdate || '-'}</span></div>
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">성별</span><span className="text-dark">{selectedUser.gender === 'M' ? '남성' : selectedUser.gender === 'F' ? '여성' : (selectedUser.gender || '-')}</span></div>
              <div className="flex md:col-span-2"><span className="w-36 font-bold text-gray-600 shrink-0">주소</span><span className="text-dark">{[selectedUser.roadAddress, selectedUser.detailAddress].filter(Boolean).join(' ') || selectedUser.address || selectedUser.region || '-'}</span></div>
              {selectedUser.zipCode && <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">우편번호</span><span className="text-dark">{selectedUser.zipCode}</span></div>}
              <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">가입일자</span><span className="text-dark">{selectedUser.createdAt?.toDate?.().toLocaleString('ko-KR') ?? (typeof selectedUser.createdAt === 'string' ? new Date(selectedUser.createdAt).toLocaleString('ko-KR') : selectedUser.createdAt) ?? '-'}</span></div>
              {selectedUser.isIdentityVerified && (
                <>
                  <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">본인인증 이름</span><span className="text-dark">{selectedUser.verifiedName || '-'}</span></div>
                  <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">본인인증 전화</span><span className="text-dark">{selectedUser.verifiedPhone || '-'}</span></div>
                </>
              )}
              {(selectedUser.businessRegistrationNumber || selectedUser.company) && (
                <div className="flex"><span className="w-36 font-bold text-gray-600 shrink-0">사업자등록번호</span><span className="text-dark">{selectedUser.businessRegistrationNumber || '-'}</span></div>
              )}
            </div>
          </div>

          {/* 수정 가능 항목 */}
          <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-6">
            <h4 className="font-bold text-gray-700 mb-4">수정 가능 항목</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">회원등급</span>
                <select value={editForm.memberGrade ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, memberGrade: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                  {MEMBER_GRADE_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">승인 여부</span>
                <select value={editForm.approvalStatus ?? 'pending'} onChange={(e) => setEditForm((f) => ({ ...f, approvalStatus: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                  <option value="pending">대기</option>
                  <option value="approved">승인</option>
                  <option value="rejected">거절</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">권한</span>
                <select value={editForm.role ?? 'user'} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                  <option value="user">일반 회원</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">회사명</span>
                <input type="text" value={editForm.company ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="회사명" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">회사 전화</span>
                <input type="text" value={editForm.companyPhone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyPhone: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="회사 전화번호" />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">회사 사이트</span>
                <input type="url" value={editForm.companyWebsite ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyWebsite: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">업종/업태</span>
                <select value={editForm.businessCategory ?? editForm.industry ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, businessCategory: e.target.value, industry: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                  <option value="">선택</option>
                  {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">직책</span>
                <input type="text" value={editForm.position ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="직책" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">협업 업종</span>
                <input type="text" value={editForm.collaborationIndustry ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, collaborationIndustry: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="협업 업종" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">핵심고객</span>
                <input type="text" value={editForm.keyCustomers ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, keyCustomers: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="핵심고객" />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <span className="w-36 font-bold text-gray-600 shrink-0">대표 이미지 URL</span>
                <input type="text" value={editForm.companyMainImage ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyMainImage: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="URL" />
              </div>
              <div className="md:col-span-2 flex items-start gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0 pt-2">회사 소개</span>
                <textarea value={editForm.companyDescription ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyDescription: e.target.value }))} rows={3} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none resize-none" placeholder="회사 소개" />
              </div>
              <div className="md:col-span-2 flex items-start gap-2">
                <span className="w-36 font-bold text-gray-600 shrink-0 pt-2">추가 이미지 URL</span>
                <textarea value={(Array.isArray(editForm.companyImages) ? editForm.companyImages : (editForm.companyImages ? [editForm.companyImages] : [])).join('\n')} onChange={(e) => setEditForm((f) => ({ ...f, companyImages: e.target.value.trim() ? e.target.value.trim().split(/\n/).map((s) => s.trim()).filter(Boolean) : [] }))} rows={2} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none resize-none" placeholder="한 줄에 URL 하나" />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
