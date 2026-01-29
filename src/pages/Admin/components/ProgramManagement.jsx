import React, { useState, useEffect, useMemo, useRef } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { DateTimePicker } from './DateTimePicker';
import { KakaoMapModal } from './KakaoMapModal';
import { uploadImageToStorage } from '../../../utils/imageUtils';
import ModalPortal from '../../../components/ModalPortal';

const MAX_IMAGES = 10;

const SORT_OPTIONS = [
  { value: 'popular', label: '인기순 (신청 많은 순)' },
  { value: 'dateDesc', label: '날짜 최신순' },
  { value: 'dateAsc', label: '날짜 오래된순' },
  { value: 'title', label: '제목 가나다순 (ㄱ~ㅎ)' },
];

/** 프로그램 날짜 문자열을 비교용 타임스탬프로 변환 */
const parseDateForSort = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  const num = trimmed.replace(/\D/g, '');
  if (num.length >= 8) {
    const y = parseInt(num.slice(0, 4), 10);
    const m = parseInt(num.slice(4, 6), 10) - 1;
    const d = parseInt(num.slice(6, 8), 10);
    const h = num.length >= 10 ? parseInt(num.slice(8, 10), 10) : 0;
    const min = num.length >= 12 ? parseInt(num.slice(10, 12), 10) : 0;
    return new Date(y, m, d, h, min).getTime();
  }
  return 0;
};

/**
 * 프로그램 관리 컴포넌트
 */
export const ProgramManagement = () => {
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
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
    imageUrls: []
  });
  const [imageUploading, setImageUploading] = useState(false);
  const programImageInputRef = useRef(null);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setIsLoading(true);
      const [programsData, applicationsData] = await Promise.all([
        firebaseService.getSeminars(),
        firebaseService.getApplications().catch(() => []),
      ]);
      setPrograms(programsData);
      setApplications(applicationsData || []);
    } catch (error) {
      console.error('프로그램 목록 로드 오류:', error);
      alert('프로그램 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /** 프로그램별 신청 수 */
  const applicationCountBySeminarId = useMemo(() => {
    const map = {};
    (applications || []).forEach((app) => {
      const sid = app.seminarId != null ? String(app.seminarId) : '';
      map[sid] = (map[sid] || 0) + 1;
    });
    return map;
  }, [applications]);

  /** 검색어로 필터 + 정렬된 목록 */
  const filteredAndSortedPrograms = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    let list = programs;
    if (q) {
      list = programs.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const location = (p.location || '').toLowerCase();
        const date = (p.date || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || category.includes(q) || location.includes(q) || date.includes(q);
      });
    }
    const countMap = applicationCountBySeminarId;
    const sorted = [...list].sort((a, b) => {
      const aId = a.id != null ? String(a.id) : '';
      const bId = b.id != null ? String(b.id) : '';
      switch (sortBy) {
        case 'popular':
          return (countMap[bId] || 0) - (countMap[aId] || 0);
        case 'dateDesc':
          return parseDateForSort(b.date) - parseDateForSort(a.date);
        case 'dateAsc':
          return parseDateForSort(a.date) - parseDateForSort(b.date);
        case 'title':
          return (a.title || '').localeCompare(b.title || '', 'ko');
        default:
          return parseDateForSort(b.date) - parseDateForSort(a.date);
      }
    });
    return sorted;
  }, [programs, searchQuery, sortBy, applicationCountBySeminarId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      imageUrl: formData.imageUrls?.[0] || '',
      images: formData.imageUrls || []
    };
    try {
      if (editingProgram) {
        await firebaseService.updateSeminar(editingProgram.id, payload);
        alert('프로그램이 수정되었습니다.');
      } else {
        await firebaseService.createSeminar(payload);
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
    const urls = Array.isArray(program.imageUrls) ? program.imageUrls : (program.imageUrl ? [program.imageUrl] : []);
    setFormData({
      title: program.title || '',
      description: program.description || '',
      date: program.date || '',
      location: program.location || '',
      locationLat: program.locationLat || null,
      locationLng: program.locationLng || null,
      capacity: program.capacity || '',
      category: program.category || '',
      imageUrls: urls
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
      imageUrls: []
    });
  };

  const handleProgramImageChange = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    const current = formData.imageUrls || [];
    if (current.length + files.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    setImageUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const url = await uploadImageToStorage(file, 'program');
        uploaded.push(url);
      }
      setFormData({ ...formData, imageUrls: [...current, ...uploaded] });
    } catch (err) {
      console.error(err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const removeProgramImage = (index) => {
    const next = (formData.imageUrls || []).filter((_, i) => i !== index);
    setFormData({ ...formData, imageUrls: next });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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

      {/* 검색 및 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Icons.Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 설명, 카테고리, 장소, 일시로 검색..."
            className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 sm:w-56">
          <label className="text-sm font-bold text-gray-700 whitespace-nowrap">정렬:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 px-3 py-2.5 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 프로그램 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedPrograms.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Icons.Calendar size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {programs.length === 0 ? '등록된 프로그램이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          </div>
        ) : (
          filteredAndSortedPrograms.map((program) => {
            const thumb = (program.imageUrls?.[0] ?? program.imageUrl);
            return (
            <div key={program.id} className="bg-white border-2 border-blue-200 rounded-2xl p-4 hover:shadow-lg transition-shadow">
              {thumb && (
                <img src={thumb} alt={program.title} className="w-full h-40 object-cover rounded-xl mb-3" />
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
            );
          })
        )}
      </div>

      {/* 프로그램 추가/수정 모달 (ESC 미적용) */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center">
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h3 className="text-2xl font-bold text-dark mb-6">
                {editingProgram ? '프로그램 수정' : '프로그램 추가'}
              </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">설명 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
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
                    className="flex-1 px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
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
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">이미지 (최대 {MAX_IMAGES}장)</label>
                <input
                  ref={programImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleProgramImageChange}
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.imageUrls || []).map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`이미지 ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border-2 border-blue-200" />
                      <button
                        type="button"
                        onClick={() => removeProgramImage(idx)}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-90 hover:opacity-100"
                        aria-label="삭제"
                      >
                        <Icons.X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={(formData.imageUrls?.length || 0) >= MAX_IMAGES || imageUploading}
                  onClick={() => programImageInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {imageUploading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Icons.Plus size={18} />
                      이미지 추가
                    </>
                  )}
                </button>
              </div>

              <button
                  type="submit"
                  className="w-full px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-6"
                >
                  {editingProgram ? '수정' : '추가'}
                </button>
            </form>
            </div>
            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                닫기
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
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
