import publishedContent from '../constants/publishedContent.json';
import { defaultContent, defaultMenuNames, defaultMenuOrder } from '../constants/content';

const DEFAULT_MENU_ENABLED = {
  '홈': true,
  '소개': true,
  '프로그램': true,
  '부청사 회원': true,
  '커뮤니티': true,
  '후원': true,
  '부산맛집': true,
};

/** 관리자가 배포용으로 반영한 콘텐츠 + 코드 기본값 */
export function buildSiteContent() {
  return { ...defaultContent, ...publishedContent };
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
