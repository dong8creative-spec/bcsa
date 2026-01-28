#!/usr/bin/env node

/**
 * 나라장터 스크린샷 조건과 동일한 검색 테스트
 * 
 * 검색 조건:
 * - 공고종류: 실공고
 * - 공고명: "부산"
 * - 날짜 범위: 2025/12/30 ~ 2026/01/29
 * - 업무구분: 전체
 */

import axios from 'axios';
import https from 'https';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 나라장터 스크린샷 기준 검색 조건
const SEARCH_CONDITIONS = {
  bidNtceNm: '부산',
  bidNtceDtlClsfCd: '실공고',
  fromBidDt: '20251230',
  toBidDt: '20260129',
  inqryDiv: '1',
  pageNo: 1,
  numOfRows: 10
};

console.log('🔍 나라장터 스크린샷 조건 기준 검색 테스트\n');
console.log('📋 검색 조건:');
console.log(`   - 공고명: ${SEARCH_CONDITIONS.bidNtceNm}`);
console.log(`   - 공고종류: ${SEARCH_CONDITIONS.bidNtceDtlClsfCd}`);
console.log(`   - 날짜: ${SEARCH_CONDITIONS.fromBidDt} ~ ${SEARCH_CONDITIONS.toBidDt}\n`);

// 1. 현재 시스템 API 호출
async function getOurResults() {
  try {
    console.log('📡 현재 시스템 API 호출 중...');
    const response = await axios.get(OUR_API, {
      params: SEARCH_CONDITIONS,
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
    });

    if (response.data.success && response.data.data.items) {
      console.log(`   ✅ ${response.data.data.items.length}개 결과 수신`);
      console.log(`   totalCount: ${response.data.data.totalCount || 'N/A'}`);
      console.log(`   warnings: ${response.data.data.warnings ? JSON.stringify(response.data.data.warnings) : 'null'}\n`);
      return response.data.data.items;
    }
    return [];
  } catch (error) {
    console.error('   ❌ 오류:', error.message);
    return [];
  }
}

// 2. 나라장터 원본 API 호출 (3개 엔드포인트)
async function getOfficialResults() {
  const apiPaths = [
    { name: '물품', path: 'getBidPblancListInfoThngPPSSrch' },
    { name: '용역', path: 'getBidPblancListInfoSvcPPSSrch' },
    { name: '공사', path: 'getBidPblancListInfoCnstwkPPSSrch' }
  ];

  console.log('📡 나라장터 원본 API 호출 중 (3개 엔드포인트)...\n');
  
  const allResults = [];
  const inqryBgnDt = SEARCH_CONDITIONS.fromBidDt + '0000';
  const inqryEndDt = SEARCH_CONDITIONS.toBidDt + '2359';

  for (const { name, path } of apiPaths) {
    try {
      const url = `${BASE_URL}/${path}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=${SEARCH_CONDITIONS.pageNo}&numOfRows=100&inqryDiv=${SEARCH_CONDITIONS.inqryDiv}&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&bidNtceNm=${encodeURIComponent(SEARCH_CONDITIONS.bidNtceNm)}&bidNtceDtlClsfCd=${encodeURIComponent(SEARCH_CONDITIONS.bidNtceDtlClsfCd)}&type=json`;

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
          console.log(`      ⚠️  결과 코드: ${body.resultCode}, 메시지: ${body.resultMsg || 'N/A'}`);
          continue;
        }

        if (body.items) {
          if (Array.isArray(body.items.item)) {
            items = body.items.item;
          } else if (body.items.item) {
            items = [body.items.item];
          }
        }
        
        // 필드명 정규화
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

  console.log(`\n   📊 총 ${allResults.length}개 결과 수집\n`);
  return allResults;
}

// 3. 결과 비교
function compareResults(ourResults, officialResults) {
  console.log('📊 결과 비교:\n');
  console.log(`현재 시스템: ${ourResults.length}개`);
  console.log(`나라장터 원본: ${officialResults.length}개\n`);

  // 공고번호로 매칭
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

  // 공통 공고번호
  const commonNos = Array.from(ourMap.keys()).filter(k => officialMap.has(k));
  const onlyInOurs = Array.from(ourMap.keys()).filter(k => !officialMap.has(k));
  const onlyInOfficial = Array.from(officialMap.keys()).filter(k => !ourMap.has(k));

  console.log(`✅ 공통 공고번호: ${commonNos.length}개`);
  console.log(`현재 시스템에만: ${onlyInOurs.length}개`);
  console.log(`나라장터에만: ${onlyInOfficial.length}개\n`);

  // 상세 비교 (공통 항목)
  if (commonNos.length > 0) {
    console.log('🔍 공통 항목 상세 비교:\n');
    
    let perfectMatches = 0;
    
    commonNos.slice(0, 5).forEach((no, idx) => {
      const our = ourMap.get(no);
      const official = officialMap.get(no);
      
      console.log(`${idx + 1}. 공고번호: ${no}`);
      
      // 공고명 비교
      const ourName = (our.bidNtceNm || '').trim();
      const officialName = (official.bidNtceNm || '').trim();
      const nameMatch = ourName === officialName;
      console.log(`   공고명: ${nameMatch ? '✅ 일치' : '❌ 불일치'}`);
      if (!nameMatch) {
        console.log(`     현재: ${ourName}`);
        console.log(`     원본: ${officialName}`);
      }
      
      // 기관명 비교
      const ourInstt = (our.insttNm || '').trim();
      const officialInstt = (official.insttNm || official.ntceInsttNm || '').trim();
      const insttMatch = ourInstt === officialInstt;
      console.log(`   기관명: ${insttMatch ? '✅ 일치' : '❌ 불일치'}`);
      if (!insttMatch) {
        console.log(`     현재: ${ourInstt}`);
        console.log(`     원본: ${officialInstt}`);
      }
      
      // 게시일시 비교
      const ourDate = (our.bidNtceDt || '').trim();
      const officialDate = (official.bidNtceDt || '').trim();
      const dateMatch = ourDate === officialDate;
      console.log(`   게시일시: ${dateMatch ? '✅ 일치' : '❌ 불일치'}`);
      if (!dateMatch) {
        console.log(`     현재: ${ourDate}`);
        console.log(`     원본: ${officialDate}`);
      }
      
      if (nameMatch && insttMatch && dateMatch) {
        perfectMatches++;
        console.log(`   ✅ 완전 일치\n`);
      } else {
        console.log(`   ⚠️  부분 불일치\n`);
      }
    });
    
    const perfectMatchRate = (perfectMatches / Math.min(commonNos.length, 5) * 100).toFixed(1);
    console.log(`완전 일치율 (첫 5개): ${perfectMatchRate}%\n`);
  }

  // 나라장터 스크린샷 공고번호 (9개)
  const screenshotBidNos = [
    'R26BK01302318',
    'R26BK01266494', 
    'R26BK01301862',
    'R26BK01296994',
    'R26BK01298805',
    'R26BK01301585',
    'R26BK01298159',
    'R26BK01300683'
  ];

  console.log('🖼️  나라장터 스크린샷 공고번호 확인:\n');
  screenshotBidNos.forEach((no, idx) => {
    const inOurs = ourMap.has(no);
    const inOfficial = officialMap.has(no);
    console.log(`${idx + 1}. ${no}: 현재시스템=${inOurs ? '✅' : '❌'}, 원본API=${inOfficial ? '✅' : '❌'}`);
  });

  // 일치율 계산
  const totalUnique = new Set([...ourMap.keys(), ...officialMap.keys()]).size;
  const matchRate = totalUnique > 0 ? (commonNos.length / totalUnique * 100).toFixed(2) : 0;
  
  console.log(`\n📊 전체 일치율: ${matchRate}% (${commonNos.length}/${totalUnique})`);

  return {
    ourCount: ourResults.length,
    officialCount: officialResults.length,
    commonCount: commonNos.length,
    onlyInOurs: onlyInOurs.length,
    onlyInOfficial: onlyInOfficial.length,
    matchRate: parseFloat(matchRate),
    screenshotMatches: screenshotBidNos.filter(no => ourMap.has(no)).length,
    screenshotTotal: screenshotBidNos.length
  };
}

// 메인 실행
async function main() {
  try {
    const [ourResults, officialResults] = await Promise.all([
      getOurResults(),
      getOfficialResults()
    ]);

    const comparison = compareResults(ourResults, officialResults);

    console.log('\n✅ 비교 완료!\n');
    console.log('📋 요약:');
    console.log(`   - 현재 시스템: ${comparison.ourCount}개`);
    console.log(`   - 나라장터 원본: ${comparison.officialCount}개`);
    console.log(`   - 공통 항목: ${comparison.commonCount}개`);
    console.log(`   - 전체 일치율: ${comparison.matchRate}%`);
    console.log(`   - 스크린샷 일치: ${comparison.screenshotMatches}/${comparison.screenshotTotal}개\n`);

    if (comparison.matchRate >= 80) {
      console.log('✅ 결과가 매우 일치합니다! (80% 이상)');
    } else if (comparison.matchRate >= 50) {
      console.log('⚠️  결과가 부분적으로 일치합니다. (50-80%)');
    } else {
      console.log('❌ 결과 차이가 있습니다. (50% 미만)');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
