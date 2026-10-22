import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { groupService } from '../../services/groupService';

const PASS_KEY = (gid, sid) => `bcsa_group_pass_${gid}_${sid}`;
const LAST_PAY_KEY = 'bcsa_group_last_payment';

const Screen = ({ icon, tone = 'brand', title, children }) => (
    <div className="min-h-screen bg-soft pt-28 pb-16 px-5">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-7 text-center shadow-sm">
            {icon ? <div className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${tone === 'ok' ? 'bg-emerald-50 text-emerald-600' : tone === 'bad' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-brand'}`}>{icon}</div> : null}
            <h1 className="text-xl font-semibold text-dark break-keep">{title}</h1>
            <div className="mt-3 text-sm text-gray-600 break-keep">{children}</div>
        </div>
    </div>
);

/**
 * mode="checkIn": QR을 찍고 들어온 화면 (/groups/:id/checkin?s=회차&t=토큰)
 * mode="payResult": 모바일 결제 후 돌아오는 화면 (/groups/pay-result?paymentId=...)
 */
export default function GroupCheckIn({ mode, groupId, currentUser, onRequireLogin }) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('s') || '';
    const [state, setState] = useState({ step: 'loading' });
    const startedRef = useRef(false);

    // 1) QR 토큰 → 출석 패스 (로그인 전에도 가능, 10분 유효). 새로고침 대비 sessionStorage에 보관
    useEffect(() => {
        if (mode !== 'checkIn') return;
        const token = params.get('t');
        let alive = true;
        (async () => {
            try {
                if (token) {
                    const r = await groupService.issueCheckInPass(groupId, sessionId, token);
                    try { sessionStorage.setItem(PASS_KEY(groupId, sessionId), JSON.stringify(r)); } catch (_) {}
                    navigate(`/groups/${groupId}/checkin?s=${encodeURIComponent(sessionId)}`, { replace: true });
                    if (alive) setState({ step: 'ready', info: r });
                    return;
                }
                let saved = null;
                try { saved = JSON.parse(sessionStorage.getItem(PASS_KEY(groupId, sessionId)) || 'null'); } catch (_) {}
                if (alive) setState(saved ? { step: 'ready', info: saved } : { step: 'error', message: 'QR을 다시 찍어 주세요.' });
            } catch (e) {
                if (alive) setState({ step: 'error', message: e.message });
            }
        })();
        return () => { alive = false; };
    }, [mode, groupId, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // 2) 로그인되어 있으면 바로 출석 처리 (유료면 결제 안내)
    const doCheckIn = useCallback(async (info) => {
        setState((s) => ({ ...s, step: 'working' }));
        try {
            const r = await groupService.checkInSession(info.pass);
            if (r.status === 'payment_required') {
                setState({ step: 'pay', info, payment: r });
            } else {
                try { sessionStorage.removeItem(PASS_KEY(groupId, sessionId)); } catch (_) {}
                setState({ step: 'done', info, already: r.status === 'already_checked_in' });
            }
        } catch (e) {
            setState({ step: 'error', message: e.message, info });
        }
    }, [groupId, sessionId]);

    useEffect(() => {
        if (mode !== 'checkIn' || state.step !== 'ready' || !currentUser || startedRef.current) return;
        startedRef.current = true;
        doCheckIn(state.info);
    }, [mode, state, currentUser, doCheckIn]);

    const pay = async () => {
        const { payment, info } = state;
        setState((s) => ({ ...s, step: 'paying' }));
        try { sessionStorage.setItem(LAST_PAY_KEY, JSON.stringify({ paymentId: payment.paymentId, groupId, title: info?.session?.title || '' })); } catch (_) {}
        try {
            const r = await groupService.requestSessionPayment({
                paymentId: payment.paymentId,
                amount: payment.amount,
                orderName: payment.orderName,
                customer: {
                    fullName: currentUser?.name || '',
                    phoneNumber: (currentUser?.phone || currentUser?.phoneNumber || '').toString().replace(/\D/g, ''),
                    email: currentUser?.email || '',
                },
            });
            if (r.redirected) return;
            if (r.ok) {
                try { sessionStorage.removeItem(PASS_KEY(groupId, sessionId)); } catch (_) {}
                setState({ step: 'done', info, paid: true });
            } else if (r.error === 'pending') {
                setState({ step: 'error', info, message: '결제 확인이 지연되고 있어요. 잠시 후 그룹 화면에서 출석 여부를 확인해 주세요.' });
            } else {
                setState({ step: 'pay', info, payment, message: r.error === 'amount_mismatch' ? '결제 금액이 달라 자동 취소(환불)되었어요.' : r.error });
            }
        } catch (e) {
            setState({ step: 'pay', info, payment, message: e.message || '결제를 진행하지 못했어요.' });
        }
    };

    // 모바일 결제 복귀
    useEffect(() => {
        if (mode !== 'payResult') return;
        const paymentId = params.get('paymentId');
        const code = params.get('code');
        let saved = {};
        try { saved = JSON.parse(sessionStorage.getItem(LAST_PAY_KEY) || '{}'); } catch (_) {}
        if (!paymentId) { setState({ step: 'error', message: '결제 정보를 찾을 수 없어요.' }); return; }
        if (code) { setState({ step: 'error', message: params.get('message') || '결제가 취소되었어요. 출석은 처리되지 않았습니다.', groupId: saved.groupId }); return; }
        if (!currentUser) { setState({ step: 'needLogin' }); return; }
        let alive = true;
        (async () => {
            for (let i = 0; i < 6 && alive; i++) {
                try {
                    const r = await groupService.completeGroupPayment(paymentId);
                    if (r?.ok) { if (alive) setState({ step: 'done', paid: true, groupId: r.groupId, info: { session: { title: saved.title } } }); return; }
                    if (r?.error && !['not_paid', 'verify_error'].includes(r.error)) {
                        if (alive) setState({ step: 'error', message: r.error === 'amount_mismatch' ? '결제 금액이 달라 자동 취소(환불)되었어요.' : '결제를 확인하지 못했어요.', groupId: saved.groupId });
                        return;
                    }
                } catch (e) { /* 재시도 */ }
                await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
            }
            if (alive) setState({ step: 'error', message: '결제 확인이 지연되고 있어요. 잠시 후 그룹 화면에서 출석 여부를 확인해 주세요.', groupId: saved.groupId });
        })();
        return () => { alive = false; };
    }, [mode, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

    const info = state.info;
    const sessionLine = info ? `${info.group?.title || ''} · ${info.session?.title || ''}` : '';
    const backGid = groupId || state.groupId;
    const backBtn = backGid ? <button type="button" onClick={() => navigate(`/groups/${backGid}`)} className="mt-6 w-full py-3 rounded-full bg-soft font-semibold text-dark">그룹 화면으로</button> : null;

    if (state.step === 'loading' || state.step === 'working') return <Screen icon={<Icons.Clock size={28} />} title="출석 확인 중…">{sessionLine}</Screen>;
    if (state.step === 'needLogin') return <Screen icon={<Icons.Lock size={28} />} title="로그인이 필요해요"><button type="button" onClick={onRequireLogin} className="mt-4 w-full py-3.5 rounded-full bg-brand text-white font-semibold">로그인</button></Screen>;
    if (state.step === 'error') return <Screen icon={<Icons.AlertCircle size={28} />} tone="bad" title="출석하지 못했어요"><p>{state.message}</p>{backBtn}</Screen>;
    if (state.step === 'done') {
        return (
            <Screen icon={<Icons.CheckCircle size={30} />} tone="ok" title={state.already ? '이미 출석했어요' : state.paid ? '결제와 출석이 완료됐어요' : '출석 완료!'}>
                <p>{sessionLine || info?.session?.title}</p>
                {backBtn}
            </Screen>
        );
    }
    if (state.step === 'ready' && !currentUser) {
        return (
            <Screen icon={<Icons.Users size={28} />} title="로그인하면 출석이 완료돼요">
                <p>{sessionLine}</p>
                <p className="mt-1 text-xs text-gray-400">QR을 찍은 뒤 10분 안에 로그인해 주세요.</p>
                <button type="button" onClick={onRequireLogin} className="mt-5 w-full py-3.5 rounded-full bg-brand text-white font-semibold">로그인하고 출석하기</button>
            </Screen>
        );
    }
    if (state.step === 'pay' || state.step === 'paying') {
        const amount = state.payment?.amount || 0;
        return (
            <Screen icon={<Icons.DollarSign size={28} />} title="참가비를 결제하면 출석이 완료돼요">
                <p>{sessionLine}</p>
                <p className="mt-4 text-3xl font-semibold text-dark">{amount.toLocaleString()}원</p>
                {state.message ? <p className="mt-3 text-red-600 font-semibold">{state.message}</p> : null}
                <button type="button" disabled={state.step === 'paying'} onClick={pay} className="mt-5 w-full py-3.5 rounded-full bg-brand text-white font-semibold disabled:opacity-60">
                    {state.step === 'paying' ? '결제 진행 중…' : '결제하고 출석하기'}
                </button>
                <p className="mt-3 text-xs text-gray-400">결제 금액은 부청사가 받아 그룹장에게 정산합니다.</p>
            </Screen>
        );
    }
    return <Screen icon={<Icons.Clock size={28} />} title="잠시만요…">{sessionLine}</Screen>;
}
