import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { authService } from '../../../services/authService';
import { defaultContent } from '../../../constants/content';
import { buildSiteContent, mergeLiveContent } from '../../../utils/siteContent';
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
      // 사이트와 같은 순서로 병합: 코드 기본값 → 배포본 → 관리자 저장값
      setContent(mergeLiveContent(buildSiteContent(), contentData));
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
      await firebaseService.updateContent({ ...content, liveSync: true }, currentUser?.uid);
      alert('저장했어요. 사이트에 바로 반영돼요.');
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
    { id: 'images', label: '사이트 이미지', icon: Icons.Image },
    { id: 'hero', label: '메인 상단 배너', icon: Icons.Star },
    { id: 'stats', label: '숫자 통계', icon: Icons.TrendingUp },
    { id: 'features', label: '소개 카드', icon: Icons.CheckCircle },
    { id: 'activities', label: '활동 소개', icon: Icons.Calendar },
    { id: 'donation', label: '후원 안내', icon: Icons.DollarSign },
    { id: 'about', label: '단체 소개', icon: Icons.Info },
    { id: 'footer', label: '푸터', icon: Icons.FileText }
  ];

  const renderHeroSection = () => (
    <div className="space-y-6">
      <h3 className="mb-4 text-[20px] font-bold text-ink">메인 상단 배너</h3>
      
      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
        <textarea
          value={content.hero_title || ''}
          onChange={(e) => handleInputChange('hero_title', e.target.value)}
          className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
          rows={3}
          placeholder="메인 제목을 입력하세요"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">설명</label>
        <textarea
          value={content.hero_desc || ''}
          onChange={(e) => handleInputChange('hero_desc', e.target.value)}
          className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
          rows={3}
          placeholder="설명을 입력하세요"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">배경 이미지 (16:9)</label>
        <div className="flex flex-wrap items-center gap-3">
          {content.hero_bg && (
            <img src={content.hero_bg} alt="Hero Background" className="w-32 h-18 object-cover border border-line" loading="lazy" decoding="async" />
          )}
          <button
            type="button"
            onClick={() => handleImageUpload('hero_bg', 16 / 9)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
          >
            <Icons.Camera size={18} />
            {content.hero_bg ? '변경' : '업로드'}
          </button>
          {content.hero_bg && (
            <button
              type="button"
              onClick={() => handleInputChange('hero_bg', '')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">메인 이미지 (16:9)</label>
        <div className="flex flex-wrap items-center gap-3">
          {content.hero_image && (
            <img src={content.hero_image} alt="Hero Image" className="w-32 h-18 object-cover border border-line" loading="lazy" decoding="async" />
          )}
          <button
            type="button"
            onClick={() => handleImageUpload('hero_image', 16 / 9)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
          >
            <Icons.Camera size={18} />
            {content.hero_image ? '변경' : '업로드'}
          </button>
          {content.hero_image && (
            <button
              type="button"
              onClick={() => handleInputChange('hero_image', '')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
      <h3 className="mb-4 text-[20px] font-bold text-ink">숫자 통계</h3>
      
      {[1, 2, 3, 4].map((num) => (
        <div key={num} className="grid grid-cols-1 gap-4 rounded-xl bg-card p-4 sm:grid-cols-2">
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">통계 {num} - 값</label>
            <input
              type="text"
              value={content[`stat_${num}_val`] || ''}
              onChange={(e) => handleInputChange(`stat_${num}_val`, e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 200+"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">통계 {num} - 설명</label>
            <input
              type="text"
              value={content[`stat_${num}_desc`] || ''}
              onChange={(e) => handleInputChange(`stat_${num}_desc`, e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 활동중인 사업가"
            />
          </div>
        </div>
      ))}

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">배경 이미지 (16:9)</label>
        <div className="flex flex-wrap items-center gap-3">
          {content.stat_bg && (
            <img src={content.stat_bg} alt="Stats Background" className="w-32 h-18 object-cover border border-line" loading="lazy" decoding="async" />
          )}
          <button
            type="button"
            onClick={() => handleImageUpload('stat_bg', 16 / 9)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
          >
            <Icons.Camera size={18} />
            {content.stat_bg ? '변경' : '업로드'}
          </button>
          {content.stat_bg && (
            <button
              type="button"
              onClick={() => handleInputChange('stat_bg', '')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
      <h3 className="mb-4 text-[20px] font-bold text-ink">소개 카드</h3>
      
      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">섹션 제목</label>
        <input
          type="text"
          value={content.features_title || ''}
          onChange={(e) => handleInputChange('features_title', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
      </div>

      {['network', 'expert', 'success'].map((type) => (
        <div key={type} className="space-y-3 rounded-xl bg-card p-4">
          <h4 className="text-[16px] font-semibold text-ink capitalize">{type}</h4>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
            <input
              type="text"
              value={content[`features_${type}_title`] || ''}
              onChange={(e) => handleInputChange(`features_${type}_title`, e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">설명</label>
            <textarea
              value={content[`features_${type}_desc`] || ''}
              onChange={(e) => handleInputChange(`features_${type}_desc`, e.target.value)}
              className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
              rows={2}
            />
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2].map((num) => (
          <div key={num}>
            <label className="block text-[15px] font-semibold text-ink mb-2">이미지 {num} (1:1)</label>
            <div className="flex flex-col gap-2">
              {content[`features_image_${num}`] && (
                <img src={content[`features_image_${num}`]} alt={`Feature ${num}`} className="w-full h-32 object-cover border border-line" loading="lazy" decoding="async" />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleImageUpload(`features_image_${num}`, 1)}
                  className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
                >
                  {content[`features_image_${num}`] ? '변경' : '업로드'}
                </button>
                {content[`features_image_${num}`] && (
                  <button
                    type="button"
                    onClick={() => handleInputChange(`features_image_${num}`, '')}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
      <h3 className="mb-4 text-[20px] font-bold text-ink">활동 소개</h3>
      
      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">섹션 제목</label>
        <input
          type="text"
          value={content.activities_title || ''}
          onChange={(e) => handleInputChange('activities_title', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">서브타이틀</label>
        <input
          type="text"
          value={content.activities_subtitle || ''}
          onChange={(e) => handleInputChange('activities_subtitle', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
      </div>

      {['seminar', 'investment', 'networking'].map((type) => (
        <div key={type} className="space-y-3 rounded-xl bg-card p-4">
          <h4 className="text-[16px] font-semibold text-ink capitalize">{type}</h4>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
            <input
              type="text"
              value={content[`activity_${type}_title`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_title`, e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">설명</label>
            <textarea
              value={content[`activity_${type}_desc`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_desc`, e.target.value)}
              className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">일정</label>
            <input
              type="text"
              value={content[`activity_${type}_schedule`] || ''}
              onChange={(e) => handleInputChange(`activity_${type}_schedule`, e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">이미지 (4:3)</label>
            <div className="flex flex-wrap items-center gap-3">
              {content[`activity_${type}_image`] && (
                <div 
                  onClick={() => setPreviewImageUrl(content[`activity_${type}_image`])} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img src={content[`activity_${type}_image`]} alt={type} className="w-32 h-24 object-cover border border-line" loading="lazy" decoding="async" />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleImageUpload(`activity_${type}_image`, 4 / 3)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
              >
                {content[`activity_${type}_image`] ? '변경' : '업로드'}
              </button>
              {content[`activity_${type}_image`] && (
                <button
                  type="button"
                  onClick={() => handleInputChange(`activity_${type}_image`, '')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
      <h3 className="mb-4 text-[20px] font-bold text-ink">후원 안내</h3>
      
      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
        <input
          type="text"
          value={content.donation_title || ''}
          onChange={(e) => handleInputChange('donation_title', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">설명</label>
        <textarea
          value={content.donation_desc || ''}
          onChange={(e) => handleInputChange('donation_desc', e.target.value)}
          className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">버튼 텍스트</label>
        <input
          type="text"
          value={content.donation_button || ''}
          onChange={(e) => handleInputChange('donation_button', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">이미지 (4:3)</label>
        <div className="flex flex-wrap items-center gap-3">
          {content.donation_image && (
            <img src={content.donation_image} alt="Donation" className="w-32 h-24 object-cover border border-line" loading="lazy" decoding="async" />
          )}
          <button
            type="button"
            onClick={() => handleImageUpload('donation_image', 4 / 3)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
          >
            <Icons.Camera size={18} />
            {content.donation_image ? '변경' : '업로드'}
          </button>
          {content.donation_image && (
            <button
              type="button"
              onClick={() => handleInputChange('donation_image', '')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
        <div key={imageMeta.id} className="border border-line bg-white p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 이미지 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[16px] font-semibold text-ink">{imageMeta.name}</h4>
                <span className="inline-flex h-7 items-center rounded-none bg-sky px-2 text-[13px] font-semibold text-royal">
                  {ratioLabel}
                </span>
              </div>
              <p className="mb-2 text-[15px] text-sub">{imageMeta.description}</p>
              <p className="text-[13px] text-sub">
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
                    className="overflow-hidden border border-line bg-card"
                    style={{ 
                      width: '120px', 
                      aspectRatio: imageMeta.aspectRatio || '16/9' 
                    }}
                  >
                    <img 
                      src={imageUrl} 
                      alt={imageMeta.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              ) : (
                <div 
                  className="flex items-center justify-center border border-dashed border-line2 bg-card"
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
                  type="button"
                  onClick={() => handleImageUpload(imageMeta.field, imageMeta.aspectRatio)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
                >
                  <Icons.Camera size={16} />
                  {imageUrl ? '변경' : '업로드'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => handleInputChange(imageMeta.field, '')}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
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
          <h3 className="mb-2 text-[20px] font-bold text-ink">사이트 이미지</h3>
          <p className="text-[15px] text-sub">
            메인페이지와 소개페이지에 사용되는 모든 이미지를 한 곳에서 관리할 수 있습니다.
            각 이미지는 표시되는 비율에 맞춰 크롭됩니다.
          </p>
        </div>

        {/* 메인페이지 이미지 */}
        <div>
          <h4 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-ink">
            <Icons.Home size={20} />
            메인페이지 이미지
          </h4>
          <div className="space-y-3">
            {mainPageImages.map(renderImageItem)}
          </div>
        </div>

        {/* 소개페이지 이미지 */}
        <div>
          <h4 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-ink">
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
      <h3 className="mb-4 text-[20px] font-bold text-ink">단체 소개</h3>
      
      <div className="rounded-xl bg-card p-4">
        <h4 className="mb-3 text-[16px] font-semibold text-ink">상단 배너</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
            <input
              type="text"
              value={content.about_hero_title || ''}
              onChange={(e) => handleInputChange('about_hero_title', e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">설명</label>
            <textarea
              value={content.about_hero_desc || ''}
              onChange={(e) => handleInputChange('about_hero_desc', e.target.value)}
              className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">히어로 이미지 (16:9)</label>
            <div className="flex flex-wrap items-center gap-3">
              {content.about_hero_image && (
                <div 
                  onClick={() => setPreviewImageUrl(content.about_hero_image)} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img 
                    src={content.about_hero_image} 
                    alt="About Hero" 
                    className="w-48 h-27 object-cover border border-line" 
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleImageUpload('about_hero_image', 16 / 9)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink whitespace-nowrap"
              >
                <Icons.Camera size={18} />
                {content.about_hero_image ? '변경' : '업로드'}
              </button>
              {content.about_hero_image && (
                <button
                  type="button"
                  onClick={() => handleInputChange('about_hero_image', '')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card p-4">
        <h4 className="mb-3 text-[16px] font-semibold text-ink">Mission 섹션</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">제목</label>
            <input
              type="text"
              value={content.about_mission_title || ''}
              onChange={(e) => handleInputChange('about_mission_title', e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          {[1, 2, 3].map((num) => (
            <div key={num}>
              <label className="block text-[15px] font-semibold text-ink mb-2">설명 {num}</label>
              <textarea
                value={content[`about_mission_desc_${num}`] || ''}
                onChange={(e) => handleInputChange(`about_mission_desc_${num}`, e.target.value)}
                className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-card p-4">
        <h4 className="mb-3 text-[16px] font-semibold text-ink">Why Us 섹션</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">섹션 제목</label>
            <input
              type="text"
              value={content.about_why_title || ''}
              onChange={(e) => handleInputChange('about_why_title', e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[15px] font-semibold text-ink mb-2">서브타이틀</label>
            <input
              type="text"
              value={content.about_why_subtitle || ''}
              onChange={(e) => handleInputChange('about_why_subtitle', e.target.value)}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">항목 {num} - 제목</label>
                <input
                  type="text"
                  value={content[`about_why_${num}_title`] || ''}
                  onChange={(e) => handleInputChange(`about_why_${num}_title`, e.target.value)}
                  className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">항목 {num} - 설명</label>
                <input
                  type="text"
                  value={content[`about_why_${num}_desc`] || ''}
                  onChange={(e) => handleInputChange(`about_why_${num}_desc`, e.target.value)}
                  className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFooterSection = () => (
    <div className="space-y-6">
      <h3 className="mb-4 text-[20px] font-bold text-ink">푸터 텍스트</h3>
      <p className="mb-6 text-[15px] text-sub">사이트 하단 푸터에 표시되는 문구를 수정할 수 있습니다.</p>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">푸터 제목 (1줄)</label>
        <input
          type="text"
          value={content.footer_title || ''}
          onChange={(e) => handleInputChange('footer_title', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          placeholder="예: 먼저가본"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">주소 · 대표 · 사업자등록번호 (2줄, | 로 구분)</label>
        <input
          type="text"
          value={content.footer_line2 || ''}
          onChange={(e) => handleInputChange('footer_line2', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          placeholder="예: 부산광역시 연제구 ... | 대표 정은지 | 사업자등록번호 792-72-00616"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[15px] font-semibold text-ink mb-2">대표번호</label>
          <input
            type="text"
            value={content.footer_phone || ''}
            onChange={(e) => handleInputChange('footer_phone', e.target.value)}
            className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            placeholder="예: 070-8064-7238"
          />
        </div>
        <div>
          <label className="block text-[15px] font-semibold text-ink mb-2">운영시간 문구</label>
          <input
            type="text"
            value={content.footer_hours || ''}
            onChange={(e) => handleInputChange('footer_hours', e.target.value)}
            className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            placeholder="예: 평일 09:00–18:00 / 주말·공휴일 휴무"
          />
        </div>
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">대표 메일</label>
        <input
          type="email"
          value={content.footer_email || ''}
          onChange={(e) => handleInputChange('footer_email', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          placeholder="예: pujar@naver.com"
        />
      </div>

      <div>
        <label className="block text-[15px] font-semibold text-ink mb-2">저작권 문구</label>
        <input
          type="text"
          value={content.footer_copyright || ''}
          onChange={(e) => handleInputChange('footer_copyright', e.target.value)}
          className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          placeholder="예: © 2025 먼저가본. All rights reserved."
        />
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
      case 'footer':
        return renderFooterSection();
      default:
        return renderImagesSection();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-[15px] text-sub">콘텐츠 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold text-ink md:text-[24px]">
          <Icons.FileText size={24} />
          콘텐츠 관리
        </h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0c0c0e] px-5 text-[15px] font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="mb-6 flex overflow-x-auto border border-[#0c0c0e]" role="tablist" aria-label="페이지 구역">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-r border-line px-4 text-[15px] font-semibold last:border-r-0 ${
                activeSection === section.id
                  ? 'bg-[#0c0c0e] text-white'
                  : 'bg-white text-[#555] hover:text-ink'
              }`}
            >
              <Icon size={18} />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* 섹션 콘텐츠 */}
      <div className="border border-line bg-white p-4 md:p-6">
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
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[100dvh] md:max-h-[90vh] max-md:scale-[0.8] origin-center">
            <button
              type="button"
              aria-label="미리보기 닫기"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 transition-colors hover:bg-white"
            >
              <Icons.X size={24} className="text-gray-700" />
            </button>
            <img 
              src={previewImageUrl} 
              alt="미리보기" 
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
