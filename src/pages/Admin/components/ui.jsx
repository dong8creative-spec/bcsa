import React, { useEffect, useRef, useState } from 'react';

/**
 * 관리자 화면 공통 디자인 규칙 (소모임·스터디 탭의 새 디자인 기준)
 * - 카드·창: rounded-2xl + 옅은 테두리 / 버튼·입력칸: rounded-lg / 필터·배지: rounded-full
 * - 버튼 색: 주요 동작=브랜드 파랑, 보조·닫기·취소=흰색 테두리, 위험(삭제·탈퇴·반려)=빨강
 * - 글자는 12px(text-xs) 이상만 쓴다
 */
export const BTN = {
  base: 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  primary: 'bg-brand text-white hover:bg-brand/90',
  secondary: 'bg-white text-slate-700 border border-black/10 hover:bg-slate-50',
  soft: 'bg-soft text-dark hover:bg-slate-200/70',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700',
};

export const btn = (variant = 'secondary', size = 'md') => `${BTN.base} ${BTN[size]} ${BTN[variant]}`;

export const CARD = 'bg-white rounded-2xl border border-black/[0.06]';
export const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-sm focus:border-brand focus:outline-none';

export const chip = (active) =>
  `px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${active ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-black/10 hover:bg-slate-50'}`;

/** 화면 제목 줄: 제목 + 한 줄 설명 + 오른쪽 버튼 */
export const AdminPageHeader = ({ title, description, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
    <div className="min-w-0">
      <h2 className="text-2xl font-bold text-dark">{title}</h2>
      {description ? <p className="text-sm text-slate-500 mt-1 break-keep">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

/** 받침에 따라 을/를 */
const eulReul = (word) => {
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return '을(를)';
  return (c - 0xac00) % 28 ? '을' : '를';
};

/** 불러오기 실패 안내 — 숫자 0과 헷갈리지 않게 따로 보여 준다 */
export const LoadError = ({ what = '목록', onRetry }) => (
  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-2">
    <span>{what}{eulReul(what)} 불러오지 못했어요. 숫자가 0으로 보여도 실제와 다를 수 있어요.</span>
    {onRetry ? <button type="button" onClick={onRetry} className={btn('secondary', 'sm')}>다시 불러오기</button> : null}
  </div>
);

// ───────────────────────── 화면 안 확인창 (브라우저 기본 팝업 대신) ─────────────────────────

let pushDialog = null;
const queue = [];

const open = (opts) => new Promise((resolve) => {
  const item = { ...opts, resolve };
  if (pushDialog) pushDialog(item);
  else queue.push(item);
});

/** 알림: 확인 버튼 하나. await 하지 않아도 된다 */
export const adminAlert = (message, opts = {}) => open({ kind: 'alert', message: String(message ?? ''), ...opts });

/** 확인: true/false */
export const adminConfirm = (message, opts = {}) => open({ kind: 'confirm', message: String(message ?? ''), ...opts });

/** 입력: 입력값 문자열 또는 취소 시 null */
export const adminPrompt = (message, opts = {}) => open({ kind: 'prompt', message: String(message ?? ''), ...opts });

/** AdminLayout에 한 번만 둔다 */
export const AdminDialogHost = () => {
  const [items, setItems] = useState([]);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const okRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    pushDialog = (item) => setItems((prev) => [...prev, item]);
    if (queue.length) setItems((prev) => [...prev, ...queue.splice(0)]);
    return () => { pushDialog = null; };
  }, []);

  const current = items[0];

  useEffect(() => {
    if (!current) return;
    setValue(current.defaultValue ?? '');
    // 위험한 동작(삭제·탈퇴 등)은 실수로 Enter를 눌러도 실행되지 않게 '취소'에 먼저 초점을 둔다
    const target = current.kind === 'prompt' ? inputRef.current : current.danger && current.kind === 'confirm' ? cancelRef.current : okRef.current;
    const t = setTimeout(() => target?.focus(), 30);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const close = (result) => {
    current.resolve(result);
    setItems((prev) => prev.slice(1));
  };
  const cancelValue = current.kind === 'confirm' ? false : current.kind === 'prompt' ? null : undefined;
  const okValue = current.kind === 'confirm' ? true : current.kind === 'prompt' ? value : undefined;
  const required = current.kind === 'prompt' && current.required;
  const mismatch = current.kind === 'prompt' && current.mustEqual != null && value.trim() !== current.mustEqual;
  const okDisabled = (required && !value.trim()) || mismatch;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(cancelValue); }
    if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON' && current.kind !== 'prompt' && !current.danger && !e.shiftKey) { e.preventDefault(); close(okValue); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40" onKeyDown={onKeyDown} role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(cancelValue); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        {current.title ? <h3 className="text-lg font-bold text-dark mb-2">{current.title}</h3> : null}
        <p className="text-sm text-slate-700 whitespace-pre-wrap break-keep leading-relaxed">{current.message}</p>
        {current.kind === 'prompt' ? (
          current.multiline ? (
            <textarea ref={inputRef} rows={4} maxLength={current.maxLength || 500} value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={current.placeholder || ''} className={`${INPUT} mt-3 resize-none`} />
          ) : (
            <input ref={inputRef} value={value} maxLength={current.maxLength || 200} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !okDisabled) { e.preventDefault(); close(value); } }}
              placeholder={current.placeholder || ''} className={`${INPUT} mt-3`} />
          )
        ) : null}
        <div className="flex justify-end gap-2 mt-5">
          {current.kind !== 'alert' ? (
            <button ref={cancelRef} type="button" onClick={() => close(cancelValue)} className={btn('secondary')}>{current.cancelText || '취소'}</button>
          ) : null}
          <button ref={okRef} type="button" disabled={okDisabled} onClick={() => close(okValue)}
            className={btn(current.danger ? 'dangerSolid' : 'primary')}>
            {current.okText || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};
