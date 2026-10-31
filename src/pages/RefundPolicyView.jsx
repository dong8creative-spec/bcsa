import React from 'react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import { REFUND_TITLE, REFUND_SECTIONS } from '../constants/legal';

/**
 * 취소/환불 규정 전용 페이지 (개인정보처리방침·이용약관과 같은 모양)
 * 원문은 constants/legal.js 한 곳에서 관리하며 세미나 신청 화면도 같은 원문을 쓴다.
 */
export default function RefundPolicyView({ onBack }) {
  return (
    <LegalDocumentPage
      docKey="refund"
      title={REFUND_TITLE}
      subtitle="유료 세미나·교육 프로그램과 그룹 회차 참가비의 취소·환불 규정입니다."
      sections={REFUND_SECTIONS}
      onBack={onBack}
    />
  );
}
