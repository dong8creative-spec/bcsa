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
 * @param {Object} [props.currentUser] - Firebase 로그인 사용자 (저장 시 필수)
 */
export const MemberDetailView = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState(() => getInitialMemberEditForm(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (firebaseService.subscribeUsersAdmin) {
      setIsLoading(true);
      const unsubscribe = firebaseService.subscribeUsersAdmin((usersData) => {
        setUsers(usersData || []);
        setIsLoading(false);
      });
      return () => unsubscribe();
    }
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await firebaseService.getUsersAdmin();
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
    if (!currentUser) {
      alert('회원 정보 수정을 하려면 먼저 로그인해 주세요. 메인 페이지에서 로그인한 뒤 관리자 페이지로 다시 들어와 주세요.');
      return;
    }
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
      if (!firebaseService.subscribeUsersAdmin && firebaseService.getUsersAdmin) {
        const updated = await firebaseService.getUsersAdmin();
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-royal mb-4" />
          <p className="text-[15px] text-sub">회원 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2.5 text-[22px] font-bold text-ink md:text-[24px]">
        <Icons.FileSearch size={24} />
        회원정보 상세
      </h2>
      <p className="mb-6 text-[15px] leading-relaxed text-sub">회원을 선택하면 기입한 정보를 한눈에 볼 수 있으며, 민감정보를 제외한 항목만 수정할 수 있습니다.</p>

      {/* 회원 선택 */}
      <div className="mb-6">
        <label htmlFor="member-detail-search" className="mb-2 block text-[15px] font-semibold text-ink">회원 선택</label>
        <input
          id="member-detail-search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          className="h-12 w-full max-w-md rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
        <div className="mt-2 max-h-[264px] overflow-y-auto border border-line border-t-ink bg-white">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-[15px] text-sub">회원이 없거나 검색 결과가 없습니다.</div>
          ) : (
            filteredUsers.slice(0, 50).map((u) => (
              <button
                key={u.id || u.uid}
                type="button"
                onClick={() => setSelectedUser(u)}
                className={`flex min-h-[52px] w-full items-center gap-2 border-b border-line px-4 text-left text-[15px] last:border-0 transition-colors ${selectedUser && (selectedUser.id === u.id || selectedUser.uid === u.uid) ? 'bg-[#0c0c0e] text-white' : 'hover:bg-card'}`}
              >
                <span className="shrink-0 font-semibold">{u.name || '-'}</span>
                <span className="min-w-0 truncate text-[14px] opacity-70" title={u.email || ''}>{u.email || ''}</span>
                {u.memberGrade && <span className="ml-auto inline-flex h-7 shrink-0 items-center bg-sky px-2 text-[13px] text-royal">{u.memberGrade}</span>}
              </button>
            ))
          )}
        </div>
      </div>

      {!selectedUser ? (
        <div className="rounded-xl bg-card p-12 text-center text-[15px] text-sub">
          위에서 회원을 선택하면 상세 정보가 표시됩니다.
        </div>
      ) : (
        <div className="space-y-6">
          {/* 개인정보 (열람 전용) */}
          <div>
            <h4 className="mb-3 text-[18px] font-bold text-ink">개인정보 (열람 전용)</h4>
            <div className="grid grid-cols-1 gap-x-8 border-t border-ink text-[15px] md:grid-cols-2">
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">회원명</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.name || '-'}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">이메일</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.email || '-'}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">연락처</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.phone || selectedUser.phoneNumber || '-'}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">연락처 공개</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.phonePublic ? '공개' : '비공개'}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">생년월일</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.birthdate || '-'}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">성별</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.gender === 'M' ? '남성' : selectedUser.gender === 'F' ? '여성' : (selectedUser.gender || '-')}</span></div>
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:col-span-2 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">주소</span><span className="min-w-0 break-keep break-words text-ink">{[selectedUser.roadAddress, selectedUser.detailAddress].filter(Boolean).join(' ') || selectedUser.address || selectedUser.region || '-'}</span></div>
              {selectedUser.zipCode && <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">우편번호</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.zipCode}</span></div>}
              <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">가입일자</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.createdAt?.toDate?.().toLocaleString('ko-KR') ?? (typeof selectedUser.createdAt === 'string' ? new Date(selectedUser.createdAt).toLocaleString('ko-KR') : selectedUser.createdAt) ?? '-'}</span></div>
              {selectedUser.isIdentityVerified && (
                <>
                  <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">본인인증 이름</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.verifiedName || '-'}</span></div>
                  <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">본인인증 전화</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.verifiedPhone || '-'}</span></div>
                </>
              )}
              {(selectedUser.businessRegistrationNumber || selectedUser.company) && (
                <div className="grid min-h-[52px] grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[130px_minmax(0,1fr)]"><span className="text-sub">사업자등록번호</span><span className="min-w-0 break-keep break-words text-ink">{selectedUser.businessRegistrationNumber || '-'}</span></div>
              )}
            </div>
          </div>

          {/* 수정 가능 항목 */}
          <div className="rounded-xl bg-card p-5 md:p-6">
            <h4 className="mb-4 text-[18px] font-bold text-ink">수정 가능 항목</h4>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-[15px] md:grid-cols-2">
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">회원등급</span>
                <select value={editForm.memberGrade ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, memberGrade: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none">
                  {MEMBER_GRADE_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">승인 여부</span>
                <select value={editForm.approvalStatus ?? 'pending'} onChange={(e) => setEditForm((f) => ({ ...f, approvalStatus: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none">
                  <option value="pending">대기</option>
                  <option value="approved">승인</option>
                  <option value="rejected">거절</option>
                </select>
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">권한</span>
                <select value={editForm.role ?? 'user'} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none">
                  <option value="user">일반 회원</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">회사명</span>
                <input type="text" value={editForm.company ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="회사명" />
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">회사 전화</span>
                <input type="text" value={editForm.companyPhone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyPhone: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="회사 전화번호" />
              </div>
              <div className="flex min-h-[52px] items-center gap-3 md:col-span-2">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">회사 사이트</span>
                <input type="url" value={editForm.companyWebsite ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, companyWebsite: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="https://..." />
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">업종/업태</span>
                <select value={editForm.businessCategory ?? editForm.industry ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, businessCategory: e.target.value, industry: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none">
                  <option value="">선택</option>
                  {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">직책</span>
                <input type="text" value={editForm.position ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="직책" />
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">협업 업종</span>
                <input type="text" value={editForm.collaborationIndustry ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, collaborationIndustry: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="협업 업종" />
              </div>
              <div className="flex min-h-[52px] items-center gap-3">
                <span className="w-[110px] shrink-0 text-sub md:w-[130px]">핵심고객</span>
                <input type="text" value={editForm.keyCustomers ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, keyCustomers: e.target.value }))} className="h-12 min-w-0 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none" placeholder="핵심고객" />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0c0c0e] px-6 text-[15px] font-bold text-white hover:bg-black disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
