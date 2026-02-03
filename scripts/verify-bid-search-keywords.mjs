#!/usr/bin/env node
/**
 * 검색어 3종(부산, 용역, 서울) 검색결과 일치 테스트
 * 각 검색어에 대해 프록시 호출 후 strict(3개 API 성공) 판정. 전체 통과 시 exit 0.
 * 사용: node scripts/verify-bid-search-keywords.mjs
 *       npm run test:bid-search-keywords
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const KEYWORDS = ['부산', '용역', '서울'];

function getApiBaseUrl() {
  if (process.env.VITE_API_URL) return process.env.VITE_API_URL.replace(/\/$/, '');
  const envPath = join(rootDir, '.env.development');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    const m = content.match(/VITE_API_URL=(.+)/);
    if (m) return m[1].trim().replace(/\/$/, '');
  }
  return 'https://apibid-oytjv32jna-du.a.run.app';
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 30);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const from = fmt(start) + '0000';
  const to = fmt(now) + '2359';
  return { fromBidDt: from, toBidDt: to };
}

async function runOne(baseUrl, keyword) {
  const { fromBidDt, toBidDt } = getDefaultDateRange();
  const params = new URLSearchParams({
    bidNtceNm: keyword,
    inqryDiv: '1',
    fromBidDt,
    toBidDt,
    pageNo: '1',
    numOfRows: '10'
  });
  const url = `${baseUrl}/api/bid-search?${params.toString()}`;

  let res;
  try {
    res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (err) {
    return { ok: false, keyword, error: err.message, totalCount: null, itemsLength: null, sampleIds: [] };
  }

  let body;
  try {
    body = await res.json();
  } catch (_) {
    return { ok: false, keyword, error: '응답 파싱 실패 (JSON 아님)', totalCount: null, itemsLength: null, sampleIds: [] };
  }

  const meta = body.meta || {};
  // 이중 검색(공고명+기관명) 시 apiCallCount=6, 단일 검색 시 3
  const expectedCalls = meta.dualSearch ? 6 : 3;
  const strictOk = body.success === true && meta.successfulCalls === expectedCalls && meta.partialFailure !== true;
  const items = body.data?.items ?? [];
  const totalCount = body.data?.totalCount ?? null;
  const sampleIds = items.slice(0, 3).map((i) => i.bidNtceNo || '-').filter((id) => id !== '-');

  if (!strictOk) {
    const reason = body.success !== true
      ? `success=${body.success}`
      : meta.successfulCalls !== 3
        ? `successfulCalls=${meta.successfulCalls}`
        : meta.partialFailure === true
          ? 'partialFailure=true'
          : 'unknown';
    return { ok: false, keyword, error: reason, totalCount, itemsLength: items.length, sampleIds };
  }

  return { ok: true, keyword, totalCount, itemsLength: items.length, sampleIds };
}

async function main() {
  const baseUrl = getApiBaseUrl();
  console.log('=== 검색어 3종 검색결과 일치 테스트 ===\n');
  console.log('API:', baseUrl);
  console.log('검색어:', KEYWORDS.join(', '));
  console.log('날짜: 최근 30일 기본\n');

  const results = [];
  for (const keyword of KEYWORDS) {
    const r = await runOne(baseUrl, keyword);
    results.push(r);
    if (r.ok) {
      const sample = r.sampleIds.length ? ` | 샘플: ${r.sampleIds.join(', ')}` : '';
      console.log(`검색어 '${keyword}' 통과 (successfulCalls=3) | totalCount=${r.totalCount ?? '-'} | items=${r.itemsLength ?? '-'}${sample}`);
    } else {
      console.log(`검색어 '${keyword}' 실패 | ${r.error}${r.totalCount != null ? ` | totalCount=${r.totalCount}` : ''}${r.sampleIds.length ? ` | 샘플: ${r.sampleIds.join(', ')}` : ''}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).map((r) => r.keyword);

  console.log('');
  if (failed.length === 0) {
    console.log('전체: 3/3 통과');
    process.exit(0);
  } else {
    console.log(`전체: ${passed}/3 통과 (실패: ${failed.join(', ')})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
