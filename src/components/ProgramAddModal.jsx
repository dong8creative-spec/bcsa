import React, { useState, useRef } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Icons } from './Icons';
import { DateTimePicker } from '../pages/Admin/components/DateTimePicker';
import { KakaoMapModal } from '../pages/Admin/components/KakaoMapModal';
import { uploadImageForAdmin, normalizeImageItem, normalizeImagesList } from '../utils/imageUtils';
import ModalPortal from './ModalPortal';

const MAX_IMAGES = 10;
const PROGRAM_CATEGORIES = [
  { value: '네트워킹 모임', label: '네트워킹 모임' },
  { value: '교육/세미나', label: '교육/세미나' },
  { value: '커피챗', label: '커피챗' },
];
const FEE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 10000);

/**
 * 프로그램 등록 전용 모달 (운영진이 인덱스에서 admin 없이 사용)
 */
export const ProgramAddModal = ({ onClose, onSuccess }) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const programImageInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    locationLat: null,
    locationLng: null,
    capacity: '',
    category: '',
    applicationFee: '',
    imageEntries: [],
  });

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
      imageUrls,
      currentParticipants: 0,
    };
    try {
      if (firebaseService.createSeminar) {
        await firebaseService.createSeminar(payload);
        alert('프로그램이 추가되었습니다.');
        onSuccess?.();
        onClose();
      } else {
        alert('프로그램 등록 기능을 사용할 수 없습니다.');
      }
    } catch (error) {
      console.error('프로그램 저장 오류:', error);
      alert('프로그램 저장에 실패했습니다.');
    }
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
      const toUpload = files.filter((f) => f.type?.startsWith('image/'));
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
      setFormData((prev) => ({ ...prev, imageEntries: [...current, ...added] }));
    } catch (err) {
      console.error(err);
      alert(err?.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const removeProgramImage = (index) => {
    const next = (formData.imageEntries || []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, imageEntries: next }));
  };

  const handleLocationSelect = (location) => {
    const locationText = location.displayAddress || location.address;
    setFormData((prev) => ({
      ...prev,
      location: locationText,
      locationLat: location.lat,
      locationLng: location.lng,
    }));
  };

  return (
    <>
      <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center">
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h3 className="text-2xl font-bold text-dark mb-6">프로그램 등록</h3>

              <form id="program-add-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">설명 *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    required
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">일시 *</label>
                  <DateTimePicker
                    value={formData.date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, date: value }))}
                    placeholder="날짜와 시간을 선택하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">장소 *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
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
                      setFormData((prev) => ({ ...prev, applicationFee: v === 'direct' ? prev.applicationFee : v }));
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
                      onChange={(e) => setFormData((prev) => ({ ...prev, applicationFee: e.target.value }))}
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
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
                form="program-add-form"
                className="flex-1 max-w-[12rem] px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                등록
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 max-w-[12rem] px-6 py-3 border-2 border-blue-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {showMapModal && (
        <KakaoMapModal
          onClose={() => setShowMapModal(false)}
          onSelectLocation={(place) => {
            handleLocationSelect({
              displayAddress: place.displayAddress || (place.name ? `${place.name}, ${(place.address || '').trim()}`.trim() : place.address),
              address: place.address,
              lat: place.lat,
              lng: place.lng,
            });
            setShowMapModal(false);
          }}
          initialLocation={formData.locationLat != null && formData.locationLng != null ? { lat: formData.locationLat, lng: formData.locationLng } : null}
        />
      )}
    </>
  );
};

export default ProgramAddModal;
