import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_TYPES, won, ratingOf, seniorBadges, toMs } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcAvatar, CcNote, ccBtn } from './ui';

const dateLabel = (ts) => {
    const ms = toMs(ts);
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function SectionTitle({ children, aside }) {
    return (
        <div className="mb-2.5 mt-7 flex items-end justify-between gap-2">
            <h4 className="text-[17px] font-semibold text-ink">{children}</h4>
            {aside ? <span className="text-[13px] text-sub">{aside}</span> : null}
        </div>
    );
}

/** 선배 프로필 — 창 이름 'senior' {uid} */
export default function SeniorProfileModal({ uid, onClose, depth }) {
    const cc = useCoffeeChat();
    const [s, setS] = useState(undefined);
    const [reviews, setReviews] = useState([]);
    const [posts, setPosts] = useState([]);
    const [shownReviews, setShownReviews] = useState(10);

    useEffect(() => (uid ? coffeeChatService.subscribeSenior(uid, setS) : (setS(null), undefined)), [uid]);
    useEffect(() => (uid ? coffeeChatService.subscribeReviews(uid, setReviews) : undefined), [uid]);
    useEffect(() => coffeeChatService.subscribePublishedPosts((all) => setPosts(all.filter((p) => p.authorUid === uid))), [uid]);

    const mine = !!cc.uid && cc.uid === uid;
    const badges = useMemo(() => (s ? seniorBadges(s) : []), [s]);
    const r = ratingOf(s);
    const accepting = s?.accepting !== false;
    const visible = s && (s.status === 'approved' || mine);

    const footer = visible ? (
        mine ? (
            <button type="button" className={ccBtn.primary} onClick={() => cc.open('register', {})}>내 프로필 고치기</button>
        ) : (
            <button type="button" className={ccBtn.royal} disabled={!accepting} onClick={() => cc.open('apply', { seniorUid: uid })}>커피챗 신청하기</button>
        )
    ) : null;

    return (
        <CcModal title="선배 프로필" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} footer={footer}><div className="w-0 min-w-full">
            {s === undefined ? <p className="py-10 text-center text-[15px] text-sub" role="status">불러오는 중…</p> : null}
            {s !== undefined && !visible ? <CcNote>선배 정보를 찾을 수 없어요. 아직 심사 중이거나 활동을 멈춘 선배예요.</CcNote> : null}
            {visible ? (
                <div>
                    {mine && s.status !== 'approved' ? (
                        <div className="mb-4"><CcNote title={s.status === 'pending' ? '선배 등록 심사 중' : '선배 등록 반려'}>
                            {s.status === 'pending' ? '운영진이 확인하면 다른 회원에게 공개돼요.' : `${s.rejectReason || '등록 내용을 고쳐 다시 신청해 주세요.'}`}
                        </CcNote></div>
                    ) : null}

                    <div className="flex items-start gap-4">
                        <CcAvatar src={s.photoUrl} name={s.name} size={80} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-[20px] font-bold text-ink">{s.name} 선배</h3>
                                {s.status === 'approved' ? <CcTag tone="royal">인증 선배</CcTag> : null}
                            </div>
                            <p className="mt-0.5 text-[15px] text-ink">{s.bizName}</p>
                            <p className="text-[14px] text-sub">{[s.industry, s.area, `${s.years}년차`].filter(Boolean).join(' · ')}</p>
                        </div>
                    </div>
                    {(s.topics || []).length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">{s.topics.map((t) => <CcTag key={t}>#{t}</CcTag>)}</div>
                    ) : null}
                    {s.intro ? <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-[1.7] text-[#333]">{s.intro}</p> : null}

                    <dl className="mt-5 grid grid-cols-4 border border-line">
                        {[
                            ['완료 커피챗', `${Number(s.completedCount) || 0}회`],
                            ['평점', r !== null ? r.toFixed(1) : '-'],
                            ['연결된 후배', `${Number(s.connectedCount) || 0}명`],
                            ['후기', `${Number(s.ratingCount) || reviews.length || 0}개`],
                        ].map(([k, v], i) => (
                            <div key={k} className={`flex flex-col items-center justify-center px-1 py-3 ${i ? 'border-l border-line' : ''}`}>
                                <dt className="text-[12.5px] text-sub">{k}</dt>
                                <dd className="mt-0.5 text-[17px] font-semibold text-ink">{k === '평점' && r !== null ? <><span aria-hidden="true" className="text-royal">★</span>{v}</> : v}</dd>
                            </div>
                        ))}
                    </dl>

                    <SectionTitle aside={accepting ? null : '지금은 신청을 받지 않아요'}>커피챗 가격</SectionTitle>
                    <div className="grid grid-cols-2 gap-2">
                        {['online30', 'visit60'].map((t) => (
                            <div key={t} className={`flex h-full flex-col bg-card px-3.5 py-3 ${accepting ? '' : 'opacity-60'}`}>
                                <p className="text-[14px] font-semibold text-ink">{CC_TYPES[t].short}</p>
                                <p className="mt-0.5 line-clamp-2 min-h-[2.9em] text-[13px] leading-[1.45] text-sub">{CC_TYPES[t].desc}</p>
                                <p className="mt-auto pt-1.5 text-[18px] font-bold text-ink">{s.prices?.[t] ? won(s.prices[t]) : '-'}</p>
                            </div>
                        ))}
                    </div>
                    {!accepting ? <p className="mt-2 text-[14px] text-sub">이 선배는 지금 커피챗 신청을 받지 않아요.</p> : null}

                    <SectionTitle aside={`${badges.filter((b) => b.earned).length}/${badges.length}개 획득`}>활동 뱃지</SectionTitle>
                    <ul className="grid grid-cols-2 gap-2">
                        {badges.map((b) => (
                            <li key={b.key} className={`flex h-full flex-col border px-3.5 py-3 ${b.earned ? 'border-royal' : 'border-line'}`}>
                                <div className="flex items-center justify-between gap-1.5">
                                    <p className="truncate text-[15px] font-semibold text-ink">{b.label}</p>
                                    <CcTag tone={b.earned ? 'royal' : 'muted'}>{b.earned ? '획득' : '진행 중'}</CcTag>
                                </div>
                                <p className="mt-1 line-clamp-2 min-h-[2.9em] text-[13px] leading-[1.45] text-sub">{b.desc}</p>
                                {!b.earned && b.goal ? (
                                    <div className="mt-auto pt-2">
                                        <div className="h-1.5 w-full bg-[#e9e9e9]" role="progressbar" aria-label={`${b.label} 진행`} aria-valuemin={0} aria-valuemax={b.goal} aria-valuenow={b.progress}>
                                            <div className="h-full bg-royal" style={{ width: `${Math.round((b.progress / b.goal) * 100)}%` }} />
                                        </div>
                                        <p className="mt-1 text-[12.5px] text-sub">{b.progress}/{b.goal}{b.key === 'rating' && b.rating !== null && b.rating !== undefined ? ` · 평점 ${b.rating.toFixed(1)}` : ''}</p>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>

                    <SectionTitle aside={reviews.length ? `${reviews.length}개` : null}>후기</SectionTitle>
                    {!reviews.length ? <p className="bg-card px-4 py-4 text-[15px] text-sub">아직 후기가 없어요.</p> : (
                        <ul className="divide-y divide-line border-y border-line">
                            {reviews.slice(0, shownReviews).map((rv) => (
                                <li key={rv.id} className="py-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] text-royal" aria-label={`별점 ${rv.rating}점`}>{'★'.repeat(Number(rv.rating) || 0)}<span className="text-[#cfcfcf]">{'★'.repeat(Math.max(0, 5 - (Number(rv.rating) || 0)))}</span></span>
                                        <span className="text-[14px] text-ink">{rv.juniorName || '후배'}</span>
                                        <span className="ml-auto text-[13px] text-sub">{dateLabel(rv.createdAt)}</span>
                                    </div>
                                    {(rv.tags || []).length ? <div className="mt-1.5 flex flex-wrap gap-1">{rv.tags.map((t) => <CcTag key={t}>#{t}</CcTag>)}</div> : null}
                                    <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-[1.65] text-[#333]">{rv.text}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    {reviews.length > shownReviews ? (
                        <button type="button" className={`${ccBtn.line} mt-3`} onClick={() => setShownReviews((n) => n + 10)}>후기 더보기 ({reviews.length - shownReviews})</button>
                    ) : null}

                    <SectionTitle aside={posts.length ? `${posts.length}개` : null}>이 선배의 노하우</SectionTitle>
                    {!posts.length ? <p className="bg-card px-4 py-4 text-[15px] text-sub">아직 쓴 노하우 글이 없어요.</p> : (
                        <ul className="divide-y divide-line border-y border-line">
                            {posts.map((p) => (
                                <li key={p.id}>
                                    <button type="button" className="flex w-full items-center gap-2 py-3.5 text-left" onClick={() => cc.open('post', { postId: p.id })}>
                                        <CcTag>#{p.topic}</CcTag>
                                        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.title}</span>
                                        <span aria-hidden="true" className="shrink-0 text-sub">›</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div></CcModal>
    );
}
