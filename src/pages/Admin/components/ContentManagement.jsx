import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { authService } from '../../../services/authService';
import { defaultContent } from '../../../constants/content';
import { imageMetadata } from '../../../constants/imageMetadata';
import { Icons } from '../../../components/Icons';
import { ImageCropModal } from '../../../components/ImageCropModal';
import ModalPortal from '../../../components/ModalPortal';

/**
 * 콘텐츠 관리 컴포넌트
 */
export const ContentManagement = () => {
  const [content, setContent] = useState(defaultContent);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [currentUser, setCurrentUser] = useState(null);
  
  // 이미지 크롭 모달 상태
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [currentImageField, setCurrentImageField] = useState('');
  const [currentImageRatio, setCurrentImageRatio] = useState(16 / 9);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  useEffect(() => {
    loadContent();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
    }
  };

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const contentData = await firebaseService.getContent();
      // Firestore에서 가져온 데이터와 defaultContent 병합
      setContent({ ...defaultContent, ...contentData });
    } catch (error) {
      console.error('콘텐츠 로드 오류:', error);
      alert('콘텐츠를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!confirm('변경사항을 저장하시겠습니까?')) return;

    try {
      setIsSaving(true);
      await firebaseService.updateContent(content, currentUser?.uid);
      alert('콘텐츠가 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('콘텐츠 저장 오류:', error);
      alert('콘텐츠 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (field, ratio = 16 / 9) => {
    setCurrentImageField(field);
    setCurrentImageRatio(ratio);
    setCurrentImageUrl(content[field] || ''); // 기존 이미지 URL 저장
    setIsCropModalOpen(true);
  };

  const handleImageCropped = (imageUrl) => {
    setContent(prev => ({
      ...prev,
      [currentImageField]: imageUrl
    }));
  };

  const handleInputChange = (field, value) => {
    setContent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const sections = [
    { id: 'images', label: '이미지 관리', icon: Icons.Image },
    { id: 'hero', label: 'Hero 섹션', icon: Icons.Star },
    { id: 'stats', label: '통계 섹션', icon: Icons.TrendingUp },
    { id: 'features', label: 'Features 섹션', icon: Icons.CheckCircle },
    { id: 'activities', label: '활동 섹션', icon: Icons.Calendar },
    { id: 'donation', label: '후원 섹션', icon: Icons.DollarSign },
    { id: 'about', label: '소개 페이지', icon: Icons.Info }
  ];

  const renderHeroSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">메인 Hero 섹션</h3>
      
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
        <textarea
          value={content.hero_title || ''}
          onChange={(e) => handleInputChange('hero_title', e.target.value)}
          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          rows={3}
          placeholder="메인 제목을 입력하세요"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
        <textarea
          value={content.hero_desc || ''}
          onChange={(e) => handleInputChange('hero_desc', e.target.value)}
          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          rows={3}
          placeholder="설명을 입력하세요"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">배경 이미지 (16:9)</label>
        <div className="flex items-center gap-4">
          {content.hero_bg && (
            <img src={content.hero_bg} alt="Hero Background" className="w-32 h-18 object-cover rounded-xl" />
          )}
          <button
            onClick={() => handleImageUpload('hero_bg', 16 / 9)}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.Camera size={18} />
            {content.hero_bg ? '변경' : '업로드'}
          </button>
          {content.hero_bg && (
            <button
              onClick={() => handleInputChange('hero_bg', '')}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">메인 이미지 (16:9)</label>
        <div className="flex items-center gap-4">
          {content.hero_image && (
            <img src={content.hero_image} alt="Hero Image" className="w-32 h-18 object-cover rounded-xl" />
          )}
          <button
            onClick={() => handleImageUpload('hero_image', 16 / 9)}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.Camera size={18} />
            {content.hero_image ? '변경' : '업로드'}
          </button>
          {content.hero_image && (
            <button
              onClick={() => handleInputChange('hero_image', '')}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderStatsSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">통계 섹션</h3>
      
      {[1, 2, 3, 4].map((num) => (
        <div key={num} className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">통계 {num} - 값</label>
            <input
              type="text"
              value={content[`stat_${num}_val`] || ''}
              onChange={(e) => handleInputChange(`stat_${num}_val`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
              placeholder="예: 200+"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">통계 {num} - 설명</label>
            <input
              type="text"
              value={content[`stat_${num}_desc`] || ''}
              onChange={(e) => handleInputChange(`stat_${num}_desc`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
              placeholder="예: 활동중인 사업가"
            />
          </div>
        </div>
      ))}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">배경 이미지 (16:9)</label>
        <div className="flex items-center gap-4">
          {content.stat_bg && (
            <img src={content.stat_bg} alt="Stats Background" className="w-32 h-18 object-cover rounded-xl" />
          )}
          <button
            onClick={() => handleImageUpload('stat_bg', 16 / 9)}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.Camera size={18} />
            {content.stat_bg ? '변경' : '업로드'}
          </button>
          {content.stat_bg && (
            <button
              onClick={() => handleInputChange('stat_bg', '')}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderFeaturesSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">Features 섹션</h3>
      
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">섹션 제목</label>
        <input
          type="text"
          value={content.features_title || ''}
          onChange={(e) => handleInputChange('features_title', e.target.value)}
          className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
      </div>

      {['network', 'expert', 'success'].map((type) => (
        <div key={type} className="p-4 bg-gray-50 rounded-xl space-y-3">
          <h4 className="font-bold text-gray-800 capitalize">{type}</h4>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
            <input
              type="text"
              value={content[`features_${type}_title`] || ''}
              onChange={(e) => handleInputChange(`features_${type}_title`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
            <textarea
              value={content[`features_${type}_desc`] || ''}
              onChange={(e) => handleInputChange(`features_${type}_desc`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
              rows={2}
            />
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((num) => (
          <div key={num}>
            <label className="block text-sm font-bold text-gray-700 mb-2">이미지 {num} (1:1)</label>
            <div className="flex flex-col gap-2">
              {content[`features_image_${num}`] && (
                <img src={content[`features_image_${num}`]} alt={`Feature ${num}`} className="w-full h-32 object-cover rounded-xl" />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleImageUpload(`features_image_${num}`, 1)}
                  className="flex-1 px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm"
                >
                  {content[`features_image_${num}`] ? '변경' : '업로드'}
                </button>
                {content[`features_image_${num}`] && (
                  <button
                    onClick={() => handleInputChange(`features_image_${num}`, '')}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActivitiesSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">활동 섹션</h3>
      
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">섹션 제목</label>
        <input
          type="text"
          value={content.activities_title || ''}
          onChange={(e) => handleInputChange('activities_title', e.target.value)}
          className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">서브타이틀</label>
        <input
          type="text"
          value={content.activities_subtitle || ''}
          onChange={(e) => handleInputChange('activities_subtitle', e.target.value)}
          className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
      </div>

      {['seminar', 'investment', 'networking'].map((type) => (
        <div key={type} className="p-4 bg-gray-50 rounded-xl space-y-3">
          <h4 className="font-bold text-gray-800 capitalize">{type}</h4>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
            <input
              type="text"
              value={content[`activity_${type}_title`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_title`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
            <textarea
              value={content[`activity_${type}_desc`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_desc`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">일정</label>
            <input
              type="text"
              value={content[`activity_${type}_schedule`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_schedule`, e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">이미지 (4:3)</label>
            <div className="flex items-center gap-4">
              {content[`activity_${type}_image`] && (
                <div 
                  onClick={() => setPreviewImageUrl(content[`activity_${type}_image`])} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img src={content[`activity_${type}_image`]} alt={type} className="w-32 h-24 object-cover rounded-xl border-2 border-blue-200" />
                </div>
              )}
              <button
                onClick={() => handleImageUpload(`activity_${type}_image`, 4 / 3)}
                className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm"
              >
                {content[`activity_${type}_image`] ? '변경' : '업로드'}
              </button>
              {content[`activity_${type}_image`] && (
                <button
                  onClick={() => handleInputChange(`activity_${type}_image`, '')}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDonationSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">후원 섹션</h3>
      
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
        <input
          type="text"
          value={content.donation_title || ''}
          onChange={(e) => handleInputChange('donation_title', e.target.value)}
          className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
        <textarea
          value={content.donation_desc || ''}
          onChange={(e) => handleInputChange('donation_desc', e.target.value)}
          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">버튼 텍스트</label>
        <input
          type="text"
          value={content.donation_button || ''}
          onChange={(e) => handleInputChange('donation_button', e.target.value)}
          className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">이미지 (4:3)</label>
        <div className="flex items-center gap-4">
          {content.donation_image && (
            <img src={content.donation_image} alt="Donation" className="w-32 h-24 object-cover rounded-xl" />
          )}
          <button
            onClick={() => handleImageUpload('donation_image', 4 / 3)}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.Camera size={18} />
            {content.donation_image ? '변경' : '업로드'}
          </button>
          {content.donation_image && (
            <button
              onClick={() => handleInputChange('donation_image', '')}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderImagesSection = () => {
    // 페이지별로 그룹화
    const mainPageImages = imageMetadata.filter(img => img.page === '메인페이지');
    const aboutPageImages = imageMetadata.filter(img => img.page === '소개페이지');

    const renderImageItem = (imageMeta) => {
      const imageUrl = content[imageMeta.field] || '';
      const ratioLabel = imageMeta.aspectRatio === 16 / 9 ? '16:9' : 
                        imageMeta.aspectRatio === 4 / 3 ? '4:3' : 
                        imageMeta.aspectRatio === 1 ? '1:1' : 'Free';

      return (
        <div key={imageMeta.id} className="bg-white border-2 border-blue-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 이미지 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-lg font-bold text-dark">{imageMeta.name}</h4>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                  {ratioLabel}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{imageMeta.description}</p>
              <p className="text-xs text-gray-500">
                {imageMeta.page} · {imageMeta.section}
              </p>
            </div>
            
            {/* 이미지 미리보기 및 관리 */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              {imageUrl ? (
                <div 
                  onClick={() => setPreviewImageUrl(imageUrl)} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div 
                    className="border-2 border-blue-200 rounded-xl overflow-hidden bg-gray-100"
                    style={{ 
                      width: '120px', 
                      aspectRatio: imageMeta.aspectRatio || '16/9' 
                    }}
                  >
                    <img 
                      src={imageUrl} 
                      alt={imageMeta.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center bg-gray-50"
                  style={{ 
                    width: '120px', 
                    aspectRatio: imageMeta.aspectRatio || '16/9' 
                  }}
                >
                  <Icons.Image size={24} className="text-gray-400" />
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleImageUpload(imageMeta.field, imageMeta.aspectRatio)}
                  className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 whitespace-nowrap"
                >
                  <Icons.Camera size={16} />
                  {imageUrl ? '변경' : '업로드'}
                </button>
                {imageUrl && (
                  <button
                    onClick={() => handleInputChange(imageMeta.field, '')}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <Icons.Trash2 size={16} />
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-dark mb-2">이미지 관리</h3>
          <p className="text-sm text-gray-600">
            메인페이지와 소개페이지에 사용되는 모든 이미지를 한 곳에서 관리할 수 있습니다.
            각 이미지는 표시되는 비율에 맞춰 크롭됩니다.
          </p>
        </div>

        {/* 메인페이지 이미지 */}
        <div>
          <h4 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
            <Icons.Home size={20} />
            메인페이지 이미지
          </h4>
          <div className="space-y-3">
            {mainPageImages.map(renderImageItem)}
          </div>
        </div>

        {/* 소개페이지 이미지 */}
        <div>
          <h4 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
            <Icons.Info size={20} />
            소개페이지 이미지
          </h4>
          <div className="space-y-3">
            {aboutPageImages.map(renderImageItem)}
          </div>
        </div>
      </div>
    );
  };

  const renderAboutSection = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-dark mb-4">소개 페이지</h3>
      
      <div className="p-4 bg-blue-50 rounded-xl">
        <h4 className="font-bold text-gray-800 mb-3">Hero 섹션</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
            <input
              type="text"
              value={content.about_hero_title || ''}
              onChange={(e) => handleInputChange('about_hero_title', e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
            <textarea
              value={content.about_hero_desc || ''}
              onChange={(e) => handleInputChange('about_hero_desc', e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">히어로 이미지 (16:9)</label>
            <div className="flex items-center gap-4">
              {content.about_hero_image && (
                <div 
                  onClick={() => setPreviewImageUrl(content.about_hero_image)} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img 
                    src={content.about_hero_image} 
                    alt="About Hero" 
                    className="w-48 h-27 object-cover rounded-xl border-2 border-blue-200" 
                  />
                </div>
              )}
              <button
                onClick={() => handleImageUpload('about_hero_image', 16 / 9)}
                className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Icons.Camera size={18} />
                {content.about_hero_image ? '변경' : '업로드'}
              </button>
              {content.about_hero_image && (
                <button
                  onClick={() => handleInputChange('about_hero_image', '')}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-green-50 rounded-xl">
        <h4 className="font-bold text-gray-800 mb-3">Mission 섹션</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
            <input
              type="text"
              value={content.about_mission_title || ''}
              onChange={(e) => handleInputChange('about_mission_title', e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          {[1, 2, 3].map((num) => (
            <div key={num}>
              <label className="block text-sm font-bold text-gray-700 mb-2">설명 {num}</label>
              <textarea
                value={content[`about_mission_desc_${num}`] || ''}
                onChange={(e) => handleInputChange(`about_mission_desc_${num}`, e.target.value)}
                className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-yellow-50 rounded-xl">
        <h4 className="font-bold text-gray-800 mb-3">Why Us 섹션</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">섹션 제목</label>
            <input
              type="text"
              value={content.about_why_title || ''}
              onChange={(e) => handleInputChange('about_why_title', e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">서브타이틀</label>
            <input
              type="text"
              value={content.about_why_subtitle || ''}
              onChange={(e) => handleInputChange('about_why_subtitle', e.target.value)}
              className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
            />
          </div>
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">항목 {num} - 제목</label>
                <input
                  type="text"
                  value={content[`about_why_${num}_title`] || ''}
                  onChange={(e) => handleInputChange(`about_why_${num}_title`, e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">항목 {num} - 설명</label>
                <input
                  type="text"
                  value={content[`about_why_${num}_desc`] || ''}
                  onChange={(e) => handleInputChange(`about_why_${num}_desc`, e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'images':
        return renderImagesSection();
      case 'hero':
        return renderHeroSection();
      case 'stats':
        return renderStatsSection();
      case 'features':
        return renderFeaturesSection();
      case 'activities':
        return renderActivitiesSection();
      case 'donation':
        return renderDonationSection();
      case 'about':
        return renderAboutSection();
      default:
        return renderImagesSection();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-gray-600">콘텐츠 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dark flex items-center gap-3">
          <Icons.FileText size={28} />
          콘텐츠 관리
        </h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              저장 중...
            </>
          ) : (
            <>
              <Icons.CheckCircle size={20} />
              저장
            </>
          )}
        </button>
      </div>

      {/* 섹션 탭 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={18} />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* 섹션 콘텐츠 */}
      <div className="bg-white rounded-2xl border-2 border-blue-200 p-6">
        {renderSection()}
      </div>

      {/* 이미지 크롭 모달 */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false);
          setCurrentImageUrl(''); // 모달 닫을 때 초기화
        }}
        onImageCropped={handleImageCropped}
        aspectRatio={currentImageRatio}
        title="이미지 업로드 및 크롭"
        initialImage={currentImageUrl || null}
        fixedRatio={true}
      />

      {/* 이미지 미리보기 모달 */}
      {previewImageUrl && (
        <ModalPortal>
        <div 
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[100dvh] md:max-h-[90vh] max-md:scale-[0.8] origin-center">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center z-10 transition-colors"
            >
              <Icons.X size={24} className="text-gray-700" />
            </button>
            <img 
              src={previewImageUrl} 
              alt="미리보기" 
              className="w-full h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
