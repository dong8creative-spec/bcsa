import React, { useMemo, useState } from 'react';
import { serverTimestamp, arrayUnion } from 'firebase/firestore';
import { firebaseService } from '../services/firebaseService';
import {
    MARKETING_CHANNELS, MARKETING_CONSENT, MYPAGE_MENU,
    buildMarketingConsent, buildMarketingResultNotice, getMarketingConsentState, LEGAL_VERSION,
} from '../constants/legal';

const toDate = (v) => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v.seconds != null) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};
const fmt = (d) => (d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '');

/**
 * 마이페이지 「광고성 정보 수신 설정」
 * - 동의·철회와 받는 방법(이메일·문자·카카오톡)을 바꾸고, 처리 결과를 화면에 바로 보여 준다
 *   (정보통신망법 제50조 제7항·시행령 제62조의2: 전송자, 사실과 날짜, 처리 결과)
 * - users/{uid}.marketingConsent 에 서버 시각으로 저장, 변경 이력은 marketingConsentLog 에 쌓는다
 * - 예전 가입자(marketingAgreed만 있고 동의 일시가 없음)는 '미확인'으로 보고 보내지 않는다
 */
export default function MarketingConsentSection({ user }) {
    const uid = user?.uid || user?.id;
    const [local, setLocal] = useState(null); // 저장 후 화면용 { agreed, channels, at: Date, notice }
    const state = useMemo(() => getMarketingConsentState(user), [user]);
    const current = local
        ? { status: local.agreed ? 'agreed' : 'declined', channels: local.channels, at: local.at }
        : {
            status: state.status,
            channels: state.channels,
            at: toDate(state.status === 'agreed' ? state.consent?.agreedAt : state.consent?.withdrawnAt || state.consent?.updatedAt),
        };
    const [draft, setDraft] = useState(() => (state.status === 'agreed' ? state.channels : []));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const notice = local?.notice || user?.marketingConsent?.resultNotice || '';

    const toggle = (key) => setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));

    const save = async (agreed) => {
        if (!uid) return;
        if (agreed && draft.length === 0) { setError('받을 방법을 하나 이상 골라 주세요.'); return; }
        setError('');
        setSaving(true);
        const now = new Date();
        const channels = agreed ? draft : [];
        const resultNotice = buildMarketingResultNotice({ agreed, channels, date: now });
        try {
            const at = serverTimestamp();
            await firebaseService.updateUser(uid, {
                marketingAgreed: agreed,
                marketingConsent: { ...buildMarketingConsent({ agreed, channels, at, source: 'mypage' }), resultNotice, resultNoticeShownAt: at },
                // 서버 시각은 배열에 넣을 수 없어 기기 시각(ISO)으로 남기고, 위 updatedAt이 서버 시각이다
                marketingConsentLog: arrayUnion({ agreed, channels, at: now.toISOString(), source: 'mypage', version: LEGAL_VERSION }),
            });
            setLocal({ agreed, channels, at: now, notice: resultNotice });
            if (!agreed) setDraft([]);
        } catch (e) {
            setError(`저장하지 못했어요. 잠시 후 다시 시도해 주세요. (${e?.code || e?.message || '오류'})`);
        } finally {
            setSaving(false);
        }
    };

    const labels = (keys) => keys.map((k) => MARKETING_CHANNELS.find((c) => c.key === k)?.label).filter(Boolean).join('·');

    return (
        <section className="border-t border-black/[0.06] pt-8 pb-6" aria-labelledby="marketing-consent-title">
            <h4 id="marketing-consent-title" className="text-sm font-semibold text-gray-700 mb-3">{MYPAGE_MENU.marketing}</h4>
            <div className="rounded-2xl border border-black/[0.06] bg-gray-50 p-4 md:p-5 space-y-4">
                <div className="text-sm text-gray-800 break-keep">
                    {current.status === 'agreed' ? (
                        <p><b className="text-brand">수신 동의</b> · {labels(current.channels)}{current.at ? ` · ${fmt(current.at)} 동의` : ''}</p>
                    ) : current.status === 'declined' ? (
                        <p><b>수신 안 함</b>{current.at ? ` · ${fmt(current.at)} 처리` : ''}</p>
                    ) : current.status === 'unverified' ? (
                        <p><b className="text-amber-700">동의 기록 미확인</b> · 예전 가입 때 받은 동의는 날짜와 받는 방법이 남아 있지 않아요. 그래서 지금은 광고성 정보를 보내지 않아요. 받고 싶으시면 아래에서 다시 동의해 주세요.</p>
                    ) : (
                        <p><b>수신 안 함</b> · 동의하지 않으셨어요.</p>
                    )}
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] leading-relaxed">
                    {MARKETING_CONSENT.summary.map((r) => (
                        <React.Fragment key={r.k}>
                            <dt className="text-gray-500 whitespace-nowrap">{r.k}</dt>
                            <dd className="text-gray-700 break-keep">{r.v}</dd>
                        </React.Fragment>
                    ))}
                </dl>

                <fieldset>
                    <legend className="text-[13px] text-gray-600 mb-1.5">받는 방법</legend>
                    <div className="flex flex-wrap gap-2">
                        {MARKETING_CHANNELS.map((c) => {
                            const on = draft.includes(c.key);
                            return (
                                <label key={c.key} className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm cursor-pointer ${on ? 'border-brand bg-white text-brand font-semibold' : 'border-black/10 bg-white text-gray-600'}`}>
                                    <input type="checkbox" className="w-4 h-4 text-brand rounded" checked={on} onChange={() => toggle(c.key)} />
                                    {c.label}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => save(true)} className="px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold disabled:opacity-60">
                        {saving ? '저장 중…' : current.status === 'agreed' ? '받는 방법 저장' : '동의하고 받기'}
                    </button>
                    {current.status === 'agreed' ? (
                        <button type="button" disabled={saving} onClick={() => save(false)} className="px-5 py-2.5 rounded-full border border-black/10 bg-white text-sm font-semibold text-gray-700 disabled:opacity-60">
                            수신 동의 철회
                        </button>
                    ) : null}
                </div>

                {notice ? (
                    <p role="status" className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-[13px] text-gray-800 break-keep">{notice}</p>
                ) : null}
            </div>
        </section>
    );
}
