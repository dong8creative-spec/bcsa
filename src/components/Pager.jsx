import React from 'react';

const BLOCK_SIZE = 5;
const numBtn = "min-w-[44px] h-11 px-2 text-[15px] font-semibold rounded-lg border border-line bg-white text-ink hover:border-ink transition-colors";
const navBtn = "h-11 px-3.5 text-[15px] font-semibold rounded-lg border border-line bg-white text-ink hover:border-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Pager — 목록(뉴스, 지원사업 등)에서 공통으로 쓰는 페이지 번호 버튼.
 * 페이지 번호는 BLOCK_SIZE(5)개씩 묶음으로 보여준다 (1~5, 6~10 …). 묶음 밖으로 넘어가면 다음 묶음이 나온다.
 * 예전에는 totalPages를 전부 그려서 뉴스처럼 64페이지짜리 목록에서 버튼이 64개 한 줄에
 * 다 나열됐다 — 처음/끝 이동 버튼도 없어서 뒷페이지로 가려면 "다음"을 63번 눌러야 했다.
 */
export default function Pager({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;

    const start = Math.floor((page - 1) / BLOCK_SIZE) * BLOCK_SIZE + 1;
    const end = Math.min(start + BLOCK_SIZE - 1, totalPages);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-6">
            {start > 1 && (
                <button type="button" onClick={() => onChange(1)} className={navBtn}>처음</button>
            )}
            <button
                type="button"
                onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className={navBtn}
            >
                이전
            </button>
            {pages.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onChange(p)}
                    aria-current={p === page ? 'page' : undefined}
                    className={`${numBtn} ${p === page ? '!bg-[#0c0c0e] !text-white !border-[#0c0c0e]' : ''}`}
                >
                    {p}
                </button>
            ))}
            <button
                type="button"
                onClick={() => onChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={navBtn}
            >
                다음
            </button>
            {end < totalPages && (
                <button type="button" onClick={() => onChange(totalPages)} className={navBtn}>끝</button>
            )}
        </div>
    );
}
