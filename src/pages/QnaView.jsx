import React, { useMemo, useState } from 'react';

/**
 * QnaView — 전문가 Q&A 페이지 (1단계: 목업 콘텐츠 그대로)
 *
 * bcsa_bento/qa.html 목업을 그대로 이식한 정적 버전이다. 실제 질문 등록/답변 기능은
 * 2단계(실데이터 연동)에서 추가할 예정이며, 그 전까지는 목업과 동일한 예시 데이터를 보여준다.
 */

const QUESTIONS = [
    { category: '세무', badgeClass: 'bg-purple-600', bg: '#E7A6A0', title: '간이과세자에서 일반과세자로 바뀌면 가장 먼저 챙길 게 뭔가요?', meta: '✓ 답변 3 · 조회 128 · 3시간 전' },
    { category: '마케팅', badgeClass: 'bg-orange-500', bg: '#EBBB8C', title: '네이버 플레이스 광고를 월 30만원부터 시작해도 효과가 있을까요?', meta: '✓ 답변 7 · 조회 246 · 오늘' },
    { category: '지원사업', badgeClass: 'bg-sky-500', bg: '#E9D48C', title: '창업 5년차인데 부산에서 신청 가능한 마케팅 지원사업이 있을까요?', meta: '✓ 답변 2 · 조회 94 · 오늘' },
    { category: '노무', badgeClass: 'bg-emerald-600', bg: '#A9CB9B', title: '직원을 처음 채용하는데 4대보험 신고는 언제까지 해야 하나요?', meta: '✓ 답변 5 · 조회 61 · 어제' },
    { category: '세무', badgeClass: 'bg-purple-600', bg: '#9DC3E0', title: '간이과세 매출 기준이 올해 바뀌었다고 들었는데 정확한 기준이 궁금합니다.', meta: '답변 대기중 · 조회 33 · 방금 전' },
];

const CATEGORIES = ['전체', '세무', '마케팅', '지원사업', '노무'];

export default function QnaView({ onBack }) {
    const [category, setCategory] = useState('전체');
    const [question, setQuestion] = useState('');

    const filtered = useMemo(
        () => (category === '전체' ? QUESTIONS : QUESTIONS.filter((q) => q.category === category)),
        [category]
    );

    const handleSubmit = () => {
        if (!question.trim()) {
            alert('질문 내용을 입력해주세요.');
            return;
        }
        alert('질문 등록 기능은 준비 중입니다. 조금만 기다려주세요!');
    };

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> Q&amp;A
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">EXPERT Q&amp;A</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">
                        혼자 고민하지 마세요,<br />가장 가까운 답
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">
                        지역 전문가와 실제 사업자의 경험이 쌓이는 지식 커뮤니티입니다.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-8">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCategory(c)}
                                className={`text-xs font-semibold rounded-full px-3.5 py-2 transition-colors ${category === c ? 'text-white bg-brand' : 'text-gray-500 bg-soft hover:bg-[#eceef2]'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="pb-10 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-semibold text-dark">최근 질문</h2>
                        <span className="text-xs text-gray-400">최신순</span>
                    </div>
                    {filtered.length > 0 ? (
                        <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
                            {filtered.map((q) => (
                                <a
                                    key={q.title}
                                    href="#"
                                    onClick={(e) => e.preventDefault()}
                                    className="group shrink-0 w-[220px] sm:w-[240px] transition-transform duration-300 hover:-translate-y-1"
                                >
                                    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3 grid place-items-center" style={{ background: q.bg }}>
                                        <span className={`absolute top-3 left-3 inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap ${q.badgeClass}`}>{q.category}</span>
                                        <span className="text-5xl font-black text-black/10">?</span>
                                    </div>
                                    <p className="text-sm font-semibold leading-snug break-keep line-clamp-2 min-h-[2.5em] text-dark group-hover:text-brand transition-colors">{q.title}</p>
                                    <p className="text-xs text-gray-500 mt-1">{q.meta}</p>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-gray-400 bg-soft rounded-2xl">
                            <p className="text-sm">해당 카테고리의 질문이 아직 없습니다.</p>
                        </div>
                    )}
                    <p className="text-center text-xs text-gray-400 mt-8">※ 위 항목은 준비 중인 예시 데이터입니다. 실제 질문/답변 기능은 순차 적용될 예정입니다.</p>
                </div>
            </section>

            <section className="px-6 pb-24 md:pb-32">
                <div
                    className="max-w-[760px] mx-auto rounded-[32px] p-8 md:p-10 text-white relative overflow-hidden border border-white/10"
                    style={{ background: 'linear-gradient(160deg,#0b0b0c,#071a37 90%)' }}
                >
                    <span className="absolute -right-4 -bottom-14 text-[190px] font-bold text-white/[0.04] select-none leading-none pointer-events-none">?</span>
                    <h3 className="relative z-10 text-xl md:text-2xl font-semibold mb-2 break-keep text-white">사업하면서 지금 가장 막힌 게 뭔가요?</h3>
                    <p className="relative z-10 text-sm text-white/50 break-keep">질문을 남기면 카테고리에 맞는 전문가와 사업자가 답할 수 있도록 연결합니다.</p>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="예: 직원 한 명을 처음 채용하려고 하는데 4대보험부터 어떻게 준비해야 하나요?"
                        className="relative z-10 w-full h-28 my-5 border border-white/10 bg-white/5 outline-none rounded-2xl p-3.5 resize-none text-sm text-white placeholder:text-white/30"
                    />
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="relative z-10 w-full border-0 bg-brand hover:bg-[#00327a] transition-colors text-white font-semibold rounded-xl py-3"
                    >
                        질문 등록하기
                    </button>
                </div>
            </section>
        </div>
    );
}
