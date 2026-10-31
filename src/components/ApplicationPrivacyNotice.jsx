import React from 'react';
import { APPLICATION_PRIVACY_CONSENT, LEGAL_VERSION } from '../constants/legalCore';

/** 신청서에 함께 저장할 동의 기록 (서버 시각은 신청 문서 createdAt, 여기 agreedAt은 기기 시각) */
export const buildApplicationPrivacyConsent = () => ({
    agreed: true,
    version: LEGAL_VERSION,
    agreedAt: new Date().toISOString(),
    noticeShown: true,
});

/**
 * 프로그램 신청 개인정보 수집·이용 동의 (4가지 고지: 항목·목적·보관 기간·거부 권리)
 * 체크박스 위에 내용을 먼저 보여 준다 (개인정보 보호법 제15조 제2항).
 */
export default function ApplicationPrivacyNotice({ checked, onChange, id = 'application-privacy' }) {
    return (
        <div className="p-4 bg-brand/5 rounded-2xl border border-brand/10">
            <p className="text-sm font-bold text-gray-800 mb-2">개인정보 수집·이용 안내 <span className="text-red-500">*</span></p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] leading-relaxed mb-3">
                {APPLICATION_PRIVACY_CONSENT.items.map((r) => (
                    <React.Fragment key={r.k}>
                        <dt className="text-gray-500 whitespace-nowrap">{r.k}</dt>
                        <dd className="text-gray-700 break-keep">{r.v}</dd>
                    </React.Fragment>
                ))}
            </dl>
            <p className="text-xs text-gray-500 mb-3 break-keep">
                자세한 내용은 <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand underline">개인정보처리방침</a>에서 볼 수 있어요.
            </p>
            <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
                <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 text-brand rounded shrink-0" />
                <span className="text-sm font-bold text-gray-700 break-keep">{APPLICATION_PRIVACY_CONSENT.label} <span className="text-red-500">*</span></span>
            </label>
        </div>
    );
}
