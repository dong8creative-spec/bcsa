import React, { useEffect, useState } from 'react';
import coffeeChatService, { CC_TOPICS } from '../../services/coffeeChatService';
import { uploadImage } from '../../utils/imageUtils';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcSegment, CcField, CcNote, CcError, ccBtn, ccInput } from './ui';

/** 노하우 글 쓰기·고치기 (창 이름 'editor', 받는 값 {postId?}). 승인된 선배만 */

const STEPS = [
    ['problem', '문제 상황', '현실적 배경', '어떤 위기나 현실적인 어려움이 있었나요? (예: 갑작스러운 재계약 임대료 인상 요구, 오픈 초기 극심한 매출 부진 등)'],
    ['solution', '해결 과정', '구체적 시도', '어떤 구체적인 방법이나 시도로 극복하셨나요? (발로 뛴 데이터, 거래처 협상, 마케팅 액션 등)'],
    ['result', '결과', '핵심 교훈', '최종 결과와 후배 사장님들에게 꼭 전하고 싶은 핵심 교훈은 무엇인가요?'],
];
const EMPTY = { topic: '', title: '', problem: '', solution: '', result: '', imageUrl: '' };

/** 단계별 안내 — 머리줄 「단계별 안내」 버튼, 처음 한 번 자동 */
const TOUR = {
    id: 'post-editor',
    steps: [
        { title: '노하우 글 쓰기', body: '직접 겪은 실전 경험을 문제→해결→결과 3단계로 정리해 올리는 화면이에요. 승인된 선배만 쓸 수 있어요.' },
        { target: 'ed-topic', title: '주제 고르기', body: '마케팅·브랜딩, AI·업무효율화, 재무·세무, 위기극복 중 1개를 골라 주세요. 후배들이 주제로 글을 찾아요.' },
        { target: 'ed-title', title: '제목', body: '50자까지 쓸 수 있어요. 어떤 일을 어떻게 해냈는지 한눈에 보이게 써 주세요.' },
        { target: 'ed-problem', title: '1단계 문제 상황', body: '어떤 어려움이 있었는지 써 주세요. 단계마다 1,500자까지 쓸 수 있어요.' },
        { target: 'ed-solution', title: '2·3단계 해결과 결과', body: '어떻게 풀었는지 구체적으로 쓰고, 이어서 「결과」 칸에 최종 결과와 꼭 전하고 싶은 교훈을 적어 주세요.' },
        { target: 'ed-photo', title: '사진 1장', body: '가게나 자료 사진을 1장 붙일 수 있어요. 10MB 이하 사진만 올라가요. 없어도 괜찮아요.' },
        { target: 'ed-draft', title: '임시저장', body: '다 못 썼다면 「임시저장」을 눌러 두세요. 주제와 제목만 있으면 저장되고, 공개되지 않아요.' },
        { target: 'ed-publish', title: '발행하기', body: '세 단계를 모두 채우고 누르면 공개돼요(고칠 때는 「수정 완료하기」). 글을 읽은 후배가 바로 커피챗을 신청할 수 있어요.' },
    ],
};

export default function PostEditorModal({ postId, onClose, depth }) {
    const cc = useCoffeeChat();
    const [form, setForm] = useState(EMPTY);
    const [post, setPost] = useState(postId ? undefined : null); // undefined: 불러오는 중
    const [filled, setFilled] = useState(!postId);
    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => (postId && cc.uid ? coffeeChatService.subscribePost(postId, setPost) : undefined), [postId, cc.uid]);
    useEffect(() => {
        if (filled || !post) return;
        setForm({ topic: post.topic || '', title: post.title || '', problem: post.problem || '', solution: post.solution || '', result: post.result || '', imageUrl: post.imageUrl || '' });
        setFilled(true);
    }, [post, filled]);

    if (!cc.uid) return null;

    const isEdit = !!postId;
    const title = isEdit ? '글 수정' : '새 글 작성';
    const senior = cc.mySenior;
    const notMine = isEdit && post && post.authorUid !== cc.uid;
    const ready = cc.isSenior && (!isEdit || (post && !notMine && filled));

    const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setErr(''); };

    const onPhoto = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)) { setErr('사진 파일만 올릴 수 있어요.'); return; }
        if (file.size > 10 * 1024 * 1024) { setErr('사진은 10MB 이하로 올려 주세요.'); return; }
        setUploading(true); setErr('');
        try {
            const url = await uploadImage(file, 'community');
            setForm((f) => ({ ...f, imageUrl: url || '' }));
        } catch (x) {
            setErr(x?.message || '사진을 올리지 못했어요.');
        } finally {
            setUploading(false);
        }
    };

    const save = async (status) => {
        if (!CC_TOPICS.includes(form.topic)) { setErr('주제 태그를 1개 골라 주세요.'); return; }
        if (!form.title.trim()) { setErr('제목을 써 주세요.'); return; }
        if (status === 'published') {
            const empty = STEPS.find(([k]) => !form[k].trim());
            if (empty) { setErr(`「${empty[1]}」을(를) 써 주세요.`); return; }
        }
        if (uploading) { setErr('사진을 올리는 중이에요. 잠시만 기다려 주세요.'); return; }
        setBusy(true); setErr('');
        try {
            const id = await coffeeChatService.savePost(postId || null, { ...form, status }, { ...senior, uid: senior?.uid || cc.uid });
            if (status === 'published' && !isEdit) cc.replace('post', { postId: id });
            else onClose?.();
        } catch (x) {
            setErr(x?.message || '저장하지 못했어요.');
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true); setErr('');
        try {
            await coffeeChatService.deletePost(postId);
            onClose?.();
        } catch (x) {
            setErr(x?.message || '삭제하지 못했어요.');
            setBusy(false);
        }
    };

    let guard = null;
    if (senior === undefined || (isEdit && post === undefined)) guard = <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p>;
    else if (!cc.isSenior) {
        guard = (
            <div className="space-y-3">
                <CcNote tone="alert">{senior ? '운영진 승인 후 노하우 글을 쓸 수 있어요.' : '노하우 글은 승인된 선배 사장만 쓸 수 있어요.'}</CcNote>
                {!senior ? <button type="button" className={ccBtn.line} onClick={() => cc.replace('register')}>선배로 등록하기</button> : null}
            </div>
        );
    } else if (isEdit && !post) guard = <CcNote tone="alert">글을 찾을 수 없어요. 이미 삭제된 글일 수 있어요.</CcNote>;
    else if (notMine) guard = <CcNote tone="alert">내가 쓴 글만 고칠 수 있어요.</CcNote>;

    return (
        <CcModal title={title} onClose={onClose} onBack={depth > 0 ? onClose : undefined} depth={depth} tour={ready ? TOUR : undefined}
            footer={ready ? (
                <button type="button" data-tour="ed-publish" className={ccBtn.primary} onClick={() => save('published')} disabled={busy || uploading}>
                    {busy ? '저장하는 중…' : isEdit ? '수정 완료하기' : '발행하기'}
                </button>
            ) : null}>
            {guard}
            {ready ? (
                <div>
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <CcTag tone="sky">선배 사장 전용 작성 공간</CcTag>
                        <div className="flex gap-2">
                            {isEdit ? <button type="button" className={ccBtn.danger} onClick={() => setConfirmDel(true)} disabled={busy}>삭제</button> : null}
                            <button type="button" data-tour="ed-draft" className={ccBtn.small} onClick={() => save('draft')} disabled={busy || uploading}>임시저장</button>
                        </div>
                    </div>
                    {confirmDel ? (
                        <div className="mb-4 border border-red-200 bg-red-50 p-4">
                            <p className="text-[15px] text-red-700">이 글을 삭제할까요? 삭제하면 되돌릴 수 없어요.</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" className={ccBtn.line} onClick={() => setConfirmDel(false)} disabled={busy}>돌아가기</button>
                                <button type="button" className={ccBtn.primary} onClick={remove} disabled={busy}>{busy ? '삭제하는 중…' : '삭제 확정'}</button>
                            </div>
                        </div>
                    ) : null}
                    {isEdit && post?.status === 'draft' ? <p className="mb-3 text-[15px] text-sub">지금은 임시저장 상태예요. 「수정 완료하기」를 누르면 공개돼요.</p> : null}

                    <CcNote title="선배 사장님만의 실전 노하우를 들려주세요">골목 현장에서 직접 겪은 생생한 발자취가 후배 사장님들의 든든한 나침반이 돼요.</CcNote>

                    <div className="mt-5">
                        <CcField label="주제 태그 선택" required counter="필수 택1">
                            <div data-tour="ed-topic"><CcSegment label="주제 태그" cols={2} value={form.topic} onChange={set('topic')} items={CC_TOPICS.map((t) => [t, `#${t}`])} /></div>
                        </CcField>
                        <CcField label="제목" required htmlFor="cc-ed-title" counter={`${form.title.length}/50자`}>
                            <input id="cc-ed-title" data-tour="ed-title" value={form.title} maxLength={50} onChange={(e) => set('title')(e.target.value)}
                                placeholder="예: 오픈 3개월 차 인스타 마케팅 성공기" className={`${ccInput} h-12`} />
                        </CcField>
                    </div>

                    <h3 className="mb-3 mt-2 text-[17px] font-bold text-ink">실전 노하우 3단계 작성</h3>
                    {STEPS.map(([k, label, sub, ph], i) => (
                        <section key={k} data-tour={k === 'result' ? undefined : `ed-${k}`} className="mb-3 border border-line p-4">
                            <CcField label={label} required htmlFor={`cc-ed-${k}`} counter={`${i + 1}단계 · ${sub}`}
                                hint={`${form[k].length}/1500자${form[k].trim().length < 20 ? ' · 20자 이상 쓰면 더 잘 전해져요' : ''}`}>
                                <textarea id={`cc-ed-${k}`} value={form[k]} maxLength={1500} rows={5} onChange={(e) => set(k)(e.target.value)}
                                    placeholder={ph} className={`${ccInput} min-h-[132px] py-3 leading-relaxed`} />
                            </CcField>
                        </section>
                    ))}

                    <div data-tour="ed-photo" className="mb-5 mt-4">
                        <label htmlFor="cc-ed-photo" className="mb-2 block text-[15px] font-semibold text-ink">사진 1장(선택)</label>
                        {form.imageUrl ? <img src={form.imageUrl} alt="첨부한 사진" className="mb-2 aspect-[3/2] w-full border border-line object-cover" /> : null}
                        <div className="flex flex-wrap gap-2">
                            <input id="cc-ed-photo" type="file" accept="image/*" onChange={onPhoto} disabled={uploading} className="sr-only" />
                            <label htmlFor="cc-ed-photo" aria-hidden="true" className={`${ccBtn.small} cursor-pointer`}>{uploading ? '올리는 중…' : form.imageUrl ? '사진 바꾸기' : '사진 올리기'}</label>
                            {form.imageUrl ? <button type="button" className={ccBtn.small} onClick={() => set('imageUrl')('')}>사진 빼기</button> : null}
                        </div>
                    </div>

                    <CcNote>작성하신 글은 후배 창업자 노하우 목록에 보이고 1:1 커피챗 신청으로 이어져요.</CcNote>
                    <CcError>{err}</CcError>
                </div>
            ) : null}
        </CcModal>
    );
}
