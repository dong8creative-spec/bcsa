#!/usr/bin/env node

/**
 * 나라장터와 현재 시스템 전체 필드 비교 스크립트
 * 
 * 비교 항목:
 * - 공고번호 (bidNtceNo)
 * - 공고명 (bidNtceNm)
 * - 공고기관 (insttNm)
 * - 수요기관 (dmandInsttNm)
 * - 게시일시 (bidNtceDt)
 * - 마감일시 (bidClseDt)
 */

import axios from 'axios';
import https from 'https';
import { writeFileSync } from 'fs';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

const SEARCH_CONDITIONS = {
  bidNtceNm: '부산',
  fromBidDt: '20251230',
  toBidDt: '20260129',
  inqryDiv: '1',
  pageNo: 1,
  numOfRows: 20
};

console.log('🔍 나라장터 vs 현재 시스템 전체 필드 비교\n');

// 현재 시스템 결과
async function getOurResults() {
  try {
    console.log('📡 현재 시스템 API 호출 중...');
    const response = await axios.get(OUR_API, {
      params: SEARCH_CONDITIONS,
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
    });

    if (response.data.success && response.data.data.items) {
      console.log(`   ✅ ${response.data.data.items.length}개 결과\n`);
      return response.data.data.items;
    }
    return [];
  } catch (error) {
    console.error('   ❌ 오류:', error.message);
    return [];
  }
}

// 나라장터 원본 API (모든 엔드포인트)
async function getOfficialResults() {
  const apiPaths = [
    { name: '물품', path: 'getBidPblancListInfoThngPPSSrch' },
    { name: '공사', path: 'getBidPblancListInfoCnstwkPPSSrch' }
  ];

  console.log('📡 나라장터 원본 API 호출 중...\n');
  
  const allResults = [];
  const inqryBgnDt = SEARCH_CONDITIONS.fromBidDt + '0000';
  const inqryEndDt = SEARCH_CONDITIONS.toBidDt + '2359';

  for (const { name, path } of apiPaths) {
    try {
      const url = `${BASE_URL}/${path}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=100&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&bidNtceNm=${encodeURIComponent(SEARCH_CONDITIONS.bidNtceNm)}&type=json`;

      console.log(`   🔹 ${name} API 호출 중...`);
      
      const response = await axios.get(url, {
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 30000,
        validateStatus: () => true
      });

      if (response.status !== 200) {
        console.log(`      ❌ HTTP ${response.status}`);
        continue;
      }

      let items = [];
      if (response.data.response && response.data.response.body) {
        const body = response.data.response.body;
        
        if (body.resultCode && body.resultCode !== '00') {
          console.log(`      ⚠️  결과 코드: ${body.resultCode}`);
          continue;
        }

        if (body.items) {
          if (Array.isArray(body.items.item)) {
            items = body.items.item;
          } else if (body.items.item) {
            items = [body.items.item];
          } else if (Array.isArray(body.items)) {
            items = body.items;
          }
        }
        
        items = items.map(item => ({
          ...item,
          insttNm: item.ntceInsttNm || item.insttNm,
          dmandInsttNm: item.dminsttNm || item.dmandInsttNm
        }));
      }

      console.log(`      ✅ ${items.length}개 결과`);
      allResults.push(...items);
      
    } catch (error) {
      console.log(`      ❌ 오류: ${error.message}`);
    }
  }

  console.log(`\n   📊 총 ${allResults.length}개 결과\n`);
  return allResults;
}

// 전체 필드 비교
function compareAllFields(ourResults, officialResults) {
  console.log('📊 전체 필드 비교:\n');
  console.log(`현재 시스템: ${ourResults.length}개`);
  console.log(`나라장터 원본: ${officialResults.length}개\n`);

  const ourMap = new Map();
  ourResults.forEach(item => {
    if (item.bidNtceNo) {
      ourMap.set(item.bidNtceNo, item);
    }
  });

  const officialMap = new Map();
  officialResults.forEach(item => {
    if (item.bidNtceNo) {
      officialMap.set(item.bidNtceNo, item);
    }
  });

  const commonNos = Array.from(ourMap.keys()).filter(k => officialMap.has(k));
  
  const detailedComparison = {
    totalOurs: ourResults.length,
    totalOfficial: officialResults.length,
    commonCount: commonNos.length,
    fieldMatches: {
      bidNtceNo: 0,
      bidNtceNm: 0,
      insttNm: 0,
      dmandInsttNm: 0,
      bidNtceDt: 0,
      bidClseDt: 0
    },
    discrepancies: []
  };

  if (commonNos.length > 0) {
    console.log(`✅ 공통 공고번호: ${commonNos.length}개\n`);
    console.log('🔍 필드별 상세 비교:\n');

    commonNos.forEach((no, idx) => {
      const our = ourMap.get(no);
      const official = officialMap.get(no);

      const fields = ['bidNtceNm', 'insttNm', 'dmandInsttNm', 'bidNtceDt', 'bidClseDt'];
      
      fields.forEach(field => {
        const ourValue = (our[field] || '').trim();
        const officialValue = (official[field] || official[`ntce${field.charAt(0).toUpperCase()}${field.slice(1)}`] || '').trim();
        
        if (ourValue === officialValue) {
          detailedComparison.fieldMatches[field]++;
        } else if (idx < 3) {
          detailedComparison.discrepancies.push({
            bidNtceNo: no,
            field,
            ourValue,
            officialValue
          });
        }
      });
    });

    // 필드별 일치율
    console.log('필드별 일치율:');
    Object.entries(detailedComparison.fieldMatches).forEach(([field, count]) => {
      const rate = (count / commonNos.length * 100).toFixed(1);
      console.log(`   ${field}: ${rate}% (${count}/${commonNos.length})`);
    });
  } else {
    console.log('⚠️  공통 공고번호가 없습니다.\n');
    
    // 현재 시스템 공고번호 목록 (처음 10개)
    console.log('현재 시스템 공고번호 (첫 10개):');
    Array.from(ourMap.keys()).slice(0, 10).forEach((no, idx) => {
      const item = ourMap.get(no);
      console.log(`   ${idx + 1}. ${no} - ${item.bidNtceNm || 'N/A'}`);
    });
    
    console.log('\n나라장터 원본 공고번호 (첫 10개):');
    Array.from(officialMap.keys()).slice(0, 10).forEach((no, idx) => {
      const item = officialMap.get(no);
      console.log(`   ${idx + 1}. ${no} - ${item.bidNtceNm || 'N/A'}`);
    });
  }

  // 보고서 저장
  const report = {
    timestamp: new Date().toISOString(),
    searchConditions: SEARCH_CONDITIONS,
    results: detailedComparison,
    conclusion: detailedComparison.commonCount > 0 
      ? `${(detailedComparison.commonCount / Math.max(detailedComparison.totalOurs, detailedComparison.totalOfficial) * 100).toFixed(1)}% 일치` 
      : '일치하는 항목 없음'
  };

  writeFileSync('G2B_COMPARISON_REPORT.json', JSON.stringify(report, null, 2));
  console.log('\n📄 상세 보고서 저장: G2B_COMPARISON_REPORT.json');

  return detailedComparison;
}

// 메인 실행
async function main() {
  try {
    const [ourResults, officialResults] = await Promise.all([
      getOurResults(),
      getOfficialResults()
    ]);

    const comparison = compareAllFields(ourResults, officialResults);

    console.log('\n✅ 비교 완료!\n');
    console.log('📋 최종 요약:');
    console.log(`   - 현재 시스템: ${comparison.totalOurs}개`);
    console.log(`   - 나라장터 원본: ${comparison.totalOfficial}개`);
    console.log(`   - 공통 항목: ${comparison.commonCount}개`);
    
    if (comparison.commonCount > 0) {
      const avgMatchRate = Object.values(comparison.fieldMatches).reduce((a, b) => a + b, 0) / Object.keys(comparison.fieldMatches).length / comparison.commonCount * 100;
      console.log(`   - 평균 필드 일치율: ${avgMatchRate.toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
