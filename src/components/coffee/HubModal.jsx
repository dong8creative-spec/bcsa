import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_TOPICS, CC_INDUSTRIES, won, ratingOf, toMs } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcChip, CcAvatar, CcNote, ccBtn, ccInput } from './ui';
import { MgTabs } from '../mg/Mg';

/** 「n일 전」 (오늘이면 「오늘」, 두 달이 넘으면 날짜) */
const agoLabel = (ts) => {
    const ms = toMs(ts);
    if (!ms) return '';
    const days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 0) return '오늘';
    if (days < 60) return `${days}일 전`;
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const selectCls = `${ccInput} h-12 pr-8`;

/** 단계별 안내(탭마다 따로) — 머리줄 「단계별 안내」 버튼, 처음 한 번 자동 */
const TOUR_FEED = {
    id: 'hub-feed',
    steps: [
        { title: '선배 커피챗은 이런 곳이에요', body: '업력 3년 이상 선배 사장님의 실전 노하우를 읽고, 궁금한 점은 1:1 유료 커피챗으로 직접 물어볼 수 있어요.' },
        { target: 'hub-tabs', title: '두 가지 보기', body: '「선배 노하우」는 선배들이 쓴 글 모음이고, 「선배 찾기」는 커피챗을 신청할 선배 목록이에요.' },
        { target: 'hub-my', title: '내 커피챗', body: '내가 낸 신청과 진행 상황을 여기서 봐요. 선배라면 받은 신청과 정산도 함께 볼 수 있어요.' },
        { target: 'hub-senior-box', title: '선배 사장님 자리', body: '업력 3년 이상이면 여기서 선배로 등록해요. 운영진이 승인하면 「작성」으로 노하우 글을 올릴 수 있어요.' },
        { target: 'hub-topics', title: '원하는 글만 골라 보기', body: '주제 칩을 눌러 보세요. 아래 칸에서 업종을 고르거나 상권(예: 전포동)을 검색해도 맞는 글만 보여요.' },
        { target: 'hub-post-card', title: '노하우 글 한 편', body: '글은 문제→해결→결과 3단계로 쓰여 있어요. 카드를 누르면 전체 글을 읽고 좋아요·저장도 할 수 있어요.' },
        { target: 'hub-post-apply', title: '바로 물어보기', body: '「선배와 대화 →」를 누르면 이 글을 쓴 선배에게 보낼 커피챗 신청서가 열려요. 결제는 신청할 때 미리 해요.' },
    ],
};
const TOUR_SENIORS = {
    id: 'hub-seniors',
    steps: [
        { title: '선배 찾기', body: '운영진이 승인한 선배 사장님 목록이에요. 나와 맞는 선배를 골라 1:1 커피챗을 신청할 수 있어요.' },
        { target: 'hub-s-filters', title: '주제·업종으로 거르기', body: '고민 주제 칩과 업종을 고르면 그 분야 선배만 보여요. 커피챗을 많이 마친 선배가 위에 나와요.' },
        { target: 'hub-senior-card', title: '선배 카드', body: '사진 옆에 상호·상권, 업종·업력이 보여요. # 표시는 선배가 잘 아는 주제예요.' },
        { target: 'hub-senior-rating', title: '평점과 완료 횟수', body: '★ 평점은 후배들이 남긴 별점 평균이에요. 후기 수와 마친 커피챗 횟수도 함께 보세요.' },
        { target: 'hub-senior-price', title: '가격 두 가지', body: '30분 비대면(오픈채팅 보이스톡·화상)과 60분 매장 방문 가격이에요. 선배마다 5천 원 단위로 정해요.' },
        { target: 'hub-my', title: '내 커피챗', body: '내가 낸 신청과 진행 상황은 여기서 확인해요.' },
        { target: 'hub-senior-card', title: '선배를 골랐다면', body: '카드를 누르면 선배 프로필이 열려요. 후기를 읽어 보고 아래 「커피챗 신청하기」를 누르면 신청서가 나와요.' },
    ],
};

/**
 * 선배 커피챗 첫 창: 「선배 노하우」(지식피드) · 「선배 찾기」
 * 창 이름 'hub' {tab:'feed'|'seniors'}
 */
export default function HubModal({ tab: initialTab = 'feed', onClose, depth }) {
    const cc = useCoffeeChat();
    const [tab, setTab] = useState(initialTab === 'seniors' ? 'seniors' : 'feed');

    // 노하우 글
    const [posts, setPosts] = useState(null);
    const [topic, setTopic] = useState('');
    const [industry, setIndustry] = useState('');
    const [area, setArea] = useState('');
    useEffect(() => coffeeChatService.subscribePublishedPosts(setPosts), []);

    // 선배 목록(선배 찾기 탭을 처음 열 때 불러온다)
    const [seniors, setSeniors] = useState(null);
    const [sTopic, setSTopic] = useState('');
    const [sIndustry, setSIndustry] = useState('');
    const wantSeniors = tab === 'seniors' || seniors !== null;
    useEffect(() => (wantSeniors ? coffeeChatService.subscribeApprovedSeniors(setSeniors) : undefined), [wantSeniors]);

    const shownPosts = useMemo(() => {
        const q = area.trim();
        return (posts || []).filter((p) => (!topic || p.topic === topic)
            && (!industry || p.author?.industry === industry)
            && (!q || String(p.author?.area || '').includes(q)));
    }, [posts, topic, industry, area]);

    const shownSeniors = useMemo(() => (seniors || [])
        .filter((s) => (!sIndustry || s.industry === sIndustry) && (!sTopic || (s.topics || []).includes(sTopic)))
        .sort((a, b) => (Number(b.completedCount) || 0) - (Number(a.completedCount) || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
    [seniors, sIndustry, sTopic]);

    const goRegister = () => { if (cc.requireLogin()) cc.open('register', {}); };
    const mySenior = cc.mySenior;

    return (
        <CcModal title="선배 커피챗" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} wide
            tour={tab === 'feed' ? (posts !== null ? TOUR_FEED : undefined) : (seniors !== null ? TOUR_SENIORS : undefined)}><div className="w-0 min-w-full">
            <div className="mb-4 flex items-center justify-between gap-3">
                <p className="min-w-0 text-[15px] leading-snug text-sub">먼저 가 본 선배 사장님의 실전 노하우를 읽고, 1:1로 물어보세요.</p>
                {cc.uid ? (
                    <button type="button" data-tour="hub-my" className={`${ccBtn.small} shrink-0`} onClick={() => cc.open('center', { tab: cc.isSenior ? 'received' : 'mine' })}>내 커피챗</button>
                ) : null}
            </div>

            <div data-tour="hub-tabs"><MgTabs label="선배 커피챗 보기" value={tab} onChange={setTab} items={[['feed', '선배 노하우'], ['seniors', '선배 찾기']]} className="mb-5" /></div>

            {tab === 'feed' ? (
                <div role="tabpanel" aria-label="선배 노하우">
                    {/* 선배 칸: 승인된 선배면 글쓰기, 아니면 선배 등록 */}
                    {mySenior === undefined && cc.uid ? null : cc.isSenior ? (
                        <div data-tour="hub-senior-box" className="mb-5 flex items-center gap-3 rounded-xl bg-sky px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-semibold text-ink">선배 사장님, 내 노하우 공유하기</p>
                                <p className="mt-0.5 text-[14px] leading-snug text-[#1d2a55]">후배 창업자의 길잡이가 되고, 1:1 커피챗으로 이어져요.</p>
                            </div>
                            <button type="button" className={`${ccBtn.smallDark} shrink-0`} onClick={() => cc.open('editor', {})}>작성</button>
                        </div>
                    ) : mySenior?.status === 'pending' ? (
                        <div data-tour="hub-senior-box" className="mb-5 flex items-center gap-3 rounded-xl bg-sky px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-semibold text-ink">선배 등록 심사 중</p>
                                <p className="mt-0.5 text-[14px] leading-snug text-[#1d2a55]">운영진이 확인하면 노하우 글을 쓰고 커피챗 신청을 받을 수 있어요.</p>
                            </div>
                            <button type="button" className={`${ccBtn.small} shrink-0`} onClick={() => cc.open('register', {})}>등록 내용 보기</button>
                        </div>
                    ) : (
                        <div data-tour="hub-senior-box" className="mb-5 flex items-center gap-3 rounded-xl bg-sky px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-semibold text-ink">업력 3년 이상 사장님이신가요?</p>
                                <p className="mt-0.5 text-[14px] leading-snug text-[#1d2a55]">
                                    {mySenior?.status === 'rejected' ? `등록이 반려되었어요.${mySenior.rejectReason ? ` (${mySenior.rejectReason})` : ''} 고쳐서 다시 신청할 수 있어요.` : '노하우를 나누고 유료 커피챗으로 후배를 도와주세요.'}
                                </p>
                            </div>
                            <button type="button" className={`${ccBtn.smallDark} shrink-0`} onClick={goRegister}>선배로 등록하기</button>
                        </div>
                    )}

                    <div data-tour="hub-topics" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="주제">
                        <span className="shrink-0"><CcChip on={!topic} onClick={() => setTopic('')}>전체</CcChip></span>
                        {CC_TOPICS.map((t) => <span key={t} className="shrink-0"><CcChip on={topic === t} onClick={() => setTopic(t)}>#{t}</CcChip></span>)}
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor="cc-hub-industry" className="sr-only">업종</label>
                            <select id="cc-hub-industry" className={selectCls} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                                <option value="">업종 전체</option>
                                {CC_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="cc-hub-area" className="sr-only">상권 검색</label>
                            <input id="cc-hub-area" type="search" className={`${ccInput} h-12`} placeholder="상권 검색 (예: 전포동)" value={area} onChange={(e) => setArea(e.target.value)} />
                        </div>
                    </div>
                    <p className="mb-3 text-[14px] text-sub" aria-live="polite">총 {shownPosts.length}개 실전팁</p>

                    {posts === null ? <p className="py-10 text-center text-[15px] text-sub" role="status">불러오는 중…</p> : null}
                    {posts !== null && !shownPosts.length ? (
                        <CcNote>{posts.length ? '조건에 맞는 노하우가 없어요. 주제나 업종을 바꿔 보세요.' : '아직 올라온 노하우가 없어요. 선배 사장님의 첫 글을 기다리고 있어요.'}</CcNote>
                    ) : null}
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {shownPosts.map((p) => <li key={p.id} className="flex"><PostCard post={p} cc={cc} /></li>)}
                    </ul>
                </div>
            ) : (
                <div role="tabpanel" aria-label="선배 찾기">
                    <div data-tour="hub-s-filters" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="주제">
                        <span className="shrink-0"><CcChip on={!sTopic} onClick={() => setSTopic('')}>전체</CcChip></span>
                        {CC_TOPICS.map((t) => <span key={t} className="shrink-0"><CcChip on={sTopic === t} onClick={() => setSTopic(t)}>#{t}</CcChip></span>)}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="cc-hub-s-industry" className="sr-only">업종</label>
                        <select id="cc-hub-s-industry" className={selectCls} value={sIndustry} onChange={(e) => setSIndustry(e.target.value)}>
                            <option value="">업종 전체</option>
                            {CC_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                        </select>
                    </div>
                    <p className="mb-3 text-[14px] text-sub" aria-live="polite">선배 {shownSeniors.length}명</p>
                    {seniors === null ? <p className="py-10 text-center text-[15px] text-sub" role="status">불러오는 중…</p> : null}
                    {seniors !== null && !shownSeniors.length ? (
                        <CcNote>{seniors.length ? '조건에 맞는 선배가 없어요. 주제나 업종을 바꿔 보세요.' : '아직 등록된 선배가 없어요. 업력 3년 이상이라면 첫 선배가 되어 주세요.'}</CcNote>
                    ) : null}
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {shownSeniors.map((s) => <li key={s.id} className="flex"><SeniorCard senior={s} me={s.id === cc.uid} onOpen={() => cc.open('senior', { uid: s.id })} /></li>)}
                    </ul>
                </div>
            )}
        </div></CcModal>
    );
}

function PostCard({ post, cc }) {
    const a = post.author || {};
    const openPost = () => cc.open('post', { postId: post.id });
    return (
        <article data-tour="hub-post-card" className="flex w-full cursor-pointer flex-col border border-line bg-white p-4" onClick={openPost}>
            <div className="mb-2 flex items-center gap-2">
                <CcTag tone="sky">#{post.topic}</CcTag>
                <span className="min-w-0 flex-1 truncate text-[13px] text-sub">{a.area}</span>
                <span className="shrink-0 text-[13px] text-sub">{agoLabel(post.createdAt)}</span>
            </div>
            <h3 className="text-[17px] font-semibold leading-[1.4] text-ink">
                <button type="button" className="block w-full text-left" onClick={(e) => { e.stopPropagation(); openPost(); }}>
                    <span className="line-clamp-2 min-h-[2.8em]">{post.title}</span>
                </button>
            </h3>
            <p className="mt-1.5 line-clamp-2 min-h-[3.2em] text-[15px] leading-[1.6] text-sub">{post.problem || ' '}</p>
            <div className="mt-3 flex items-center gap-2.5 bg-card px-3 py-2.5">
                <CcAvatar src={a.photoUrl} name={a.name} size={40} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{a.name} 선배 <span className="font-normal text-sub">· {a.years}년차</span></p>
                    <p className="truncate text-[13px] text-sub">{[a.industry, a.area].filter(Boolean).join(' · ')}</p>
                </div>
                {post.authorPrice ? (
                    <div className="shrink-0 text-right">
                        <p className="text-[12.5px] text-sub">30분 커피챗</p>
                        <p className="text-[15px] font-semibold text-ink">{won(post.authorPrice)}</p>
                    </div>
                ) : null}
            </div>
            <div className="mt-auto flex items-center gap-3 pt-3">
                <span className="text-[14px] text-sub"><span aria-hidden="true" className="text-royal">♥</span> <span className="sr-only">좋아요 </span>{Number(post.likeCount) || 0}</span>
                <span className="text-[14px] text-sub">조회 {Number(post.viewCount) || 0}</span>
                <button type="button" data-tour="hub-post-apply" className={`${ccBtn.smallDark} ml-auto`} onClick={(e) => { e.stopPropagation(); cc.open('apply', { seniorUid: post.authorUid, postId: post.id }); }}>선배와 대화 →</button>
            </div>
        </article>
    );
}

function SeniorCard({ senior: s, me, onOpen }) {
    const r = ratingOf(s);
    return (
        <button type="button" data-tour="hub-senior-card" onClick={onOpen} className="flex w-full flex-col border border-line bg-white p-4 text-left">
            <div className="flex w-full items-start gap-3">
                <CcAvatar src={s.photoUrl} name={s.name} size={56} />
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[17px] font-semibold text-ink">
                        <span className="truncate">{s.name} 선배</span>
                        {me ? <CcTag tone="royal">나</CcTag> : null}
                    </p>
                    <p className="truncate text-[14px] text-sub">{[s.bizName, s.area].filter(Boolean).join(' · ')}</p>
                    <p className="truncate text-[14px] text-sub">{s.industry} · {s.years}년차</p>
                </div>
            </div>
            <div className="mt-2.5 flex h-6 w-full gap-1.5 overflow-hidden">
                {(s.topics || []).map((t) => <CcTag key={t}>#{t}</CcTag>)}
            </div>
            <p data-tour="hub-senior-rating" className="mt-2.5 text-[14px] text-ink">
                <span className="text-royal" aria-hidden="true">★</span> {r !== null ? r.toFixed(1) : '-'}<span className="text-sub">(후기 {Number(s.ratingCount) || 0})</span>
                <span className="text-sub"> · 완료 {Number(s.completedCount) || 0}회</span>
            </p>
            <div data-tour="hub-senior-price" className="mt-auto grid w-full grid-cols-2 gap-2 pt-3">
                <div className="bg-card px-3 py-2">
                    <p className="text-[12.5px] text-sub">30분 비대면</p>
                    <p className="text-[15px] font-semibold text-ink">{s.prices?.online30 ? won(s.prices.online30) : '-'}</p>
                </div>
                <div className="bg-card px-3 py-2">
                    <p className="text-[12.5px] text-sub">60분 매장 방문</p>
                    <p className="text-[15px] font-semibold text-ink">{s.prices?.visit60 ? won(s.prices.visit60) : '-'}</p>
                </div>
            </div>
            {s.accepting === false ? <p className="mt-2 text-[13px] text-sub">지금은 신청을 받지 않아요</p> : null}
        </button>
    );
}
