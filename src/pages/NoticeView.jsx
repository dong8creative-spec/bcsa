import React, { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Icons } from '../components/Icons';

const NoticeView = ({ onBack, posts, menuNames, pageTitles }) => {
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedPost, setSelectedPost] = useState(null);
    
    const categories = ['전체', '일반공지', '세미나', '내부안내'];
    const filteredPosts = selectedCategory === '전체' 
        ? posts.filter(p => p.category === '공지사항')
        : posts.filter(p => p.category === '공지사항' && p.title.includes(selectedCategory));
    
    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="community" pageTitles={pageTitles} defaultText={menuNames?.['커뮤니티'] || '커뮤니티'} />
                        <p className="text-gray-500 text-sm">단체 소식 안내</p>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로
                    </button>
                </div>
                {/* 공지사항 내용 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                {/* 카테고리 필터 */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                                selectedCategory === cat
                                    ? 'bg-brand text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                    {/* 공지사항 목록 */}
                    {filteredPosts.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">등록된 공지사항이 없습니다.</p>
                </div>
                    ) : (
                    <div className="space-y-4">
                        {filteredPosts.map((post) => (
                            <div
                                key={post.id}
                                    className="p-5 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer"
                                onClick={() => setSelectedPost(post)}
                            >
                                    <h3 className="font-bold text-dark mb-2">{post.title}</h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                            <span>{post.author}</span>
                                        <span>{new Date(post.createdAt?.toDate?.() || post.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </div>

            {/* 공지사항 상세 모달 */}
                {selectedPost && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto modal-scroll">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-dark mb-2">{selectedPost.title}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>{selectedPost.author}</span>
                                    <span>{new Date(selectedPost.createdAt?.toDate?.() || selectedPost.createdAt).toLocaleDateString()}</span>
                                </div>
                                </div>
                            <button type="button" onClick={() => setSelectedPost(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <Icons.X size={24} />
                            </button>
                                        </div>
                        <div className="prose max-w-none">
                            <p className="whitespace-pre-wrap text-gray-700">{selectedPost.content}</p>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default NoticeView;
