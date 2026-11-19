import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MgPageHead, MgWrap, MgCard, MgInfoTable } from '../components/mg/Mg';
import { useCoffeeChat } from '../components/coffee/CoffeeChatProvider';
import { topicService, parseTopicBody, topicDateLabel, topicImages } from '../services/topicService';

/**
 * 토픽(대표자 인터뷰) — /topics 목록, /topics/:id 본문. 글은 관리자 화면 「토픽(인터뷰)」에서 쓴다.
 */
export default function TopicsView() {
    const location = useLocation();
    const m = location.pathname.replace(/\/$/, '').match(/^\/topics\/([^/]+)$/);
    return m ? <TopicDetail id={decodeURIComponent(m[1])} /> : <TopicList />;
}

function TopicList() {
    const navigate = useNavigate();
    const [rows, setRows] = useState(null);
    useEffect(() => topicService.subscribePublished(setRows), []);
    return (
        <div className="bg-white">
            <MgPageHead eyebrow="Topic" title="토픽" desc="먼저 가본 대표들을 만나 사업 이야기를 듣고 기록합니다." />
            <MgWrap className="pb-20 pt-12 md:pt-16">
                {rows === null ? (
                    <p className="py-12 text-center text-[15px] text-sub">불러오는 중…</p>
                ) : rows.length === 0 ? (
                    <p className="rounded-xl bg-card px-5 py-12 text-center text-[15px] text-sub">첫 인터뷰를 준비하고 있어요.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-8 md:grid-cols-3 md:gap-x-3">
                        {rows.map((t) => (
                            <MgCard key={t.id} image={topicImages(t)[0]?.url || '/assets/images/home/hero.jpg'} state="대표 인터뷰"
                                title={t.title}
                                meta={<>{[t.interviewee, t.company].filter(Boolean).join(' · ')}<br />{topicDateLabel(t)}</>}
                                onClick={() => { navigate(`/topics/${t.id}`); window.scrollTo({ top: 0 }); }} />
                        ))}
                    </div>
                )}
                <CoffeeChatLink />
            </MgWrap>
        </div>
    );
}

/** 토픽 아래: 현직 선배들이 직접 쓴 노하우·1:1 커피챗(창)으로 이어지는 칸 */
function CoffeeChatLink() {
    const cc = useCoffeeChat();
    if (!cc) return null;
    return (
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card px-5 py-5 md:px-6">
            <div className="min-w-0">
                <p className="text-[18px] font-bold text-ink">선배 사장님들이 직접 쓴 노하우</p>
                <p className="mt-1 text-[14px] text-sub">문제 상황 → 해결 과정 → 결과로 정리한 실전 팁. 궁금하면 1:1 커피챗으로 물어보세요.</p>
            </div>
            <button type="button" onClick={() => cc.open('hub', { tab: 'feed' })} className="h-12 shrink-0 rounded-lg bg-[#0c0c0e] px-5 text-[16px] font-bold text-white">선배 노하우 보기</button>
        </div>
    );
}

function TopicDetail({ id }) {
    const navigate = useNavigate();
    const [t, setT] = useState(undefined);
    useEffect(() => topicService.subscribeOne(id, setT), [id]);
    const back = (e) => { e.preventDefault(); navigate('/topics'); window.scrollTo({ top: 0 }); };
    if (t === undefined) return <div className="min-h-[60vh] bg-white pt-40 text-center text-[15px] text-sub">불러오는 중…</div>;
    if (t === null) {
        return (
            <div className="bg-white">
                <MgPageHead title="인터뷰를 찾을 수 없어요" desc="지워졌거나 아직 공개되지 않은 글입니다." />
                <MgWrap className="py-12"><a href="/topics" onClick={back} className="inline-flex h-12 items-center rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white">토픽 목록으로</a></MgWrap>
            </div>
        );
    }
    const blocks = parseTopicBody(t.body);
    const [cover, ...more] = topicImages(t);
    return (
        <div className="bg-white">
            <MgPageHead
                crumbs={<nav aria-label="경로"><a href="/topics" onClick={back} className="hover:text-white">토픽</a><span className="mx-1.5" aria-hidden="true">/</span>대표 인터뷰</nav>}
                eyebrow={t.status === 'draft' ? '임시저장 (관리자만 보임)' : '대표 인터뷰'}
                title={t.title} desc={t.summary} />
            <MgWrap className="pb-20 pt-10 md:pt-14">
                <article className="mx-auto max-w-[760px]">
                    {cover ? <img src={cover.url} alt={`${t.interviewee || '대표'} 인터뷰 대표 사진`} className="mb-8 aspect-[3/2] w-full border border-line object-cover" decoding="async" /> : null}
                    <MgInfoTable className="mb-10" rows={[['대표', t.interviewee], ['회사', t.company], ['소개', t.role], ['날짜', topicDateLabel(t)]]} />
                    <div className="space-y-5 text-[17px] leading-[1.85] text-[#222]">
                        {blocks.map((b, i) => (b.type === 'q' ? (
                            <h2 key={i} className="pt-4 text-[19px] font-bold leading-snug text-ink"><span className="mr-2 text-royal">Q.</span>{b.text}</h2>
                        ) : (
                            <p key={i} className="whitespace-pre-line break-keep">{b.text}</p>
                        )))}
                    </div>
                    {more.length ? (
                        <section className="mt-12" aria-label="인터뷰 사진">
                            <ul className="grid grid-cols-2 gap-2.5 md:gap-3">
                                {more.map((im, i) => (
                                    <li key={im.url + i} className="aspect-[3/2] overflow-hidden border border-line bg-[#f6f6f6]">
                                        <a href={im.url} target="_blank" rel="noopener noreferrer" aria-label={`사진 ${i + 2} 크게 보기`}>
                                            <img src={im.url} alt={`${t.interviewee || '대표'} 인터뷰 사진 ${i + 2}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                    <div className="mt-14 border-t border-line pt-6">
                        <a href="/topics" onClick={back} className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-[15px] font-semibold text-ink hover:border-ink">← 토픽 목록</a>
                    </div>
                </article>
            </MgWrap>
        </div>
    );
}
