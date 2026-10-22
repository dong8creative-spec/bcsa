/**
 * 공개용 사본 생성 규칙 (functions 트리거 + scripts/backfill-public-mirrors.mjs 공용)
 * users·applications 원본은 본인·관리자만 읽을 수 있으므로, 누구나 보는 화면에 필요한 필드만 복사한다.
 * 이 파일은 firebase-admin 등 외부 의존 없이 순수 함수만 둔다.
 */

/** 주소 관련 필드에서 "○○구"만 추출 (회원명단 지역 표시용, 상세주소는 공개하지 않음) */
export const extractDistrict = (u) => {
  const parts = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) parts.push(v); };
  ['address', 'roadAddress', 'jibunAddress', 'companyAddress', 'businessAddress', 'region', 'location', '주소']
    .forEach((k) => push(u[k]));
  if (u.address && typeof u.address === 'object') {
    ['roadAddress', 'address', 'region', 'address_name'].forEach((k) => push(u.address[k]));
  }
  const m = parts.join(' ').match(/([가-힣]+구)/);
  return m ? m[1] : '';
};

/** 회원 문서 → 공개 프로필 (생년월일·성별·이메일·사업자번호·주소 원문·본인인증 고유번호 제외) */
export const buildPublicProfile = (docId, u) => {
  const pick = (k) => (u[k] === undefined ? null : u[k]);
  const phonePublic = u.phonePublic === true;
  return {
    uid: u.uid || docId,
    name: pick('name'),
    nickname: pick('nickname'),
    img: pick('img'),
    company: pick('company'),
    role: pick('role'),
    position: pick('position'),
    industry: pick('industry'),
    businessCategory: pick('businessCategory'),
    businessType: pick('businessType'),
    userType: pick('userType'),
    memberGrade: pick('memberGrade'),
    approvalStatus: pick('approvalStatus'),
    companyPhone: pick('companyPhone'),
    companyWebsite: pick('companyWebsite'),
    keyCustomers: pick('keyCustomers'),
    collaborationIndustry: pick('collaborationIndustry'),
    isIdentityVerified: u.isIdentityVerified === true,
    businessVerified: u.businessVerified === true,
    address: extractDistrict(u),
    phonePublic,
    phone: phonePublic ? (u.phone || u.phoneNumber || null) : null,
    createdAt: pick('createdAt'),
  };
};

export const isApprovedMember = (u) => !u.approvalStatus || u.approvalStatus === 'approved';

/** 신청 문서 → 공개 집계용 사본 (이름·연락처·이메일·결제번호 제외, 결제 여부만) */
export const buildPublicApplication = (a) => ({
  seminarId: a.seminarId ?? null,
  programId: a.programId ?? null,
  seminar_id: a.seminar_id ?? null,
  program_id: a.program_id ?? null,
  hasPayment: !!(a.merchant_uid || a.merchantUid || a.imp_uid || a.impUid),
  adminAddedParticipant: a.adminAddedParticipant === true || String(a.participationPath || '').trim() === '관리자 등록',
  createdAt: a.createdAt ?? null,
});
