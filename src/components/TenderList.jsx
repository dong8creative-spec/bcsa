import React, { useState } from 'react';
import { useTenders } from '../hooks/useTenders';
import * as Icons from 'lucide-react';

export const TenderList = () => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  
  const { tenders, loading, error } = useTenders(searchKeyword, 50);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchKeyword(filterKeyword);
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length < 12) return '-';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const min = dateStr.substring(10, 12);
    return `${year}-${month}-${day} ${hour}:${min}`;
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('ko-KR').format(price) + '원';
  };

  const filteredTenders = tenders.filter(tender => {
    if (filterInstitution && (!tender.ntceInsttNm || !tender.ntceInsttNm.includes(filterInstitution))) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                공고명 검색
              </label>
              <input
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="키워드를 입력하세요"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                기관명 필터
              </label>
              <input
                type="text"
                value={filterInstitution}
                onChange={(e) => setFilterInstitution(e.target.value)}
                placeholder="기관명을 입력하세요"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 w-full md:w-auto px-6 py-2 bg-brand text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
          >
            <Icons.Search className="inline-block mr-2" size={18} />
            검색
          </button>
        </div>
      </form>

      {/* 로딩 상태 */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <Icons.AlertCircle className="inline-block mr-2" size={20} />
          오류: {error}
        </div>
      )}

      {/* 결과 목록 */}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-dark">
              검색 결과: {filteredTenders.length}건
            </h2>
          </div>

          {filteredTenders.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <Icons.Search className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-gray-600">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTenders.map((tender) => (
                <div
                  key={tender.id}
                  className="bg-white rounded-2xl shadow-card p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-dark flex-1">
                      {tender.bidNtceNm || '-'}
                    </h3>
                    <span className="ml-4 px-3 py-1 bg-brand/10 text-brand rounded-lg text-sm font-bold">
                      {tender.bidNtceInsttClsfNm || '일반'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Icons.Building2 size={16} className="text-gray-400" />
                      <span className="font-medium">공고기관:</span>
                      <span>{tender.ntceInsttNm || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Icons.DollarSign size={16} className="text-gray-400" />
                      <span className="font-medium">예산:</span>
                      <span>{formatPrice(tender.asignBdgtAmt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Icons.Calendar size={16} className="text-gray-400" />
                      <span className="font-medium">등록:</span>
                      <span>{formatDate(tender.bidNtceDt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Icons.Clock size={16} className="text-gray-400" />
                      <span className="font-medium">마감:</span>
                      <span>{formatDate(tender.bidClseDt)}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      공고번호: {tender.bidNtceNo || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
