import React from 'react';
import { Icons } from '../components/Icons';
import { MgWrap, MgPageHead } from '../components/mg/Mg';
import { GROUP_REFUND_SECTION } from '../constants/legal';

const TITLE = '[부산청년사업가 포럼] 취소 및 환불 규정';

const SECTIONS = [
  {
    title: '제1조 (목적)',
    body: `본 규정은 '부산청년사업가 포럼'(이하 "포럼")이 제공하는 유료 세미나·교육 프로그램과 회원 그룹(소모임·스터디) 회차 참가비의 취소 및 환불에 관한 사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (환불 기준)',
    body: `회원은 세미나 시작 전까지 취소를 요청할 수 있으며, 환불액은 '소비자분쟁해결기준'에 의거하여 취소 시점에 따라 차등 적용됩니다.

1. 환불 적용 기간 및 비율
· 세미나 개최 3일 전 (23:59까지): 결제 금액 100% 환불
· 세미나 개최 2일 전 (23:59까지): 결제 금액의 90% 환불 (위약금 10% 공제)
· 세미나 개최 1일 전 (23:59까지): 결제 금액의 80% 환불 (위약금 20% 공제)
· 세미나 당일 및 시작 시간 이후: 환불 불가 (노쇼 포함)

2. 패키지 상품 (세미나+자료) 예외 조항
· 세미나 참가권과 디지털 자료(PDF, 영상 등)가 결합된 상품의 경우, 자료를 다운로드하거나 열람한 이력이 확인되면 해당 자료 비용(정가 기준)을 공제한 후 남은 차액에 대해 위 기간별 비율을 적용합니다.`,
  },
  {
    title: '제3조 (환불 신청 방법)',
    bodyBefore: '1. 환불 신청은 [마이페이지 > 결제내역]에서 직접 취소하거나, 포럼 공식 이메일(',
    bodyAfter: ')로 접수해야 합니다.\n2. 유선(전화)을 통한 구두 취소는 정확한 시점 확인이 어려워 인정되지 않으며, 시스템상 기록이 남는 온라인 신청을 원칙으로 합니다.',
  },
  {
    title: '제4조 (포럼 귀책사유 및 폐강)',
    body: `1. 천재지변, 강사 부재, 최소 인원 미달 등 포럼 측의 사정으로 세미나가 취소될 경우, 시점과 관계없이 결제 금액 100%를 전액 환불합니다.
2. 환불 처리는 취소 확정일로부터 영업일 기준 3~5일 이내에 진행됩니다.`,
  },
  GROUP_REFUND_SECTION,
];

const FOOTER_EMAIL = 'pujar@naver.com';

/**
 * 취소/환불 규정 전용 페이지 (개인정보처리방침·이용약관과 동일 스타일)
 */
export default function RefundPolicyView({ onBack, content }) {
  const email = content?.footer_email || FOOTER_EMAIL;

  return (
    <div className="min-h-screen bg-white">
      <MgPageHead eyebrow="REFUND" title="취소 및 환불 규정" desc={'유료 세미나 및 교육 프로그램 취소·환불에 관한 규정입니다.'} />
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
                  {section.bodyBefore != null ? (
                    <>
                      {section.bodyBefore}
                      <a href={`mailto:${email}`} className="font-semibold text-royal underline-offset-2 hover:underline">{email}</a>
                      {section.bodyAfter}
                    </>
                  ) : (
                    section.body
                  )}
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
