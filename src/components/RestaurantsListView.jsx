import React, { useState } from 'react';
import PageTitle from './PageTitle';
import { Icons } from './Icons';

const RestaurantsListView = ({ onBack, restaurants, currentUser, isFoodBusinessOwner, onRestaurantClick, onCreateClick, menuNames, pageTitles }) => {
    const [searchKeyword, setSearchKeyword] = useState('');
    
    const filteredRestaurants = restaurants.filter(restaurant => {
        // 승인 상태 및 노출 여부 체크
        const isApproved = restaurant.approvalStatus === 'approved' || !restaurant.approvalStatus;
        const isVisible = restaurant.isVisible !== false; // 기본값 true
        if (!isApproved || !isVisible) return false;
        
        // 검색어 매칭
        const matchKeyword = !searchKeyword || 
            restaurant.title?.toLowerCase().includes(searchKeyword.toLowerCase()) || 
            restaurant.location?.address?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            restaurant.ownerName?.toLowerCase().includes(searchKeyword.toLowerCase());
        return matchKeyword;
    });

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="w-full text-center md:text-left">
                        <PageTitle pageKey="restaurants" pageTitles={pageTitles} defaultText={menuNames?.['부산맛집'] || '부산맛집'} />
                        <p className="text-gray-500 text-sm">부산 지역 맛집 정보</p>
                    </div>
                    <div className="w-full flex justify-end md:justify-start items-center gap-4">
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateClick(); }} 
                                className="flex items-center gap-2 bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Icons.Plus size={20} /> 맛집 등록
                            </button>
                        ) : null}
                        <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} 
                            className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors"
                        >
                            <Icons.ArrowLeft size={20} /> 메인으로
                        </button>
                    </div>
                </div>

                {/* 검색 */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mb-8">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-2">검색</label>
                        <div className="relative">
                            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="맛집명, 주소, 등록자명 검색" 
                                className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none text-sm" 
                                value={searchKeyword} 
                                onChange={(e) => setSearchKeyword(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        검색 결과: <span className="font-bold text-brand">{filteredRestaurants.length}</span>개
                    </div>
                </div>

                {/* 맛집 리스트 */}
                {filteredRestaurants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRestaurants.map((restaurant) => (
                            <div 
                                key={restaurant.id} 
                                className="bg-white rounded-2xl shadow-sm border border-blue-200 hover:shadow-md transition-all hover:border-brand/20 cursor-pointer overflow-hidden" 
                                onClick={() => onRestaurantClick(restaurant)}
                            >
                                {restaurant.images && restaurant.images.length > 0 ? (
                                    <div className="w-full overflow-hidden" style={{ aspectRatio: '1/1' }}>
                                        <img 
                                            src={restaurant.images[0]} 
                                            alt={restaurant.title} 
                                            className="w-full h-full object-cover" 
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : null}
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-dark mb-2 line-clamp-2">{restaurant.title || '제목 없음'}</h3>
                                    {restaurant.location?.address ? (
                                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                                            <Icons.MapPin size={14} />
                                            <span className="line-clamp-1">{restaurant.location.address}</span>
                                        </div>
                                    ) : null}
                                    {restaurant.ownerName ? (
                                        <div className="text-xs text-gray-500 mb-2">
                                            등록자: {restaurant.ownerName}
                                        </div>
                                    ) : null}
                                    {restaurant.menuItems && restaurant.menuItems.length > 0 ? (
                                        <div className="text-xs text-gray-500 mb-2">
                                            대표메뉴: {restaurant.menuItems[0].name}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <Icons.Info className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>등록된 맛집이 없습니다.</p>
                        {isFoodBusinessOwner(currentUser) ? (
                            <button 
                                type="button"
                                onClick={onCreateClick}
                                className="mt-4 px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                맛집 등록하기
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestaurantsListView;
