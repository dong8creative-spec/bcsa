#!/usr/bin/env node
/**
 * 결제대기(pendingPayments) 문서를 신청(applications)으로 편입하는 일회성 스크립트
 *
 * 사용: API URL을 환경변수 또는 인자로 넘긴 후 실행
 *   VITE_API_URL=https://xxx.cloudfunctions.net/app node scripts/promote-pending-to-application.mjs
 *   node scripts/promote-pending-to-application.mjs https://xxx.cloudfunctions.net/app
 *
 * 이가람님 내마음 세미나 편입 (pending doc id: p_mmana36j_h0bzdo)
 *   node scripts/promote-pending-to-application.mjs [API_BASE_URL] p_mmana36j_h0bzdo
 */

const apiBase = process.env.VITE_API_URL || process.argv[2] || '';
const merchantUid = process.argv[3] || 'p_mmana36j_h0bzdo';

if (!apiBase) {
  console.error('사용법: VITE_API_URL=<URL> node scripts/promote-pending-to-application.mjs [merchant_uid]');
  console.error('   또는: node scripts/promote-pending-to-application.mjs <API_BASE_URL> [merchant_uid]');
  process.exit(1);
}

const url = `${apiBase.replace(/\/$/, '')}/api/admin/application-from-pending`;

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_uid: merchantUid })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      console.log('편입 완료. applicationId:', data.applicationId);
    } else {
      console.error('편입 실패:', res.status, data.error || data);
      process.exit(1);
    }
  } catch (e) {
    console.error('요청 실패:', e.message);
    process.exit(1);
  }
})();
