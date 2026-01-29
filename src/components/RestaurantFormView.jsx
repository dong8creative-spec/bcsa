import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { resizeImage, uploadImageToImgBB } from '../utils/imageUtils';

const RestaurantFormView = ({ restaurant, onBack, onSave, waitForKakaoMap, openKakaoPlacesSearch, resizeImage, uploadImageToImgBB }) => {
    // 초기 데이터 설정 (이미지 배열을 최소 3개 슬롯으로 확장)
    const initializeFormData = (restaurantData) => {
        const existingImages = restaurantData?.images || [];
        // 이미지 배열을 최소 3개 슬롯으로 확장
        const images = [...existingImages];
        while (images.length < 3) {
            images.push('');
        }
        
        return {
            title: restaurantData?.title || '',
            images: images,
            location: restaurantData?.location || null,
            menuItems: restaurantData?.menuItems && restaurantData.menuItems.length > 0 
                ? restaurantData.menuItems 
                : [{ name: '', price: '' }],
            naverReservationUrl: restaurantData?.naverReservationUrl || '',
            smartPlaceUrl: restaurantData?.smartPlaceUrl || '',
            phone: restaurantData?.phone || '',
            businessHours: restaurantData?.businessHours || '',
            priceRange: restaurantData?.priceRange || '',
            description: restaurantData?.description || ''
        };
    };
    
    const [formData, setFormData] = useState(initializeFormData(restaurant));
    const [uploadingImages, setUploadingImages] = useState(false);
    
    // restaurant prop이 변경될 때 formData 업데이트
    useEffect(() => {
        if (restaurant) {
            setFormData(initializeFormData(restaurant));
        }
    }, [restaurant]);
    
    const handleImageUpload = async (e, index) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('이미지 크기는 5MB 이하여야 합니다.');
            return;
        }
        
        setUploadingImages(true);
        try {
            // 3:2 비율로 리사이징
            const resizedImage = await resizeImage(file, 1200, 800, 0.9);
            const result = await uploadImageToImgBB(resizedImage, `restaurant_${Date.now()}_${index}.jpg`);
            
            if (result.success) {
                const newImages = [...formData.images];
                newImages[index] = result.url;
                setFormData({ ...formData, images: newImages });
            } else {
                alert('이미지 업로드에 실패했습니다.');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            alert('이미지 업로드에 실패했습니다.');
        } finally {
            setUploadingImages(false);
        }
    };
    
    const handleAddMenuItem = () => {
        if (formData.menuItems.length >= 10) {
            alert('대표메뉴는 최대 10개까지 등록할 수 있습니다.');
            return;
        }
        setFormData({
            ...formData,
            menuItems: [...formData.menuItems, { name: '', price: '' }]
        });
    };
    
    const handleRemoveMenuItem = (index) => {
        const newMenuItems = formData.menuItems.filter((_, i) => i !== index);
        setFormData({ ...formData, menuItems: newMenuItems.length > 0 ? newMenuItems : [{ name: '', price: '' }] });
    };
    
    const handleLocationSelect = async () => {
        try {
            await waitForKakaoMap();
            openKakaoPlacesSearch((place) => {
                setFormData({
                    ...formData,
                    location: {
                        name: place.name,
                        address: place.address,
                        lat: place.lat,
                        lng: place.lng
                    }
                });
            });
        } catch (error) {
            alert('카카오맵을 불러올 수 없습니다.');
        }
    };
    
    const handleSubmit = () => {
        if (!formData.title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        
        // 이미지 검증: 빈 문자열 제거 후 검증
        const validImages = formData.images.filter(img => img && img.trim());
        if (validImages.length === 0) {
            alert('대표사진을 최소 1장 이상 업로드해주세요.');
            return;
        }
        
        // 등록 시에는 3장 필수, 수정 시에는 기존 이미지가 있으면 허용
        if (!restaurant && validImages.length < 3) {
            alert('맛집 등록 시 대표사진 3장을 모두 업로드해주세요.');
            return;
        }
        
        if (!formData.location) {
            alert('지도 위치를 선택해주세요.');
            return;
        }
        
        const validMenuItems = formData.menuItems.filter(m => m.name.trim());
        if (validMenuItems.length === 0) {
            alert('대표메뉴를 최소 1개 이상 등록해주세요.');
            return;
        }
        
        onSave({
            ...formData,
            images: validImages, // 빈 이미지 제거
            menuItems: validMenuItems
        });
    };
    
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-4xl">
                <button onClick={onBack} className="mb-6 flex items-center gap-2 text-brand font-bold hover:underline">
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>
                
                <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                    <h2 className="text-2xl font-bold text-dark mb-6">{restaurant ? '맛집 수정' : '맛집 등록'}</h2>
                    
                    <div className="space-y-6">
                        {/* 제목 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="맛집 이름"
                            />
                        </div>
                        
                        {/* 대표사진 3장 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                대표사진 {restaurant ? '(수정 가능)' : '(3장 필수)'} *
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                {[0, 1, 2].map((index) => (
                                    <div key={index} className="relative" style={{ aspectRatio: '3/2' }}>
                                        {formData.images[index] ? (
                                            <div className="relative w-full h-full group">
                                                <img src={formData.images[index]} alt={`사진 ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newImages = [...formData.images];
                                                        newImages[index] = '';
                                                        setFormData({ ...formData, images: newImages });
                                                    }}
                                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Icons.X size={16} />
                                                    </button>
                                                    <label className="absolute inset-0 cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => handleImageUpload(e, index)}
                                                            className="hidden"
                                                            disabled={uploadingImages}
                                                        />
                                                    </label>
                                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                                                        클릭하여 교체
                                                    </div>
                                                </div>
                                        ) : (
                                            <label className="w-full h-full border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleImageUpload(e, index)}
                                                    className="hidden"
                                                    disabled={uploadingImages}
                                                />
                                                <div className="text-center">
                                                    <Icons.Camera size={24} className="mx-auto mb-2 text-gray-400" />
                                                    <span className="text-xs text-gray-500">
                                                        {uploadingImages ? '업로드 중...' : `사진 ${index + 1} ${restaurant ? '(교체)' : '(필수)'}`}
                                                    </span>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {restaurant ? (
                                <p className="text-xs text-gray-500 mt-2">
                                    * 수정 시 기존 이미지를 유지하거나 교체할 수 있습니다. 최소 1장 이상 필요합니다.
                                </p>
                            ) : null}
                        </div>
                        
                        {/* 지도 위치 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">지도 위치 *</label>
                            {formData.location ? (
                                <div className="p-3 bg-gray-50 rounded-xl mb-2">
                                    <p className="font-bold">{formData.location.name}</p>
                                    <p className="text-sm text-gray-600">{formData.location.address}</p>
                                </div>
                            ) : null}
                            <button
                                onClick={handleLocationSelect}
                                className="w-full px-4 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700"
                            >
                                {formData.location ? '위치 변경' : '위치 선택'}
                            </button>
                        </div>
                        
                        {/* 대표메뉴 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">대표메뉴 (최대 10개) *</label>
                            {formData.menuItems.map((menu, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={menu.name}
                                        onChange={(e) => {
                                            const newMenuItems = [...formData.menuItems];
                                            newMenuItems[index].name = e.target.value;
                                            setFormData({ ...formData, menuItems: newMenuItems });
                                        }}
                                        className="flex-1 p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                        placeholder="메뉴명"
                                    />
                                    <input
                                        type="text"
                                        value={menu.price}
                                        onChange={(e) => {
                                            const newMenuItems = [...formData.menuItems];
                                            newMenuItems[index].price = e.target.value;
                                            setFormData({ ...formData, menuItems: newMenuItems });
                                        }}
                                        className="w-32 p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                        placeholder="가격"
                                    />
                                    {formData.menuItems.length > 1 ? (
                                        <button
                                            onClick={() => handleRemoveMenuItem(index)}
                                            className="px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
                                        >
                                            삭제
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            {formData.menuItems.length < 10 ? (
                                <button
                                    onClick={handleAddMenuItem}
                                    className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                                >
                                    메뉴 추가
                                </button>
                            ) : null}
                        </div>
                        
                        {/* 네이버 예약 URL */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">네이버 예약 URL</label>
                            <input
                                type="url"
                                value={formData.naverReservationUrl}
                                onChange={(e) => setFormData({ ...formData, naverReservationUrl: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="https://booking.naver.com/..."
                            />
                        </div>
                        
                        {/* 스마트플레이스 URL */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">스마트플레이스 URL</label>
                            <input
                                type="url"
                                value={formData.smartPlaceUrl}
                                onChange={(e) => setFormData({ ...formData, smartPlaceUrl: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="https://place.naver.com/..."
                            />
                        </div>
                        
                        {/* 전화번호 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="051-123-4567"
                            />
                        </div>
                        
                        {/* 영업시간 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">영업시간</label>
                            <input
                                type="text"
                                value={formData.businessHours}
                                onChange={(e) => setFormData({ ...formData, businessHours: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="예: 11:00 - 22:00"
                            />
                        </div>
                        
                        {/* 가격대 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">가격대</label>
                            <input
                                type="text"
                                value={formData.priceRange}
                                onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                placeholder="예: 만원대, 2만원대"
                            />
                        </div>
                        
                        {/* 설명 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                rows="5"
                                placeholder="맛집 소개"
                            />
                        </div>
                        
                        {/* 저장 버튼 */}
                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={onBack}
                                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={uploadingImages}
                                className="flex-1 px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {uploadingImages ? '업로드 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestaurantFormView;
