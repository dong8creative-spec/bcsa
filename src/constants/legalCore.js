/**
 * 첫 화면 번들에 들어가는 작은 법적 표시 값 (사업자 정보·시행일·신청 동의 고지)
 * 약관·처리방침 본문은 legal.js(필요할 때 내려받는 화면에서만 사용)에 있다.
 */

export const BUSINESS_INFO = {
  brandName: '부산청년사업가들',
  legalName: '부산청년사업가 포럼',
  ceo: '정은지',
  bizNo: '792-72-00616',
  bizNoDigits: '7927200616',
  mailOrderNo: '제 2026-부산연제-0018 호',
  address: '부산광역시 연제구 법원남로9번길 17(거제동)',
  phone: '070-8064-7238',
  email: 'pujar@naver.com',
  privacyOfficer: '정은지 (대표)',
  hosting: 'GitHub, Inc. · Google LLC(Firebase)',
};

export const bizInfoCheckUrl = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_INFO.bizNoDigits}`;

/**
 * 시행일 (배포할 때 확정해서 바꾼다. 기본값은 공지 7일 뒤)
 * 형식: YYYY-MM-DD
 */
export const LEGAL_EFFECTIVE_DATE = '2026-11-07';

/** 문서 버전 = 시행일. 회원 동의 기록(consents.*.version, marketingConsent.version, privacyConsent.version)에 저장된다 */
export const LEGAL_VERSION = LEGAL_EFFECTIVE_DATE;

export const formatKoreanDate = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return String(ymd || '');
  return `${y}년 ${m}월 ${d}일`;
};

export const LEGAL_EFFECTIVE_DATE_TEXT = formatKoreanDate(LEGAL_EFFECTIVE_DATE);

/** 세미나·프로그램 신청 화면 개인정보 수집·이용 동의 (4가지 고지) */
export const APPLICATION_PRIVACY_CONSENT = {
  label: '위 내용을 확인했으며 개인정보 수집·이용에 동의합니다',
  items: [
    { k: '수집 항목', v: '이름·휴대전화번호·이메일(회원 정보에서 자동으로 채워져요), 참여 경로, 식사 여부 / 선택: 신청 계기, 사전 질문 / 유료 프로그램: 결제번호·금액·결제 상태' },
    { k: '목적', v: '참가 신청 확인, 행사 운영(좌석·식사 준비, 사전 질문 전달), 결제와 환불' },
    { k: '보관 기간', v: '행사 종료 후 1년. 결제·취소 기록은 전자상거래법에 따라 5년간 따로 보관해요.' },
    { k: '거부 권리', v: '동의를 거부할 수 있지만, 거부하면 이 프로그램을 신청할 수 없어요.' },
  ],
};

