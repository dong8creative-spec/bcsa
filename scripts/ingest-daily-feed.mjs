#!/usr/bin/env node
/**
 * 지원사업 + 뉴스 일일 자동 수집 스크립트
 *
 * 매일 07:00(KST)에 GitHub Actions(.github/workflows/daily-content-feed.yml)가 실행합니다.
 * - 지원사업: 기업마당(bizinfo.go.kr) 지원사업정보 오픈API → Firestore `supportPrograms` 컬렉션.
 *   전체 공고 조회 + hashtags=부산 조회를 함께 호출해서, 부산 조회에 포함된 공고는 region:['부산']로
 *   표시한다 — 사이트의 "부산 지원사업" 섹션(SupportProgramsView.jsx)이 이 필드로 걸러 보여준다.
 * - 뉴스: 네이버 뉴스검색 API(NAVER API HUB, naverapihub.apigw.ntruss.com — 네이버가 기존
 *         openapi.naver.com 검색 API를 이쪽으로 이관함)에서 소상공인/자영업/창업 관련 키워드로 검색한
 *         기사 제목·발췌(요약)를 가져와 → Firestore `newsItems` 컬렉션
 *
 * 두 컬렉션 모두 sourceUrl(또는 기사 링크)의 해시를 문서 ID로 사용해 매일 실행해도 중복 등록되지 않습니다(upsert).
 * 관리자가 admin 화면에서 수동으로 만든 문서(sourceType !== 'site_scan')는 절대 덮어쓰지 않고,
 * 자동수집 문서라도 관리자가 껐던 enabled 값은 건드리지 않습니다(관리자 판단을 항상 우선).
 *
 * 노출 기간: 뉴스 기사든 지원사업 공고든 등록/발행 후 1년이 지나면 사이트에서 자동으로 숨겨집니다
 * (Firestore 문서는 그대로 남아있고, 화면 렌더링 단계에서 필터링됩니다 — src/pages/NewsView.jsx,
 * src/pages/SupportProgramsView.jsx의 ONE_YEAR_MS 참고).
 *
 * 마감일 판정 (3단계 폴백):
 *   1) 기업마당 API의 신청기간 필드(reqstBeginEndDe 또는 reqstDt, "20260101 ~ 20260228" 형태)를 우선 사용.
 *   2) 그게 없거나 파싱 실패하면, 공고 제목+요약문 안에서 "OOOO.MM.DD ~ OOOO.MM.DD", "9월 1일부터
 *      9월 30일까지", "~9.30", "9월 30일까지" 같은 기간/마감 표현을 직접 찾는다(extractDeadlineFromText).
 *   3) 그래도 못 찾으면, 공고의 신청 링크(applyUrl → 다르면 sourceUrl 순서)를 실제로 열어서 그 페이지의
 *      본문 텍스트에서 같은 방식으로 기간/마감 표현을 찾는다(fetchDeadlineFromPage) — 기업마당 자체에는
 *      신청기간이 없고 연결된 원문 사이트에만 있는 경우가 많기 때문(예: 특정 기관이 매 회차 접수기간을
 *      자기 사이트에만 공지하는 경우). 페이지 접근에 실패하거나 여기서도 못 찾으면 그때만 "상시모집"으로 남긴다.
 *
 * 실행 전 필요한 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  - 파이어베이스 서비스 계정 키 JSON 전체(문자열)
 *   BIZINFO_API_KEY               - 기업마당 오픈API 인증키(data.go.kr에서 발급). 없으면 지원사업 수집은 건너뜀.
 *   NAVER_CLIENT_ID               - NAVER API HUB 검색 API Client ID (콘솔: console.ncloud.com/naver-api-hub)
 *   NAVER_CLIENT_SECRET           - NAVER API HUB 검색 API Client Secret. 둘 중 하나라도 없으면 뉴스 수집은 건너뜀.
 *
 * 실행:
 *   node scripts/ingest-daily-feed.mjs           # 실제 반영
 *   node scripts/ingest-daily-feed.mjs --dry-run # 수집 결과만 콘솔에 출력, Firestore 미반영
 */

import crypto from 'crypto';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

const isDryRun = process.argv.includes('--dry-run');

// 소스당 1회 실행 최대 처리 건수 캡(오작동 시 대량 오등록 방지 안전장치)
const MAX_ITEMS_PER_SOURCE = 15;
// 지원사업은 전체 조회 + 부산 조회를 합친 뒤 중복 제거하므로, 합친 후에도 한 번 더 상한을 둔다.
const MAX_ITEMS_TOTAL = 25;

// 원문 페이지에서 마감일을 찾기 위해 열어볼 때 쓰는 타임아웃/텍스트 길이 상한
// (느리거나 응답이 없는 사이트 때문에 전체 실행이 오래 걸리지 않도록 방어).
const PAGE_FETCH_TIMEOUT_MS = 8000;
const PAGE_TEXT_MAX_LEN = 20000;

// 네이버 뉴스검색에서 이 키워드들로 각각 검색해 결과를 모은다.
// 자영업자/예비창업자/소상공인 관련 뉴스를 폭넓게 담기 위한 검색어 목록 — 필요 시 자유롭게 추가/수정 가능.
const NEWS_KEYWORDS = ['창업', '사업자', '예비창업', '예창', '지원사업', '부산청년'];

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 20);
}

/**
 * HTML(기업마당 bsnsSumryCn, 네이버 뉴스 title/description 등)을 순수 텍스트로 변환.
 * 블록 태그는 지우기 전에 줄바꿈으로 바꿔서 문단이 이어붙지 않게 한다
 * (기업마당 bsnsSumryCn이 <p>...</p><p><br></p><p style="...">...</p> 형태의 raw HTML로 오는 경우가 많음).
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 기사 링크의 도메인을 "출처" 표시용 짧은 이름으로 변환 (예: n.news.naver.com, www.hankyung.com). */
function hostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '네이버뉴스';
  }
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error('[ingest-daily-feed] FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다.');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

/**
 * 공통 upsert 규칙:
 * - 문서가 없으면: 새로 생성 (enabled:true, status:'published', sourceType:'site_scan')
 * - 문서가 있고 sourceType이 'site_scan'이면: 지정된 필드만 갱신(enabled/status/sortOrder는 절대 건드리지 않음 — 관리자 조작 존중)
 * - 문서가 있고 sourceType이 'site_scan'이 아니면(관리자 수동 등록): 완전히 건너뜀
 */
async function upsertDoc(db, collectionName, id, { onCreate, onUpdate }) {
  const ref = db.collection(collectionName).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const data = onCreate();
    if (isDryRun) {
      console.log(`  [DRY-RUN][NEW] ${collectionName}/${id}: ${data.title}`);
      return 'new';
    }
    await ref.set({
      ...data,
      sourceType: 'site_scan',
      enabled: true,
      status: data.status || 'published',
      sortOrder: Date.now(),
      createdBy: 'auto_ingest',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'new';
  }
  const existing = snap.data() || {};
  if (existing.sourceType !== 'site_scan') {
    return 'skipped_manual';
  }
  const updateFields = onUpdate ? onUpdate(existing) : null;
  if (!updateFields) return 'skipped_no_change';
  if (isDryRun) {
    console.log(`  [DRY-RUN][UPDATE] ${collectionName}/${id}`);
    return 'updated';
  }
  await ref.update({
    ...updateFields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return 'updated';
}

/** "20260101 ~ 20260228" 형태 문자열에서 마감일(뒤쪽 날짜)을 Date로 파싱. 실패하면 null. */
function parseDeadlineFromRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const nums = rangeStr.match(/\d{8}/g);
  if (!nums || nums.length === 0) return null;
  const last = nums[nums.length - 1];
  const y = Number(last.slice(0, 4));
  const m = Number(last.slice(4, 6)) - 1;
  const d = Number(last.slice(6, 8));
  const date = new Date(y, m, d, 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 공고 설명문(자유 텍스트) 안에서 기간/마감 표현을 찾아 마감일(Date)을 추출한다.
 * bizinfo API의 reqstBeginEndDe(신청기간 구조화 필드)가 비어있거나 파싱에 실패했을 때 쓰는 보조 수단 —
 * "상시모집"으로 잘못 분류되는 공고를 줄이기 위함. 연도가 없는 표현(예: "9.1~9.30")은 올해로 가정하고,
 * 그 결과가 이미 두 달 이상 지난 날짜라면 내년으로 보정한다(연말에 등록된 "내년 상반기까지" 류 공고 대응).
 * 못 찾으면 null.
 */
function extractDeadlineFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const currentYear = new Date().getFullYear();

  const makeDate = (y, mo, d) => {
    const date = new Date(y, mo - 1, d, 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  // 연도 없는 월/일만 나온 경우: 이미 많이 지난 날짜면 내년으로 보정.
  const makeDateInferYear = (mo, d) => {
    let date = makeDate(currentYear, mo, d);
    if (date && date.getTime() < Date.now() - 60 * 86400000) {
      date = makeDate(currentYear + 1, mo, d);
    }
    return date;
  };

  // 1) "2026.09.01 ~ 2026.09.30" / "2026-09-01~2026-09-30" / "2026년 9월 1일부터 2026년 9월 30일까지"
  let m = text.match(/(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})\s*일?\s*(?:~|-|부터)\s*(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
  if (m) {
    const d = makeDate(Number(m[4]), Number(m[5]), Number(m[6]));
    if (d) return d;
  }

  // 2) "9.1 ~ 9.30" / "09/01~09/30" (연도 없음, 월.일 형식 두 번)
  m = text.match(/(\d{1,2})[.\/](\d{1,2})\s*(?:~|-)\s*(\d{1,2})[.\/](\d{1,2})(?!\d)/);
  if (m) {
    const d = makeDateInferYear(Number(m[3]), Number(m[4]));
    if (d) return d;
  }

  // 3) "9월 1일부터 9월 30일까지" / "9월 1일 ~ 9월 30일"
  m = text.match(/\d{1,2}월\s*\d{1,2}일\s*(?:부터|~|-)\s*(\d{1,2})월\s*(\d{1,2})일\s*까지/);
  if (m) {
    const d = makeDateInferYear(Number(m[1]), Number(m[2]));
    if (d) return d;
  }

  // 4) 종료일만 명시: "~2026.09.30", "2026-09-30까지", "마감: 2026.09.30", "마감일 2026-09-30"
  m = text.match(/(?:~|마감\s*[:：]?\s*|마감일\s*[:：]?\s*)(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
  if (m) {
    const d = makeDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) return d;
  }

  // 5) "9월 30일까지" (연도 없음)
  m = text.match(/(\d{1,2})월\s*(\d{1,2})일\s*까지/);
  if (m) {
    const d = makeDateInferYear(Number(m[1]), Number(m[2]));
    if (d) return d;
  }

  // 6) "접수기간 2026. 09. 14 ~ 2026. 09. 28" 처럼 라벨(접수기간/신청기간/모집기간) 뒤에 붙는 경우도
  //    위 1)에서 대부분 잡히지만, 점 뒤에 공백이 많거나 줄바꿈이 끼는 실제 페이지 레이아웃을 위해
  //    라벨을 기준으로 그 뒤 60자만 잘라 1)의 패턴을 한 번 더 시도한다.
  m = text.match(/(?:접수기간|신청기간|모집기간)\s*[:：]?\s*([\s\S]{4,60})/);
  if (m) {
    const nested = m[1].match(/(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})\s*일?\s*(?:~|-|부터)\s*(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
    if (nested) {
      const d = makeDate(Number(nested[4]), Number(nested[5]), Number(nested[6]));
      if (d) return d;
    }
  }

  return null;
}

/** HTML에서 <script>/<style>/주석 블록을 통째로 지운 뒤 나머지를 stripHtml로 텍스트화. */
function htmlPageToText(html) {
  if (!html || typeof html !== 'string') return '';
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return stripHtml(withoutNoise).slice(0, PAGE_TEXT_MAX_LEN);
}

/**
 * 공고의 신청 링크(원문 페이지)를 실제로 열어서 그 페이지 텍스트에서 마감일을 찾는다.
 * 기업마당 API 자체에는 신청기간 정보가 없고, 연결된 기관 사이트에만 접수기간이 적혀 있는 경우를 위한
 * 마지막 폴백. 페이지 접근 실패/타임아웃/HTML이 아닌 응답(PDF 등)이면 조용히 null을 반환하고 넘어간다
 * (원문 크롤링은 "되면 좋고 안 되면 상시로 남기는" 보조 수단이라 실패해도 전체 실행을 막지 않는다).
 */
async function fetchDeadlineFromPage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      timeout: PAGE_FETCH_TIMEOUT_MS,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BCSA-ingest-bot/1.0; +https://bcsa.co.kr)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('xhtml')) return null;
    const html = await res.text();
    const text = htmlPageToText(html);
    return extractDeadlineFromText(text);
  } catch (err) {
    console.log(`  [deadline-crawl] ${url} 접근 실패 또는 시간초과 — 건너뜀 (${err.message})`);
    return null;
  }
}

/**
 * 공고 하나의 마감일을 3단계 폴백으로 판정한다: 구조화 필드 → 제목/요약 텍스트 → 원문 페이지 크롤링.
 * 앞 단계에서 찾으면 뒤 단계(특히 네트워크가 필요한 원문 크롤링)는 건너뛴다.
 * 반환값의 usedCrawl은 원문 페이지 접근을 실제로 시도했는지(로그/통계용) 나타낸다.
 */
async function resolveDeadline({ item, title, summaryText, applyUrl, sourceUrl }) {
  let deadline = parseDeadlineFromRange(item.reqstBeginEndDe || item.reqstDt);
  if (deadline) return { deadline, usedCrawl: false };

  deadline = extractDeadlineFromText(`${title} ${summaryText}`);
  if (deadline) return { deadline, usedCrawl: false };

  deadline = await fetchDeadlineFromPage(applyUrl);
  if (deadline) return { deadline, usedCrawl: true };

  if (sourceUrl && sourceUrl !== applyUrl) {
    deadline = await fetchDeadlineFromPage(sourceUrl);
    if (deadline) return { deadline, usedCrawl: true };
  }

  return { deadline: null, usedCrawl: true };
}

/**
 * 기업마당 지원사업정보 API를 한 번 호출한다. hashtags를 넘기면 그 태그로 필터링된 결과만 온다
 * (예: hashtags='부산' → 부산 지역 공고만). 공식 문서 기준 지역 해시태그는 시/도 한글명 그대로 사용.
 */
async function fetchBizinfoList(apiKey, hashtags) {
  const params = new URLSearchParams({
    crtfcKey: apiKey,
    dataType: 'json',
    pageUnit: String(MAX_ITEMS_PER_SOURCE),
    pageIndex: '1',
  });
  if (hashtags) params.set('hashtags', hashtags);
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`;
  const res = await fetch(url, { timeout: 20000 });
  if (!res.ok) {
    console.error(`[bizinfo${hashtags ? ':' + hashtags : ''}] API 응답 실패: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  // 응답 최상위 배열 키가 버전에 따라 다를 수 있어 방어적으로 탐색.
  const items = json?.jsonArray || json?.items || json?.result || [];
  return Array.isArray(items) ? items.slice(0, MAX_ITEMS_PER_SOURCE) : [];
}

async function ingestBizinfo(db) {
  const apiKey = process.env.BIZINFO_API_KEY;
  if (!apiKey) {
    console.log('[bizinfo] BIZINFO_API_KEY가 없어 지원사업 자동수집을 건너뜁니다.');
    return { new: 0, updated: 0, skipped: 0 };
  }

  // 전체 공고 + 부산 지역 공고(hashtags=부산)를 각각 조회한다. 기업마당 API 자체에 시/도 필드가
  // 없어서(공식 문서 확인 — jrsdInsttNm 등 소관기관명만 있고 별도 지역 필드는 없음), 지역으로
  // 걸러 받으려면 hashtags 파라미터로 조회하는 방법뿐이다. 두 결과를 pblancUrl 기준으로 합쳐서
  // 부산 조회에 포함된 공고만 region:['부산']으로 표시하고, 나머지는 region:[]로 둔다
  // (사이트의 "부산 지원사업" 섹션은 이 region 필드로 걸러 보여준다 — SupportProgramsView.jsx 참고).
  const [generalItems, busanItems] = await Promise.all([
    fetchBizinfoList(apiKey, null),
    fetchBizinfoList(apiKey, '부산'),
  ]);
  if (generalItems.length === 0 && busanItems.length === 0) {
    console.log('[bizinfo] 수집된 공고가 없습니다. (응답 형식이 예상과 다르면 이 스크립트의 필드 매핑을 점검하세요)');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const busanUrlSet = new Set(busanItems.map((i) => i.pblancUrl).filter(Boolean));
  const merged = new Map();
  for (const item of [...generalItems, ...busanItems]) {
    if (item.pblancUrl) merged.set(item.pblancUrl, item);
  }
  const allItems = Array.from(merged.values()).slice(0, MAX_ITEMS_TOTAL);

  const counts = { new: 0, updated: 0, skipped: 0 };
  let crawledCount = 0;
  let busanCount = 0;
  for (const item of allItems) {
    const title = item.pblancNm || item.title || '';
    const org = item.jrsdInsttNm || item.excInsttNm || item.instt || '';
    const sourceUrl = item.pblancUrl || '';
    const applyUrl = item.rceptEngnHmpgUrl || sourceUrl;
    if (!title || !sourceUrl) continue;

    const isBusan = busanUrlSet.has(sourceUrl);
    if (isBusan) busanCount += 1;
    const region = isBusan ? ['부산'] : [];

    const id = shortHash(sourceUrl);
    // bsnsSumryCn은 <p>/<br> 등이 섞인 raw HTML로 온다 — 화면에 태그가 그대로 노출되지 않도록
    // 순수 텍스트로 정리한 뒤에만 요약/설명/마감일 추출에 사용한다.
    const summaryText = stripHtml(item.bsnsSumryCn || '');

    const { deadline, usedCrawl } = await resolveDeadline({ item, title, summaryText, applyUrl, sourceUrl });
    if (usedCrawl) crawledCount += 1;

    const result = await upsertDoc(db, 'supportPrograms', id, {
      onCreate: () => ({
        title,
        org,
        summary: summaryText.slice(0, 120),
        description: summaryText,
        amountText: '',
        region,
        industry: item.pldirSportRealmLclasCodeNm ? [item.pldirSportRealmLclasCodeNm] : [],
        applyUrl,
        sourceUrl,
        deadlineAt: deadline ? admin.firestore.Timestamp.fromDate(deadline) : null,
        isRolling: !deadline,
        thumbnailUrl: null,
        thumbnailDeleteUrl: null,
      }),
      onUpdate: () => ({
        title,
        org,
        summary: summaryText.slice(0, 120),
        description: summaryText,
        region,
        deadlineAt: deadline ? admin.firestore.Timestamp.fromDate(deadline) : null,
        isRolling: !deadline,
      }),
    });
    counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
      (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
  }
  console.log(`[bizinfo] 신규 ${counts.new}건, 갱신 ${counts.updated}건, 건너뜀 ${counts.skipped}건 (부산 ${busanCount}건, 원문 페이지 크롤링 시도 ${crawledCount}건)`);
  return counts;
}

/**
 * NAVER API HUB 뉴스검색 API로 키워드별 최신 기사를 가져와 newsItems에 upsert.
 * (2026년 이전 구버전 openapi.naver.com/v1/search/news.json + X-Naver-Client-Id 방식은
 * 네이버가 종료하고 NAVER API HUB로 이관함 — 도메인/경로/인증 헤더가 모두 바뀌었다.)
 * API 응답은 기사 제목/발췌(description)만 주기 때문에, summary에는 그 발췌 전문을 담아
 * "기사 발췌" 형태로 보여준다(전체 본문을 가져오는 게 아님 — 원문은 externalUrl로 연결).
 */
async function ingestNaverNews(db) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('[naver-news] NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 없어 뉴스 자동수집을 건너뜁니다.');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const seen = new Set();
  const collected = [];

  for (const query of NEWS_KEYWORDS) {
    if (collected.length >= MAX_ITEMS_PER_SOURCE) break;
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/news?query=${encodeURIComponent(query)}&display=10&sort=date`;
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
        timeout: 20000,
      });
    } catch (err) {
      console.error(`[naver-news:${query}] 요청 실패:`, err.message);
      continue;
    }
    if (!res.ok) {
      console.error(`[naver-news:${query}] API 응답 실패: HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    for (const item of json.items || []) {
      const link = item.originallink || item.link || '';
      if (!link || seen.has(link)) continue;
      seen.add(link);
      collected.push(item);
    }
  }

  const counts = { new: 0, updated: 0, skipped: 0 };
  for (const item of collected.slice(0, MAX_ITEMS_PER_SOURCE)) {
    const link = item.originallink || item.link || '';
    const title = stripHtml(item.title);
    const description = stripHtml(item.description);
    if (!link || !title) continue;

    const id = shortHash(link);
    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

    const result = await upsertDoc(db, 'newsItems', id, {
      onCreate: () => ({
        title,
        source: hostnameLabel(link),
        summary: description.slice(0, 200),
        url: link,
        category: 'econ',
        publishedAt: admin.firestore.Timestamp.fromDate(publishedAt),
      }),
      onUpdate: () => null, // 뉴스는 내용이 바뀔 일이 없어 갱신 불필요
    });
    counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
      (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
  }
  console.log(`[naver-news] 검색 수집 ${collected.length}건 중 신규 ${counts.new}건, 건너뜀 ${counts.skipped}건`);
  return counts;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log(`[ingest-daily-feed] 시작 (${isDryRun ? 'dry-run' : 'live'}) — ${new Date().toISOString()}`);

  const bizinfoResult = await ingestBizinfo(db);
  const newsResult = await ingestNaverNews(db);

  console.log('[ingest-daily-feed] 완료:', { supportPrograms: bizinfoResult, newsItems: newsResult });
  process.exit(0);
}

main().catch((err) => {
  console.error('[ingest-daily-feed] 오류:', err);
  process.exit(1);
});
