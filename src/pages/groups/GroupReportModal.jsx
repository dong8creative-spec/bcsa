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
                className="max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-[18px] bg-white p-6 md:p-7"
                onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <h2 id="group-report-title" className="text-[21px] font-bold text-ink">신고가 접수됐어요</h2>
                        <p className="mt-2 break-keep text-[15px] text-sub">운영진이 확인한 뒤 조치할게요. 신고한 사람은 그룹장에게 알려지지 않아요.</p>
                        <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-lg bg-[#1a1a1a] text-[16px] font-bold text-white">확인</button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit}>
                        <h2 id="group-report-title" className="text-[21px] font-bold text-ink">이 그룹 신고하기</h2>
                        <p className="mt-1 break-keep text-[15px] text-sub">「{group.title}」 · 운영진만 확인해요.</p>

                        <p className="mt-5 text-[15px] font-semibold text-ink">어떤 문제인가요?</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {REASONS.map((r) => (
                                <button key={r} type="button" onClick={() => setKind(kind === r ? '' : r)} aria-pressed={kind === r}
                                    className={`min-h-[44px] rounded-full border px-4 text-[15px] font-semibold transition-colors ${kind === r ? 'border-ink bg-ink text-white' : 'border-line2 bg-white text-[#333] hover:border-ink'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>

                        <label htmlFor="group-report-detail" className="mt-5 block text-[15px] font-semibold text-ink">
                            자세한 내용 <span className="font-normal text-sub">{kind === '기타' ? '(필수)' : '(선택)'}</span>
                        </label>
                        <textarea id="group-report-detail" ref={textRef} value={detail} maxLength={MAX} rows={5}
                            onChange={(e) => setDetail(e.target.value)}
                            placeholder="언제, 어떤 일이 있었는지 적어 주시면 확인이 빨라요."
                            className="mt-2 w-full resize-none rounded-lg border border-line2 px-4 py-3 text-[15px] leading-relaxed focus:border-royal focus:outline-none" />
                        <p className="mt-1 text-right text-[13px] text-sub">{detail.length}/{MAX}</p>

                        {error ? <p role="alert" className="mt-2 text-[15px] text-red-600">{error}</p> : null}

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-lg border border-line2 bg-white text-[16px] font-semibold text-ink disabled:opacity-60">취소</button>
                            <button type="submit" disabled={!canSubmit} className="h-12 rounded-lg bg-[#1a1a1a] text-[16px] font-bold text-white disabled:opacity-40">{busy ? '보내는 중…' : '신고하기'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
