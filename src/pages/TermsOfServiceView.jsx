import React from 'react';
import { Icons } from '../components/Icons';
import { MgWrap, MgPageHead } from '../components/mg/Mg';
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
    <div className="min-h-screen bg-white">
      <MgPageHead eyebrow="TERMS" title="서비스 이용약관" desc={`시행일: ${EFFECTIVE_DATE}`} />
      <MgWrap className="py-12 md:py-16">
        <article className="mx-auto max-w-[760px]">
          <header className="border-b border-[#0c0c0e] pb-6">
            <h2 className="break-keep text-[24px] font-bold leading-[1.4] text-ink md:text-[28px]">{TITLE}</h2>
          </header>
          <div className="divide-y divide-line">
            {SECTIONS.map((section, index) => (
              <section key={index} className="py-7 md:py-8">
                <h3 className="mb-3 break-keep text-[18px] font-semibold leading-snug text-ink">{section.title}</h3>
                <div className="text-[16px] leading-[1.85] text-[#333] whitespace-pre-line break-keep">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
          <div className="flex justify-center border-t border-line pt-8">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : window.history.back())}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-line2 bg-white px-6 text-[16px] font-bold text-ink transition-colors hover:border-ink"
            >
              <Icons.ArrowLeft size={20} />
              이전으로
            </button>
          </div>
        </article>
      </MgWrap>
    </div>
  );
}
