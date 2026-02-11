import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';

const RestaurantDetailView = ({ restaurant, onBack, currentUser, onEdit, onDelete, waitForKakaoMap, openKakaoPlacesSearch }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    
    const isOwner = restaurant && currentUser && (restaurant.ownerId === (currentUser.id || currentUser.uid));
    
    // 지도 초기화
    useEffect(() => {
        if (!restaurant?.location?.lat || !restaurant?.location?.lng || !mapContainerRef.current) return;
        
        const initMap = async () => {
            try {
                await waitForKakaoMap();
                const kakao = window.kakao;
                const position = new kakao.maps.LatLng(restaurant.location.lat, restaurant.location.lng);
                
                const mapOption = {
                    center: position,
                    level: 3
                };
                
                mapRef.current = new kakao.maps.Map(mapContainerRef.current, mapOption);
                
                // 마커 표시
                markerRef.current = new kakao.maps.Marker({
                    position: position,
                    map: mapRef.current
                });
            } catch (error) {
                console.error('지도 초기화 실패:', error);
            }
        };
        
        initMap();
    }, [restaurant?.location, waitForKakaoMap]);
    
    if (!restaurant) {
        return (
            <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
                <div className="container mx-auto max-w-7xl text-center">
                    <p className="text-gray-500">맛집 정보를 찾을 수 없습니다.</p>
                    <button onClick={onBack} className="mt-4 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700">
                        목록으로
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-7xl">
                <button onClick={onBack} className="mb-6 flex items-center gap-2 text-brand font-bold hover:underline">
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>
                
                {/* 갤러리 */}
                {restaurant.images && restaurant.images.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-6">
                        <div className="relative" style={{ aspectRatio: '1/1' }}>
                            <img 
                                src={restaurant.images[currentImageIndex]} 
                                alt={restaurant.title}
                                className="w-full h-full object-cover rounded-xl"
                                loading="lazy"
                                decoding="async"
                            />
                            {restaurant.images.length > 1 ? (
                                <>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev - 1 + restaurant.images.length) % restaurant.images.length)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                                    >
                                        <Icons.ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev + 1) % restaurant.images.length)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
                                    >
                                        <Icons.ChevronRight size={20} />
                                    </button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                        {restaurant.images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`w-2 h-2 rounded-full ${idx === currentImageIndex ? 'bg-brand w-6' : 'bg-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                
                {/* 기본 정보 */}
                <div className="bg-white rounded-3xl shadow-card p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-3xl font-bold text-dark">{restaurant.title}</h2>
                        {isOwner ? (
                            <div className="flex gap-2">
                                <button onClick={onEdit} className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700">
                                    수정
                                </button>
                                <button onClick={onDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">
                                    삭제
                                </button>
                            </div>
                        ) : null}
                    </div>
                    
                    {restaurant.location?.address ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.MapPin size={18} />
                            <span>{restaurant.location.address}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.phone ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.Phone size={18} />
                            <span>{restaurant.phone}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.businessHours ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Icons.Clock size={18} />
                            <span>{restaurant.businessHours}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.priceRange ? (
                        <div className="flex items-center gap-2 text-gray-600 mb-4">
                            <Icons.DollarSign size={18} />
                            <span>{restaurant.priceRange}</span>
                        </div>
                    ) : null}
                    
                    {restaurant.description ? (
                        <p className="text-gray-700 mb-4">{restaurant.description}</p>
                    ) : null}
                    
                    {/* 예약 버튼 */}
                    <div className="flex gap-4 mt-6">
                        {restaurant.naverReservationUrl ? (
                            <a 
                                href={restaurant.naverReservationUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 text-center"
                            >
                                네이버 예약
                            </a>
                        ) : null}
                        {restaurant.smartPlaceUrl ? (
                            <a 
                                href={restaurant.smartPlaceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 text-center"
                            >
                                스마트플레이스
                            </a>
                        ) : null}
                    </div>
                </div>
                
                {/* 대표메뉴 */}
                {restaurant.menuItems && restaurant.menuItems.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-6">
                        <h3 className="text-xl font-bold text-dark mb-4">대표메뉴</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {restaurant.menuItems.map((menu, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="font-bold text-dark">{menu.name}</span>
                                    {menu.price && <span className="text-brand font-bold">{menu.price}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                
                {/* 지도 */}
                {restaurant.location?.lat && restaurant.location?.lng ? (
                    <div className="bg-white rounded-3xl shadow-card p-6">
                        <h3 className="text-xl font-bold text-dark mb-4">위치</h3>
                        <div ref={mapContainerRef} className="w-full" style={{ height: '400px', borderRadius: '12px', overflow: 'hidden' }}></div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default RestaurantDetailView;
