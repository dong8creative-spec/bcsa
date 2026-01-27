import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { DateTimePicker } from './DateTimePicker';
import { KakaoMapModal } from './KakaoMapModal';

/**
 * 프로그램 관리 컴포넌트
 */
export const ProgramManagement = () => {
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    locationLat: null,
    locationLng: null,
    capacity: '',
    category: '',
    imageUrl: ''
  });

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setIsLoading(true);
      const programsData = await firebaseService.getSeminars();
      setPrograms(programsData);
    } catch (error) {
      console.error('프로그램 목록 로드 오류:', error);
      alert('프로그램 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingProgram) {
        await firebaseService.updateSeminar(editingProgram.id, formData);
        alert('프로그램이 수정되었습니다.');
      } else {
        await firebaseService.createSeminar(formData);
        alert('프로그램이 추가되었습니다.');
      }
      setShowModal(false);
      resetForm();
      loadPrograms();
    } catch (error) {
      console.error('프로그램 저장 오류:', error);
      alert('프로그램 저장에 실패했습니다.');
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    setFormData({
      title: program.title || '',
      description: program.description || '',
      date: program.date || '',
      location: program.location || '',
      locationLat: program.locationLat || null,
      locationLng: program.locationLng || null,
      capacity: program.capacity || '',
      category: program.category || '',
      imageUrl: program.imageUrl || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (programId) => {
    if (!confirm('정말 이 프로그램을 삭제하시겠습니까?')) return;

    try {
      await firebaseService.deleteSeminar(programId);
      alert('프로그램이 삭제되었습니다.');
      loadPrograms();
    } catch (error) {
      console.error('프로그램 삭제 오류:', error);
      alert('프로그램 삭제에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setEditingProgram(null);
    setFormData({
      title: '',
      description: '',
      date: '',
      location: '',
      locationLat: null,
      locationLng: null,
      capacity: '',
      category: '',
      imageUrl: ''
    });
  };

  const handleLocationSelect = (location) => {
    setFormData({
      ...formData,
      location: location.address,
      locationLat: location.lat,
      locationLng: location.lng
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-gray-600">프로그램 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dark flex items-center gap-3">
          <Icons.Calendar size={28} />
          프로그램 관리
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadPrograms}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Icons.RefreshCw size={18} />
            새로고침
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.Plus size={18} />
            프로그램 추가
          </button>
        </div>
      </div>

      {/* 프로그램 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Icons.Calendar size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">등록된 프로그램이 없습니다.</p>
          </div>
        ) : (
          programs.map((program) => (
            <div key={program.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:shadow-lg transition-shadow">
              {program.imageUrl && (
                <img src={program.imageUrl} alt={program.title} className="w-full h-40 object-cover rounded-xl mb-3" />
              )}
              <h3 className="font-bold text-lg text-dark mb-2">{program.title}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{program.description}</p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.Calendar size={16} />
                  <span>{program.date || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.MapPin size={16} />
                  <span className="line-clamp-1">{program.location || '-'}</span>
                </div>
                {program.capacity && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icons.Users size={16} />
                    <span>{program.capacity}명</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(program)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Edit2 size={16} />
                  수정
                </button>
                <button
                  onClick={() => handleDelete(program.id)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Trash2 size={16} />
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 프로그램 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-dark">
                {editingProgram ? '프로그램 수정' : '프로그램 추가'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <Icons.X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">설명 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">일시 *</label>
                <DateTimePicker
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  placeholder="날짜와 시간을 선택하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">장소 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Icons.MapPin size={18} />
                    지도
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">정원</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">이미지 URL</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  {editingProgram ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 카카오맵 모달 */}
      {showMapModal && (
        <KakaoMapModal
          onClose={() => setShowMapModal(false)}
          onSelectLocation={handleLocationSelect}
          initialLocation={formData.locationLat && formData.locationLng ? {
            lat: formData.locationLat,
            lng: formData.locationLng,
            address: formData.location
          } : null}
        />
      )}
    </div>
  );
};
