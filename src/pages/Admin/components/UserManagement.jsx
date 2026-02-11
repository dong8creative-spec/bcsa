import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';

const MEMBER_GRADE_OPTIONS = [
  { value: '', label: '등급 없음' },
  { value: '파트너사', label: '파트너사' },
  { value: '운영진', label: '운영진' },
  { value: '사업자', label: '사업자' },
  { value: '예창', label: '예창' },
];

/**
 * 회원 관리 컴포넌트
 */
export const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

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

  const handleDeleteUser = async (userId) => {
    if (!confirm('정말 이 회원을 강제 탈퇴 처리하시겠습니까?')) return;

    try {
      await firebaseService.deleteUser(userId);
      alert('회원이 강제 탈퇴 처리되었습니다.');
      if (!firebaseService.subscribeUsers) loadUsers();
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      alert('회원 강제 탈퇴에 실패했습니다.');
    }
  };

  const handleGradeChange = async (userId, value) => {
    try {
      await firebaseService.updateUser(userId, { memberGrade: value || '' });
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

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
        <button
          onClick={loadUsers}
          className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Icons.RefreshCw size={18} />
          새로고침
        </button>
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

      {/* 회원 목록 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-blue-200">
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">회원명</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">회사명</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">회원 연락처</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">지역</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">가입일자</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">회원등급</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">승인 여부</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">관리자 기능</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">회원 강제탈퇴</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                  회원이 없습니다.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-blue-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-dark font-medium">{user.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.company || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.phone || user.phoneNumber || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.address || user.region || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? user.createdAt ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.memberGrade || ''}
                      onChange={(e) => handleGradeChange(user.id, e.target.value)}
                      className="w-full max-w-[140px] px-2 py-1.5 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                    >
                      {MEMBER_GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                      !user.approvalStatus || user.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`} title={!user.approvalStatus || user.approvalStatus === 'approved' ? '회원명단(부청사 회원)에 표시됨' : '승인 대기 중'}>
                      {!user.approvalStatus || user.approvalStatus === 'approved' ? '승인' : '대기'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role === 'admin' ? 'admin' : 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="w-full max-w-[100px] px-2 py-1.5 border border-blue-200 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                    >
                      <option value="user">부</option>
                      <option value="admin">여</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-3 py-1.5 text-sm font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      회원 강제탈퇴
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
