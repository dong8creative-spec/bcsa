/**
 * 메인페이지와 소개페이지 이미지 메타데이터
 * 각 이미지의 필드명, 설명, 표시 비율, 페이지 정보를 정의
 */

export const imageMetadata = [
  // 메인페이지 이미지
  {
    id: 'hero_image',
    field: 'hero_image',
    name: 'Hero 메인 이미지',
    description: '메인페이지 상단 Hero 섹션의 메인 이미지',
    page: '메인페이지',
    section: 'Hero 섹션',
    aspectRatio: 16 / 9,
    required: false
  },
  {
    id: 'features_image_1',
    field: 'features_image_1',
    name: 'Features 이미지 1',
    description: 'Features 섹션의 첫 번째 이미지',
    page: '메인페이지',
    section: 'Features 섹션',
    aspectRatio: 1,
    required: false
  },
  {
    id: 'features_image_2',
    field: 'features_image_2',
    name: 'Features 이미지 2',
    description: 'Features 섹션의 두 번째 이미지',
    page: '메인페이지',
    section: 'Features 섹션',
    aspectRatio: 1,
    required: false
  },
  {
    id: 'activity_seminar_image',
    field: 'activity_seminar_image',
    name: '활동 - 세미나 이미지',
    description: '주요 활동 섹션의 비즈니스 세미나 카드 이미지',
    page: '메인페이지',
    section: '활동 섹션',
    aspectRatio: 4 / 3,
    required: false
  },
  {
    id: 'activity_investment_image',
    field: 'activity_investment_image',
    name: '활동 - 투자 이미지',
    description: '주요 활동 섹션의 투자 & 지원사업 카드 이미지',
    page: '메인페이지',
    section: '활동 섹션',
    aspectRatio: 4 / 3,
    required: false
  },
  {
    id: 'activity_networking_image',
    field: 'activity_networking_image',
    name: '활동 - 네트워킹 이미지',
    description: '주요 활동 섹션의 사업가 네트워킹 카드 이미지',
    page: '메인페이지',
    section: '활동 섹션',
    aspectRatio: 4 / 3,
    required: false
  },
  {
    id: 'donation_image',
    field: 'donation_image',
    name: '후원 섹션 배경 이미지',
    description: '후원 섹션의 배경 이미지',
    page: '메인페이지',
    section: '후원 섹션',
    aspectRatio: 16 / 9,
    required: false
  },
  // 소개페이지 이미지
  {
    id: 'about_hero_image',
    field: 'about_hero_image',
    name: '소개페이지 Hero 이미지',
    description: '소개페이지 상단 Hero 섹션의 메인 이미지',
    page: '소개페이지',
    section: 'Hero 섹션',
    aspectRatio: 16 / 9,
    required: false
  }
];

/**
 * 이미지 메타데이터를 필드명으로 조회
 */
export const getImageMetadata = (field) => {
  return imageMetadata.find(img => img.field === field);
};

/**
 * 페이지별 이미지 목록 조회
 */
export const getImagesByPage = (page) => {
  return imageMetadata.filter(img => img.page === page);
};

/**
 * 섹션별 이미지 목록 조회
 */
export const getImagesBySection = (section) => {
  return imageMetadata.filter(img => img.section === section);
};
