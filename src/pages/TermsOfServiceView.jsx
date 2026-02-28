import React from 'react';
import { Icons } from '../components/Icons';

const TITLE = '[부산청년사업가 포럼] 서비스 이용약관';

const SECTIONS = [
  {
    title: '제1조 (목적)',
    body: `본 약관은 [부산청년사업가 포럼](이하 "회사"라 함)이 운영하는 웹사이트 및 오프라인 서비스(세미나, 네트워킹 파티, 온라인 콘텐츠 등)를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (용어의 정의)',
    body: `"서비스"란 회사가 제공하는 온·오프라인 행사 기획, 티켓 판매, 디지털 콘텐츠 제공 등의 비즈니스 인프라 일체를 의미합니다.

"회원"이란 본 약관에 동의하고 소셜 로그인(카카오 등)을 통해 시스템에 등록되어 서비스를 이용하는 자를 말합니다.`,
  },
  {
    title: '제3조 (회원가입 및 계정 무결성 유지)',
    body: `회원가입은 이용자가 소셜 로그인 API를 통해 제공하는 정보(이름, 전화번호 등)를 바탕으로 이루어집니다.

회원은 반드시 본인의 실명 및 실제 정보를 제공해야 합니다. 타인의 정보(사업자등록번호, 명함 등)를 도용하거나 허위 데이터를 인젝션(Injection)하여 가입한 경우, 사전 통보 없이 계정이 영구 삭제(Drop)되며 관련 법령에 따라 민·형사상의 책임을 질 수 있습니다.`,
  },
  {
    title: '제4조 (서비스 이용 및 결제)',
    body: `오프라인 행사 티켓 및 온라인 강의는 플랫폼 내 연동된 결제 모듈(PG)을 통해 구매할 수 있습니다.

결제 완료 시 시스템은 회원의 연락처(알림톡/문자)로 예약 확정 데이터를 전송합니다.`,
  },
  {
    title: '제5조 (취소 및 환불 정책)',
    body: `회사는 디지털 콘텐츠 및 오프라인 공간 대관의 특성을 고려하여 다음과 같은 엄격한 환불 알고리즘을 적용합니다.

· 온라인 VOD 강의: 결제 후 재생 이력(Log)이 없는 경우 7일 이내 100% 환불 가능. 단, 1초라도 스트리밍 데이터가 전송된 경우 환불이 불가합니다.

· 오프라인 행사 (세미나/파티):
  - 행사일 기준 [7]일 전 취소 시: 100% 환불
  - 행사일 기준 [3]일 전 취소 시: 50% 환불
  - 행사일 기준 2일 전 ~ 당일 (노쇼 포함): 환불 불가 (오프라인 수용 인원 및 식음료 사전 예약으로 인한 리소스 고정 할당 때문임)`,
  },
  {
    title: '제6조 (금지된 트랜잭션 및 이용 제한)',
    body: `회원은 다음의 행위를 해서는 안 되며, 적발 시 즉각적인 서비스 접근 차단 및 강제 탈퇴 조치됩니다.

· 다단계, 코인 사기, 불법 영업 목적으로 네트워킹에 참여하는 행위

· 다른 회원의 개인정보를 무단으로 크롤링(수집)하거나 스팸을 발송하는 행위

· 플랫폼의 정상적인 로직을 방해하거나 시스템에 과부하를 주는 행위`,
  },
  {
    title: '제6조의2 (탈퇴 및 재가입)',
    body: `· 자진 탈퇴: 회원이 마이페이지 등에서 직접 탈퇴한 경우, 언제든 동일 계정 또는 동일 정보로 재가입할 수 있습니다.

· 강제 탈퇴: 관리자에 의해 이용약관 위반 등으로 강제 탈퇴 처리된 회원은 탈퇴일로부터 1년간 재가입이 제한됩니다. 1년이 경과한 이후에는 재가입이 가능합니다.

회원은 위 내용을 인지하고 서비스를 이용하여야 합니다.`,
  },
  {
    title: '제7조 (면책 조항)',
    body: `회사는 네트워킹 파티 등에서 회원 간에 자발적으로 이루어진 투자, 거래, 계약 등 오프라인 상호작용(Interaction)에 대해 어떠한 법적 책임도 지지 않습니다. (플랫폼은 연결 공간만 제공할 뿐, 개별 노드(회원) 간의 데이터 교환을 보증하지 않습니다.)

천재지변, 서버 호스팅 업체의 장애(DDoS, 망 장애 등)로 인해 서비스가 중단된 경우 회사는 손해배상 책임을 면합니다.`,
  },
  {
    title: '제8조 (관할법원)',
    body: `본 서비스 이용과 관련하여 분쟁이 발생할 경우, 회사의 본점 소재지(부산광역시 연제구)를 관할하는 법원을 제1심 합의관할 법원으로 합니다.`,
  },
];

const EFFECTIVE_DATE = '2026년 1월 5일';

/**
 * 서비스 이용약관 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입)
 */
export default function TermsOfServiceView({ onBack }) {
  return (
    <div className="min-h-screen bg-soft pt-24 pb-20 px-4 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-blue-100 text-center">
            <h1 className="text-xl md:text-2xl font-bold text-dark">{TITLE}</h1>
            <p className="text-sm text-brand mt-2">* 시행일: {EFFECTIVE_DATE}</p>
          </div>
          <div className="p-6 md:p-8 space-y-8">
            {SECTIONS.map((section, index) => (
              <section key={index}>
                <h2 className="text-base md:text-lg font-bold text-dark mb-3">{section.title}</h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.body}
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
