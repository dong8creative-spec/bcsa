/**
 * Payment Service Container
 * User-Agent에 따라 모바일/CEP·UXP는 리다이렉트 결제(m_redirect_url), PC는 표준 결제만 사용
 */

import { PORTONE_IMP_CODE, PORTONE_CHANNEL_KEY } from '../constants';
import { useRedirectPayment } from '../utils/paymentEnv';

const PENDING_PREFIX = 'payment_pending_';
const PENDING_TTL_MS = 30 * 60 * 1000;

function getMerchantUid() {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 40);
}

/**
 * 결제 대기 데이터 저장 (리다이렉트 결제 후 /payment/result에서 복원용)
 */
export function setPaymentPending(merchantUid, data) {
    try {
        const payload = { ...data, createdAt: Date.now() };
        sessionStorage.setItem(PENDING_PREFIX + merchantUid, JSON.stringify(payload));
    } catch (e) {
        console.warn('paymentService: setPaymentPending failed', e);
    }
}

/**
 * 결제 대기 데이터 복원. 없거나 만료 시 null
 */
export function getPaymentPending(merchantUid) {
    try {
        const raw = sessionStorage.getItem(PENDING_PREFIX + merchantUid);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.createdAt && Date.now() - data.createdAt > PENDING_TTL_MS) return null;
        return data;
    } catch (e) {
        return null;
    }
}

export function clearPaymentPending(merchantUid) {
    try {
        sessionStorage.removeItem(PENDING_PREFIX + merchantUid);
    } catch (e) {}
}

/**
 * 리다이렉트 결제 결과 URL 기준 (m_redirect_url에 사용)
 */
export function getPaymentResultRedirectUrl() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/payment/result`;
}

/**
 * 결제 요청 단일 진입점
 * @param {Object} params
 * @param {Object} params.seminar - 프로그램 정보 (title, applicationFee, id 등)
 * @param {Object} params.applicationData - 신청 폼 데이터
 * @param {Object} params.customer - { fullName, phoneNumber, email }
 * @param {string} [params.apiBaseUrl] - API 기본 URL (리다이렉트 결제 시 pending 저장용)
 * @param {string} [params.userId] - 로그인 사용자 id (리다이렉트 결제 시 pending 저장용)
 * @param {Function} params.onSuccess - 표준 결제 시 성공 콜백 (리다이렉트 시에는 /payment/result에서 처리)
 * @param {Function} params.onFail - 표준 결제 시 실패 콜백
 */
export async function requestPayment({ seminar, applicationData, customer, apiBaseUrl, userId, onSuccess, onFail }) {
    if (!PORTONE_IMP_CODE || PORTONE_IMP_CODE === 'imp00000000') {
        alert('결제가 설정되지 않았습니다. 관리자에게 문의해주세요.');
        if (onFail) onFail();
        return;
    }
    if (!PORTONE_CHANNEL_KEY) {
        alert('결제 채널이 설정되지 않았습니다. 관리자에게 문의해주세요.');
        if (onFail) onFail();
        return;
    }
    const amount = Number(seminar?.applicationFee) || 0;
    if (amount <= 0) {
        if (onFail) onFail();
        return;
    }
    const fullName = (customer?.fullName || '').toString().trim() || '구매자';
    const phoneNumber = (customer?.phoneNumber || '').toString().trim();
    const email = (customer?.email || '').toString().trim();
    if (!phoneNumber || !email) {
        alert('연락처 정보가 필요합니다.');
        if (onFail) onFail();
        return;
    }

    const orderName = (seminar?.title || '프로그램 신청').substring(0, 50);
    const merchantUid = getMerchantUid();

    if (useRedirectPayment()) {
        const IMP = typeof window !== 'undefined' ? window.IMP : null;
        if (!IMP) {
            alert('결제를 불러올 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.');
            if (onFail) onFail();
            return;
        }
        if (apiBaseUrl && userId) {
            try {
                const base = apiBaseUrl.replace(/\/$/, '');
                const res = await fetch(`${base}/api/payment/pending`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_uid: merchantUid,
                        seminar_id: seminar.id,
                        user_id: userId,
                        user_name: fullName,
                        user_email: email,
                        user_phone: phoneNumber,
                        application_data: applicationData || {}
                    })
                });
                const data = res.ok ? await res.json().catch(() => ({})) : null;
                if (!res.ok || !data?.saved) {
                    console.warn('paymentService: pending save failed, proceeding with payment window');
                }
            } catch (e) {
                console.warn('paymentService: pending save failed', e);
            }
        }
        setPaymentPending(merchantUid, { seminar, applicationData });
        let redirectFailHandled = false;
        const pgHint = ' 관리자: PortOne 콘솔(admin.portone.io) → 결제 연동 → 채널 관리에서 해당 채널에 PG가 연결되어 있는지 확인해 주세요.';
        const handleRedirectFail = () => {
            if (redirectFailHandled) return;
            redirectFailHandled = true;
            alert('결제창이 열리지 않았습니다. PG 설정을 확인하거나 잠시 후 다시 시도해 주세요.' + pgHint);
            if (onFail) onFail();
        };
        try {
            IMP.init(PORTONE_IMP_CODE);
            IMP.request_pay({
                channelKey: PORTONE_CHANNEL_KEY,
                pay_method: 'card',
                merchant_uid: merchantUid,
                name: orderName,
                amount,
                buyer_email: email,
                buyer_name: fullName,
                buyer_tel: phoneNumber,
                m_redirect_url: getPaymentResultRedirectUrl()
            }, () => {
                // 리다이렉트 방식에서는 콜백이 실행되지 않음. 결과는 /payment/result에서만 처리
            });
            setTimeout(() => {
                if (typeof window === 'undefined') return;
                if (window.location.pathname === '/payment/result') return;
                handleRedirectFail();
            }, 8000);
        } catch (e) {
            redirectFailHandled = true;
            const msg = e?.message || '결제 요청 중 오류가 발생했습니다.';
            const isPgError = /등록된\s*PG|PG\s*설정\s*정보가\s*없습니다/i.test(msg);
            alert(msg + (isPgError ? '\n\n' + pgHint : ''));
            if (onFail) onFail();
        }
        return;
    }

    if (typeof window !== 'undefined' && window.PortOne) {
        const paymentPromise = window.PortOne.requestPayment({
            storeId: PORTONE_IMP_CODE,
            channelKey: PORTONE_CHANNEL_KEY,
            paymentId: merchantUid,
            orderName,
            totalAmount: amount,
            currency: 'CURRENCY_KRW',
            payMethod: 'CARD',
            customer: { fullName, phoneNumber, email }
        });
        paymentPromise.then((response) => {
            if (response?.code != null) {
                alert(response.message || '결제 실패');
                if (onFail) onFail();
                return;
            }
            if (onSuccess) onSuccess(response);
        }).catch((e) => {
            const msg = e?.message || e?.errorMessage || '결제 요청 중 오류가 발생했습니다.';
            const pgHintV2 = ' 관리자: PortOne 콘솔(admin.portone.io) → 결제 연동 → 채널 관리에서 해당 채널에 PG가 연결되어 있는지 확인해 주세요.';
            const isPgError = /등록된\s*PG|PG\s*설정\s*정보가\s*없습니다/i.test(msg);
            alert(msg + (isPgError ? '\n\n' + pgHintV2 : ''));
            if (onFail) onFail();
        });
        return;
    }

    const IMP = typeof window !== 'undefined' ? window.IMP : null;
    if (!IMP) {
        alert('결제를 불러올 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.');
        if (onFail) onFail();
        return;
    }
    IMP.init(PORTONE_IMP_CODE);
    IMP.request_pay({
        channelKey: PORTONE_CHANNEL_KEY,
        pay_method: 'card',
        merchant_uid: merchantUid,
        name: orderName,
        amount,
        buyer_email: email,
        buyer_name: fullName,
        buyer_tel: phoneNumber
    }, (rsp) => {
        if (rsp.success) {
            if (onSuccess) onSuccess(rsp);
        } else {
            const errMsg = rsp?.error_msg || '';
            const pgHintPc = ' 관리자: PortOne 콘솔(admin.portone.io) → 결제 연동 → 채널 관리에서 해당 채널에 PG가 연결되어 있는지 확인해 주세요.';
            const isPgError = /등록된\s*PG|PG\s*설정\s*정보가\s*없습니다/i.test(errMsg);
            if (errMsg) alert(`결제 실패: ${errMsg}` + (isPgError ? '\n\n' + pgHintPc : ''));
            if (onFail) onFail();
        }
    });
}
