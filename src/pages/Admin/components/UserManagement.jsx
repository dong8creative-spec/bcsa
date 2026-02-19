import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { getInitialMemberEditForm, EDITABLE_FIELD_LABELS, BUSINESS_CATEGORIES } from '../constants/memberFields';

const PAGE_SIZE = 10;

// 회원등급 표시·정렬 순서: 마스터 → 운영진(운영자) → 파트너사 → 사업자 → 예창(예비창업자) → 대기자(대기)
const MEMBER_GRADE_OPTIONS = [
  { value: '', label: '등급 없음' },
  { value: '마스터', label: '마스터' },
  { value: '운영진', label: '운영진' },
  { value: '파트너사', label: '파트너사' },
  { value: '사업자', label: '사업자' },
  { value: '예창', label: '예창' },
  { value: '대기자', label: '대기자' },
];
const GRADE_PRIORITY = { 마스터: 0, 운영진: 1, 파트너사: 2, 사업자: 3, 예창: 4, 대기자: 5 };

/**
 * 회원 관리 컴포넌트
 * @param {Object} props
 * @param {Function} [props.onNavigateToMemberDetail] - 회원정보 상세 탭으로 이동 콜백
 */
export const UserManagement = ({ onNavigateToMemberDetail }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [memberModalUser, setMemberModalUser] = useState(null);
  const [bulkGradeValue, setBulkGradeValue] = useState('');
  const [sortKey, setSortKey] = useState('memberGrade');
  const [sortOrder, setSortOrder] = useState('asc');
  const [memberModalEditing, setMemberModalEditing] = useState(false);
  const [memberEditForm, setMemberEditForm] = useState(() => getInitialMemberEditForm(null));
  const [savingMember, setSavingMember] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersData = await firebaseService.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('회원 목록 로드 오류:', error);
      alert('회원 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseService.subscribeUsers) {
      setIsLoading(true);
      const unsubscribe = firebaseService.subscribeUsers((usersData) => {
        setUsers(usersData);
        setIsLoading(false);
      });
      return () => unsubscribe();
    }
    loadUsers();
  }, []);

  const handleDeleteUser = async (user) => {
    if (!confirm('정말 이 회원을 강제 탈퇴 처리하시겠습니까?')) return;

    const uid = user?.uid || user?.id;
    const userId = user?.id || user?.uid;

    try {
      if (firebaseService.deleteAuthUser && uid) {
        await firebaseService.deleteAuthUser(uid);
      }
      await firebaseService.deleteUser(userId);
      alert('회원이 강제 탈퇴 처리되었습니다.');
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      alert(error?.message || '회원 강제 탈퇴에 실패했습니다.');
    }
  };

  /** 회원등급 지정 시 승인 처리 + 역할 지정(마스터/운영진=관리자, 그 외=일반 회원) */
  const handleGradeChange = async (userId, value) => {
    try {
      const grade = value || '';
      const role = (grade === '마스터' || grade === '운영진') ? 'admin' : 'user';
      await firebaseService.updateUser(userId, {
        memberGrade: grade,
        approvalStatus: 'approved',
        role,
      });
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('회원등급 변경 오류:', error);
      alert('회원등급 변경에 실패했습니다.');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!confirm(`이 회원을 ${newRole === 'admin' ? '관리자' : '일반 회원'}으로 변경하시겠습니까?`)) return;

    try {
      await firebaseService.updateUser(userId, { role: newRole });
      alert('권한이 변경되었습니다.');
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('권한 변경 오류:', error);
      alert('권한 변경에 실패했습니다.');
    }
  };

  const openMemberEdit = () => {
    setMemberEditForm(getInitialMemberEditForm(memberModalUser));
    setMemberModalEditing(true);
  };

  const handleMemberEditSave = async () => {
    if (!memberModalUser) return;
    const userId = memberModalUser.id || memberModalUser.uid;
    const u = memberModalUser;
    const payload = {};
    const correctedFields = [];
    const str = (v) => String(v ?? '').trim();
    const arr = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

    if (str(memberEditForm.memberGrade) !== str(u.memberGrade)) { payload.memberGrade = memberEditForm.memberGrade || ''; correctedFields.push('memberGrade'); }
    if (str(memberEditForm.approvalStatus) !== str(u.approvalStatus)) { payload.approvalStatus = memberEditForm.approvalStatus || 'pending'; correctedFields.push('approvalStatus'); }
    if (str(memberEditForm.role) !== str(u.role)) { payload.role = memberEditForm.role || 'user'; correctedFields.push('role'); }
    if (str(memberEditForm.company) !== str(u.company)) { payload.company = memberEditForm.company; correctedFields.push('company'); }
    if (str(memberEditForm.companyPhone) !== str(u.companyPhone)) { payload.companyPhone = memberEditForm.companyPhone; correctedFields.push('companyPhone'); }
    if (str(memberEditForm.companyWebsite) !== str(u.companyWebsite)) { payload.companyWebsite = memberEditForm.companyWebsite; correctedFields.push('companyWebsite'); }
    const nextCategory = str(memberEditForm.businessCategory) || str(memberEditForm.industry);
    const currCategory = str(u.businessCategory) || str(u.industry);
    if (nextCategory !== currCategory) { payload.businessCategory = nextCategory; payload.industry = nextCategory; correctedFields.push('businessCategory'); }
    if (str(memberEditForm.position) !== str(u.position)) { payload.position = memberEditForm.position; correctedFields.push('position'); }
    if (str(memberEditForm.collaborationIndustry) !== str(u.collaborationIndustry)) { payload.collaborationIndustry = memberEditForm.collaborationIndustry; correctedFields.push('collaborationIndustry'); }
    if (str(memberEditForm.keyCustomers) !== str(u.keyCustomers)) { payload.keyCustomers = memberEditForm.keyCustomers; correctedFields.push('keyCustomers'); }
    if (str(memberEditForm.companyMainImage) !== str(u.companyMainImage)) { payload.companyMainImage = memberEditForm.companyMainImage; correctedFields.push('companyMainImage'); }
    if (str(memberEditForm.companyDescription) !== str(u.companyDescription)) { payload.companyDescription = memberEditForm.companyDescription; correctedFields.push('companyDescription'); }
    const nextImages = arr(memberEditForm.companyImages);
    const currImages = arr(u.companyImages);
    if (JSON.stringify(nextImages) !== JSON.stringify(currImages)) { payload.companyImages = nextImages; correctedFields.push('companyImages'); }

    if (Object.keys(payload).length === 0) {
      setMemberModalEditing(false);
      return;
    }
    setSavingMember(true);
    try {
      await firebaseService.updateUser(userId, payload);
      const message = correctedFields.length > 0
        ? `${correctedFields.map(f => EDITABLE_FIELD_LABELS[f] || f).join(', ')}가 정정되었습니다.`
        : '회원정보가 정정되었습니다.';
      if (firebaseService.addUserNotification) {
        await firebaseService.addUserNotification(userId, { type: 'profile_corrected', message, correctedFields });
      }
      alert('저장되었습니다. 해당 회원에게 정정 알림이 전달됩니다.');
      setMemberModalEditing(false);
      setMemberModalUser(prev => prev ? { ...prev, ...payload } : null);
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('회원 정보 수정 오류:', error);
      alert(error?.message || '저장에 실패했습니다.');
    } finally {
      setSavingMember(false);
    }
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedUsers.map(u => u.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    if (allOnPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkGradeChange = async () => {
    if (selectedIds.size === 0) {
      alert('등급을 변경할 회원을 선택해주세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedIds.size}명의 회원 등급을 "${MEMBER_GRADE_OPTIONS.find(o => o.value === bulkGradeValue)?.label || bulkGradeValue || '등급 없음'}"(으)로 변경하시겠습니까?`)) return;

    try {
      const grade = bulkGradeValue || '';
      const role = (grade === '마스터' || grade === '운영진') ? 'admin' : 'user';
      for (const id of selectedIds) {
        await firebaseService.updateUser(id, {
          memberGrade: grade,
          approvalStatus: 'approved',
          role,
        });
      }
      alert(`${selectedIds.size}명 회원 등급·승인·역할이 적용되었습니다.`);
      setSelectedIds(new Set());
      setBulkGradeValue('');
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('일괄 등급 변경 오류:', error);
      alert('일괄 등급 변경에 실패했습니다.');
    }
  };

  const handleBulkWithdraw = async () => {
    if (selectedIds.size === 0) {
      alert('탈퇴 처리할 회원을 선택해주세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedIds.size}명 회원을 강제 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const list = filteredUsers.filter(u => selectedIds.has(u.id));
      for (const user of list) {
        const uid = user.uid || user.id;
        if (firebaseService.deleteAuthUser && uid) {
          await firebaseService.deleteAuthUser(uid);
        }
        await firebaseService.deleteUser(user.id);
      }
      alert(`${selectedIds.size}명 회원이 탈퇴 처리되었습니다.`);
      setSelectedIds(new Set());
      setMemberModalUser(null);
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('일괄 탈퇴 오류:', error);
      alert(error?.message || '일괄 탈퇴 처리에 실패했습니다.');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const sortedUsers = React.useMemo(() => {
    const getVal = (u, k) => {
      if (k === 'createdAt') {
        const c = u.createdAt;
        if (!c) return 0;
        if (typeof c.toDate === 'function') return c.toDate().getTime();
        if (typeof c === 'string') return new Date(c).getTime();
        return 0;
      }
      if (k === 'memberGrade') {
        const g = (u.memberGrade || '').toString().trim();
        return GRADE_PRIORITY[g] ?? 99;
      }
      return (u[k] || '').toString().trim().toLowerCase();
    };
    const list = [...filteredUsers];
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
  }, [filteredUsers, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const paginatedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, sortKey, sortOrder]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-gray-600">회원 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dark flex items-center gap-3">
          <Icons.Users size={28} />
          회원 관리
        </h2>
        <div className="flex items-center gap-2">
          {typeof onNavigateToMemberDetail === 'function' && (
            <button
              type="button"
              onClick={onNavigateToMemberDetail}
              className="px-4 py-2 bg-white border-2 border-brand text-brand rounded-xl font-bold hover:bg-brand/5 transition-colors flex items-center gap-2"
            >
              <Icons.FileSearch size={18} />
              회원정보 상세
            </button>
          )}
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">검색</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">권한 필터</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="user">일반 회원</option>
            <option value="admin">관리자</option>
          </select>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-bold mb-1">전체 회원</p>
          <p className="text-2xl font-bold text-dark">{users.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-sm text-green-600 font-bold mb-1">일반 회원</p>
          <p className="text-2xl font-bold text-dark">{users.filter(u => u.role === 'user').length}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-sm text-purple-600 font-bold mb-1">관리자</p>
          <p className="text-2xl font-bold text-dark">{users.filter(u => u.role === 'admin').length}</p>
        </div>
      </div>

      {/* 일괄 작업 버튼 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-blue-100">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="px-4 py-2 bg-white border-2 border-blue-200 rounded-xl font-bold text-gray-700 hover:border-brand hover:bg-brand/5 transition-colors"
        >
          {paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.has(u.id)) ? '전체 해제' : '전체선택'}
        </button>
        {selectedIds.size > 0 && (
          <>
            <span className="text-sm text-gray-600 font-medium">선택 {selectedIds.size}명</span>
            <select
              value={bulkGradeValue}
              onChange={(e) => setBulkGradeValue(e.target.value)}
              className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:border-brand focus:outline-none"
            >
              <option value="">등급 선택</option>
              {MEMBER_GRADE_OPTIONS.filter(o => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkGradeChange}
              disabled={!bulkGradeValue}
              className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              선택 회원 등급 일괄 변경
            </button>
            <button
              type="button"
              onClick={handleBulkWithdraw}
              className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
            >
              선택 회원 일괄 탈퇴
            </button>
          </>
        )}
      </div>

      {/* 회원 목록: 회원등급 | 회원명 | 가입일자 | 탈퇴 (항목별 오름/내림차순 정렬) */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50/50">
              <th className="px-4 py-3 text-center w-12 align-middle">
                <input
                  type="checkbox"
                  checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.has(u.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
                />
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('memberGrade')}
              >
                <span className="block text-center">회원등급</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-blue-200 bg-white/90 text-gray-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'memberGrade' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('name')}
              >
                <span className="block text-center">회원명</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-blue-200 bg-white/90 text-gray-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'name' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('company')}
              >
                <span className="block text-center">회사명</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-blue-200 bg-white/90 text-gray-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'company' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-gray-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('createdAt')}
              >
                <span className="block text-center">가입일자</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-blue-200 bg-white/90 text-gray-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'createdAt' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 align-middle">탈퇴</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  회원이 없습니다.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-blue-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelectOne(user.id)}
                      className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
                    />
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <select
                      value={user.memberGrade || ''}
                      onChange={(e) => handleGradeChange(user.id, e.target.value)}
                      className="mx-auto block max-w-[140px] px-2 py-1.5 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                    >
                      {MEMBER_GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => setMemberModalUser(user)}
                      className="text-sm font-bold text-brand hover:underline"
                    >
                      {user.name || '-'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center align-middle">{user.company || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center align-middle">
                    {user.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? (typeof user.createdAt === 'string' ? new Date(user.createdAt).toLocaleDateString('ko-KR') : user.createdAt) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      className="px-3 py-1.5 text-sm font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      탈퇴
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-4 py-2 rounded-xl font-bold border-2 border-blue-200 text-gray-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm font-bold text-gray-700">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 rounded-xl font-bold border-2 border-blue-200 text-gray-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
        </div>
      )}

      {/* 회원 정보 모달: 열람(전체) + 수정(수정 가능 필드만) */}
      {memberModalUser && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setMemberModalEditing(false); setMemberModalUser(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-dark">{memberModalEditing ? '회원 정보 수정 (민감정보 제외)' : '회원 정보'}</h3>
              <button type="button" onClick={() => { setMemberModalEditing(false); setMemberModalUser(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">×</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {/* 열람 전용: 개인정보·본인인증·주소·사업자등록번호 */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <h4 className="font-bold text-gray-700 mb-3">개인정보 (열람 전용)</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회원명</span><span className="text-dark">{memberModalUser.name || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">이메일</span><span className="text-dark">{memberModalUser.email || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">연락처</span><span className="text-dark">{memberModalUser.phone || memberModalUser.phoneNumber || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">연락처 공개</span><span className="text-dark">{memberModalUser.phonePublic ? '공개' : '비공개'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">생년월일</span><span className="text-dark">{memberModalUser.birthdate || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">성별</span><span className="text-dark">{memberModalUser.gender === 'M' ? '남성' : memberModalUser.gender === 'F' ? '여성' : (memberModalUser.gender || '-')}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">주소</span><span className="text-dark">{[memberModalUser.roadAddress, memberModalUser.detailAddress].filter(Boolean).join(' ') || memberModalUser.address || memberModalUser.region || '-'}</span></div>
                  {memberModalUser.zipCode && <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">우편번호</span><span className="text-dark">{memberModalUser.zipCode}</span></div>}
                  <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">가입일자</span><span className="text-dark">{memberModalUser.createdAt?.toDate?.().toLocaleString('ko-KR') ?? (typeof memberModalUser.createdAt === 'string' ? new Date(memberModalUser.createdAt).toLocaleString('ko-KR') : memberModalUser.createdAt) ?? '-'}</span></div>
                  {memberModalUser.isIdentityVerified && (
                    <>
                      <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">본인인증 이름</span><span className="text-dark">{memberModalUser.verifiedName || '-'}</span></div>
                      <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">본인인증 전화</span><span className="text-dark">{memberModalUser.verifiedPhone || '-'}</span></div>
                    </>
                  )}
                  {(memberModalUser.businessRegistrationNumber || memberModalUser.company) && (
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">사업자등록번호</span><span className="text-dark">{memberModalUser.businessRegistrationNumber || '-'}</span></div>
                  )}
                </div>
              </div>

              {memberModalEditing ? (
                <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-4">
                  <h4 className="font-bold text-gray-700 mb-3">수정 가능 항목</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">회원등급</span>
                      <select value={memberEditForm.memberGrade ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, memberGrade: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                        {MEMBER_GRADE_OPTIONS.map(opt => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">승인 여부</span>
                      <select value={memberEditForm.approvalStatus ?? 'pending'} onChange={e => setMemberEditForm(f => ({ ...f, approvalStatus: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                        <option value="pending">대기</option>
                        <option value="approved">승인</option>
                        <option value="rejected">거절</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">권한</span>
                      <select value={memberEditForm.role ?? 'user'} onChange={e => setMemberEditForm(f => ({ ...f, role: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                        <option value="user">일반 회원</option>
                        <option value="admin">관리자</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">회사명</span>
                      <input type="text" value={memberEditForm.company ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, company: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="회사명" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">회사 전화</span>
                      <input type="text" value={memberEditForm.companyPhone ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyPhone: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="회사 전화번호" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">회사 사이트</span>
                      <input type="url" value={memberEditForm.companyWebsite ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyWebsite: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="https://..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">업종/업태</span>
                      <select value={memberEditForm.businessCategory ?? memberEditForm.industry ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, businessCategory: e.target.value, industry: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none bg-white">
                        <option value="">선택</option>
                        {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">직책</span>
                      <input type="text" value={memberEditForm.position ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, position: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="직책" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">협업 업종</span>
                      <input type="text" value={memberEditForm.collaborationIndustry ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, collaborationIndustry: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="협업 업종" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">핵심고객</span>
                      <input type="text" value={memberEditForm.keyCustomers ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, keyCustomers: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="핵심고객" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0">대표 이미지 URL</span>
                      <input type="text" value={memberEditForm.companyMainImage ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyMainImage: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none" placeholder="URL" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0 pt-2">회사 소개</span>
                      <textarea value={memberEditForm.companyDescription ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyDescription: e.target.value }))} rows={3} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none resize-none" placeholder="회사 소개" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-32 font-bold text-gray-600 shrink-0 pt-2">추가 이미지 URL</span>
                      <textarea value={(Array.isArray(memberEditForm.companyImages) ? memberEditForm.companyImages : (memberEditForm.companyImages ? [memberEditForm.companyImages] : [])).join('\n')} onChange={e => setMemberEditForm(f => ({ ...f, companyImages: e.target.value.trim() ? e.target.value.trim().split(/\n/).map(s => s.trim()).filter(Boolean) : [] }))} rows={2} className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:border-brand focus:outline-none resize-none" placeholder="한 줄에 URL 하나" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-4">
                  <h4 className="font-bold text-gray-700 mb-3">수정 가능 항목 (현재 값)</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회원등급</span><span className="text-dark">{memberModalUser.memberGrade || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">승인 여부</span><span className="text-dark">{memberModalUser.approvalStatus === 'approved' ? '승인' : memberModalUser.approvalStatus === 'rejected' ? '거절' : '대기'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">권한</span><span className="text-dark">{memberModalUser.role === 'admin' ? '관리자' : '일반 회원'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회사명</span><span className="text-dark">{memberModalUser.company || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회사 전화</span><span className="text-dark">{memberModalUser.companyPhone || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회사 사이트</span><span className="text-dark">{memberModalUser.companyWebsite ? <a href={memberModalUser.companyWebsite.startsWith('http') ? memberModalUser.companyWebsite : `https://${memberModalUser.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{memberModalUser.companyWebsite}</a> : '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">업종/업태</span><span className="text-dark">{memberModalUser.businessCategory || memberModalUser.industry || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">직책</span><span className="text-dark">{memberModalUser.position || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">협업 업종</span><span className="text-dark">{memberModalUser.collaborationIndustry || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">핵심고객</span><span className="text-dark">{memberModalUser.keyCustomers || '-'}</span></div>
                    {memberModalUser.companyMainImage && <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">대표 이미지</span><a href={memberModalUser.companyMainImage} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate">보기</a></div>}
                    {memberModalUser.companyDescription && <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">회사 소개</span><span className="text-dark whitespace-pre-line">{memberModalUser.companyDescription}</span></div>}
                    {memberModalUser.companyImages && memberModalUser.companyImages.length > 0 && <div className="flex"><span className="w-32 font-bold text-gray-600 shrink-0">추가 이미지</span><span className="text-dark">{memberModalUser.companyImages.length}장</span></div>}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-blue-100 flex gap-2 justify-end">
              {!memberModalEditing && (
                <button type="button" onClick={() => { handleDeleteUser(memberModalUser); setMemberModalUser(null); }} className="px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50">강제 탈퇴</button>
              )}
              {memberModalEditing ? (
                <>
                  <button type="button" onClick={() => setMemberModalEditing(false)} className="px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50">취소</button>
                  <button type="button" onClick={handleMemberEditSave} disabled={savingMember} className="px-4 py-2 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">저장</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={openMemberEdit} className="px-4 py-2 text-sm font-bold text-brand border border-brand rounded-xl hover:bg-brand/5">수정</button>
                  <button type="button" onClick={() => setMemberModalUser(null)} className="px-4 py-2 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">닫기</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
