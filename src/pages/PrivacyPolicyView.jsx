import React from 'react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import { PRIVACY_TITLE, PRIVACY_SECTIONS } from '../constants/legal';

/**
 * 개인정보처리방침 전용 페이지 (푸터 링크 등에서 별도 페이지로 진입)
 * 원문은 constants/legal.js에서 관리 (실제 수집 항목·위탁·국외 이전 기준)
 */
export default function PrivacyPolicyView({ onBack }) {
  return <LegalDocumentPage docKey="privacy" title={PRIVACY_TITLE} sections={PRIVACY_SECTIONS} onBack={onBack} />;
}
