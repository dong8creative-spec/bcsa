import React from 'react';
import { Icons } from '../components/Icons';
import { defaultContent } from '../constants/content';

const TITLE = '[부산청년사업가 포럼] 개인정보처리방침';

const SECTIONS = [
  {
    title: '제1조 (개인정보의 처리 목적)',
    body: `[부산청년사업가 포럼]은(는) 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.

· 회원 가입 및 관리: 회원제 서비스 제공에 따른 본인 식별·인증, 불량 회원의 부정 이용 방지(사업자 신분 도용 및 사기 행위 차단), 가입 의사 확인

· 오프라인 행사 운영: 세미나, 네트워킹 파티 등 오프라인 행사 참석자 명단 관리 및 현장 본인 확인

· 재화 또는 서비스 제공: 서비스 제공, 청구서 발송, 콘텐츠 제공, 맞춤서비스 제공, 본인인증, 연령인증, 요금결제·정산`,
  },
  {
    title: '제2조 (처리하는 개인정보 항목)',
    body: `시스템은 최소한의 데이터만 수집합니다.

· 필수항목: 성명, 휴대전화번호, 이메일, 사업자등록번호(또는 재직증명 데이터), 카카오톡 프로필 정보

· 선택항목: 주소, 회사명, 직책

· 자동수집항목: IP 주소, 쿠키, 서비스 이용 기록, 방문 기록`,
  },
  {
    title: '제3조 (개인정보의 처리 및 보유기간)',
    body: `① 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
② 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 아래와 같이 법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.

· 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)

· 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)

· 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)`,
  },
  {
    title: '제4조 (개인정보의 파기절차 및 파기방법)',
    body: `이용자의 개인정보는 목적 달성 후 즉시 파기됩니다. 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.`,
  },
  {
    title: '제5조 (이용자 및 법정대리인의 권리와 그 행사방법)',
    body: `이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 가입 해지를 요청할 수도 있습니다.`,
  },
  {
    title: '제6조 (개인정보 보호책임자)',
    body: `· 성명: 정은지
· 직책: 대표
· 연락처:`,
    contactLinesKey: 'footer', // 푸터 대표번호·이메일과 동일하게 표시
  },
];

/**
 * 개인정보처리방침 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입)
 * 연락처는 푸터에 있는 대표번호·이메일과 동일하게 표시
 */
export default function PrivacyPolicyView({ onBack, content }) {
  const footerPhone = content?.footer_phone || defaultContent.footer_phone;
  const footerEmail = content?.footer_email || defaultContent.footer_email;
  const contactLines = [`☎ ${footerPhone}`, `✉ ${footerEmail}`];

  return (
    <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-blue-100 text-center">
            <h1 className="text-xl md:text-2xl font-bold text-dark">{TITLE}</h1>
            <p className="text-sm text-brand mt-2">* 시행일 등 추가 안내는 포럼 운영정책에 따릅니다.</p>
          </div>
          <div className="p-6 md:p-8 space-y-8">
            {SECTIONS.map((section, index) => (
              <section key={index}>
                <h2 className="text-base md:text-lg font-bold text-dark mb-3">{section.title}</h2>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {section.contactLinesKey === 'footer' ? (
                    <>
                      <span className="whitespace-pre-line">{section.body}</span>
                      <span className="inline-block align-top ml-1">
                        {contactLines.map((line, i) => (
                          <div key={i} className="leading-relaxed">{line}</div>
                        ))}
                      </span>
                    </>
                  ) : (
                    <span className="whitespace-pre-line">{section.body}</span>
                  )}
                </div>
              </section>
            ))}
          </div>
          <div className="p-6 md:p-8 border-t border-blue-100 flex justify-center">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : window.history.back())}
              className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
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
