#!/usr/bin/env node
/**
 * 지원사업 + 뉴스 일일 자동 수집 스크립트
 *
 * 매일 07:00(KST)에 GitHub Actions(.github/workflows/daily-content-feed.yml)가 실행합니다.
 * - 지원사업: 기업마당(bizinfo.go.kr) 지원사업정보 오픈API → Firestore `supportPrograms` 컬렉션
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

// 네이버 뉴스검색에서 이 키워드들로 각각 검색해 결과를 모은다.
// 자영업자/예비창업자/소상공인 관련 뉴스를 폭넓게 담기 위한 검색어 목록 — 필요 시 자유롭게 추가/수정 가능.
const NEWS_KEYWORDS = ['창업', '사업자', '예비창업', '예창', '지원사업', '부산청년'];

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 20);
}

/** 네이버 API 응답의 title/description에 섞여 있는 <b> 태그, HTML 엔티티를 제거한 순수 텍스트로 변환. */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

async function ingestBizinfo(db) {
  const apiKey = process.env.BIZINFO_API_KEY;
  if (!apiKey) {
    console.log('[bizinfo] BIZINFO_API_KEY가 없어 지원사업 자동수집을 건너뜁니다.');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${encodeURIComponent(apiKey)}&dataType=json&pageUnit=${MAX_ITEMS_PER_SOURCE}&pageIndex=1`;
  const res = await fetch(url, { timeout: 20000 });
  if (!res.ok) {
    console.error(`[bizinfo] API 응답 실패: HTTP ${res.status}`);
    return { new: 0, updated: 0, skipped: 0 };
  }
  const json = await res.json();
  // 응답 최상위 배열 키가 버전에 따라 다를 수 있어 방어적으로 탐색.
  const items = json?.jsonArray || json?.items || json?.result || [];
  if (!Array.isArray(items) || items.length === 0) {
    console.log('[bizinfo] 수집된 공고가 없습니다. (응답 형식이 예상과 다르면 이 스크립트의 필드 매핑을 점검하세요)');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const counts = { new: 0, updated: 0, skipped: 0 };
  for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
    const title = item.pblancNm || item.title || '';
    const org = item.jrsdInsttNm || item.excInsttNm || item.instt || '';
    const sourceUrl = item.pblancUrl || '';
    const applyUrl = item.rceptEngnHmpgUrl || sourceUrl;
    if (!title || !sourceUrl) continue;

    const id = shortHash(sourceUrl);
    const deadline = parseDeadlineFromRange(item.reqstBeginEndDe);

    const result = await upsertDoc(db, 'supportPrograms', id, {
      onCreate: () => ({
        title,
        org,
        summary: (item.bsnsSumryCn || '').slice(0, 120),
        description: item.bsnsSumryCn || '',
        amountText: '',
        region: [],
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
        description: item.bsnsSumryCn || '',
        deadlineAt: deadline ? admin.firestore.Timestamp.fromDate(deadline) : null,
        isRolling: !deadline,
      }),
    });
    counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
      (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
  }
  console.log(`[bizinfo] 신규 ${counts.new}건, 갱신 ${counts.updated}건, 건너뜀 ${counts.skipped}건`);
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
