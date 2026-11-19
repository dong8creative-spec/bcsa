import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import ModalPortal from '../components/ModalPortal';
import { MgWrap, MgPageHead, MgTabs } from '../components/mg/Mg';

const NoticeView = ({ onBack, posts, menuNames, pageTitles }) => {
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [selectedPost, setSelectedPost] = useState(null);
    
    // ESC 키로 공지 상세 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && selectedPost) {
                setSelectedPost(null);
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [selectedPost]);
    
    const categories = ['전체', '일반공지', '세미나', '내부안내'];
    const filteredPosts = selectedCategory === '전체' 
        ? posts.filter(p => p.category === '공지사항')
        : posts.filter(p => p.category === '공지사항' && p.title.includes(selectedCategory));
    
    // 관리자가 바꾼 화면 제목(pageTitles.community)이 있으면 그 글을 쓴다(글 크기·굵기는 개편 규칙을 따름)
    const pageTitleText = pageTitles?.community?.text || menuNames?.['커뮤니티'] || '커뮤니티';
    const formatDate = (v) => new Date(v?.toDate?.() || v).toLocaleDateString();

    return (
        <div className="min-h-screen min-h-0 overflow-y-auto bg-white">
            <MgPageHead
                crumbs={
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-white">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span> 공지사항
                    </>
                }
                eyebrow="NOTICE"
                title={<span style={{ whiteSpace: 'pre-line' }}>{pageTitleText}</span>}
                desc="단체 소식 안내"
            >
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-[15px] font-semibold text-white transition-colors hover:border-white">
                    <Icons.ArrowLeft size={18} /> 메인으로
                </button>
            </MgPageHead>

            <section className="py-12 md:py-16" aria-label="공지사항 목록">
                <MgWrap>
                    {/* 카테고리 필터 */}
                    <MgTabs className="mb-2" label="공지 분류" value={selectedCategory} onChange={setSelectedCategory} items={categories.map((c) => [c, c])} />

                    {/* 공지사항 목록 */}
                    {filteredPosts.length === 0 ? (
                        <p className="mt-6 rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">등록된 공지사항이 없습니다.</p>
                    ) : (
                        <ul className="border-t border-[#0c0c0e]">
                            {filteredPosts.map((post) => (
                                <li key={post.id} className="border-b border-line">
                                    <button
                                        type="button"
                                        className="block w-full py-5 text-left transition-colors hover:bg-card md:px-2 md:py-6"
                                        onClick={() => setSelectedPost(post)}
                                    >
                                        <h3 className="truncate text-[17px] font-semibold leading-snug text-ink md:text-[18px]">{post.title}</h3>
                                        <p className="mt-1.5 line-clamp-2 min-h-[3.25em] break-keep text-[15px] leading-relaxed text-sub">{post.content || '\u00a0'}</p>
                                        <span className="mt-2 flex min-w-0 items-center gap-4 text-[13px] text-sub">
                                            <span className="min-w-0 truncate">{post.author}</span>
                                            <span className="shrink-0">{formatDate(post.createdAt)}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </MgWrap>
            </section>

            {/* 공지사항 상세 모달 (ESC로 닫기) */}
            {selectedPost && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
                        <div role="dialog" aria-modal="true" aria-labelledby="notice-detail-title" className="flex max-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col rounded-[18px] bg-white md:max-h-[calc(90vh-100px)]" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
                                <h3 id="notice-detail-title" className="break-keep text-[22px] font-bold leading-snug text-ink md:text-[26px]">{selectedPost.title}</h3>
                                <div className="mb-6 mt-2 flex items-center gap-4 border-b border-line pb-4 text-[14px] text-sub">
                                    <span>{selectedPost.author}</span>
                                    <span>{formatDate(selectedPost.createdAt)}</span>
                                </div>
                                <p className="whitespace-pre-wrap break-keep text-[16px] leading-[1.8] text-[#333]">{selectedPost.content}</p>
                            </div>
                            <div className="flex shrink-0 justify-end border-t border-line p-4">
                                <button type="button" onClick={() => setSelectedPost(null)} className="h-12 rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white transition-colors hover:bg-black">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default NoticeView;
