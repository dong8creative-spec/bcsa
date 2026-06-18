/**
 * 결제 확인 공통 폴링 유틸 (PC 표준결제 + 모바일 리다이렉트 결제 공용)
 *
 * 기존에는 PC(paymentService)와 모바일(PaymentResultView)이 각각
 * "complete 1회 → 1초 간격 status 폴링"을 따로 구현해 느리고(고정 1초 간격)
 * complete 재시도가 없어 일시적 검증 지연·콜드스타트에 취약했다.
 *
 * 이 유틸은 다음을 보장한다.
 *  - 초반에는 짧은 간격(250ms~)으로 빠르게 확인 → 점진적으로 간격 증가
 *  - status(가벼운 조회)와 complete(신청 생성)를 함께 재시도
 *  - pending_not_found 처럼 재시도가 무의미한 경우 complete 재호출 중단(status만 유지)
 */

/**
 * @param {Object} params
 * @param {string} params.apiBaseUrl - API 기본 URL
 * @param {string} params.paymentId - 결제 식별자(merchant_uid == V2 paymentId)
 * @param {string} [params.userId] - complete 본인 검증용 (서버가 토큰과 대조)
 * @param {string} [params.idToken] - Firebase ID 토큰 (Authorization 헤더)
 * @param {number} [params.maxMs=20000] - 최대 폴링 시간(ms)
 * @returns {Promise<{ completed: boolean, reason?: string, applicationId?: string, seminarId?: string }>}
 */
export async function pollPaymentUntilComplete({ apiBaseUrl, paymentId, userId, idToken, maxMs = 20000 }) {
    const base = (apiBaseUrl || '').replace(/\/$/, '');
    if (!base || !paymentId) return { completed: false, reason: 'no_base_or_id' };

    const authHeaders = idToken ? { Authorization: `Bearer ${idToken}` } : {};
    let lastMeta = {};

    const tryComplete = async () => {
        try {
            const r = await fetch(`${base}/api/payment/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ paymentId, userId })
            });
            const data = await r.json().catch(() => ({}));
            if (data.applicationId) lastMeta = { applicationId: data.applicationId, seminarId: data.seminarId };
            return data;
        } catch (_) {
            return {};
        }
    };

    const tryStatus = async () => {
        try {
            const r = await fetch(`${base}/api/payment/status?paymentId=${encodeURIComponent(paymentId)}`);
            const d = await r.json().catch(() => ({}));
            if (d.applicationId) lastMeta = { applicationId: d.applicationId, seminarId: d.seminarId };
            return d.completed === true;
        } catch (_) {
            return false;
        }
    };

    // 1차: complete 즉시 시도 (대부분의 정상 결제는 여기서 완료)
    const first = await tryComplete();
    if (first.ok === true) return { completed: true, ...lastMeta };
    if (first.error === 'capacity_full') return { completed: false, reason: 'capacity_full', ...lastMeta };

    // pending이 아예 없으면 complete 재시도는 무의미 → status(웹훅 복구)만 확인
    let retryComplete = first.error !== 'pending_not_found';
    let lastReason = first.error || 'pending';

    // 초반 짧게(빠른 반영) → 점진적으로 길게 (합계 약 17.8초)
    const intervals = [250, 250, 300, 500, 700, 1000, 1000, 1500, 2000, 2500, 3000, 3000];
    const start = Date.now();

    for (let i = 0; i < intervals.length && Date.now() - start < maxMs; i++) {
        await new Promise((r) => setTimeout(r, intervals[i]));

        if (await tryStatus()) return { completed: true, ...lastMeta };

        if (retryComplete) {
            const c = await tryComplete();
            if (c.ok === true) return { completed: true, ...lastMeta };
            if (c.error === 'capacity_full') return { completed: false, reason: 'capacity_full', ...lastMeta };
            lastReason = c.error || lastReason;
            if (c.error === 'pending_not_found') retryComplete = false;
        }
    }

    return { completed: false, reason: lastReason, ...lastMeta };
}
