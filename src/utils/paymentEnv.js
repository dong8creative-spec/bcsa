/**
 * 결제 환경 감지: 모바일/CEP·UXP 여부에 따라 리다이렉트 결제 vs 표준 결제 분기용
 */

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;
const CEP_UXP_UA = /CEP|UXP|Adobe|AEM|CepSession/i;

/**
 * 모바일 기기(또는 모바일 UA) 여부
 */
export function isMobile() {
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
    return MOBILE_UA.test(navigator.userAgent);
}

/**
 * CEP/UXP(포토샵·프리미어 플러그인) Webview 여부
 * User-Agent 또는 window.cep 등 플러그인 환경 힌트 검사
 */
export function isCEPOrUXP() {
    if (typeof window !== 'undefined' && window.cep) return true;
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
    return CEP_UXP_UA.test(navigator.userAgent);
}

/**
 * 리다이렉트 결제(m_redirect_url)를 사용할 환경인지
 * true면 모바일 전용 API(리다이렉트)만 사용하고, PC 전용 INIStdPay 호출 금지
 */
export function useRedirectPayment() {
    return isMobile() || isCEPOrUXP();
}
