import React, { useState, useEffect, useMemo, useRef } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { DateTimePicker } from './DateTimePicker';
import { KakaoMapModal } from './KakaoMapModal';
import { uploadImageForAdmin, normalizeImageItem, normalizeImagesList } from '../../../utils/imageUtils';
import ModalPortal from '../../../components/ModalPortal';

const MAX_IMAGES = 10;

const SORT_OPTIONS = [
  { value: 'popular', label: '인기순 (신청 많은 순)' },
  { value: 'dateDesc', label: '날짜 최신순' },
  { value: 'dateAsc', label: '날짜 오래된순' },
  { value: 'title', label: '제목 가나다순 (ㄱ~ㅎ)' },
];

const PROGRAM_CATEGORIES = [
  { value: '네트워킹 모임', label: '네트워킹 모임' },
  { value: '교육/세미나', label: '교육/세미나' },
  { value: '커피챗', label: '커피챗' },
];

/** 신청 비용 드롭다운 옵션: 1만원~10만원 (1만원 단위) */
const FEE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 10000);

const PAGE_SIZE = 6;

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
    applicationFee: '', // 신청 비용 (원, 비어 있으면 무료)
    imageEntries: [] // Array<{ firebase: string | null, imgbb: string | null }>
  });
  const [imageUploading, setImageUploading] = useState(false);
  const programImageInputRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [applicantModalProgram, setApplicantModalProgram] = useState(null);

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

  /** 현재 페이지에 표시할 프로그램 (6개) */
  const displayPrograms = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedPrograms.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedPrograms, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPrograms.length / PAGE_SIZE));

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const feeNum = formData.applicationFee === '' ? null : (parseInt(String(formData.applicationFee).replace(/[,\s]/g, ''), 10) || null);
    const capacityNum = formData.capacity ? parseInt(formData.capacity, 10) : null;
    const imageUrls = normalizeImagesList(formData.imageEntries || []);
    const firstImageUrl = imageUrls[0] || '';
    const payload = {
      title: formData.title || '',
      description: formData.description || '',
      desc: formData.description || '',
      date: formData.date || '',
      location: formData.location || '',
      locationLat: formData.locationLat ?? null,
      locationLng: formData.locationLng ?? null,
      capacity: capacityNum != null && !isNaN(capacityNum) ? capacityNum : null,
      maxParticipants: capacityNum != null && !isNaN(capacityNum) ? capacityNum : null,
      category: formData.category || '',
      applicationFee: feeNum != null && !isNaN(feeNum) && feeNum >= 0 ? feeNum : null,
      imageUrl: firstImageUrl,
      img: firstImageUrl,
      images: imageUrls,
      imageUrls
    };
    if (!editingProgram) {
      payload.currentParticipants = 0;
    } else if (editingProgram.currentParticipants != null) {
      payload.currentParticipants = editingProgram.currentParticipants;
    }
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
    const rawImages = program.images || (program.imageUrls ? program.imageUrls : (program.imageUrl ? [program.imageUrl] : []));
    const imageEntries = Array.isArray(rawImages)
      ? rawImages.map((item) =>
          typeof item === 'string'
            ? { firebase: item, imgbb: null }
            : { firebase: item?.firebase ?? null, imgbb: item?.imgbb ?? null }
        )
      : [];
    const rawCapacity = program.capacity != null && program.capacity !== ''
      ? Number(program.capacity)
      : (program.maxParticipants != null && program.maxParticipants !== '' ? Number(program.maxParticipants) : NaN);
    const capacityNorm = (() => {
      if (isNaN(rawCapacity) || rawCapacity < 10 || rawCapacity > 500) return '';
      if (rawCapacity < 100) return String(Math.min(90, Math.max(10, Math.round(rawCapacity / 10) * 10)));
      return String(Math.min(500, Math.max(100, Math.round(rawCapacity / 100) * 100)));
    })();
    setFormData({
      title: program.title || '',
      description: program.description || '',
      date: program.date || '',
      location: program.location || '',
      locationLat: program.locationLat || null,
      locationLng: program.locationLng || null,
      capacity: capacityNorm,
      category: program.category || '',
      applicationFee: program.applicationFee != null && program.applicationFee !== '' ? String(program.applicationFee) : '',
      imageEntries
    });
    setShowModal(true);
  };

  const handleAddTestPrograms = async () => {
    if (!confirm('테스트용 프로그램 2개(정원 30명, 강의료 5만원)를 추가하시겠습니까?')) return;
    try {
      const d = new Date();
      const date1 = `${d.getFullYear()}.${String(d.getMonth() + 2).padStart(2, '0')}.15 14:00`;
      const date2 = `${d.getFullYear()}.${String(d.getMonth() + 3).padStart(2, '0')}.01 10:00`;
      const baseData = (title, desc, date, category) => ({
        title,
        description: desc,
        desc: desc,
        date,
        location: '부산 해운대구 센텀시티',
        capacity: '30',
        maxParticipants: 30,
        currentParticipants: 0,
        category: category || '교육/세미나',
        applicationFee: 50000,
        imageUrls: [],
        images: [],
      });
      await firebaseService.createSeminar(baseData(
        '테스트 프로그램 1 - 비즈니스 세미나',
        '정원 30명, 강의료 5만원 테스트용 프로그램입니다. 청년 사업가들을 위한 실전 비즈니스 인사이트를 공유합니다.',
        date1
      ));
      await firebaseService.createSeminar(baseData(
        '테스트 프로그램 2 - 스타트업 네트워킹',
        '정원 30명, 강의료 5만원 테스트용 프로그램입니다. 스타트업 대표들과의 네트워킹 및 경험 공유의 장입니다.',
        date2,
        '네트워킹/모임'
      ));
      alert('테스트 프로그램 2개가 추가되었습니다.');
      loadPrograms();
    } catch (error) {
      console.error('테스트 프로그램 추가 오류:', error);
      alert('테스트 프로그램 추가에 실패했습니다.');
    }
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
      applicationFee: '',
      imageEntries: []
    });
  };

  const handleProgramImageChange = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    const current = formData.imageEntries || [];
    if (current.length + files.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    setImageUploading(true);
    try {
      const toUpload = Array.from(files).filter((f) => f.type?.startsWith('image/'));
      const uploadPromises = toUpload.map(async (file) => {
        const url = await uploadImageForAdmin(file);
        return { firebase: null, imgbb: url };
      });
      const results = await Promise.all(uploadPromises);
      const added = results.filter((r) => r?.imgbb);
      if (added.length === 0 && results.length > 0) {
        alert('이미지 업로드에 실패했습니다.');
        return;
      }
      setFormData({ ...formData, imageEntries: [...current, ...added] });
    } catch (err) {
      console.error(err);
      alert(err?.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const removeProgramImage = (index) => {
    const next = (formData.imageEntries || []).filter((_, i) => i !== index);
    setFormData({ ...formData, imageEntries: next });
  };

  const handleLocationSelect = (location) => {
    const locationText = location.displayAddress || location.address;
    setFormData({
      ...formData,
      location: locationText,
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadPrograms}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Icons.RefreshCw size={18} />
            새로고침
          </button>
          <button
            onClick={handleAddTestPrograms}
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition-colors flex items-center gap-2"
          >
            <Icons.Plus size={18} />
            테스트 프로그램 2개 추가
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
          displayPrograms.map((program) => {
            const thumb = normalizeImageItem(program.images?.[0]) || program.imageUrls?.[0] || program.imageUrl;
            return (
            <div key={program.id} className="relative bg-white border-2 border-blue-200 rounded-2xl p-4 hover:shadow-lg transition-shadow">
              <button
                type="button"
                onClick={() => handleDelete(program.id)}
                className="absolute top-3 right-3 z-10 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="프로그램 삭제"
                aria-label="삭제"
              >
                <Icons.Trash2 size={18} />
              </button>
              {thumb && (
                <img src={thumb} alt={program.title} className="w-full h-40 object-cover rounded-xl mb-3" loading="lazy" decoding="async" />
              )}
              <h3 className="font-bold text-lg text-dark mb-2 pr-8">{program.title}</h3>
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
                  onClick={() => {
                    setApplicantModalProgram(program);
                    setShowApplicantModal(true);
                  }}
                  className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Users size={16} />
                  신청자명단
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* 페이징 */}
      {filteredAndSortedPrograms.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
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
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 rounded-xl font-bold border-2 border-blue-200 text-gray-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
        </div>
      )}

      {/* 프로그램 추가/수정 모달 (ESC 미적용) */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center">
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h3 className="text-2xl font-bold text-dark mb-6">
                {editingProgram ? '프로그램 수정' : '프로그램 추가'}
              </h3>

            <form id="program-form" onSubmit={handleSubmit} className="space-y-4">
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
                <select
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">선택 (명)</option>
                  {[...Array.from({ length: 9 }, (_, i) => (i + 1) * 10), ...Array.from({ length: 5 }, (_, i) => (i + 1) * 100)].map((n) => (
                    <option key={n} value={String(n)}>{n}명</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">10~90명은 10명 단위, 100명 이상은 100명 단위 (최대 500명)</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">신청 비용 (원)</label>
                <select
                  value={formData.applicationFee === '' ? '' : FEE_OPTIONS.includes(Number(formData.applicationFee)) ? formData.applicationFee : 'direct'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, applicationFee: v === 'direct' ? formData.applicationFee : v });
                  }}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">무료</option>
                  {FEE_OPTIONS.map((n) => (
                    <option key={n} value={String(n)}>{n >= 10000 ? `${n / 10000}만` : n}원</option>
                  ))}
                  <option value="direct">직접 입력</option>
                </select>
                {(formData.applicationFee === '' ? '' : FEE_OPTIONS.includes(Number(formData.applicationFee)) ? formData.applicationFee : 'direct') === 'direct' && (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.applicationFee}
                    onChange={(e) => setFormData({ ...formData, applicationFee: e.target.value })}
                    placeholder="금액 입력 (원)"
                    className="w-full mt-2 px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">무료 또는 1만~10만원 선택, 직접 입력도 가능합니다.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">카테고리</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">선택하세요</option>
                  {PROGRAM_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
                  {(formData.imageEntries || []).map((entry, idx) => (
                    <div key={idx} className="relative group">
                      <img src={normalizeImageItem(entry)} alt={`이미지 ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border-2 border-blue-200" loading="lazy" decoding="async" />
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
                  disabled={(formData.imageEntries?.length || 0) >= MAX_IMAGES || imageUploading}
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
            </form>
            </div>
            <div className="shrink-0 border-t border-blue-200 p-4 flex gap-3 justify-end">
              <button
                type="submit"
                form="program-form"
                className="flex-1 max-w-[12rem] px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {editingProgram ? '수정' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 max-w-[12rem] px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 신청자명단 모달 */}
      {showApplicantModal && applicantModalProgram && (() => {
        const programId = String(applicantModalProgram.id);
        const list = (applications || []).filter((app) => String(app.seminarId) === programId);
        const formatDate = (v) => {
          if (!v) return '-';
          if (v.toDate && typeof v.toDate === 'function') return v.toDate().toLocaleString('ko-KR');
          if (v.seconds != null) return new Date(v.seconds * 1000).toLocaleString('ko-KR');
          return String(v);
        };
        const headers = ['번호', '이름', '이메일', '연락처', '신청일', '신청사유'];
        const toCsvRow = (arr) => arr.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',');
        const csvContent = [
          '\uFEFF' + toCsvRow(headers),
          ...list.map((app, i) => toCsvRow([
            i + 1,
            app.userName || '',
            app.userEmail || '',
            app.userPhone || '',
            formatDate(app.createdAt),
            (app.reason || '').replace(/\n/g, ' ')
          ]))
        ].join('\n');
        const tsvContent = [
          headers.join('\t'),
          ...list.map((app, i) => [
            i + 1,
            app.userName || '',
            app.userEmail || '',
            app.userPhone || '',
            formatDate(app.createdAt),
            (app.reason || '').replace(/\n/g, ' ')
          ].join('\t'))
        ].join('\n');
        const handleCsvDownload = () => {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `신청자명단_${(applicantModalProgram.title || programId).replace(/[/\\?%*:|"]/g, '_')}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          alert('CSV 파일이 다운로드되었습니다. Google 스프레드시트에서 파일 → 가져오기로 업로드할 수 있습니다.');
        };
        const handleCopyForSheets = async () => {
          try {
            await navigator.clipboard.writeText(tsvContent);
            alert('신청자명단이 클립보드에 복사되었습니다. Google 스프레드시트에서 붙여넣기(Ctrl+V) 하세요.');
          } catch (e) {
            alert('복사에 실패했습니다. 브라우저에서 클립보드 권한을 허용해 주세요.');
          }
        };
        return (
          <ModalPortal>
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-blue-200">
                  <h3 className="text-xl font-bold text-dark">
                    신청자명단: {applicantModalProgram.title || '(제목 없음)'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setShowApplicantModal(false); setApplicantModalProgram(null); }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    aria-label="닫기"
                  >
                    <Icons.X size={24} />
                  </button>
                </div>
                <div className="flex gap-2 p-4 border-b border-blue-100">
                  <button
                    type="button"
                    onClick={handleCsvDownload}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-200 transition-colors flex items-center gap-2"
                  >
                    <Icons.FileText size={18} />
                    CSV 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyForSheets}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold hover:bg-green-200 transition-colors flex items-center gap-2"
                  >
                    스프레드시트에 붙여넣기
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {list.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">신청자가 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-blue-200">
                          <th className="px-3 py-2 text-left font-bold text-gray-700">번호</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">이름</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">이메일</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">연락처</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">신청일</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-700">신청사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((app, i) => (
                          <tr key={app.id || i} className="border-b border-blue-100">
                            <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                            <td className="px-3 py-2">{app.userName || '-'}</td>
                            <td className="px-3 py-2">{app.userEmail || '-'}</td>
                            <td className="px-3 py-2">{app.userPhone || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{formatDate(app.createdAt)}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={app.reason || ''}>{app.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}

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
