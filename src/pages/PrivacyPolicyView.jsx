import React from 'react';
import { Icons } from '../components/Icons';
import { BUSINESS_INFO, PRIVACY_SECTIONS, PRIVACY_EFFECTIVE_DATE } from '../constants/legal';

// 처리방침 원문은 constants/legal.js에서 관리 (실제 수집 항목·위탁·국외 이전 기준)
const TITLE = `[${BUSINESS_INFO.legalName}] 개인정보처리방침`;
const SECTIONS = PRIVACY_SECTIONS;

/**
 * 개인정보처리방침 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입)
 * 연락처는 푸터에 있는 대표번호·이메일과 동일하게 표시
 */
export default function PrivacyPolicyView({ onBack }) {
  return (
    <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-white rounded-[28px] border border-black/[0.06] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-black/[0.06] text-center">
            <h1 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-dark">{TITLE}</h1>
            <p className="text-sm text-brand mt-2">* 시행일: {PRIVACY_EFFECTIVE_DATE}</p>
          </div>
          <div className="p-6 md:p-8 space-y-8">
            {SECTIONS.map((section, index) => (
              <section key={index}>
                <h2 className="text-[15px] md:text-base font-semibold text-dark mb-3">{section.title}</h2>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <span className="whitespace-pre-line">{section.body}</span>
                </div>
              </section>
            ))}
          </div>
          <div className="p-6 md:p-8 border-t border-black/[0.06] flex justify-center">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : window.history.back())}
              className="px-6 py-3 bg-brand text-white font-semibold rounded-full hover:bg-[#00327a] transition-colors flex items-center gap-2"
            >
              <Icons.ArrowLeft size={20} />
              이전으로
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
