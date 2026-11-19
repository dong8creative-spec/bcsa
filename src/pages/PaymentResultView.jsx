import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPaymentPending, clearPaymentPending } from '../services/paymentService';
import { pollPaymentUntilComplete } from '../utils/paymentPoll';
import { formatPaymentApplySuccess } from '../utils/paymentMessages';
import { getApiBaseUrl } from '../utils/api';
import { getIdToken } from 'firebase/auth';
import { auth } from '../firebase';
import { Icons } from '../components/Icons';
import { HEADER_OFFSET_CLASS } from '../components/mg/Mg';

/**
 * 리다이렉트 결제 후 복귀 URL (/payment/result)
 * 서버 웹훅/complete 완료를 폴링(~20초)해서 확인.
 */
export function PaymentResultView({ onComplete, onGoMyPage }) {
    const location = useLocation();
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'fail' | 'expired' | 'pending'
    const [message, setMessage] = useState('');
    const [seminarTitle, setSeminarTitle] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const processedRef = useRef(false);
    const timerRef = useRef(null);

    useEffect(() => {
        if (status !== 'loading') return;
        timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [status]);

    useEffect(() => {
        if (processedRef.current) return;
        const params = new URLSearchParams(location.search);
        const merchantUid = params.get('paymentId') || params.get('payment_id') || params.get('merchant_uid') || params.get('merchantUid');
        const impSuccess = params.get('imp_success') ?? params.get('success');
        const failCode = params.get('code');
        const errorMsg = params.get('message') ?? params.get('pgMessage') ?? params.get('error_msg') ?? params.get('error_message');

        if (!merchantUid) {
            setMessage('결제 정보를 찾을 수 없습니다.');
            setStatus('fail');
            return;
        }
        processedRef.current = true;

        const pending = getPaymentPending(merchantUid);
        const title = pending?.seminar?.title || '';
        if (title) setSeminarTitle(title);

        const run = async () => {
            const explicitFail = (failCode != null && failCode !== '') || impSuccess === 'false' || impSuccess === false;

            if (explicitFail) {
                clearPaymentPending(merchantUid);
                setStatus('fail');
                setMessage(errorMsg || '결제가 취소되었거나 실패했습니다.\n프로그램 신청은 진행되지 않았습니다.');
                return;
            }

            const base = getApiBaseUrl();
            if (base) {
                let idToken = '';
                try {
                    const fbUser = auth.currentUser;
                    if (fbUser) idToken = await getIdToken(fbUser, false);
                } catch (_) {}

                const { completed, reason } = await pollPaymentUntilComplete({
                    apiBaseUrl: base,
                    paymentId: merchantUid,
                    idToken,
                    maxMs: 20000
                });

                if (completed) {
                    setStatus('success');
                    setMessage(formatPaymentApplySuccess(title || '프로그램', { serverCompleted: true }));
                    if (pending?.seminar && typeof onComplete === 'function') {
                        try {
                            await onComplete(pending.seminar, pending.applicationData, { merchantUid });
                        } catch (e) {
                            console.warn('PaymentResultView: onComplete failed (non-fatal)', e?.message);
                        }
                    }
                    clearPaymentPending(merchantUid);
                    return;
                }

                if (reason === 'capacity_full') {
                    clearPaymentPending(merchantUid);
                    setStatus('fail');
                    setMessage('정원이 마감되어 결제가 자동 취소(환불)되었습니다.\n프로그램 신청은 진행되지 않았으며, 환불은 영업일 기준 3~5일 내 처리됩니다.');
                    return;
                }

                if (typeof reason === 'string' && reason.startsWith('global_recruitment_')) {
                    clearPaymentPending(merchantUid);
                    setStatus('fail');
                    setMessage('현재 전체 프로그램 모집이 중단되어 결제가 자동 취소(환불)되었습니다.\n프로그램 신청은 진행되지 않았으며, 환불은 영업일 기준 3~5일 내 처리됩니다.');
                    return;
                }

                if (reason === 'amount_mismatch') {
                    clearPaymentPending(merchantUid);
                    setStatus('fail');
                    setMessage('결제 금액이 참가비와 달라 결제가 자동 취소(환불)되었습니다.\n프로그램 신청은 진행되지 않았으며, 다시 신청해 주세요.');
                    return;
                }

                if (reason === 'payment_not_verified') {
                    clearPaymentPending(merchantUid);
                    setStatus('fail');
                    setMessage('결제 승인을 확인하지 못했습니다.\n카드사·포트원에서 결제가 완료되었는지 확인 후, 문제가 계속되면 아래 결제 번호와 함께 문의해 주세요.');
                    return;
                }
            }

            clearPaymentPending(merchantUid);
            setMessage(
                '결제는 완료되었을 수 있으나, 신청 반영 확인이 지연되고 있습니다.\n\n' +
                '1~2분 후 마이페이지에서 신청 내역을 확인해 주세요.\n' +
                '신청이 보이지 않으면 아래 결제 번호를 관리자에게 알려주세요.'
            );
            setStatus('pending');
        };
        run();
    }, [location.search, onComplete]);

    const goHome = () => {
        window.location.href = '/';
    };

    const goMyPage = () => {
        if (typeof onGoMyPage === 'function') {
            onGoMyPage();
            return;
        }
        window.location.href = '/';
    };

    if (status === 'loading') {
        const MAX_WAIT = 20;
        const progressPct = Math.min(100, Math.round((elapsed / MAX_WAIT) * 100));
        const loadingMsg = elapsed < 5
            ? '결제 결과를 확인하고 있습니다...'
            : elapsed < 12
            ? '신청 처리 중입니다. 잠시만 기다려 주세요...'
            : '거의 다 됐습니다. 페이지를 닫지 마세요...';
        return (
            <div className={`flex min-h-screen items-start justify-center bg-white px-5 pb-16 ${HEADER_OFFSET_CLASS}`}>
                <div className="mt-10 w-full max-w-md rounded-[18px] border border-line bg-white px-6 py-9 text-center md:mt-16 md:px-8" role="status" aria-live="polite">
                    <div className="mb-5 inline-block h-12 w-12 animate-spin rounded-full border-[3px] border-royal border-t-transparent" aria-hidden="true" />
                    <p className="mb-1 text-[17px] font-semibold text-ink">{loadingMsg}</p>
                    {seminarTitle ? (
                        <p className="mb-2 text-[15px] font-semibold text-royal">{seminarTitle}</p>
                    ) : null}
                    <p className="mb-5 text-[14px] text-sub">페이지를 닫거나 새로고침하지 마세요</p>
                    <div className="h-2 w-full overflow-hidden bg-card" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label="결제 확인 진행">
                        <div
                            className="h-2 bg-royal transition-all duration-1000"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="mt-2 text-[13px] text-sub">{elapsed}초 / 최대 {MAX_WAIT}초</p>
                </div>
            </div>
        );
    }

    const paymentId = (() => {
        const sp = new URLSearchParams(location.search);
        return sp.get('paymentId') || sp.get('payment_id') || sp.get('merchant_uid') || sp.get('merchantUid') || '';
    })();

    return (
        <div className={`flex min-h-screen items-start justify-center bg-white px-5 pb-16 ${HEADER_OFFSET_CLASS}`}>
            <div className="mt-10 w-full max-w-md rounded-[18px] border border-line bg-white px-6 py-9 text-center md:mt-16 md:px-8" role="status" aria-live="polite">
                {status === 'success' && (
                    <>
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky" aria-hidden="true">
                            <Icons.CheckCircle className="h-9 w-9 text-royal" />
                        </div>
                        <h2 className="mb-2 text-[24px] font-bold text-ink">신청 완료</h2>
                        {seminarTitle ? (
                            <p className="mb-3 text-[16px] font-semibold text-royal">{seminarTitle}</p>
                        ) : null}
                        <p className="mb-2 whitespace-pre-line text-[16px] text-ink">{message}</p>
                        <p className="mb-6 text-[15px] text-sub">환불·취소는 마이페이지에서 신청 취소로 진행할 수 있습니다.</p>
                    </>
                )}
                {status === 'pending' && (
                    <>
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-card" aria-hidden="true">
                            <Icons.AlertCircle className="h-9 w-9 text-ink" />
                        </div>
                        <h2 className="mb-2 text-[24px] font-bold text-ink">신청 확인 중</h2>
                        {seminarTitle ? (
                            <p className="mb-3 text-[16px] font-semibold text-royal">{seminarTitle}</p>
                        ) : null}
                        <p className="mb-5 whitespace-pre-line text-[16px] text-[#333]">{message}</p>
                    </>
                )}
                {(status === 'fail' || status === 'expired') && (
                    <>
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50" aria-hidden="true">
                            <Icons.AlertCircle className="h-9 w-9 text-red-600" />
                        </div>
                        <h2 className="mb-2 text-[24px] font-bold text-ink">
                            {status === 'expired' ? '확인 시간 초과' : '결제 실패'}
                        </h2>
                        <p className="mb-5 whitespace-pre-line text-[16px] text-[#333]">{message}</p>
                    </>
                )}
                {paymentId ? (
                    <p className="mb-6 break-all text-[14px] text-sub">
                        결제 번호: <code className="bg-card px-1.5 py-0.5 text-ink">{paymentId}</code>
                    </p>
                ) : null}
                <div className="flex flex-col gap-2.5">
                    {status === 'success' || status === 'pending' ? (
                        <button
                            type="button"
                            onClick={goMyPage}
                            className="h-[52px] w-full rounded-lg bg-royal text-[16px] font-bold text-white transition-colors hover:bg-royalDark"
                        >
                            마이페이지에서 확인
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={goHome}
                        className={`h-[52px] w-full rounded-lg text-[16px] font-bold transition-colors ${
                            status === 'success' || status === 'pending'
                                ? 'border border-line2 bg-white text-ink hover:border-ink'
                                : 'bg-[#1a1a1a] text-white hover:bg-black'
                        }`}
                    >
                        홈으로 이동
                    </button>
                </div>
            </div>
        </div>
    );
}
