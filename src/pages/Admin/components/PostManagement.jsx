import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import ModalPortal from '../../../components/ModalPortal';
import { uploadImageForAdmin } from '../../../utils/imageUtils';

const MAX_REVIEW_IMAGES = 10;

/**
 * 게시물 관리 컴포넌트
 */
export const PostManagement = () => {
  const [posts, setPosts] = useState([]);
  const [seminars, setSeminars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 후기 작성/수정 모달
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    seminarId: '',
    seminarTitle: '',
    title: '',
    content: '',
    rating: 5,
    authorName: '관리자',
    reviewImages: []
  });
  const [reviewImageUploading, setReviewImageUploading] = useState(false);

  // 상세 보기 모달
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // ESC 키로 게시물 상세 모달 닫기 (후기 작성/수정 모달은 ESC 미적용)
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && selectedPost && !isReviewModalOpen) {
        setSelectedPost(null);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [selectedPost, isReviewModalOpen]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [postsData, seminarsData] = await Promise.all([
        firebaseService.getPosts(),
        firebaseService.getSeminars()
      ]);
      setPosts(postsData);
      setSeminars(seminarsData || []);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      alert('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('정말 이 게시물을 삭제하시겠습니까?')) return;

    try {
      await firebaseService.deletePost(postId);
      alert('게시물이 삭제되었습니다.');
      loadData();
    } catch (error) {
      console.error('게시물 삭제 오류:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  // 후기 작성 모달 열기
  const openCreateReviewModal = () => {
    setEditingReview(null);
    setReviewForm({
      seminarId: '',
      seminarTitle: '',
      title: '',
      content: '',
      rating: 5,
      authorName: '관리자',
      reviewImages: []
    });
    setIsReviewModalOpen(true);
  };

  // 후기 수정 모달 열기
  const openEditReviewModal = (post) => {
    setEditingReview(post);
    setReviewForm({
      seminarId: post.seminarId || '',
      seminarTitle: post.seminarTitle || '',
      title: post.title || '',
      content: post.content || '',
      rating: post.rating || 5,
      authorName: post.authorName || '관리자',
      reviewImages: post.reviewImages || post.images || []
    });
    setIsReviewModalOpen(true);
  };

  // 후기 저장
  const handleSaveReview = async () => {
    if (!reviewForm.seminarId) {
      alert('프로그램을 선택해주세요.');
      return;
    }
    if (!reviewForm.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!reviewForm.content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    try {
      const reviewData = {
        category: '프로그램 후기',
        seminarId: reviewForm.seminarId,
        seminarTitle: reviewForm.seminarTitle,
        title: reviewForm.title,
        content: reviewForm.content,
        rating: reviewForm.rating,
        authorName: reviewForm.authorName,
        author: reviewForm.authorName,
        isAdminPost: true,
        reviewImages: reviewForm.reviewImages || [],
        images: reviewForm.reviewImages || []
      };

      if (editingReview) {
        // 수정
        await firebaseService.updatePost(editingReview.id, reviewData);
        alert('후기가 수정되었습니다.');
      } else {
        // 생성
        await firebaseService.createPost(reviewData);
        alert('후기가 작성되었습니다.');
      }
      
      setIsReviewModalOpen(false);
      loadData();
    } catch (error) {
      console.error('후기 저장 오류:', error);
      alert('후기 저장에 실패했습니다.');
    }
  };

  // 프로그램 선택 시 제목 자동 설정
  const handleSeminarSelect = (seminarId) => {
    const seminar = seminars.find(s => String(s.id) === String(seminarId));
    if (seminar) {
      setReviewForm(prev => ({
        ...prev,
        seminarId: seminarId,
        seminarTitle: seminar.title,
        title: editingReview ? prev.title : `[${seminar.title}] 후기`
      }));
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm ||
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || post.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['인력구인', '중고거래', '프로그램 후기', '자유게시판'];

  // 별점 렌더링
  const renderStars = (rating, interactive = false, onChange = null) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange && onChange(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            disabled={!interactive}
          >
            <Icons.Star
              size={interactive ? 28 : 18}
              className={star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dark flex items-center gap-3">
          <Icons.MessageSquare size={28} />
          게시물 관리
        </h2>
        <div className="flex gap-2">
          <button
            onClick={openCreateReviewModal}
            className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Icons.Plus size={18} />
            후기 작성
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icons.RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">검색</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="제목 또는 내용 검색"
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">카테고리 필터</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
          >
            <option value="all">전체</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-bold mb-1">전체</p>
          <p className="text-2xl font-bold text-dark">{posts.length}</p>
        </div>
        {categories.map(cat => (
          <div key={cat} className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 font-bold mb-1">{cat}</p>
            <p className="text-2xl font-bold text-dark">{posts.filter(p => p.category === cat).length}</p>
          </div>
        ))}
      </div>

      {/* 게시물 목록 */}
      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <Icons.MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">게시물이 없습니다.</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-white border-2 border-blue-200 rounded-2xl p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                      {post.category}
                    </span>
                    {post.isSecret && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Icons.Lock size={12} />
                        비밀글
                      </span>
                    )}
                    {post.isAdminPost && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                        관리자
                      </span>
                    )}
                    {post.category === '프로그램 후기' && post.rating && (
                      <div className="flex items-center gap-1">
                        {renderStars(post.rating)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-dark mb-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Icons.User size={14} />
                      {post.authorName || '익명'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icons.Calendar size={14} />
                      {post.createdAt?.toDate?.().toLocaleDateString() || '-'}
                    </span>
                    {post.seminarTitle && (
                      <span className="flex items-center gap-1 text-brand">
                        <Icons.Tag size={14} />
                        {post.seminarTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {post.category === '프로그램 후기' && (
                    <button
                      onClick={() => openEditReviewModal(post)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      title="후기 수정"
                    >
                      <Icons.Edit2 size={20} className="text-blue-600" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="게시물 삭제"
                  >
                    <Icons.Trash2 size={20} className="text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 후기 작성/수정 모달 (ESC 미적용) */}
      {isReviewModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={() => setIsReviewModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h2 className="text-2xl font-bold text-dark mb-6">
                {editingReview ? '후기 수정' : '후기 작성'}
              </h2>

            <div className="space-y-6">
              {/* 프로그램 선택 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">프로그램 선택 *</label>
                <select
                  value={reviewForm.seminarId}
                  onChange={(e) => handleSeminarSelect(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                >
                  <option value="">프로그램을 선택하세요</option>
                  {seminars.map((seminar) => (
                    <option key={seminar.id} value={seminar.id}>
                      {seminar.title} ({seminar.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* 평점 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">평점 *</label>
                {renderStars(reviewForm.rating, true, (rating) => setReviewForm(prev => ({ ...prev, rating })))}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                  placeholder="후기 제목을 입력하세요"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                <textarea
                  value={reviewForm.content}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none h-40 resize-none"
                  placeholder="후기 내용을 입력하세요"
                />
              </div>

              {/* 작성자 이름 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">작성자 이름</label>
                <input
                  type="text"
                  value={reviewForm.authorName}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, authorName: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-brand focus:outline-none"
                  placeholder="작성자 이름"
                />
              </div>

              {/* 후기 사진 (최대 10장) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">후기 사진 (최대 {MAX_REVIEW_IMAGES}장)</label>
                <div className="flex flex-wrap gap-3">
                  {(reviewForm.reviewImages || []).map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt={`후기 사진 ${idx + 1}`} className="w-24 h-24 object-cover rounded-xl border-2 border-blue-200" />
                      <button
                        type="button"
                        onClick={() => setReviewForm(prev => ({ ...prev, reviewImages: (prev.reviewImages || []).filter((_, i) => i !== idx) }))}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(reviewForm.reviewImages || []).length < MAX_REVIEW_IMAGES && (
                    <label className="w-24 h-24 border-2 border-dashed border-blue-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-colors">
                      {reviewImageUploading ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto mb-1"></div>
                          <span className="text-xs text-gray-500">업로드 중</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Icons.Plus size={20} className="text-gray-400 mx-auto mb-0.5" />
                          <span className="text-xs text-gray-500">추가</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const current = reviewForm.reviewImages || [];
                          if (current.length + files.length > MAX_REVIEW_IMAGES) {
                            alert(`최대 ${MAX_REVIEW_IMAGES}장까지만 업로드할 수 있습니다. (현재 ${current.length}장)`);
                            return;
                          }
                          setReviewImageUploading(true);
                          try {
                            const uploadPromises = files.map(async (file) => {
                              try {
                                if (!file.type.startsWith('image/')) return null;
                                return await uploadImageForAdmin(file);
                              } catch (err) {
                                alert(err?.message || `${file.name} 업로드 실패`);
                                return null;
                              }
                            });
                            const uploaded = (await Promise.all(uploadPromises)).filter(Boolean);
                            setReviewForm(prev => ({ ...prev, reviewImages: [...(prev.reviewImages || []), ...uploaded] }));
                          } finally {
                            setReviewImageUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <button
                  onClick={handleSaveReview}
                  className="w-full px-6 py-3 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-6"
                >
                  {editingReview ? '수정' : '작성'}
                </button>
            </div>
            </div>
            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                닫기
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 게시물 상세 보기 모달 (ESC로 닫기) */}
      {selectedPost && (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
            <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-sm font-bold">
                  {selectedPost.category}
                </span>
                {selectedPost.category === '프로그램 후기' && selectedPost.rating && (
                  <div className="flex items-center gap-1">
                    {renderStars(selectedPost.rating)}
                  </div>
                )}
              </div>

            <div>
              <h2 className="text-2xl font-bold text-dark mb-4">{selectedPost.title}</h2>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 pb-4 border-b border-blue-100">
                <span className="flex items-center gap-1">
                  <Icons.User size={16} />
                  {selectedPost.authorName || '익명'}
                </span>
                <span className="flex items-center gap-1">
                  <Icons.Calendar size={16} />
                  {selectedPost.createdAt?.toDate?.().toLocaleDateString() || '-'}
                </span>
                {selectedPost.seminarTitle && (
                  <span className="flex items-center gap-1 text-brand">
                    <Icons.Tag size={16} />
                    {selectedPost.seminarTitle}
                  </span>
                )}
              </div>

              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {/* 후기 이미지 */}
              {selectedPost.reviewImages && selectedPost.reviewImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">첨부 이미지</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedPost.reviewImages.map((img, idx) => (
                      <img key={idx} src={img} alt={`후기 이미지 ${idx + 1}`} className="w-full h-32 object-cover rounded-xl" />
                    ))}
                  </div>
                </div>
              )}

              {selectedPost.category === '프로그램 후기' && (
                  <button
                    onClick={() => { setSelectedPost(null); openEditReviewModal(selectedPost); }}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mt-6"
                  >
                    <Icons.Edit2 size={18} />
                    수정
                  </button>
                )}
                <button
                  onClick={() => { handleDelete(selectedPost.id); setSelectedPost(null); }}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  <Icons.Trash2 size={18} />
                  삭제
                </button>
            </div>
            </div>
            <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
              <button type="button" onClick={() => setSelectedPost(null)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
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
