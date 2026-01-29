import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';

/**
 * 회원 관리 컴포넌트
 */
export const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    loadUsers();
  }, []);

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

  const handleDeleteUser = async (userId) => {
    if (!confirm('정말 이 회원을 삭제하시겠습니까?')) return;

    try {
      await firebaseService.deleteUser(userId);
      alert('회원이 삭제되었습니다.');
      loadUsers();
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      alert('회원 삭제에 실패했습니다.');
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    if (!confirm(`이 회원을 ${newRole === 'admin' ? '관리자' : '일반 회원'}으로 변경하시겠습니까?`)) return;

    try {
      await firebaseService.updateUser(userId, { role: newRole });
      alert('권한이 변경되었습니다.');
      loadUsers();
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
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">이름</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">이메일</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">권한</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">가입일</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  회원이 없습니다.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-blue-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-dark font-medium">{user.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? '관리자' : '일반'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.createdAt?.toDate?.().toLocaleDateString() || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggleRole(user.id, user.role)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title={user.role === 'admin' ? '일반 회원으로 변경' : '관리자로 변경'}
                      >
                        <Icons.Shield size={18} className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="회원 삭제"
                      >
                        <Icons.Trash2 size={18} className="text-red-600" />
                      </button>
                    </div>
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
