import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_STATUS, CC_SETTLE, won, ratingOf, slotLabel, toMs } from '../../../services/coffeeChatService';

/**
 * 관리자 「선배 커피챗」: 선배 등록 심사(승인·반려), 신청 전체 보기, 선배 정산(매월 10일) 표시.
 * 결제·환불은 서버가 처리하고, 여기서는 정산 완료 표시와 선배 승인만 한다.
 */
const card = 'rounded-xl border border-line bg-white';
const tabCls = (on) => `h-11 px-4 text-[15px] font-semibold ${on ? 'bg-[#0c0c0e] text-white' : 'bg-white text-ink'}`;

export const CoffeeChatManagement = () => {
    const [tab, setTab] = useState('seniors');
    const [seniors, setSeniors] = useState(null);
    const [chats, setChats] = useState(null);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState('');
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');
    const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

    useEffect(() => coffeeChatService.subscribeAllSeniorsAdmin(setSeniors), []);
    useEffect(() => coffeeChatService.subscribeAllChatsAdmin(setChats), []);

    const pending = (seniors || []).filter((s) => s.status === 'pending');
    const act = async (key, fn, done) => {
        setBusy(key); setMsg('');
        try { await fn(); setMsg(done); } catch (e) { setMsg(`처리하지 못했습니다: ${e.message || e}`); }
        setBusy('');
    };

    // 정산: 선택한 달에 약속이 잡힌 확정·완료 건을 선배별로 묶는다
    const settle = useMemo(() => {
        // 저장값은 UTC(ISO)라 그대로 자르면 매달 1일 오전 약속이 전달로 들어간다 → 이 화면 시간대(한국)의 연·월로 비교
        const ym = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
        const rows = (chats || []).filter((c) => CC_SETTLE.includes(c.status) && !c.refunded && ym(c.chosenSlot) === month);
        const by = {};
        rows.forEach((c) => {
            const k = c.seniorUid;
            by[k] = by[k] || { seniorUid: k, name: c.seniorName, biz: c.seniorBiz, items: [], total: 0, payout: 0, unsettled: 0 };
            by[k].items.push(c); by[k].total += Number(c.amount) || 0; by[k].payout += Number(c.payout) || 0;
            if (!c.settled && c.status === 'completed') by[k].unsettled += Number(c.payout) || 0;
        });
        return Object.values(by);
    }, [chats, month]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-ink">선배 커피챗</h2>
                    <p className="mt-1 text-[14px] text-sub">선배 등록 심사, 커피챗 신청 현황, 정산(매월 10일, 수수료 10% 뺀 금액)을 관리합니다.</p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => act('sweep', async () => { const r = await coffeeChatService.runSweepAdmin(); setMsg(`점검 완료: 무응답 환불 ${r.expired}건 · 자동 완료 ${r.completed}건 · 결제 안 한 신청 정리 ${r.abandoned}건`); }, '')}
                    className="h-11 rounded-lg border border-line2 bg-white px-4 text-[15px] font-semibold">지금 점검 실행</button>
            </div>
            <div role="tablist" aria-label="커피챗 관리" className="inline-grid grid-cols-3 border border-[#0c0c0e]">
                <button type="button" role="tab" aria-selected={tab === 'seniors'} className={tabCls(tab === 'seniors')} onClick={() => setTab('seniors')}>선배 심사{pending.length ? ` (${pending.length})` : ''}</button>
                <button type="button" role="tab" aria-selected={tab === 'chats'} className={tabCls(tab === 'chats')} onClick={() => setTab('chats')}>신청 현황</button>
                <button type="button" role="tab" aria-selected={tab === 'settle'} className={tabCls(tab === 'settle')} onClick={() => setTab('settle')}>정산</button>
            </div>
            {msg ? <p role="status" className="rounded-lg bg-sky px-4 py-3 text-[15px]">{msg}</p> : null}

            {tab === 'seniors' ? (
                seniors === null ? <p className="text-sub">불러오는 중…</p> : seniors.length === 0 ? <p className={`${card} px-5 py-10 text-center text-sub`}>아직 선배 등록 신청이 없습니다.</p> : (
                    <ul className="space-y-3">
                        {seniors.map((s) => (
                            <li key={s.id} className={`${card} px-4 py-4`}>
                                <div className="flex flex-wrap items-start gap-3">
                                    <span className={`inline-flex h-7 w-20 shrink-0 items-center justify-center text-[13px] ${s.status === 'approved' ? 'bg-royal text-white' : s.status === 'pending' ? 'bg-[#0c0c0e] text-white' : 'bg-red-50 text-red-600'}`}>{s.status === 'approved' ? '활동 중' : s.status === 'pending' ? '심사 대기' : '반려'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[16px] font-semibold">{s.name} 선배 · {s.bizName}</p>
                                        <p className="truncate text-[14px] text-sub">{[s.industry, s.area, `${s.years}년차`, (s.topics || []).join(' ')].filter(Boolean).join(' · ')}</p>
                                        <p className="mt-1 line-clamp-2 text-[14px]">{s.intro}</p>
                                        <p className="mt-1 text-[13px] text-sub">30분 {won(s.prices?.online30)} · 60분 {won(s.prices?.visit60)} · 완료 {s.completedCount || 0}회 · 평점 {ratingOf(s) ?? '-'}{s.rejectReason ? ` · 반려 사유: ${s.rejectReason}` : ''}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {s.status !== 'approved' ? <button type="button" disabled={!!busy} onClick={() => act(s.id, () => coffeeChatService.setSeniorStatusAdmin(s.id, 'approved'), `${s.name} 선배를 승인했습니다.`)} className="h-10 rounded-lg bg-[#0c0c0e] px-4 text-[14px] font-bold text-white">승인</button> : null}
                                        {s.status !== 'rejected' ? <button type="button" disabled={!!busy} onClick={() => { setRejecting(s.id); setReason(''); }} className="h-10 rounded-lg border border-red-300 px-4 text-[14px] text-red-600">{s.status === 'approved' ? '활동 중지' : '반려'}</button> : null}
                                    </div>
                                </div>
                                {rejecting === s.id ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <label className="sr-only" htmlFor={`rj-${s.id}`}>반려 사유</label>
                                        <input id={`rj-${s.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="사유(선배에게 보여요)" className="h-10 min-w-0 flex-1 rounded-lg border border-line2 px-3 text-[15px]" />
                                        <button type="button" onClick={() => act(s.id, async () => { await coffeeChatService.setSeniorStatusAdmin(s.id, 'rejected', reason); setRejecting(null); }, '반려했습니다.')} className="h-10 rounded-lg bg-red-600 px-4 text-[14px] font-semibold text-white">확인</button>
                                        <button type="button" onClick={() => setRejecting(null)} className="h-10 rounded-lg border border-line2 px-4 text-[14px]">취소</button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )
            ) : null}

            {tab === 'chats' ? (
                chats === null ? <p className="text-sub">불러오는 중…</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] border-t border-ink text-left text-[14px]">
                            <thead><tr className="h-12 border-b border-line text-sub">
                                <th className="px-2 font-semibold">신청일</th><th className="px-2 font-semibold">상태</th><th className="px-2 font-semibold">선배</th><th className="px-2 font-semibold">후배</th><th className="px-2 font-semibold">방식</th><th className="px-2 font-semibold">일정</th><th className="px-2 text-right font-semibold">금액</th><th className="px-2 font-semibold">후기</th>
                            </tr></thead>
                            <tbody>
                                {chats.filter((c) => !['pending_payment', 'abandoned'].includes(c.status)).map((c) => (
                                    <tr key={c.id} className="h-[52px] border-b border-line">
                                        <td className="px-2">{new Date(toMs(c.createdAt)).toLocaleDateString('ko-KR')}</td>
                                        <td className="px-2"><span className="truncate">{CC_STATUS[c.status]?.label || c.status}{c.refunded ? ' · 환불' : ''}</span></td>
                                        <td className="max-w-[140px] truncate px-2" title={c.seniorBiz}>{c.seniorName}</td>
                                        <td className="max-w-[120px] truncate px-2">{c.juniorName}</td>
                                        <td className="px-2">{c.type === 'visit60' ? '60분 방문' : '30분 비대면'}</td>
                                        <td className="px-2">{c.chosenSlot ? slotLabel(c.chosenSlot) : `희망 ${slotLabel(c.slots?.[0])} 외`}</td>
                                        <td className="px-2 text-right">{won(c.amount)}</td>
                                        <td className="px-2">{c.review ? `★${c.review.rating}` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : null}

            {tab === 'settle' ? (
                <div className="space-y-4">
                    <label className="flex items-center gap-3 text-[15px] font-semibold">약속이 있었던 달
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 rounded-lg border border-line2 px-3 font-normal" />
                    </label>
                    {settle.length === 0 ? <p className={`${card} px-5 py-10 text-center text-sub`}>이 달에 정산할 커피챗이 없습니다.</p> : settle.map((g) => (
                        <div key={g.seniorUid} className={card}>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                                <p className="text-[16px] font-semibold">{g.name} 선배 <span className="font-normal text-sub">· {g.biz}</span></p>
                                <p className="text-[15px]">결제 {won(g.total)} · 지급액 <b>{won(g.payout)}</b>{g.unsettled ? <span className="ml-2 text-red-600">미정산 {won(g.unsettled)}</span> : null}</p>
                            </div>
                            <ul>
                                {g.items.map((c) => (
                                    <li key={c.id} className="flex min-h-[52px] flex-wrap items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
                                        <span className="w-44 shrink-0 text-[14px]">{slotLabel(c.chosenSlot)}</span>
                                        <span className="min-w-0 flex-1 truncate text-[14px]">{c.juniorName} · {c.type === 'visit60' ? '60분 방문' : '30분 비대면'} · {CC_STATUS[c.status]?.label}</span>
                                        <span className="w-24 text-right text-[14px]">{won(c.payout)}</span>
                                        <label className="flex h-10 items-center gap-2 text-[14px]">
                                            <input type="checkbox" checked={!!c.settled} disabled={c.status !== 'completed' || busy === c.id}
                                                onChange={(e) => act(c.id, () => coffeeChatService.setSettledAdmin(c.id, e.target.checked), e.target.checked ? '정산 완료로 표시했습니다.' : '정산 대기로 되돌렸습니다.')} />
                                            정산 완료
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <p className="text-[13px] text-sub">진행 완료된 건만 정산 완료로 표시할 수 있습니다. 확정 후 아직 진행 전인 건은 취소·환불될 수 있어 대기로 둡니다.</p>
                </div>
            ) : null}
        </div>
    );
};
