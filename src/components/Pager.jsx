import React from 'react';

/**
 * Pager — 10개씩 페이지네이션되는 목록(뉴스, 지원사업 등)에서 공통으로 쓰는 페이지 번호 버튼.
 */
export default function Pager({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-6">
            <button
                type="button"
                onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="text-xs font-semibold rounded-full px-3 py-2 bg-soft text-gray-600 hover:bg-[#eceef2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                이전
            </button>
            {pages.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onChange(p)}
                    className={`text-xs font-semibold rounded-full w-8 h-8 transition-colors ${p === page ? 'bg-brand text-white' : 'bg-soft text-gray-600 hover:bg-[#eceef2]'}`}
                >
                    {p}
                </button>
            ))}
            <button
                type="button"
                onClick={() => onChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="text-xs font-semibold rounded-full px-3 py-2 bg-soft text-gray-600 hover:bg-[#eceef2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                다음
            </button>
        </div>
    );
}
