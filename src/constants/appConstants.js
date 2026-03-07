/**
 * App 전역 상수 (메인 앱에서 사용하는 플래그·목록)
 */

/** 후원 기능 비노출: true면 메뉴·홈 섹션·뷰 접근 모두 없음 */
export const DONATION_FEATURE_DISABLED = true;

/** 프로그램 팝업을 별도 창(새 창)으로 띄울지 여부 */
export const POPUP_AS_NEW_WINDOW = false;

/** 메인 검색용 부산 지역구 목록 (구·군) */
export const BUSAN_DISTRICTS = [
  '전체',
  '해운대구',
  '부산진구',
  '동래구',
  '남구',
  '북구',
  '중구',
  '영도구',
  '동구',
  '서구',
  '사하구',
  '금정구',
  '연제구',
  '수영구',
  '사상구',
  '기장군',
];

/** 협력기관 로고 경로 (partner1~6 순) */
export const PARTNER_LOGOS = [
  '/assets/images/partners/partner1.png',
  '/assets/images/partners/partner2.png',
  '/assets/images/partners/partner3.png',
  '/assets/images/partners/partner4.png',
  '/assets/images/partners/partner5.png',
  '/assets/images/partners/partner6.png',
];

/** 협력기관 이름 (PARTNER_LOGOS와 순서 대응) */
export const PARTNER_NAMES = [
  '중소벤처기업부',
  '15분도시',
  '나라장터',
  'KOTRA',
  '부산경제진흥원',
  '부산광역시',
];

/** 로그인 필요 메뉴 (비로그인 시 비활성 표시) */
export const MEMBERS_ONLY_MENUS = ['부청사 회원', '커뮤니티'];
