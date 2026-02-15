import React from 'react';
import { TenderSearchFilter } from '../components/TenderSearchFilter';
import PageTitle from '../components/PageTitle';

export const TenderTestView = ({ onBack, pageTitles }) => {
  const handleSearchResult = (data) => {
    console.log('검색 결과:', data);
  };

  return (
    <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in overflow-y-auto min-h-0">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="w-full text-center md:text-left">
            <PageTitle pageKey="tenderTest" pageTitles={pageTitles} defaultText="나라장터 입찰공고 검색 테스트" />
            <p className="text-gray-500 text-sm">나라장터 API 연동 테스트 페이지입니다.</p>
            <p className="text-gray-500 text-xs mt-1">
              검색 조건·API 안내:{' '}
              <a href="https://data.g2b.go.kr" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">조달데이터허브</a>
              {' '}(나라장터 입찰공고정보서비스 — 목록/상세조회 API)
            </p>
          </div>
          {onBack && (
            <div className="w-full flex justify-end md:justify-start">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                메인으로
              </button>
            </div>
          )}
        </div>

        <TenderSearchFilter onSearchResult={handleSearchResult} />
      </div>
    </div>
  );
};
