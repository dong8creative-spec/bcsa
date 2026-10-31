import React from 'react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import { BUSINESS_INFO, TERMS_SECTIONS } from '../constants/legal';

// 약관 원문은 가입 화면과 같은 것을 쓰도록 constants/legal.js에서 관리
const TITLE = `[${BUSINESS_INFO.legalName}] 서비스 이용약관`;

/** 서비스 이용약관 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입) */
export default function TermsOfServiceView({ onBack }) {
  return <LegalDocumentPage docKey="terms" title={TITLE} sections={TERMS_SECTIONS} onBack={onBack} />;
}
