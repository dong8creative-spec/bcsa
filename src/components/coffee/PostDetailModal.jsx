import React, { useEffect, useRef, useState } from 'react';
import coffeeChatService, { won, ratingOf, toMs } from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcAvatar, CcNote, CcError, ccBtn } from './ui';

const dateLabel = (ts) => {
    const ms = toMs(ts);
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
};

const STEPS = [['problem', '1. 문제 상황'], ['solution', '2. 해결 과정'], ['result', '3. 결과']];

/** 노하우 글 상세 — 창 이름 'post' {postId} */
export default function PostDetailModal({ postId, onClose, depth }) {
    const cc = useCoffeeChat();
    const [post, setPost] = useState(undefined); // undefined: 불러오는 중, null: 없음
    const [senior, setSenior] = useState(undefined);
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');
    const [confirmDel, setConfirmDel] = useState(false);
    const viewed = useRef(false);

    useEffect(() => (postId ? coffeeChatService.subscribePost(postId, setPost) : (setPost(null), undefined)), [postId]);
    useEffect(() => {
        if (!postId || viewed.current) return;
        viewed.current = true;
        coffeeChatService.addView(postId);
    }, [postId]);
    const authorUid = post?.authorUid;
    useEffect(() => (authorUid ? coffeeChatService.subscribeSenior(authorUid, setSenior) : undefined), [authorUid]);
    useEffect(() => {
        if (!cc.uid || !postId) { setLiked(false); setSaved(false); return undefined; }
        let alive = true;
        coffeeChatService.isLiked(postId, cc.uid).then((v) => { if (alive) setLiked(v); }).catch(() => {});
        coffeeChatService.isSaved(postId, cc.uid).then((v) => { if (alive) setSaved(v); }).catch(() => {});
        return () => { alive = false; };
    }, [postId, cc.uid]);

    const mine = !!post && !!cc.uid && post.authorUid === cc.uid;
    const price = Number(senior?.prices?.online30) || Number(post?.authorPrice) || 0;
    const canApply = senior?.status === 'approved';

    const toggleLike = async () => {
        if (!cc.requireLogin() || busy) return;
        const next = !liked;
        setBusy('like'); setErr(''); setLiked(next);
        try { await coffeeChatService.setLike(postId, cc.uid, next); } catch (e) { setLiked(!next); setErr('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
        setBusy('');
    };
    const toggleSave = async () => {
        if (!cc.requireLogin() || busy) return;
        const next = !saved;
        setBusy('save'); setErr(''); setSaved(next);
        try { await coffeeChatService.setSaved(postId, cc.uid, next); } catch (e) { setSaved(!next); setErr('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
        setBusy('');
    };
    const doDelete = async () => {
        setBusy('delete'); setErr('');
        try { await coffeeChatService.deletePost(postId); onClose(); } catch (e) { setErr('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'); setBusy(''); }
    };

    const footer = post ? (
        confirmDel ? (
            <div className="w-0 min-w-full">
                <p className="mb-2.5 text-[15px] text-ink">이 글을 지울까요? 지운 글은 되돌릴 수 없어요.</p>
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={ccBtn.line} onClick={() => setConfirmDel(false)} disabled={busy === 'delete'}>그대로 두기</button>
                    <button type="button" className="inline-flex h-[52px] w-full items-center justify-center rounded-lg bg-red-600 px-5 text-[16px] font-bold text-white disabled:opacity-40" onClick={doDelete} disabled={busy === 'delete'}>
                        {busy === 'delete' ? '지우는 중…' : '삭제하기'}
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex w-0 min-w-full items-center gap-2">
                <button type="button" aria-label="좋아요" aria-pressed={liked} onClick={toggleLike} disabled={busy === 'like'}
                    className={`flex h-[52px] w-14 shrink-0 flex-col items-center justify-center rounded-lg border ${liked ? 'border-royal text-royal' : 'border-line2 text-ink'}`}>
                    <span aria-hidden="true" className="text-[18px] leading-none">{liked ? '♥' : '♡'}</span>
                    <span className="mt-0.5 text-[12.5px] leading-none">{Number(post.likeCount) || 0}</span>
                </button>
                <button type="button" aria-label="글 저장" aria-pressed={saved} onClick={toggleSave} disabled={busy === 'save'}
                    className={`flex h-[52px] w-14 shrink-0 flex-col items-center justify-center rounded-lg border ${saved ? 'border-royal text-royal' : 'border-line2 text-ink'}`}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z" /></svg>
                    <span className="mt-0.5 text-[12.5px] leading-none">{saved ? '저장됨' : '저장'}</span>
                </button>
                {mine ? (
                    <>
                        <button type="button" className={`${ccBtn.primary} min-w-0 flex-1`} onClick={() => cc.open('editor', { postId })}>글 고치기</button>
                        <button type="button" className={`${ccBtn.danger} h-[52px] shrink-0`} onClick={() => setConfirmDel(true)}>삭제</button>
                    </>
                ) : canApply ? (
                    <button type="button" className={`${ccBtn.royal} min-w-0 flex-1 flex-col px-3 leading-tight`} onClick={() => cc.open('apply', { seniorUid: post.authorUid, postId })}>
                        <span className="truncate">1:1 커피챗 신청</span>
                        {price ? <span className="truncate text-[13px] font-semibold opacity-90">30분 · {won(price)}</span> : null}
                    </button>
                ) : null}
            </div>
        )
    ) : null;

    const r = ratingOf(senior);
    return (
        <CcModal title="노하우 상세" onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} footer={footer}><div className="w-0 min-w-full">
            {post === undefined ? <p className="py-10 text-center text-[15px] text-sub" role="status">불러오는 중…</p> : null}
            {post === null ? <CcNote>글을 찾을 수 없어요. 작성한 선배가 지웠거나 아직 공개되지 않은 글이에요.</CcNote> : null}
            {post ? (
                <article>
                    <div className="mb-2 flex items-center gap-2">
                        <CcTag tone="sky">#{post.topic}</CcTag>
                        {post.status === 'draft' ? <CcTag tone="muted">임시저장</CcTag> : null}
                    </div>
                    <h3 className="text-[21px] font-bold leading-[1.4] text-ink">{post.title}</h3>
                    <p className="mt-2 text-[13px] text-sub">
                        {dateLabel(post.createdAt)} · 조회 {Number(post.viewCount) || 0} · <span aria-hidden="true" className="text-royal">♥</span><span className="sr-only">좋아요</span> {Number(post.likeCount) || 0}
                    </p>
                    {post.imageUrl ? (
                        <div className="mt-4 aspect-[3/2] overflow-hidden border border-line bg-card">
                            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                    ) : null}

                    <div className="mt-5 space-y-3">
                        {STEPS.map(([k, label]) => (
                            <section key={k} className="border border-line px-4 py-4">
                                <h4 className="mb-2 text-[16px] font-semibold text-ink">{label}</h4>
                                <p className="whitespace-pre-line break-words text-[15px] leading-[1.75] text-[#333]">{post[k] || '-'}</p>
                            </section>
                        ))}
                    </div>

                    <section className="mt-5" aria-label="작성한 선배">
                        <h4 className="mb-2 text-[15px] font-semibold text-ink">작성한 선배</h4>
                        <button type="button" onClick={() => cc.open('senior', { uid: post.authorUid })}
                            className="flex w-full items-center gap-3 bg-card px-4 py-3.5 text-left">
                            <CcAvatar src={senior?.photoUrl || post.author?.photoUrl} name={senior?.name || post.author?.name} size={56} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[17px] font-semibold text-ink">{senior?.name || post.author?.name} 선배</p>
                                <p className="truncate text-[14px] text-sub">{[senior?.bizName || post.author?.bizName, senior?.area || post.author?.area].filter(Boolean).join(' · ')}</p>
                                <p className="text-[14px] text-ink">
                                    {senior?.years || post.author?.years}년차
                                    <span className="text-sub"> · </span><span aria-hidden="true" className="text-royal">★</span> {r !== null ? r.toFixed(1) : '-'}
                                    <span className="text-sub"> (후기 {Number(senior?.ratingCount) || 0})</span>
                                </p>
                            </div>
                            <span aria-hidden="true" className="shrink-0 text-[18px] text-sub">›</span>
                        </button>
                        {!mine && senior && senior.status === 'approved' && senior.accepting === false ? <p className="mt-2 text-[14px] text-sub">이 선배는 지금 커피챗 신청을 받지 않아요.</p> : null}
                    </section>
                    <CcError>{err}</CcError>
                </article>
            ) : null}
        </div></CcModal>
    );
}
