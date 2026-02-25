import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPaymentPending, clearPaymentPending } from '../services/paymentService';
import { getApiBaseUrl } from '../utils/api';
import { Icons } from '../components/Icons';

/**
 * 리다이렉트 결제 후 복귀 URL (/payment/result)
 * 웹훅 처리 완료 여부를 먼저 확인하고, 완료됐으면 onComplete 생략(중복 방지). 아니면 sessionStorage 기반 fallback.
 */
export function PaymentResultView({ onComplete }) {
    const location = useLocation();
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'fail' | 'expired'
    const [message, setMessage] = useState('');
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        const params = new URLSearchParams(location.search);
        const merchantUid = params.get('merchant_uid');
        const impSuccess = params.get('imp_success') ?? params.get('success');
        const errorMsg = params.get('error_msg') ?? params.get('error_message');

        if (!merchantUid) {
            setMessage('결제 정보를 찾을 수 없습니다.');
            setStatus('fail');
            return;
        }
        processedRef.current = true;

        const run = async () => {
            const base = getApiBaseUrl();
            if (base) {
                try {
                    const res = await fetch(`${base.replace(/\/$/, '')}/api/payment/status?merchant_uid=${encodeURIComponent(merchantUid)}`);
                    const data = res.ok ? await res.json().catch(() => ({})) : {};
                    if (data.completed === true) {
                        clearPaymentPending(merchantUid);
                        setStatus('success');
                        setMessage('결제 및 신청이 완료되었습니다.');
                        return;
                    }
                } catch (e) {
                    console.warn('PaymentResultView: status check failed', e);
                }
            }

            const pending = getPaymentPending(merchantUid);
            if (!pending || !pending.seminar) {
                setMessage('세션이 만료되었거나 결제 정보를 복원할 수 없습니다.');
                setStatus('expired');
                return;
            }
            clearPaymentPending(merchantUid);

            const success = impSuccess === 'true' || impSuccess === true;
            if (success && onComplete) {
                onComplete(pending.seminar, pending.applicationData || null)
                    .then((ok) => {
                        if (ok) {
                            setStatus('success');
                            setMessage('결제 및 신청이 완료되었습니다.');
                        } else {
                            setStatus('fail');
                            setMessage('신청 처리 중 오류가 발생했습니다.');
                        }
                    })
                    .catch(() => {
                        setStatus('fail');
                        setMessage('신청 처리 중 오류가 발생했습니다.');
                    });
            } else {
                setStatus('fail');
                setMessage(errorMsg || '결제가 취소되었거나 실패했습니다.');
            }
        };
        run();
    }, [location.search, onComplete]);

    const goHome = () => {
        window.location.href = '/';
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-soft p-4">
                <div className="text-center">
                    <div className="inline-block w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-600">결제 결과를 확인하고 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-soft p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 max-w-md w-full text-center">
                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icons.CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-dark mb-2">결제 완료</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                    </>
                )}
                {(status === 'fail' || status === 'expired') && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icons.AlertCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-dark mb-2">
                            {status === 'expired' ? '세션 만료' : '결제 실패'}
                        </h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                    </>
                )}
                <button
                    type="button"
                    onClick={goHome}
                    className="w-full py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                    홈으로 이동
                </button>
            </div>
        </div>
    );
}
