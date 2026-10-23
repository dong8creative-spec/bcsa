import React, { useEffect, useRef, useState } from 'react';
import { groupService } from '../../services/groupService';

const REASONS = ['참가비 외 금전 요구', '다단계·영업 권유', '모임 소개와 다른 운영', '불쾌한 언행', '기타'];
const MAX = 900; // 서버 규칙 1000자 안에서 [분류] 머리말 자리를 남긴다

/**
 * 그룹 신고 작성 창 (화면 가운데 모달)
 * 사유 분류는 기존 reports 스키마를 바꾸지 않도록 본문 앞에 [분류]로 붙여 보낸다.
 */
export default function GroupReportModal({ group, currentUser, uid, onClose }) {
    const [kind, setKind] = useState('');
    const [detail, setDetail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const textRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
    }, [busy, onClose]);

    useEffect(() => { textRef.current?.focus(); }, []);

    const canSubmit = !busy && (kind || detail.trim()) && (kind !== '기타' || detail.trim());

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError('');
        try {
            const reason = [kind ? `[${kind}]` : '', detail.trim()].filter(Boolean).join(' ');
            await groupService.createReport({ targetType: 'group', targetId: group.id, targetTitle: group.title, reason, reporter: { uid, name: currentUser?.name } });
            setDone(true);
        } catch (err) {
            setError(`접수하지 못했어요: ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40" onClick={() => { if (!busy) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="group-report-title"
                className="w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto bg-white rounded-3xl p-6 md:p-7 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <h2 id="group-report-title" className="text-xl font-semibold text-dark">신고가 접수됐어요</h2>
                        <p className="mt-2 text-sm text-gray-500 break-keep">운영진이 확인한 뒤 조치할게요. 신고한 사람은 그룹장에게 알려지지 않아요.</p>
                        <button type="button" onClick={onClose} className="mt-6 w-full py-3 rounded-full bg-dark text-white font-semibold">확인</button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit}>
                        <h2 id="group-report-title" className="text-xl font-semibold text-dark">이 그룹 신고하기</h2>
                        <p className="mt-1 text-sm text-gray-500 break-keep">「{group.title}」 · 운영진만 확인해요.</p>

                        <p className="mt-5 text-sm font-semibold text-dark">어떤 문제인가요?</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {REASONS.map((r) => (
                                <button key={r} type="button" onClick={() => setKind(kind === r ? '' : r)} aria-pressed={kind === r}
                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${kind === r ? 'bg-dark text-white border-dark' : 'bg-white text-gray-600 border-black/10 hover:border-black/30'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>

                        <label htmlFor="group-report-detail" className="block mt-5 text-sm font-semibold text-dark">
                            자세한 내용 <span className="font-normal text-gray-500">{kind === '기타' ? '(필수)' : '(선택)'}</span>
                        </label>
                        <textarea id="group-report-detail" ref={textRef} value={detail} maxLength={MAX} rows={5}
                            onChange={(e) => setDetail(e.target.value)}
                            placeholder="언제, 어떤 일이 있었는지 적어 주시면 확인이 빨라요."
                            className="mt-2 w-full rounded-2xl border border-black/10 p-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-brand" />
                        <p className="mt-1 text-right text-xs text-gray-400">{detail.length}/{MAX}</p>

                        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={onClose} disabled={busy} className="py-3 rounded-full bg-soft text-dark font-semibold disabled:opacity-60">취소</button>
                            <button type="submit" disabled={!canSubmit} className="py-3 rounded-full bg-red-600 text-white font-semibold disabled:opacity-40">{busy ? '보내는 중…' : '신고하기'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
