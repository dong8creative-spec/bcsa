#!/usr/bin/env node
/**
 * 지원사업 + 뉴스 일일 자동 수집 스크립트
 *
 * 매일 07:00(KST)에 GitHub Actions(.github/workflows/daily-content-feed.yml)가 실행합니다.
 * - 지원사업: 기업마당(bizinfo.go.kr) 지원사업정보 오픈API → Firestore `supportPrograms` 컬렉션
 * - 뉴스: 언론사 RSS(현재 한국경제 경제섹션) 중 소상공인/자영업/창업 키워드가 포함된 기사만 골라
 *         → Firestore `newsItems` 컬렉션
 *
 * 두 컬렉션 모두 sourceUrl(또는 기사 링크)의 해시를 문서 ID로 사용해 매일 실행해도 중복 등록되지 않습니다(upsert).
 * 관리자가 admin 화면에서 수동으로 만든 문서(sourceType !== 'site_scan')는 절대 덮어쓰지 않고,
 * 자동수집 문서라도 관리자가 껐던 enabled 값은 건드리지 않습니다(관리자 판단을 항상 우선).
 *
 * 실행 전 필요한 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  - 파이어베이스 서비스 계정 키 JSON 전체(문자열)
 *   BIZINFO_API_KEY               - 기업마당 오픈API 인증키(data.go.kr에서 발급). 없으면 지원사업 수집은 건너뜀.
 *
 * 실행:
 *   node scripts/ingest-daily-feed.mjs           # 실제 반영
 *   node scripts/ingest-daily-feed.mjs --dry-run # 수집 결과만 콘솔에 출력, Firestore 미반영
 */

import crypto from 'crypto';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import Parser from 'rss-parser';

const isDryRun = process.argv.includes('--dry-run');

// 소스당 1회 실행 최대 처리 건수 캡(오작동 시 대량 오등록 방지 안전장치)
const MAX_ITEMS_PER_SOURCE = 15;

// 경제 RSS 중 이 키워드가 제목/요약에 하나라도 포함된 기사만 "자영업자/예비창업자 관련 뉴스"로 채택.
// 필요에 따라 자유롭게 추가/수정 가능.
const NEWS_KEYWORDS = ['소상공인', '자영업', '창업', '개인사업자', '가맹점', '프랜차이즈', '중소기업', '스타트업'];

const NEWS_RSS_SOURCES = [
  { name: '한국경제', url: 'https://www.hankyung.com/feed/economy' },
  // 다른 RSS(이투데이 등)나 네이버 검색 오픈API(키워드 검색)는 여기에 소스를 추가하면 됩니다.
];

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 20);
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

async function ingestNewsRss(db) {
  const parser = new Parser({ timeout: 20000 });
  const totals = { new: 0, updated: 0, skipped: 0 };

  for (const source of NEWS_RSS_SOURCES) {
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      console.error(`[news:${source.name}] RSS를 불러오지 못했습니다:`, err.message);
      continue;
    }
    const matched = (feed.items || []).filter((it) => {
      const text = `${it.title || ''} ${it.contentSnippet || ''}`;
      return NEWS_KEYWORDS.some((kw) => text.includes(kw));
    });

    const counts = { new: 0, updated: 0, skipped: 0 };
    for (const it of matched.slice(0, MAX_ITEMS_PER_SOURCE)) {
      const link = it.link || '';
      const title = it.title || '';
      if (!link || !title) continue;
      const id = shortHash(link);
      const publishedAt = it.isoDate ? new Date(it.isoDate) : new Date();

      const result = await upsertDoc(db, 'newsItems', id, {
        onCreate: () => ({
          title,
          source: source.name,
          summary: (it.contentSnippet || '').slice(0, 140),
          url: link,
          category: 'econ',
          publishedAt: admin.firestore.Timestamp.fromDate(publishedAt),
        }),
        onUpdate: () => null, // 뉴스는 내용이 바뀔 일이 없어 갱신 불필요
      });
      counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
        (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
    }
    console.log(`[news:${source.name}] 키워드 매칭 ${matched.length}건 중 신규 ${counts.new}건, 건너뜀 ${counts.skipped}건`);
    totals.new += counts.new;
    totals.updated += counts.updated;
    totals.skipped += counts.skipped;
  }
  return totals;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log(`[ingest-daily-feed] 시작 (${isDryRun ? 'dry-run' : 'live'}) — ${new Date().toISOString()}`);

  const bizinfoResult = await ingestBizinfo(db);
  const newsResult = await ingestNewsRss(db);

  console.log('[ingest-daily-feed] 완료:', { supportPrograms: bizinfoResult, newsItems: newsResult });
  process.exit(0);
}

main().catch((err) => {
  console.error('[ingest-daily-feed] 오류:', err);
  process.exit(1);
});
