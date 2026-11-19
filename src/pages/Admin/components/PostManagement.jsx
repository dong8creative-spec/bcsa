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
  const [savingReview, setSavingReview] = useState(false);

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
    if (savingReview) return;
    if (reviewImageUploading) {
      alert('이미지 업로드가 끝난 뒤 저장해주세요.');
      return;
    }
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
      setSavingReview(true);
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
    } finally {
      setSavingReview(false);
    }
  };

  // 드롭다운용: 운영일자 최신순 정렬된 프로그램 목록
  const seminarsByDateDesc = React.useMemo(() => {
    const parseDate = (val) => {
      if (!val) return 0;
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      if (val instanceof Date) return val.getTime();
      const str = String(val).trim().split(' ')[0];
      const match = str.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
      if (match) {
        const [, y, m, d] = match;
        return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
      }
      return 0;
    };
    return [...(seminars || [])].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  }, [seminars]);

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

  // 후기 리스트: 프로그램 후기는 연동된 세미나의 운영일자순(최신 먼저), 그 외는 작성일 기준
  const sortedPosts = React.useMemo(() => {
    const parseDate = (val) => {
      if (!val) return 0;
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      if (val instanceof Date) return val.getTime();
      const str = String(val).trim();
      const match = str.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
      if (match) {
        const [, y, m, d] = match;
        return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
      }
      return 0;
    };
    return [...filteredPosts].sort((a, b) => {
      let timeA = 0, timeB = 0;
      if (a.category === '프로그램 후기' && a.seminarId) {
        const seminarA = seminars.find(s => String(s.id) === String(a.seminarId));
        timeA = seminarA ? parseDate(seminarA.date) : (a.createdAt?.toDate?.()?.getTime?.() ?? parseDate(a.date) ?? 0);
      } else {
        timeA = a.createdAt?.toDate?.()?.getTime?.() ?? parseDate(a.date) ?? 0;
      }
      if (b.category === '프로그램 후기' && b.seminarId) {
        const seminarB = seminars.find(s => String(s.id) === String(b.seminarId));
        timeB = seminarB ? parseDate(seminarB.date) : (b.createdAt?.toDate?.()?.getTime?.() ?? parseDate(b.date) ?? 0);
      } else {
        timeB = b.createdAt?.toDate?.()?.getTime?.() ?? parseDate(b.date) ?? 0;
      }
      return timeB - timeA; // 최신(운영일자) 먼저
    });
  }, [filteredPosts, seminars]);

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
            className={`${interactive ? 'flex h-11 w-11 cursor-pointer items-center justify-center' : 'cursor-default'}`}
            disabled={!interactive}
          >
            <Icons.Star
              size={interactive ? 28 : 18}
              className={star <= rating ? 'text-royal fill-royal' : 'text-gray-300'}
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-royal mb-4"></div>
          <p className="text-[15px] text-sub">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold text-ink md:text-[24px]">
          <Icons.MessageSquare size={24} />
          게시물 관리
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreateReviewModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0c0c0e] px-5 text-[15px] font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            <Icons.Plus size={18} />
            후기 작성
          </button>
          <button
            onClick={loadData}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink"
          >
            <Icons.RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[15px] font-semibold text-ink mb-2">검색</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="제목 또는 내용 검색"
            className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[15px] font-semibold text-ink mb-2">카테고리 필터</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
          >
            <option value="all">전체</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 통계 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="flex h-full flex-col rounded-xl bg-sky p-4">
          <p className="mb-1 truncate text-[15px] font-semibold text-royal">전체</p>
          <p className="mt-auto text-[24px] font-bold text-ink">{posts.length}</p>
        </div>
        {categories.map(cat => (
          <div key={cat} className="flex h-full flex-col rounded-xl bg-card p-4">
            <p className="mb-1 truncate text-[15px] font-semibold text-sub" title={cat}>{cat}</p>
            <p className="mt-auto text-[24px] font-bold text-ink">{posts.filter(p => p.category === cat).length}</p>
          </div>
        ))}
      </div>

      {/* 게시물 목록 (후기는 연동 프로그램 운영일자순) */}
      <div className="space-y-3">
        {sortedPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line2 py-12 text-center">
            <Icons.MessageSquare size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="text-[15px] text-sub">게시물이 없습니다.</p>
          </div>
        ) : (
          sortedPosts.map((post) => (
            <div key={post.id} className="border border-line bg-white p-4 transition-colors hover:border-ink">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-none px-2 text-[13px] font-semibold bg-royal text-white">
                      {post.category}
                    </span>
                    {post.isSecret && (
                      <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-none px-2 text-[13px] font-semibold bg-[#0c0c0e] text-white">
                        <Icons.Lock size={12} />
                        비밀글
                      </span>
                    )}
                    {post.isAdminPost && (
                      <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-none px-2 text-[13px] font-semibold bg-sky text-royal">
                        관리자
                      </span>
                    )}
                    {post.category === '프로그램 후기' && post.rating && (
                      <div className="flex items-center gap-1">
                        {renderStars(post.rating)}
                      </div>
                    )}
                  </div>
                  <h3 className="mb-1.5 line-clamp-2 text-[17px] font-semibold leading-snug text-ink" title={post.title}>{post.title}</h3>
                  <p className="mb-3 line-clamp-2 text-[15px] leading-relaxed text-sub">{post.content}</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub">
                    <span className="flex items-center gap-1">
                      <Icons.User size={14} />
                      {post.authorName || '익명'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icons.Calendar size={14} />
                      {post.createdAt?.toDate?.().toLocaleDateString() || '-'}
                    </span>
                    {post.seminarTitle && (
                      <span className="flex min-w-0 max-w-full items-center gap-1 text-royal" title={post.seminarTitle}>
                        <Icons.Tag size={14} className="shrink-0" />
                        <span className="truncate">{post.seminarTitle}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {post.category === '프로그램 후기' && (
                    <button
                      onClick={() => openEditReviewModal(post)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-line2 bg-white transition-colors hover:border-ink"
                      title="후기 수정"
                      aria-label="후기 수정"
                    >
                      <Icons.Edit2 size={20} className="text-royal" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white transition-colors hover:bg-red-50"
                    title="게시물 삭제"
                    aria-label="게시물 삭제"
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50" onClick={() => setIsReviewModalOpen(false)}>
          <div className="bg-white rounded-[18px] max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h2 className="mb-6 text-[20px] font-bold text-ink">
                {editingReview ? '후기 수정' : '후기 작성'}
              </h2>

            <div className="space-y-6">
              {/* 프로그램 선택 */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">프로그램 선택 *</label>
                <select
                  value={reviewForm.seminarId}
                  onChange={(e) => handleSeminarSelect(e.target.value)}
                  className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
                >
                  <option value="">프로그램을 선택하세요</option>
                  {seminarsByDateDesc.map((seminar) => (
                    <option key={seminar.id} value={seminar.id}>
                      {seminar.title} ({seminar.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* 평점 */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">평점 *</label>
                {renderStars(reviewForm.rating, true, (rating) => setReviewForm(prev => ({ ...prev, rating })))}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">제목 *</label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                  className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
                  placeholder="후기 제목을 입력하세요"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">내용 *</label>
                <textarea
                  value={reviewForm.content}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                  className="h-40 w-full resize-none rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] focus:border-royal focus:outline-none"
                  placeholder="후기 내용을 입력하세요"
                />
              </div>

              {/* 작성자 이름 */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">작성자 이름</label>
                <input
                  type="text"
                  value={reviewForm.authorName}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, authorName: e.target.value }))}
                  className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
                  placeholder="작성자 이름"
                />
              </div>

              {/* 후기 사진 (최대 10장) */}
              <div>
                <label className="block text-[15px] font-semibold text-ink mb-2">후기 사진 (최대 {MAX_REVIEW_IMAGES}장)</label>
                <div className="flex flex-wrap gap-3">
                  {(reviewForm.reviewImages || []).map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt={`후기 사진 ${idx + 1}`} className="h-24 w-24 border border-line object-cover" loading="lazy" decoding="async" />
                      <button
                        type="button"
                        onClick={() => setReviewForm(prev => ({ ...prev, reviewImages: (prev.reviewImages || []).filter((_, i) => i !== idx) }))}
                        className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center bg-red-600 text-[15px] text-white hover:bg-red-700"
                        aria-label={`후기 사진 ${idx + 1} 빼기`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(reviewForm.reviewImages || []).length < MAX_REVIEW_IMAGES && (
                    <label className="flex h-24 w-24 cursor-pointer items-center justify-center border border-dashed border-line2 transition-colors hover:border-royal">
                      {reviewImageUploading ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-royal mx-auto mb-1"></div>
                          <span className="text-[13px] text-sub">업로드 중</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Icons.Plus size={20} className="text-gray-400 mx-auto mb-0.5" />
                          <span className="text-[13px] text-sub">추가</span>
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
                  type="button"
                  onClick={handleSaveReview}
                  disabled={savingReview || reviewImageUploading}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#0c0c0e] px-5 text-[16px] font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingReview ? '저장 중...' : editingReview ? '수정' : '작성'}
                </button>
            </div>
            </div>
            <div className="shrink-0 border-t border-line p-4 flex justify-end">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink">
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-[18px] max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
            <div className="flex items-center gap-2 mb-6">
                <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-none px-2 text-[13px] font-semibold bg-royal text-white">
                  {selectedPost.category}
                </span>
                {selectedPost.category === '프로그램 후기' && selectedPost.rating && (
                  <div className="flex items-center gap-1">
                    {renderStars(selectedPost.rating)}
                  </div>
                )}
              </div>

            <div>
              <h2 className="mb-4 text-[20px] font-bold leading-snug text-ink">{selectedPost.title}</h2>
              
              <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line pb-4 text-[14px] text-sub">
                <span className="flex items-center gap-1">
                  <Icons.User size={16} />
                  {selectedPost.authorName || '익명'}
                </span>
                <span className="flex items-center gap-1">
                  <Icons.Calendar size={16} />
                  {selectedPost.createdAt?.toDate?.().toLocaleDateString() || '-'}
                </span>
                {selectedPost.seminarTitle && (
                  <span className="flex items-center gap-1 text-royal">
                    <Icons.Tag size={16} />
                    {selectedPost.seminarTitle}
                  </span>
                )}
              </div>

              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{selectedPost.content}</p>
              </div>

              {/* 후기 이미지 */}
              {selectedPost.reviewImages && selectedPost.reviewImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-3 text-[15px] font-semibold text-ink">첨부 이미지</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedPost.reviewImages.map((img, idx) => (
                      <img key={idx} src={img} alt={`후기 이미지 ${idx + 1}`} className="h-32 w-full border border-line object-cover" loading="lazy" decoding="async" />
                    ))}
                  </div>
                </div>
              )}

              {selectedPost.category === '프로그램 후기' && (
                  <button
                    onClick={() => { setSelectedPost(null); openEditReviewModal(selectedPost); }}
                    className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0c0c0e] px-5 text-[16px] font-bold text-white transition-colors hover:bg-black"
                  >
                    <Icons.Edit2 size={18} />
                    수정
                  </button>
                )}
                <button
                  onClick={() => { handleDelete(selectedPost.id); setSelectedPost(null); }}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 text-[16px] font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  <Icons.Trash2 size={18} />
                  삭제
                </button>
            </div>
            </div>
            <div className="shrink-0 border-t border-line p-4 flex justify-end">
              <button type="button" onClick={() => setSelectedPost(null)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink">
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
