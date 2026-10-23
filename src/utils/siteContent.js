import publishedContent from '../constants/publishedContent.json';
import { defaultContent, defaultMenuNames, defaultMenuOrder } from '../constants/content';

const DEFAULT_MENU_ENABLED = {
  '홈': true,
  '소개': true,
  '뉴스': true,
  '지원사업': true,
  '사업도구': true,
  '그룹': true,
  // 의뢰·Q&A는 아직 공사중 화면이라 준비될 때까지 메뉴에서 숨긴다 (관리자 메뉴 설정으로 다시 켤 수 있음)
  '의뢰': false,
  'Q&A': false,
  // 하위 호환(상단 메뉴에는 더 이상 노출되지 않지만, 홈 화면 섹션 게이팅 등에서 계속 참조됨)
  '프로그램': true,
  '부청사 회원': true,
  '커뮤니티': false,
  '후원': true,
  '부산맛집': false,
};

/** 관리자가 배포용으로 반영한 콘텐츠 + 코드 기본값 */
export function buildSiteContent() {
  return { ...defaultContent, ...publishedContent };
}

/**
 * 배포본 위에 관리자 저장값(siteContent/main)을 덮어쓴다.
 * liveSync 표시가 없는 예전 저장값은 옛 문구가 섞여 있어 모집 설정만 반영한다.
 */
export function mergeLiveContent(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  if (saved.liveSync === true) return { ...base, ...saved };
  const recruitment = Object.fromEntries(
    Object.entries(saved).filter(([key]) => key.startsWith('programRecruitment'))
  );
  return { ...base, ...recruitment };
}

export function getMenuStateFromSiteContent(content = buildSiteContent()) {
  const menuEnabled = { ...DEFAULT_MENU_ENABLED, ...(content.menuEnabled || {}) };
  const menuNames = { ...defaultMenuNames, ...(content.menuNames || {}) };
  const menuOrder = Array.isArray(content.menuOrder) && content.menuOrder.length
    ? content.menuOrder.filter((key) => defaultMenuOrder.includes(key))
        .concat(defaultMenuOrder.filter((key) => !content.menuOrder.includes(key)))
    : defaultMenuOrder;
  return { menuEnabled, menuNames, menuOrder };
}

/** 관리자 저장 후 배포용 JSON 다운로드 */
export function downloadPublishedContentJson(content, filename = 'publishedContent.json') {
  const payload = content && typeof content === 'object' ? content : {};
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
