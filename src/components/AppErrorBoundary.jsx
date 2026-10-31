import React from 'react';

/**
 * 화면 하나에서 오류가 나도 사이트 전체가 하얗게 비지 않게 막는 최상위 안전망.
 * 새 버전 배포 직후 예전 화면 조각을 못 받는 경우(chunk 로드 실패)는 한 번만 자동 새로고침한다.
 */
const RELOAD_KEY = 'bcsa:chunk-reload-at';

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(msg);
}

/**
 * 새 버전 화면(index.html)을 받아 새로고침한다. 60초 안에 이미 한 번 했으면 다시 하지 않는다 (무한 새로고침 방지).
 * 브라우저는 index.html을 잠시(GitHub Pages 10분, Firebase 1시간) 저장해 두기 때문에 그냥 새로고침하면
 * 옛 index.html을 다시 써서 같은 오류가 반복된다. 그래서 저장본을 건너뛰고 새로 받아 둔 뒤 새로고침한다.
 */
export function reloadOnceForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch (_) { /* 저장소를 못 쓰면 그냥 새로고침 */ }
  const reload = () => window.location.reload();
  try {
    fetch(window.location.href, { cache: 'reload', credentials: 'same-origin' }).then(reload, reload);
    setTimeout(reload, 3000);
  } catch (_) {
    reload();
  }
  return true;
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewVersion();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-white">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">화면을 불러오지 못했어요</p>
          <p className="mt-2 text-[15px] text-slate-500 break-keep">사이트가 새로 바뀌었거나 잠깐 문제가 생겼어요. 새로고침하면 대부분 바로 해결돼요.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold">새로고침</button>
            <a href="/" className="px-5 py-2.5 rounded-lg border border-black/10 text-sm font-semibold text-slate-700">홈으로</a>
          </div>
        </div>
      </div>
    );
  }
}
