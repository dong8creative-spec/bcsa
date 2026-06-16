import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPaymentPending, clearPaymentPending } from '../services/paymentService';
import { getApiBaseUrl } from '../utils/api';
import { Icons } from '../components/Icons';

/**
 * 리다이렉트 결제 후 복귀 URL (/payment/result)
 * 서버 웹훅 완료를 폴링(~8초)해서 확인. 미확인 시 사용자에게 결제 번호와 함께 관리자 문의 안내.
 * 보안상 sessionStorage 폴백으로 신청을 생성하지 않음 (결제 미검증 신청 방지).
 */
export function PaymentResultView({ onComplete }) {
    const location = useLocation();
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'fail' | 'expired'
    const [message, setMessage] = useState('');
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        const params = new URLSearchParams(location.search);
        // V2(paymentId)와 V1(merchant_uid) 모두 지원. 내부적으로 동일 식별자.
        const merchantUid = params.get('paymentId') || params.get('payment_id') || params.get('merchant_uid') || params.get('merchantUid');
        // V1 실패 플래그(imp_success) — 없으면 V2로 간주
        const impSuccess = params.get('imp_success') ?? params.get('success');
        // V2 실패 시 전달되는 오류 코드/문구
        const failCode = params.get('code');
        const errorMsg = params.get('message') ?? params.get('pgMessage') ?? params.get('error_msg') ?? params.get('error_message');

        if (!merchantUid) {
            setMessage('결제 정보를 찾을 수 없습니다.');
            setStatus('fail');
            return;
        }
        processedRef.current = true;

        const checkStatus = async () => {
            const base = getApiBaseUrl();
            if (!base) return false;
            const res = await fetch(`${base.replace(/\/$/, '')}/api/payment/status?paymentId=${encodeURIComponent(merchantUid)}`);
            const data = res.ok ? await res.json().catch(() => ({})) : {};
            return data.completed === true;
        };

        const run = async () => {
            // V2 실패 판정: code가 있으면 결제 실패/취소. (V1 호환: imp_success === 'false')
            const explicitFail = (failCode != null && failCode !== '') || impSuccess === 'false' || impSuccess === false;

            const base = getApiBaseUrl();
            if (base && !explicitFail) {
                // 웹훅 지연을 고려해 폴링을 늘림 (즉시 → 2s → 3s → 3s, 총 ~8초)
                const delays = [0, 2000, 3000, 3000];
                for (let i = 0; i < delays.length; i++) {
                    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
                    try {
                        if (await checkStatus()) {
                            clearPaymentPending(merchantUid);
                            setStatus('success');
                            setMessage('결제 및 신청이 완료되었습니다.');
                            return;
                        }
                    } catch (e) {
                        console.warn('PaymentResultView: status check failed', e);
                    }
                }
            }

            // 실패 파라미터가 명시된 경우
            if (explicitFail) {
                clearPaymentPending(merchantUid);
                setStatus('fail');
                setMessage(errorMsg || '결제가 취소되었거나 실패했습니다.');
                return;
            }

            // 서버에서 8초 내 완료 확인이 안된 경우:
            // sessionStorage 폴백으로 결제 미확인 신청을 생성하는 것은 보안상 위험하므로 제거.
            // 웹훅은 최대 수십 초 지연될 수 있으므로 사용자에게 대기 안내 후 결제 번호를 알려준다.
            clearPaymentPending(merchantUid);
            setMessage('결제 처리가 지연되고 있습니다. 잠시 후 마이페이지에서 신청 내역을 확인해 주세요.\n결제는 완료되었으나 신청이 반영되지 않으면 아래 결제 번호를 관리자에게 알려주세요.');
            setStatus('expired');
        };
        run();
    }, [location.search]);

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
                        <p className="text-gray-700 font-medium mb-2">{message}</p>
                        <p className="text-sm text-gray-500 mb-6">프로그램 신청이 정상적으로 완료되었습니다. 마이페이지에서 신청 내역을 확인할 수 있습니다.</p>
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
                        <p className="text-gray-600 mb-4 whitespace-pre-line">{message}</p>
                        {(() => {
                            const sp = new URLSearchParams(location.search);
                            const pid = sp.get('paymentId') || sp.get('payment_id') || sp.get('merchant_uid') || sp.get('merchantUid') || '';
                            if (!pid) return null;
                            return (
                                <p className="text-sm text-gray-500 mb-6 break-all">
                                    결제 번호: <code className="bg-gray-100 px-1 rounded">{pid}</code>
                                </p>
                            );
                        })()}
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
