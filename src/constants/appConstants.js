/**
 * App 전역 상수 (메인 앱에서 사용하는 플래그·목록)
 */

/** 후원 기능 비노출: true면 메뉴·홈 섹션·뷰 접근 모두 없음 */
export const DONATION_FEATURE_DISABLED = true;

/** 프로그램 팝업을 별도 창(새 창)으로 띄울지 여부 */
export const POPUP_AS_NEW_WINDOW = false;

/** 외부행사 포스터 전용 팝업 창: 기존 460×720 프로그램 팝업의 1.2배 */
export const EXTERNAL_POSTER_POPUP_WIDTH = Math.round(460 * 1.2);
export const EXTERNAL_POSTER_POPUP_HEIGHT = Math.round(720 * 1.2);
export const EXTERNAL_POSTER_POPUP_WINDOW_NAME = 'bcsaExternalPoster';

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

export { PARTNER_LOGOS } from './partnerLogos';
export { PARTNER_NAMES } from './partnerNames';

/** 로그인 필요 메뉴 (비로그인 시 비활성 표시) */
export const MEMBERS_ONLY_MENUS = ['부청사 회원', '커뮤니티'];

/**
 * Firestore seminars 문서 필드명.
 * true인 프로그램만 공개 화면에서 신청 인원을 `applications` 건수로 표시한다.
 * 미설정·false인 기존 프로그램은 기존처럼 `currentParticipants` 필드를 쓴다.
 */
export const SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD = 'useApplicationsParticipantCount';
