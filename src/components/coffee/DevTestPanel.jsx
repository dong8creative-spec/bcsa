import React, { useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_STATUS, slotLabel } from '../../services/coffeeChatService';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

/**
 * 로컬 시험 모드에서만 보이는 「시험 도구」 (CoffeeChatProvider 가 CC_FAKE_PAY 일 때만 그린다)
 * - 실제 결제 없음 표시, 지금 로그인한 시험 계정, 계정 바꾸기
 * - 기다려야 하는 단계 앞당기기: 선배 24시간 무응답 / 약속 시간 지남 / 약속 끝나고 자동 완료
 * - 포트원 결제창 막기: 커피챗이 아닌 다른 결제(프로그램 등)가 시험 중 실제 결제창을 열지 않게
 */
export default function DevTestPanel({ uid, currentUser }) {
    const [open, setOpen] = useState(false);
    const [mine, setMine] = useState([]);
    const [recv, setRecv] = useState([]);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState('');

    // 시험 중에는 어떤 결제창도 실제로 열리지 않게 막는다(커피챗은 이미 가짜 결제로 처리)
    useEffect(() => {
        const fake = { requestPayment: async () => ({ code: 'TEST_MODE', message: '로컬 시험 모드에서는 결제창을 열지 않아요. (커피챗은 가짜 결제로 진행돼요)' }) };
        try { Object.defineProperty(window, 'PortOne', { configurable: true, get: () => fake, set: () => {} }); } catch (_) { window.PortOne = fake; }
    }, []);

    useEffect(() => {
        if (!uid) { setMine([]); setRecv([]); return undefined; }
        const a = coffeeChatService.subscribeMyRequests(uid, setMine);
        const b = coffeeChatService.subscribeReceived(uid, setRecv);
        return () => { a(); b(); };
    }, [uid]);

    const rows = useMemo(() => {
        const m = new Map();
        [...mine.map((c) => ({ ...c, role: '후배' })), ...recv.map((c) => ({ ...c, role: '선배' }))].forEach((c) => m.set(c.id, c));
        return [...m.values()].filter((c) => ['requested', 'confirmed'].includes(c.status));
    }, [mine, recv]);

    const travel = async (id, what, done) => {
        setBusy(id + what); setMsg('');
        try { await coffeeChatService.testTimeTravel(id, what); setMsg(done); } catch (e) { setMsg(e.message); }
        setBusy('');
    };

    return (
        <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 1500, maxWidth: 'calc(100vw - 24px)' }}>
            {open ? (
                <div className="w-[340px] max-w-full rounded-xl border-2 border-[#d97706] bg-white p-3 text-[14px] text-ink">
                    <div className="mb-2 flex items-center justify-between">
                        <b className="text-[15px]">🧪 시험 도구 (로컬 전용)</b>
                        <button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-sub" aria-label="시험 도구 접기">접기</button>
                    </div>
                    <p className="mb-2 rounded-lg bg-[#fff7e6] px-2.5 py-2 text-[13px] leading-relaxed">가짜 Firebase · 가짜 결제입니다. 실제 돈은 나가지 않고, 실제 사이트 자료도 바뀌지 않아요.</p>
                    <p className="mb-2 text-[13px]">로그인: <b>{currentUser ? `${currentUser.name || ''} (${currentUser.email || ''})` : '안 함'}</b>
                        {uid ? <button type="button" onClick={() => signOut(auth).then(() => window.location.reload())} className="ml-2 underline">로그아웃(계정 바꾸기)</button> : null}
                    </p>
                    <p className="mb-1 font-semibold">기다리는 단계 앞당기기</p>
                    {rows.length === 0 ? <p className="text-[13px] text-sub">진행 중인 커피챗이 없어요. 신청하면 여기 나타나요.</p> : (
                        <ul className="max-h-[260px] space-y-2 overflow-y-auto">
                            {rows.map((c) => (
                                <li key={c.id} className="rounded-lg border border-line p-2">
                                    <p className="truncate text-[13px]"><b>{c.role}</b> · {c.seniorName} ↔ {c.juniorName} · {CC_STATUS[c.status]?.label}</p>
                                    {c.chosenSlot ? <p className="truncate text-[12px] text-sub">약속 {slotLabel(c.chosenSlot)}</p> : null}
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {c.status === 'requested' ? (
                                            <button type="button" disabled={!!busy} onClick={() => travel(c.id, 'respond', '선배가 24시간 안에 답하지 않은 것으로 처리했어요 → 자동 취소·전액 환불')} className="h-9 rounded-lg bg-[#0c0c0e] px-2.5 text-[13px] font-semibold text-white">24시간 무응답 만들기</button>
                                        ) : null}
                                        {c.status === 'confirmed' ? (
                                            <>
                                                <button type="button" disabled={!!busy} onClick={() => travel(c.id, 'meeting', '약속 시간이 지난 것으로 바꿨어요. 선배 계정에서 「진행 완료로 표시」를 눌러 보세요.')} className="h-9 rounded-lg bg-[#0c0c0e] px-2.5 text-[13px] font-semibold text-white">약속 시간 지나게</button>
                                                <button type="button" disabled={!!busy} onClick={() => travel(c.id, 'autodone', '약속이 끝나고 2시간이 지나 자동으로 「진행 완료」됐어요. 후배 계정에서 후기를 남겨 보세요.')} className="h-9 rounded-lg border border-line2 px-2.5 text-[13px] font-semibold">자동 완료까지</button>
                                            </>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {msg ? <p role="status" className="mt-2 rounded-lg bg-sky px-2.5 py-2 text-[13px]">{msg}</p> : null}
                </div>
            ) : (
                <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-lg border-2 border-[#d97706] bg-[#fff7e6] px-3 text-[14px] font-bold text-[#92400e]">🧪 시험 모드 · 실제 결제 없음</button>
            )}
        </div>
    );
}
