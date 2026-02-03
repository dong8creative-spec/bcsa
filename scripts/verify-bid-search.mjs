#!/usr/bin/env node
/**
 * 나라장터 검색결과 검증용 스크립트
 * 프록시(apibid)에 검색 요청을 보내고, 응답 요약(상태, cached, totalCount, 공고번호 목록)을 출력합니다.
 * 사용: node scripts/verify-bid-search.mjs
 *       node scripts/verify-bid-search.mjs --keyword 부산 --from 2026-01-08 --to 2026-01-31
 *       node scripts/verify-bid-search.mjs --strict   (3개 API 모두 성공 시에만 exit 0)
 *       node scripts/verify-bid-search.mjs --baseline docs/baseline_busan.json
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

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

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { keyword: '부산', fromBidDt: '', toBidDt: '', pageNo: 1, numOfRows: 10, strict: false, baselinePath: '', baselinePrint: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keyword' && args[i + 1]) { opts.keyword = args[i + 1]; i++; }
    else if (args[i] === '--from' && args[i + 1]) { opts.fromBidDt = args[i + 1].replace(/-/g, ''); i++; }
    else if (args[i] === '--to' && args[i + 1]) { opts.toBidDt = args[i + 1].replace(/-/g, ''); i++; }
    else if (args[i] === '--pageNo' && args[i + 1]) { opts.pageNo = parseInt(args[i + 1], 10) || 1; i++; }
    else if (args[i] === '--numOfRows' && args[i + 1]) { opts.numOfRows = parseInt(args[i + 1], 10) || 10; i++; }
    else if (args[i] === '--strict' || args[i] === '--compare') { opts.strict = true; }
    else if (args[i] === '--baseline' && args[i + 1]) { opts.baselinePath = args[i + 1]; i++; }
    else if (args[i] === '--baseline-print') { opts.baselinePrint = true; }
  }
  if (!opts.fromBidDt || !opts.toBidDt) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    opts.fromBidDt = opts.fromBidDt || fmt(start) + '0000';
    opts.toBidDt = opts.toBidDt || fmt(now) + '2359';
  }
  // 8자리(YYYYMMDD) → 12자리(YYYYMMDDHHMM)
  if (opts.fromBidDt.length === 8) opts.fromBidDt += '0000';
  if (opts.toBidDt.length === 8) opts.toBidDt += '2359';
  return opts;
}

async function main() {
  const baseUrl = getApiBaseUrl();
  const opts = parseArgs();
  const params = new URLSearchParams({
    bidNtceNm: opts.keyword,
    inqryDiv: '1',
    fromBidDt: opts.fromBidDt,
    toBidDt: opts.toBidDt,
    pageNo: String(opts.pageNo),
    numOfRows: String(opts.numOfRows)
  });
  if (opts.baselinePrint) params.set('nocache', 'true');
  const url = `${baseUrl}/api/bid-search?${params.toString()}`;

  console.log('=== 나라장터 검색결과 검증 (프록시 직접 호출) ===\n');
  console.log('요청 URL:', url);
  console.log('검색어:', opts.keyword, '| 날짜:', opts.fromBidDt.slice(0, 8), '~', opts.toBidDt.slice(0, 8));
  console.log('');

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
  } catch (err) {
    console.error('연결 실패:', err.message);
    console.log('\n판단: 프록시/네트워크 오류 가능성 확인');
    process.exit(1);
  }

  const status = res.status;
  let body;
  try {
    body = await res.json();
  } catch (_) {
    const text = await res.text();
    console.error('응답 파싱 실패 (JSON 아님). 본문 일부:', text.slice(0, 300));
    process.exit(1);
  }

  console.log('HTTP 상태:', status);
  console.log('success:', body.success);
  console.log('cached:', body.cached ?? '-');
  console.log('totalCount:', body.data?.totalCount ?? '-');
  const items = body.data?.items ?? [];
  console.log('items 길이:', items.length);
  if (items.length > 0) {
    const ids = items.slice(0, 10).map((i) => i.bidNtceNo || '-');
    console.log('공고번호 (최대 10건):', ids.join(', '));
  }
  if (body.meta) {
    console.log('meta.apiCallCount:', body.meta.apiCallCount ?? '-');
    console.log('meta.successfulCalls:', body.meta.successfulCalls ?? '-');
    console.log('meta.partialFailure:', body.meta.partialFailure ?? '-');
  }
  if (body.warnings && body.warnings.length > 0) {
    console.log('warnings:', body.warnings.join('; '));
  }

  console.log('\n--- 검증 체크리스트 (계획서 3.3) ---');
  if (status >= 500 || status === 404) {
    console.log('판단: 프록시/네트워크 오류');
  } else if (status === 200 && body.cached === true) {
    console.log('판단: 캐시 사용됨. 나라장터와 다르면 캐시로 인한 구식/상이 데이터 가능성');
  } else if (status === 200 && body.success && items.length === 0) {
    console.log('판단: API 호출/파라미터/키/트래픽 문제 또는 해당 조건 결과 없음');
  } else if (status === 200 && body.success) {
    console.log('판단: 정상 응답. 나라장터와 공고번호·건수 비교하여 검색 범위 차이 여부 확인');
  }

  let exitCode = 0;
  if (opts.strict) {
    const meta = body.meta || {};
    const expectedCalls = meta.dualSearch ? 6 : 3;
    const ok = body.success === true && meta.successfulCalls === expectedCalls && meta.partialFailure !== true;
    if (!ok) {
      console.log(`\n[--strict] 실패: success=true, meta.successfulCalls=${expectedCalls}(dualSearch=${!!meta.dualSearch}), meta.partialFailure=false 여야 합니다. (actual: ${meta.successfulCalls})`);
      exitCode = 1;
    } else {
      console.log(`\n[--strict] 통과: ${expectedCalls}개 API 모두 성공.`);
    }
  }
  if (opts.baselinePrint && items.length > 0) {
    console.log('\n--- 1단계 기준선 측정용: 우리 사이트 1페이지 (나라장터와 비교용) ---');
    console.log('검색어:', opts.keyword, '| 기간:', opts.fromBidDt.slice(0, 8), '~', opts.toBidDt.slice(0, 8), '| totalCount:', body.data?.totalCount ?? '-');
    console.log('순번\t공고번호\t공고명(앞 30자)');
    items.forEach((i, idx) => {
      const nm = (i.bidNtceNm || '-').slice(0, 30);
      console.log(`${idx + 1}\t${i.bidNtceNo || '-'}\t${nm}`);
    });
    console.log('--- 위 목록을 나라장터 1페이지 공고번호·순서와 비교하세요. ---');
  }

  if (opts.baselinePath) {
    const baselinePath = join(rootDir, opts.baselinePath);
    if (!existsSync(baselinePath)) {
      console.error('\n[--baseline] 파일 없음:', baselinePath);
      exitCode = 1;
    } else {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
      const expected = baseline.expectedBidNtceNos || [];
      const actual = items.map((i) => i.bidNtceNo).filter(Boolean);
      const missing = expected.filter((id) => !actual.includes(id));
      if (missing.length > 0) {
        console.log('\n[--baseline] 실패: 기대 공고번호 중 누락:', missing.join(', '));
        exitCode = 1;
      } else {
        console.log('\n[--baseline] 통과: 기대 공고번호가 1페이지 결과에 포함됨.');
      }
    }
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
