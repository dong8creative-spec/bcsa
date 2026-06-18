/** 결제 취소 API 오류 → 이용자 안내 문구 */
export function formatPaymentCancelError(data, resOk) {
    const code = data?.error || '';
    const msg = data?.message || '';

    if (code === 'application_not_found') {
        return '해당 신청 내역을 찾을 수 없습니다. 로그인 계정을 확인하거나 이메일로 문의해 주세요.';
    }
    if (code === 'refund_not_allowed') {
        return msg || '세미나 당일 이후에는 환불이 불가능합니다. 이메일로 문의해 주세요.';
    }
    if (code === 'payment_config_missing') {
        return msg || '결제 취소 시스템 설정이 완료되지 않았습니다. 잠시 후 다시 시도하거나 이메일로 문의해 주세요.';
    }
    if (code === 'unauthorized' || code === 'invalid_token') {
        return '로그인이 만료되었습니다. 다시 로그인한 뒤 취소를 시도해 주세요.';
    }
    if (code === 'payment_not_found') {
        return '결제 정보를 찾을 수 없습니다. 이미 취소하셨다면 「신청 기록 삭제」를 이용해 주세요.';
    }
    if (!resOk && msg) return msg;
    if (!resOk && code) return `취소 실패: ${code}. 이메일로 문의해 주세요.`;
    return '취소 처리에 실패했습니다. 이메일로 문의해 주세요.';
}

/** 결제·신청 완료 안내 (프로그램명 포함) */
export function formatPaymentApplySuccess(seminarTitle, { serverCompleted = true } = {}) {
    const title = (seminarTitle || '프로그램').trim();
    if (serverCompleted) {
        return `"${title}" 결제 및 신청이 완료되었습니다.\n마이페이지에서 신청 내역을 확인할 수 있습니다.`;
    }
    return `결제는 완료되었으나 신청 확인이 지연되고 있습니다.\n1~2분 후 마이페이지에서 "${title}" 신청 여부를 확인해 주세요.`;
}

/** 정원 초과로 자동 환불 안내 */
export function formatCapacityFullRefund(seminarTitle) {
    const title = (seminarTitle || '프로그램').trim();
    return `"${title}"의 정원이 마감되어 결제가 자동 취소(환불)되었습니다.\n환불은 영업일 기준 3~5일 내 처리됩니다.`;
}
