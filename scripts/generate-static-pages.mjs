/**
 * 빌드 후 각 라우트별 정적 HTML 생성 + sitemap.xml 업데이트 (네이버/구글 봇 대응)
 *
 * 1. 라우트별 HTML 생성 (title/meta/OG 태그 + 소개 페이지 키워드 본문 삽입)
 * 2. Firebase REST API로 세미나 목록 조회 → sitemap.xml에 /programs/:id URL 추가
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const BASE_URL = 'https://bcsa.co.kr';
const FIREBASE_PROJECT = 'bcsa-b190f';
const TODAY = new Date().toISOString().split('T')[0];

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
    path: '/restaurants',
    title: '부산맛집 | 부청사 회원 추천 부산 맛집 - 부청사',
    description: '부청사 회원들이 추천하는 부산 지역 맛집 정보를 확인하세요.',
  },
  {
    path: '/donation',
    title: '후원 | 부청사를 함께 만들어가세요',
    description: '부산 청년 사업가들의 성장을 응원하는 부청사 후원 프로그램입니다.',
  },
  {
    path: '/members',
    title: '부청사 회원 | 부산 청년 사업가 멤버십 - 부청사',
    description: '부청사에서 활동 중인 부산 청년 사업가 회원 목록입니다.',
  },
];

// ─── HTML 치환 ─────────────────────────────────────────────────
function replaceMeta(html, { title, description, canonical, ogTitle, ogDescription, ogUrl, bodyAppend }) {
  let result = html;
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

// ─── Firebase REST API로 세미나 ID 목록 조회 ───────────────────
async function fetchSeminarIds() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/seminars?pageSize=200&mask.fieldPaths=date&mask.fieldPaths=recruitmentClosedByAdmin`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map(doc => doc.name.split('/').pop());
  } catch (e) {
    console.warn('⚠️  세미나 목록 조회 실패 (sitemap 개별 URL 생략):', e.message);
    return [];
  }
}

// ─── sitemap.xml 재생성 ────────────────────────────────────────
function buildSitemap(seminarIds) {
  const staticUrls = [
    { loc: '/',            priority: '1.0', changefreq: 'weekly' },
    { loc: '/about',       priority: '0.8', changefreq: 'monthly' },
    { loc: '/programs',    priority: '0.9', changefreq: 'weekly' },
    { loc: '/notice',      priority: '0.7', changefreq: 'weekly' },
    { loc: '/restaurants', priority: '0.7', changefreq: 'weekly' },
    { loc: '/donation',    priority: '0.5', changefreq: 'monthly' },
    { loc: '/signup',      priority: '0.6', changefreq: 'monthly' },
    { loc: '/privacy',     priority: '0.3', changefreq: 'yearly' },
    { loc: '/terms',       priority: '0.3', changefreq: 'yearly' },
    { loc: '/refund',      priority: '0.3', changefreq: 'yearly' },
  ];

  const programUrls = seminarIds.map(id => ({
    loc: `/programs/${id}`,
    priority: '0.6',
    changefreq: 'weekly',
  }));

  const allUrls = [...staticUrls, ...programUrls];

  const entries = allUrls.map(({ loc, priority, changefreq }) => `  <url>
    <loc>${BASE_URL}${loc}</loc>
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
  const canonicalUrl = BASE_URL + page.path;
  const html = replaceMeta(baseHtml, {
    title: page.title,
    description: page.description,
    canonical: canonicalUrl,
    ogTitle: page.title,
    ogDescription: page.description,
    ogUrl: canonicalUrl,
    bodyAppend: page.bodyAppend,
  });

  const outDir = join(distDir, page.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
  generated++;
  console.log(`✅  ${page.path}/index.html`);
}

console.log(`\n📄  ${generated}개 정적 HTML 생성 완료`);

// 2. sitemap.xml 업데이트
console.log('\n🔍  Firebase에서 세미나 목록 조회 중...');
const seminarIds = await fetchSeminarIds();
console.log(`    → ${seminarIds.length}개 세미나 URL 추가`);

const sitemap = buildSitemap(seminarIds);
writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf-8');
console.log(`✅  sitemap.xml 업데이트 (총 ${10 + seminarIds.length}개 URL)\n`);
