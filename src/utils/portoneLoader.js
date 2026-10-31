/**
 * 포트원 V2 결제·본인인증 SDK를 필요할 때 불러온다.
 * 예전에는 index.html <head>에서 동기 로드해 첫 화면 그리기를 막았다.
 * 이제는 페이지가 뜬 뒤 한가할 때 미리 받아 두고, 결제·본인인증 직전에 한 번 더 확인한다.
 */
const PORTONE_SDK_URL = 'https://cdn.portone.io/v2/browser-sdk.js';
let loading = null;

export function ensurePortOne() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.PortOne) return Promise.resolve(window.PortOne);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const done = () => resolve(window.PortOne || null);
    let script = document.querySelector(`script[src="${PORTONE_SDK_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = PORTONE_SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => {
      // 실패한 <script>를 남겨 두면 다음 결제 때 같은 태그를 다시 기다리다 15초씩 멈추므로 지운다
      script.remove();
      loading = null;
      resolve(null);
    }, { once: true });
    setTimeout(() => {
      if (!window.PortOne) { loading = null; }
      done();
    }, 15000);
  });
  return loading;
}

/** 첫 화면을 다 그린 뒤 한가할 때 미리 받아 둔다 (결제 버튼 누를 때 기다리지 않게) */
export function preloadPortOneWhenIdle() {
  if (typeof window === 'undefined') return;
  const run = () => { ensurePortOne(); };
  const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 5000 }) : setTimeout(run, 2000));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
