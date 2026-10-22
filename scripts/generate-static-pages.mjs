/**
 * 빌드 후 각 라우트별 정적 HTML 생성 + sitemap.xml 업데이트 (네이버/구글 봇 대응)
 *
 * 1. 라우트별 HTML 생성 (title/meta/OG 태그 + 소개 페이지 키워드 본문 삽입)
 * 2. Firebase REST API로 세미나 목록 조회 → 프로그램 상세 페이지 HTML 생성 + sitemap.xml에 추가
 *
 * GitHub Pages는 dist/<경로>/index.html이 있어야 그 주소에 200으로 응답한다(없으면 404.html로 404 응답).
 * /about 처럼 슬래시 없는 주소는 /about/ 으로 301 이동하므로 canonical·sitemap은 끝 슬래시 주소로 통일한다.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const BASE_URL = 'https://bcsa.co.kr';
const FIREBASE_PROJECT = 'bcsa-b190f';
const TODAY = new Date().toISOString().split('T')[0];
const DEFAULT_OG_IMAGE = `${BASE_URL}/assets/images/og-image.png`;
const toCanonicalPath = (path) => (path === '/' ? '/' : `${path.replace(/\/$/, '')}/`);
const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── 페이지 정의 ───────────────────────────────────────────────
const PAGES = [
  {
    path: '/about',
    title: '소개 | 부청사 - 부산 청년 사업가 커뮤니티',
    description: '2017년부터 부산·경남 청년 사업가들의 성장과 연결을 돕는 비즈니스 플랫폼 부청사를 소개합니다. 부산사업자모임, 부산창업 커뮤니티의 중심.',
    bodyAppend: `
<div id="seo-about" style="position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
  <h2>부청사와 함께하는 분들</h2>
  <p>부산·경남 지역에서 사업을 운영하거나 창업을 준비하는 누구나 환영합니다.</p>
  <ul>
    <li>부산 청년 사업가·자영업자·소상공인</li>
    <li>경남 사업자·자영업자 및 경남창업 준비자</li>
    <li>부산창업을 계획 중인 예비 창업자</li>
    <li>부산비즈니스모임·부산사업자모임을 찾는 분</li>
  </ul>
  <p>부청사(부산청년사업가들)는 부산청년플랫폼·부산비즈니스모임·부산사업자모임으로서 마케팅 세미나, 정기 네트워킹, 창업 교육 등 실전 프로그램을 운영합니다. 경남 사업자·경남 자영업자도 함께하는 광역 비즈니스 커뮤니티입니다.</p>
</div>`,
  },
  {
    path: '/programs',
    title: '프로그램 | 부산 사업자 세미나·네트워킹 모임 - 부청사',
    description: '부산·경남 청년 사업가, 자영업자를 위한 마케팅 세미나, 네트워킹 모임, 창업 교육 프로그램 목록입니다. 부산비즈니스모임·부산청년플랫폼 대표 프로그램.',
  },
  {
    path: '/notice',
    title: '공지사항 | 부청사',
    description: '부청사의 새로운 소식과 공지사항을 확인하세요.',
  },
  {
    path: '/news',
    title: '뉴스 | 부산 창업·소상공인 경제 소식 - 부청사',
    description: '부산 창업가·소상공인이 놓치기 쉬운 지원·상권·판로 소식을 매일 모아 보여드립니다.',
  },
  {
    path: '/support',
    title: '지원사업 | 부산 신규·마감임박 정부 지원사업 - 부청사',
    description: '부산 지역 신규 지원사업과 마감이 다가온 정부·지자체 지원사업을 핵심만 요약해 보여드립니다.',
  },
  {
    path: '/tools',
    title: '사업도구 | 부가세·마진·3.3%·손익분기점 계산기 - 부청사',
    description: '부가세, 마진율, 3.3% 원천징수, 손익분기점, 광고 ROAS를 바로 계산하는 사업자 도구함입니다.',
  },
  {
    path: '/members',
    title: '부청사 회원 | 부산 청년 사업가 멤버십 - 부청사',
    description: '부청사에서 활동 중인 부산 청년 사업가 회원 목록입니다.',
  },
];

// ─── HTML 치환 ─────────────────────────────────────────────────
function replaceMeta(html, { title, description, canonical, ogTitle, ogDescription, ogUrl, ogImage, bodyAppend }) {
  let result = html;
  title = escapeHtml(title);
  description = escapeHtml(description);
  ogTitle = escapeHtml(ogTitle);
  ogDescription = escapeHtml(ogDescription);
  if (ogImage) {
    const img = escapeHtml(ogImage);
    result = result.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${img}$2`);
    result = result.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, `$1${img}$2`);
    // 기본 이미지(1200×630)가 아니면 크기 정보가 틀리므로 지운다 (카카오톡이 실제 크기로 처리)
    if (ogImage !== DEFAULT_OG_IMAGE) {
      result = result.replace(/\s*<meta\s+property="og:image:(?:width|height)"\s+content="[^"]*">/g, '');
    }
  }
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  result = result.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/,         `$1${description}$2`);
  result = result.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/,               `$1${canonical}$2`);
  result = result.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/,        `$1${ogTitle}$2`);
  result = result.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,  `$1${ogDescription}$2`);
  result = result.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/,          `$1${ogUrl}$2`);
  result = result.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,       `$1${ogTitle}$2`);
  result = result.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,`$1${ogDescription}$2`);
  if (bodyAppend) {
    result = result.replace('</body>', `${bodyAppend}\n</body>`);
  }
  return result;
}

// ─── Firebase REST API로 세미나 목록 조회 (상세 페이지 메타용) ───
const fieldValue = (f) => {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(fieldValue);
  if ('mapValue' in f) {
    const out = {};
    for (const [k, v] of Object.entries(f.mapValue.fields || {})) out[k] = fieldValue(v);
    return out;
  }
  return null;
};

async function fetchSeminars() {
  try {
    const fields = ['title', 'desc', 'images', 'imageUrls', 'imageUrl', 'img', 'date', 'location'];
    const mask = fields.map((f) => `mask.fieldPaths=${f}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/seminars?pageSize=300&${mask}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.documents || []).map((doc) => {
      const f = doc.fields || {};
      // 사이트 카드와 같은 우선순위: images[0] → imageUrls[0] → imageUrl → img
      const candidates = [...(fieldValue(f.images) || []), ...(fieldValue(f.imageUrls) || []), fieldValue(f.imageUrl), fieldValue(f.img)]
        .map((im) => (typeof im === 'string' ? im : im?.url));
      const firstImage = candidates.find((u) => /^https?:\/\//.test(u || '')) || null;
      return {
        id: doc.name.split('/').pop(),
        title: fieldValue(f.title) || '프로그램',
        desc: fieldValue(f.desc) || '',
        date: fieldValue(f.date) || '',
        location: fieldValue(f.location) || '',
        image: firstImage,
      };
    });
  } catch (e) {
    console.warn('⚠️  세미나 목록 조회 실패 (상세 페이지·sitemap 개별 URL 생략):', e.message);
    return [];
  }
}

/** 공유 미리보기용 한 줄 설명: URL 제거 + 공백 정리 + 길이 제한 */
const summarize = (text, max = 110) => {
  const t = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// ─── sitemap.xml 재생성 ────────────────────────────────────────
function buildSitemap(seminarIds) {
  const staticUrls = [
    { loc: '/',            priority: '1.0', changefreq: 'weekly' },
    { loc: '/about',       priority: '0.8', changefreq: 'monthly' },
    { loc: '/programs',    priority: '0.9', changefreq: 'weekly' },
    { loc: '/notice',      priority: '0.7', changefreq: 'weekly' },
    { loc: '/news',        priority: '0.8', changefreq: 'daily' },
    { loc: '/support',     priority: '0.9', changefreq: 'daily' },
    { loc: '/tools',       priority: '0.7', changefreq: 'monthly' },
    { loc: '/members',     priority: '0.5', changefreq: 'weekly' },
    { loc: '/privacy',     priority: '0.3', changefreq: 'yearly' },
    { loc: '/terms',       priority: '0.3', changefreq: 'yearly' },
    { loc: '/refund',      priority: '0.3', changefreq: 'yearly' },
  ];

  const programUrls = seminarIds.map((id) => ({
    loc: `/programs/${id}`,
    priority: '0.6',
    changefreq: 'weekly',
  }));

  const allUrls = [...staticUrls, ...programUrls];

  const entries = allUrls.map(({ loc, priority, changefreq }) => `  <url>
    <loc>${BASE_URL}${toCanonicalPath(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <lastmod>${TODAY}</lastmod>
  </url>`).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

// ─── 메인 ─────────────────────────────────────────────────────
const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

// 1. 라우트별 정적 HTML 생성
let generated = 0;
for (const page of PAGES) {
  const canonicalUrl = BASE_URL + toCanonicalPath(page.path);
  const html = replaceMeta(baseHtml, {
    title: page.title,
    description: page.description,
    canonical: canonicalUrl,
    ogTitle: page.title,
    ogDescription: page.description,
    ogUrl: canonicalUrl,
    ogImage: DEFAULT_OG_IMAGE,
    bodyAppend: page.bodyAppend,
  });

  const outDir = join(distDir, page.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
  generated++;
  console.log(`✅  ${page.path}/index.html`);
}

console.log(`\n📄  ${generated}개 정적 HTML 생성 완료`);

// 2. 프로그램 상세 페이지 HTML (공유 시 프로그램 제목·포스터가 미리보기에 나오도록)
console.log('\n🔍  Firebase에서 세미나 목록 조회 중...');
const seminars = await fetchSeminars();
for (const sem of seminars) {
  const path = `/programs/${sem.id}`;
  const canonicalUrl = BASE_URL + toCanonicalPath(path);
  const title = `${sem.title} | 부청사 프로그램`;
  const description = summarize([sem.date, sem.location, sem.desc].filter(Boolean).join(' · ')) || '부청사 프로그램 안내';
  const html = replaceMeta(baseHtml, {
    title,
    description,
    canonical: canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonicalUrl,
    ogImage: sem.image || DEFAULT_OG_IMAGE,
  });
  const outDir = join(distDir, path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
}
console.log(`    → 프로그램 상세 ${seminars.length}개 HTML 생성`);

// 3. sitemap.xml 업데이트
const sitemap = buildSitemap(seminars.map((sem) => sem.id));
writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf-8');
console.log(`✅  sitemap.xml 업데이트 (프로그램 ${seminars.length}개 포함)\n`);
