/**
 * 협력기관 로고 URL
 * - `src/assets/images/partners/` → 번들 URL (파일명 partner{N}… 대소문자·구분자 허용)
 * - `public/assets/images/partners/` → 빌드 시 디렉터리 스캔(가상 모듈), BASE_URL 반영
 */
import { PARTNER_NAMES } from './partnerNames';
import { PUBLIC_PARTNER_ENTRIES } from 'virtual:public-partners';

function withBase(relativePath) {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${relativePath}` : `${base}/${relativePath}`;
}

const modules = import.meta.glob('../assets/images/partners/*.{png,svg,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

function partnerIndexFromPath(filePath) {
  const file = filePath.split('/').pop() || '';
  const stem = file.replace(/\.[^.]+$/i, '');
  const m = stem.match(/partner[_\s-]*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

const srcByIndex = {};
for (const p of Object.keys(modules)) {
  const n = partnerIndexFromPath(p);
  if (n > 0) srcByIndex[n] = modules[p];
}

const publicByIndex = {};
for (const { n, path: rel } of PUBLIC_PARTNER_ENTRIES) {
  publicByIndex[n] = withBase(rel);
}

const maxSrcIndex = Object.keys(srcByIndex).length
  ? Math.max(...Object.keys(srcByIndex).map(Number))
  : 0;

const maxPublicIndex = Object.keys(publicByIndex).length
  ? Math.max(...Object.keys(publicByIndex).map(Number))
  : 0;

const slotCount = Math.max(maxSrcIndex, maxPublicIndex, PARTNER_NAMES.length);

export const PARTNER_LOGOS = Array.from({ length: slotCount }, (_, i) => {
  const n = i + 1;
  return srcByIndex[n] ?? publicByIndex[n] ?? withBase(`assets/images/partners/partner${n}.png`);
});
