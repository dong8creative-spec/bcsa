import React, { useEffect, useState } from 'react';
import coffeeChatService from '../../services/coffeeChatService';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcNote, ccBtn } from './ui';

/** 모바일 결제 후 돌아왔을 때: 결제를 확인하고 「신청 완료」 또는 실패를 알려 준다 */
export default function PayReturnModal({ chatId, failMessage, onClose, depth }) {
    const cc = useCoffeeChat();
    const [state, setState] = useState(failMessage ? { step: 'fail', message: `${failMessage} 신청은 접수되지 않았어요.` } : { step: 'checking' });
    useEffect(() => {
        if (failMessage) return undefined;
        // 결제창에서 돌아온 직후에는 로그인 복원이 늦을 수 있어 8초까지 기다린다
        if (!cc.uid) {
            setState({ step: 'checking' });
            const t = setTimeout(() => setState({ step: 'fail', message: '로그인이 풀려 결제를 확인하지 못했어요. 로그인 후 「내 커피챗」에서 확인해 주세요. (결제됐다면 자동으로 반영되고, 신청이 안 되면 자동 환불돼요)' }), 8000);
            return () => clearTimeout(t);
        }
        let alive = true;
        setState({ step: 'checking' });
        coffeeChatService.confirmPaid(chatId).then((r) => { if (alive) setState(r.ok ? { step: 'done' } : { step: 'fail', message: r.error }); });
        return () => { alive = false; };
    }, [chatId, failMessage, cc.uid]);
    return (
        <CcModal title="결제 확인" onClose={onClose} depth={depth}
            footer={state.step === 'checking' ? null : (
                <button type="button" className={ccBtn.primary} onClick={() => cc.replace('center', { tab: 'mine' })}>내 커피챗 보기</button>
            )}>
            {state.step === 'checking' ? <p className="py-10 text-center text-[16px] text-sub" role="status">결제를 확인하고 있어요…</p> : null}
            {state.step === 'done' ? (
                <div className="py-6 text-center">
                    <p className="text-[22px] font-bold text-ink">신청 완료</p>
                    <p className="mt-2 text-[15px] text-sub">선배가 24시간 안에 일정을 골라 답해 드려요.</p>
                    <div className="mt-6 text-left"><CcNote>선배가 거절하거나 24시간 안에 답하지 않으면 결제는 자동으로 전액 환불돼요.</CcNote></div>
                </div>
            ) : null}
            {state.step === 'fail' ? <CcNote tone="alert">{state.message}</CcNote> : null}
        </CcModal>
    );
}
