import React from 'react';
import { Icons } from '../components/Icons';
import { BUSINESS_INFO, TERMS_SECTIONS, TERMS_EFFECTIVE_DATE } from '../constants/legal';

// 약관 원문은 가입 화면과 같은 것을 쓰도록 constants/legal.js에서 관리
const TITLE = `[${BUSINESS_INFO.legalName}] 서비스 이용약관`;
const SECTIONS = TERMS_SECTIONS;
const EFFECTIVE_DATE = TERMS_EFFECTIVE_DATE;

/**
 * 서비스 이용약관 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입)
 */
export default function TermsOfServiceView({ onBack }) {
  return (
    <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-white rounded-[28px] border border-black/[0.06] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-black/[0.06] text-center">
            <h1 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-dark">{TITLE}</h1>
            <p className="text-sm text-brand mt-2">* 시행일: {EFFECTIVE_DATE}</p>
          </div>
          <div className="p-6 md:p-8 space-y-8">
            {SECTIONS.map((section, index) => (
              <section key={index}>
                <h2 className="text-[15px] md:text-base font-semibold text-dark mb-3">{section.title}</h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.body}
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
