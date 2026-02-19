/**
 * 관리자 회원정보: 민감 정보(열람 전용) vs 수정 가능 필드
 * - 열람만: name, email, phone, birthdate, gender, address 계열, 본인인증 정보, 사업자등록번호, phonePublic
 * - 수정 가능: memberGrade, approvalStatus, role, company, companyPhone, companyWebsite, industry, businessCategory, position, collaborationIndustry, keyCustomers
 */

/** 관리자가 수정할 수 있는 필드 키 목록 (민감 개인정보 제외) */
export const EDITABLE_MEMBER_FIELDS = [
  'memberGrade',
  'approvalStatus',
  'role',
  'company',
  'companyPhone',
  'companyWebsite',
  'industry',
  'businessCategory',
  'position',
  'collaborationIndustry',
  'keyCustomers',
];

/** 수정 가능 필드 한글 라벨 (알림/UI용) */
export const EDITABLE_FIELD_LABELS = {
  memberGrade: '회원등급',
  approvalStatus: '승인 여부',
  role: '권한',
  company: '회사명',
  companyPhone: '회사 전화번호',
  companyWebsite: '회사 사이트',
  industry: '업종',
  businessCategory: '업종/업태',
  position: '직책',
  collaborationIndustry: '협업 업종',
  keyCustomers: '핵심고객',
};

/** 관리자 회원 수정 폼 초기값 (수정 가능 필드만) */
export const getInitialMemberEditForm = (user) => {
  const empty = {
    memberGrade: '',
    approvalStatus: 'pending',
    role: 'user',
    company: '',
    companyPhone: '',
    companyWebsite: '',
    industry: '',
    businessCategory: '',
    position: '',
    collaborationIndustry: '',
    keyCustomers: '',
  };
  if (!user) return empty;
  return {
    memberGrade: user.memberGrade ?? '',
    approvalStatus: user.approvalStatus ?? 'pending',
    role: user.role ?? 'user',
    company: user.company ?? '',
    companyPhone: user.companyPhone ?? '',
    companyWebsite: user.companyWebsite ?? '',
    industry: user.industry ?? user.businessCategory ?? '',
    businessCategory: user.businessCategory ?? user.industry ?? '',
    position: user.position ?? '',
    collaborationIndustry: user.collaborationIndustry ?? '',
    keyCustomers: user.keyCustomers ?? '',
  };
};

/** 사업자 업종 옵션 (관리자 폼용) */
export const BUSINESS_CATEGORIES = [
  '식품제조업', '의류제조업', '화학제조업', '전자제품제조업', '기계제조업', '기타 제조업',
  '도매업', '소매업', '온라인 쇼핑몰', '편의점/마트',
  'IT/소프트웨어', '웹/앱 개발', '디자인/광고', '컨설팅', '교육/학원', '의료/병원', '미용/네일',
  '요식업 (한식)', '요식업 (양식)', '요식업 (중식)', '요식업 (일식)', '요식업 (카페)', '숙박업', '운송업', '부동산', '법률/회계', '기타 서비스업',
  '건설업', '인테리어', '토목공사', '농업', '축산업', '임업', '어업', '기타 사업',
];
