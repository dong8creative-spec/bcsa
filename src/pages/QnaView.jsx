import React, { useMemo, useState } from 'react';
import { MgWrap, MgPageHead, MgSectionHead, MgTabs } from '../components/mg/Mg';

/**
 * QnaView — 전문가 Q&A 페이지 (1단계: 목업 콘텐츠 그대로)
 *
 * bcsa_bento/qa.html 목업을 그대로 이식한 정적 버전이다. 실제 질문 등록/답변 기능은
 * 2단계(실데이터 연동)에서 추가할 예정이며, 그 전까지는 목업과 동일한 예시 데이터를 보여준다.
 */

const QUESTIONS = [
    { category: '세무', badgeClass: 'text-royal', bg: '#E7A6A0', title: '간이과세자에서 일반과세자로 바뀌면 가장 먼저 챙길 게 뭔가요?', meta: '✓ 답변 3 · 조회 128 · 3시간 전' },
    { category: '마케팅', badgeClass: 'text-royal', bg: '#EBBB8C', title: '네이버 플레이스 광고를 월 30만원부터 시작해도 효과가 있을까요?', meta: '✓ 답변 7 · 조회 246 · 오늘' },
    { category: '지원사업', badgeClass: 'text-royal', bg: '#E9D48C', title: '창업 5년차인데 부산에서 신청 가능한 마케팅 지원사업이 있을까요?', meta: '✓ 답변 2 · 조회 94 · 오늘' },
    { category: '노무', badgeClass: 'text-royal', bg: '#A9CB9B', title: '직원을 처음 채용하는데 4대보험 신고는 언제까지 해야 하나요?', meta: '✓ 답변 5 · 조회 61 · 어제' },
    { category: '세무', badgeClass: 'text-royal', bg: '#9DC3E0', title: '간이과세 매출 기준이 올해 바뀌었다고 들었는데 정확한 기준이 궁금합니다.', meta: '답변 대기중 · 조회 33 · 방금 전' },
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
        <div className="min-h-screen overflow-y-auto bg-white">
            <MgPageHead
                crumbs={
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-white">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span> Q&amp;A
                    </>
                }
                eyebrow="EXPERT Q&A"
                title={<>혼자 고민하지 마세요,<br />가장 가까운 답</>}
                desc="지역 전문가와 실제 사업자의 경험이 쌓이는 지식 커뮤니티입니다."
            />

            <section className="py-14 md:py-20" aria-labelledby="qna-list">
                <MgWrap>
                    <MgSectionHead id="qna-list" title="최근 질문" extra={<span className="text-[13px] text-sub">최신순</span>} />
                    <MgTabs className="mb-2 mt-[26px]" label="질문 분류" value={category} onChange={setCategory} items={CATEGORIES.map((c) => [c, c])} />
                    {filtered.length > 0 ? (
                        <ul className="border-t border-[#0c0c0e]">
                            {filtered.map((q) => (
                                <li key={q.title} className="border-b border-line py-5 md:py-6">
                                    <span className={`text-[14px] font-semibold ${q.badgeClass}`}>{q.category}</span>
                                    <p className="mt-1.5 break-keep text-[16px] font-semibold leading-snug text-ink md:text-[17px]">{q.title}</p>
                                    <p className="mt-1.5 text-[14px] text-sub">{q.meta}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">해당 카테고리의 질문이 아직 없습니다.</p>
                    )}
                    <p className="mt-6 break-keep text-[13px] text-sub">※ 위 항목은 준비 중인 예시 데이터입니다. 실제 질문/답변 기능은 순차 적용될 예정입니다.</p>
                </MgWrap>
            </section>

            <section className="bg-sky py-10 md:py-[60px]" aria-labelledby="qna-ask">
                <MgWrap>
                    <div className="mx-auto max-w-[760px] rounded-[18px] border border-skyLine bg-white px-5 pb-8 pt-9 md:px-[60px] md:pb-12 md:pt-14">
                        <h2 id="qna-ask" className="break-keep text-center text-[22px] font-bold tracking-tight text-ink md:text-[28px]">사업하면서 지금 가장 막힌 게 뭔가요?</h2>
                        <p className="mt-2.5 break-keep text-center text-[15px] text-sub">질문을 남기면 카테고리에 맞는 전문가와 사업자가 답할 수 있도록 연결합니다.</p>
                        <label htmlFor="qna-question" className="mb-2.5 mt-7 block text-[14px] font-bold text-[#1a1a1a]">질문 내용</label>
                        <textarea
                            id="qna-question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="예: 직원 한 명을 처음 채용하려고 하는데 4대보험부터 어떻게 준비해야 하나요?"
                            className="h-32 w-full resize-none rounded-lg border border-line2 p-4 text-[15px] text-[#222] outline-none focus:border-royal"
                        />
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="mt-5 h-[53px] w-full rounded-lg bg-[#1a1a1a] text-[17px] font-bold tracking-tight text-white transition-colors hover:bg-black"
                        >
                            질문 등록하기
                        </button>
                    </div>
                </MgWrap>
            </section>
        </div>
    );
}
