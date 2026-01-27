import React, { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Icons } from './Icons';
import { uploadImageToImgBB, fileToBase64, resizeImage } from '../utils/imageUtils';

/**
 * 이미지 크롭 모달 컴포넌트
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 열림 상태
 * @param {Function} props.onClose - 모달 닫기 콜백
 * @param {Function} props.onImageCropped - 크롭된 이미지 URL 콜백
 * @param {number} props.aspectRatio - 크롭 비율 (16/9, 4/3, 1, null)
 * @param {string} props.title - 모달 제목
 * @param {string} props.initialImage - 기존 이미지 URL (선택적)
 */
export const ImageCropModal = ({ 
  isOpen, 
  onClose, 
  onImageCropped, 
  aspectRatio = 16 / 9,
  title = '이미지 업로드 및 크롭',
  initialImage = null
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState(aspectRatio);
  const [previewImage, setPreviewImage] = useState(null);
  const timeoutRef = useRef(null);

  const ratioOptions = [
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
    { label: '1:1', value: 1 },
    { label: 'Free', value: null }
  ];

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 기존 이미지 로드 (initialImage가 제공될 때)
  useEffect(() => {
    if (isOpen && initialImage) {
      // 모달이 열릴 때마다 기존 이미지를 로드
      const loadInitialImage = async () => {
        try {
          const response = await fetch(initialImage, {
            mode: 'cors',
            credentials: 'omit'
          });
          if (!response.ok) {
            throw new Error('이미지를 불러올 수 없습니다.');
          }
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setImageSrc(reader.result);
          };
          reader.onerror = () => {
            console.error('이미지 변환 오류');
            // 에러가 발생해도 새 이미지를 선택할 수 있도록 경고만 표시
            console.warn('기존 이미지를 불러오는 데 실패했습니다.');
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('기존 이미지 로드 오류:', error);
          // CORS 오류 등으로 실패해도 새 이미지를 선택할 수 있도록 경고만 표시
          console.warn('기존 이미지를 불러올 수 없습니다. 새 이미지를 선택해주세요.');
        }
      };
      loadInitialImage();
    } else if (isOpen && !initialImage) {
      // initialImage가 없으면 imageSrc 초기화 (새 이미지 업로드 모드)
      setImageSrc(null);
    }
  }, [isOpen, initialImage]);

  // 실시간 미리보기 생성
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels) {
      setPreviewImage(null);
      return;
    }

    // 디바운싱으로 성능 최적화
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const preview = await createCroppedImage();
        setPreviewImage(preview);
      } catch (error) {
        console.error('미리보기 생성 오류:', error);
        setPreviewImage(null);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [imageSrc, croppedAreaPixels, crop, zoom]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setImageSrc(base64);
      setPreviewImage(null);
    } catch (error) {
      console.error('파일 읽기 오류:', error);
      alert('이미지를 불러오는 데 실패했습니다.');
    }
  };

  const handleFileButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = document.getElementById('image-upload');
    if (input) {
      input.click();
    }
  };

  const createCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return null;

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              resolve(reader.result);
            };
          },
          'image/jpeg',
          0.95
        );
      };
      image.onerror = reject;
    });
  };

  const handleCropConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      alert('이미지를 선택하고 크롭 영역을 설정해주세요.');
      return;
    }

    try {
      setIsUploading(true);

      // 크롭된 이미지 생성
      const croppedImageBase64 = await createCroppedImage();

      // 이미지 리사이징 (최대 1920px)
      const resizedImage = await resizeImage(croppedImageBase64, 1920);

      // ImgBB에 업로드
      const result = await uploadImageToImgBB(resizedImage, `cropped_${Date.now()}.jpg`);

      if (result.success && result.url) {
        onImageCropped(result.url);
        handleClose();
      } else {
        throw new Error('이미지 업로드 실패');
      }
    } catch (error) {
      console.error('이미지 처리 오류:', error);
      alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsUploading(false);
    setPreviewImage(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-dark">{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            disabled={isUploading}
          >
            <Icons.X size={24} />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {!imageSrc ? (
            // 파일 선택 UI
            <div className="text-center py-12">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="inline-flex flex-col items-center gap-4 cursor-pointer"
              >
                <div className="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center">
                  <Icons.Camera size={48} className="text-brand" />
                </div>
                <div>
                  <p className="text-lg font-bold text-dark mb-2">이미지를 선택하세요</p>
                  <p className="text-sm text-gray-500">클릭하여 파일을 선택하거나 드래그 앤 드롭</p>
                </div>
              </label>
              <button
                type="button"
                onClick={handleFileButtonClick}
                className="px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-4"
              >
                파일 선택
              </button>
            </div>
          ) : (
            // 크롭 UI - 2열 레이아웃
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: 크롭 영역 */}
              <div>
                {/* 비율 선택 */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    크롭 비율
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {ratioOptions.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => setSelectedRatio(option.value)}
                        className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                          selectedRatio === option.value
                            ? 'bg-brand text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 크롭 영역 */}
                <div className="relative w-full h-96 bg-gray-900 rounded-2xl overflow-hidden mb-4">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={selectedRatio || undefined}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>

                {/* 줌 컨트롤 */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    확대/축소
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* 오른쪽: 실시간 미리보기 */}
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    실시간 미리보기
                  </label>
                  <div className="relative w-full h-96 bg-gray-100 rounded-2xl overflow-hidden border-2 border-gray-200 flex items-center justify-center">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="크롭 미리보기"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <Icons.Camera size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">크롭 영역을 조정하면</p>
                        <p className="text-sm">미리보기가 표시됩니다</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setImageSrc(null)}
                    className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                    disabled={isUploading}
                  >
                    다시 선택
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    disabled={isUploading || !previewImage}
                    className="flex-1 px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        업로드 중...
                      </>
                    ) : (
                      '확인'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
