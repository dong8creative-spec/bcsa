import React, { useEffect, useMemo, useState } from 'react';
import { topicService, parseTopicBody, topicDateLabel, topicImages, TOPIC_MAX_IMAGES } from '../../../services/topicService';
import { uploadImageForAdminWithMeta } from '../../../utils/imageUtils';

/**
 * 관리자 「토픽(인터뷰)」 — 대표자 인터뷰를 쓰고 고치고 지운다. 사이트 /topics 에 공개 글만 보인다.
 * 본문 쓰는 법: 빈 줄로 문단을 나누고, 질문 줄은 「Q.」로 시작한다(답은 그냥 쓰거나 「A.」로 시작).
 */
const emptyForm = () => ({
    title: '', interviewee: '', company: '', role: '', summary: '', body: '',
    images: [], status: 'draft', publishedLocal: new Date().toISOString().slice(0, 10),
});
const toDateInput = (t) => {
    const v = t?.publishedAt; const ms = v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : 0);
    if (!ms) return new Date().toISOString().slice(0, 10);
    const d = new Date(ms); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const input = 'w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] text-ink focus:border-royal focus:outline-none';

export const TopicManagement = () => {
    const [rows, setRows] = useState(null);
    const [editingId, setEditingId] = useState(null); // null: 목록, 'new': 새 글, id: 고치기
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [confirmId, setConfirmId] = useState(null);

    useEffect(() => topicService.subscribeAllAdmin(setRows), []);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const preview = useMemo(() => parseTopicBody(form.body), [form.body]);

    const openNew = () => { setForm(emptyForm()); setEditingId('new'); setMsg(''); };
    const openEdit = (t) => {
        setForm({ ...emptyForm(), ...Object.fromEntries(Object.keys(emptyForm()).map((k) => [k, t[k] ?? emptyForm()[k]])), images: topicImages(t), publishedLocal: toDateInput(t) });
        setEditingId(t.id); setMsg('');
    };

    // 사진: 여러 장 한꺼번에 고를 수 있고, 모두 합쳐 최대 10장. 첫 장이 대표 사진
    const onPhotos = async (e) => {
        const files = [...(e.target.files || [])]; e.target.value = '';
        if (!files.length) return;
        const room = TOPIC_MAX_IMAGES - form.images.length;
        const pick = files.slice(0, Math.max(0, room));
        if (!pick.length) { setMsg(`사진은 최대 ${TOPIC_MAX_IMAGES}장까지 올릴 수 있어요.`); return; }
        setBusy(true);
        const done = []; let fail = 0;
        for (let i = 0; i < pick.length; i += 1) {
            setMsg(`사진 올리는 중… (${i + 1}/${pick.length})`);
            try { const { url, deleteUrl } = await uploadImageForAdminWithMeta(pick[i]); done.push({ url, deleteUrl: deleteUrl || '' }); } catch { fail += 1; }
        }
        setForm((f) => ({ ...f, images: [...f.images, ...done].slice(0, TOPIC_MAX_IMAGES) }));
        setMsg([`사진 ${done.length}장을 올렸습니다.`, fail ? `${fail}장은 올리지 못했습니다.` : '', files.length > pick.length ? `최대 ${TOPIC_MAX_IMAGES}장이라 ${files.length - pick.length}장은 빼었습니다.` : ''].filter(Boolean).join(' '));
        setBusy(false);
    };
    const moveImage = (i, d) => setForm((f) => { const a = [...f.images]; const j = i + d; if (j < 0 || j >= a.length) return f; [a[i], a[j]] = [a[j], a[i]]; return { ...f, images: a }; });
    const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, k) => k !== i) }));

    const save = async (status) => {
        if (!form.title.trim() || !form.interviewee.trim()) { setMsg('제목과 대표 이름은 꼭 넣어 주세요.'); return; }
        if (status === 'published' && !form.body.trim()) { setMsg('공개하려면 본문을 써 주세요.'); return; }
        setBusy(true); setMsg('');
        const data = { ...form, status, publishedAt: new Date(`${form.publishedLocal}T09:00:00`) };
        try {
            if (editingId === 'new') await topicService.create(data); else await topicService.update(editingId, data);
            setEditingId(null); setMsg(status === 'published' ? '공개했습니다. 사이트 「토픽」에 보입니다.' : '임시저장했습니다(사이트에는 안 보임).');
        } catch (err) { setMsg(`저장하지 못했습니다: ${err.message || err}`); }
        setBusy(false);
    };

    const remove = async (id) => {
        setBusy(true);
        try { await topicService.remove(id); setMsg('지웠습니다.'); } catch (err) { setMsg(`지우지 못했습니다: ${err.message || err}`); }
        setConfirmId(null); setBusy(false);
    };

    if (editingId) {
        return (
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[22px] font-bold text-ink md:text-[24px]">{editingId === 'new' ? '새 인터뷰 쓰기' : '인터뷰 고치기'}</h2>
                    <button type="button" onClick={() => setEditingId(null)} className="inline-flex h-11 items-center rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink">목록으로</button>
                </div>
                {msg ? <p className="rounded-lg bg-[#e8f1fd] px-4 py-3 text-[15px]" role="status">{msg}</p> : null}
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-line bg-white p-4 md:p-5">
                        <label className="block text-[15px] font-semibold text-ink">제목 *<input className={`${input} mt-1.5`} value={form.title} onChange={set('title')} maxLength={120} placeholder="예: 동네 카페 8년, 단골이 먼저 알려 준 것" /></label>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-[15px] font-semibold text-ink">대표 이름 *<input className={`${input} mt-1.5`} value={form.interviewee} onChange={set('interviewee')} maxLength={40} /></label>
                            <label className="block text-[15px] font-semibold text-ink">회사·가게 이름<input className={`${input} mt-1.5`} value={form.company} onChange={set('company')} maxLength={60} /></label>
                        </div>
                        <label className="block text-[15px] font-semibold text-ink">소개 한 줄<input className={`${input} mt-1.5`} value={form.role} onChange={set('role')} maxLength={80} placeholder="예: 대표 · 수영구 카페 운영 8년차" /></label>
                        <label className="block text-[15px] font-semibold text-ink">요약(목록·공유 미리보기)<textarea className={`${input} mt-1.5 h-20`} value={form.summary} onChange={set('summary')} maxLength={300} /></label>
                        <label className="block text-[15px] font-semibold text-ink">날짜<input type="date" className={`${input} mt-1.5`} value={form.publishedLocal} onChange={set('publishedLocal')} /></label>
                        <div>
                            <p className="text-[15px] font-semibold text-ink">사진 <span className="font-normal text-sub">({form.images.length}/{TOPIC_MAX_IMAGES}장 · 첫 장이 대표 사진)</span></p>
                            {form.images.length ? (
                                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {form.images.map((im, i) => (
                                        <li key={im.url + i} className="flex h-full flex-col border border-line bg-white">
                                            <div className="relative aspect-[3/2] bg-card">
                                                <img src={im.url} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
                                                {i === 0 ? <span className="absolute left-0 top-0 bg-royal px-1.5 py-0.5 text-[12px] text-white">대표</span> : null}
                                            </div>
                                            <div className="mt-auto grid grid-cols-3 border-t border-line text-[14px]">
                                                <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label={`사진 ${i + 1} 앞으로`} className="h-10 disabled:opacity-30">←</button>
                                                <button type="button" onClick={() => removeImage(i)} aria-label={`사진 ${i + 1} 빼기`} className="h-10 border-x border-line text-red-600">빼기</button>
                                                <button type="button" onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1} aria-label={`사진 ${i + 1} 뒤로`} className="h-10 disabled:opacity-30">→</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {form.images.length < TOPIC_MAX_IMAGES ? (
                                <label className="mt-2 inline-flex h-11 cursor-pointer items-center rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink focus-within:border-royal">
                                    사진 올리기 (여러 장 선택 가능)
                                    <input type="file" accept="image/*" multiple className="sr-only" onChange={onPhotos} disabled={busy} aria-label="토픽 사진 올리기" />
                                </label>
                            ) : <p className="mt-2 text-[14px] text-sub">사진은 최대 {TOPIC_MAX_IMAGES}장입니다. 바꾸려면 먼저 한 장을 빼 주세요.</p>}
                        </div>
                        <label className="block text-[15px] font-semibold text-ink">본문 *
                            <span className="mt-1 block text-[14px] font-normal text-sub">빈 줄로 문단을 나눕니다. 질문은 「Q.」로 시작하면 굵게 보입니다.</span>
                            <textarea className={`${input} mt-1.5 h-96 leading-relaxed`} value={form.body} onChange={set('body')} placeholder={'Q. 처음 가게를 연 계기가 무엇인가요?\n\n회사를 그만두고…\n\nQ. 가장 힘들었던 때는요?\n\n…'} />
                        </label>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" disabled={busy} onClick={() => save('published')} className="h-12 rounded-lg bg-[#0c0c0e] px-6 text-[16px] font-bold text-white hover:bg-black disabled:opacity-50">공개하기</button>
                            <button type="button" disabled={busy} onClick={() => save('draft')} className="h-12 rounded-lg border border-line2 bg-white px-6 text-[16px] font-semibold text-ink hover:border-ink disabled:opacity-50">임시저장</button>
                        </div>
                    </div>
                    <div className="min-w-0 rounded-xl bg-card p-4 md:p-5">
                        <p className="mb-3 text-[14px] font-semibold text-royal">미리보기</p>
                        <h3 className="break-keep text-[22px] font-bold leading-snug text-ink">{form.title || '제목'}</h3>
                        <p className="mt-1 text-[15px] text-sub">{[form.interviewee, form.company, form.role].filter(Boolean).join(' · ')}</p>
                        <div className="mt-5 space-y-4 text-[16px] leading-[1.8] text-ink">
                            {preview.map((b, i) => (b.type === 'q'
                                ? <p key={i} className="pt-2 font-bold"><span className="mr-1.5 text-royal">Q.</span>{b.text}</p>
                                : <p key={i} className="whitespace-pre-line">{b.text}</p>))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-bold text-ink md:text-[24px]">토픽(대표 인터뷰)</h2>
                    <p className="mt-1 text-[15px] text-sub">공개한 글만 사이트 메뉴 「토픽」에 보입니다. 임시저장 글은 관리자만 봅니다.</p>
                </div>
                <button type="button" onClick={openNew} className="h-12 rounded-lg bg-[#0c0c0e] px-6 text-[16px] font-bold text-white hover:bg-black">+ 새 인터뷰 쓰기</button>
            </div>
            {msg ? <p className="rounded-lg bg-[#e8f1fd] px-4 py-3 text-[15px]" role="status">{msg}</p> : null}
            {rows === null ? <p className="text-[15px] text-sub">불러오는 중…</p> : rows.length === 0 ? (
                <p className="rounded-xl bg-card px-5 py-10 text-center text-[15px] text-sub">아직 쓴 인터뷰가 없습니다. 「새 인터뷰 쓰기」를 눌러 시작하세요.</p>
            ) : (
                <ul className="border-t border-ink">
                    {rows.map((t) => (
                        <li key={t.id} className="flex min-h-[64px] flex-wrap items-center gap-3 border-b border-line px-1 py-3 md:px-3">
                            <span className={`inline-flex h-7 w-20 shrink-0 items-center justify-center text-[13px] ${t.status === 'published' ? 'bg-royal text-white' : 'bg-card text-sub'}`}>{t.status === 'published' ? '공개' : '임시저장'}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[16px] font-semibold text-ink" title={t.title}>{t.title}</p>
                                <p className="truncate text-[13px] text-sub">{[t.interviewee, t.company, topicDateLabel(t)].filter(Boolean).join(' · ')}</p>
                            </div>
                            <a href={`/topics/${t.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-ink hover:border-ink">보기 ↗</a>
                            <button type="button" onClick={() => openEdit(t)} className="h-10 rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-ink hover:border-ink">고치기</button>
                            {confirmId === t.id ? (
                                <span className="flex gap-1.5">
                                    <button type="button" disabled={busy} onClick={() => remove(t.id)} className="h-10 rounded-lg bg-red-600 px-3 text-[14px] font-semibold text-white">정말 지우기</button>
                                    <button type="button" onClick={() => setConfirmId(null)} className="h-10 rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-ink hover:border-ink">취소</button>
                                </span>
                            ) : <button type="button" onClick={() => setConfirmId(t.id)} className="h-10 rounded-lg border border-red-200 bg-white px-3 text-[14px] font-semibold text-red-600 hover:border-red-600">지우기</button>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
