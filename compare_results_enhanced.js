#!/usr/bin/env node

/**
 * 나라장터 공식 API와 현재 시스템 결과 비교 스크립트 (개선판)
 * 
 * 여러 API 엔드포인트를 모두 호출하여 비교
 */

import axios from 'axios';
import https from 'https';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 날짜 범위 설정
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - 30);
const endDate = new Date(today);
endDate.setHours(23, 59, 59, 999);

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const inqryBgnDt = formatDate(startDate) + '0000';
const inqryEndDt = formatDate(endDate) + '2359';

const testParams = {
  insttNm: '부산',
  inqryDiv: '1',
  inqryBgnDt,
  inqryEndDt,
  pageNo: 1,
  numOfRows: 10
};

console.log('🔍 나라장터 결과 비교 테스트 (개선판)\n');
console.log('📋 검색 조건:');
console.log(`   - 기관명: ${testParams.insttNm}`);
console.log(`   - 조회기간: ${inqryBgnDt} ~ ${inqryEndDt}\n`);

// 현재 시스템 API 호출
async function getOurResults() {
  try {
    console.log('📡 현재 시스템 API 호출 중...');
    const response = await axios.get(OUR_API, {
      params: {
        insttNm: testParams.insttNm,
        inqryDiv: testParams.inqryDiv,
        pageNo: testParams.pageNo,
        numOfRows: testParams.numOfRows
      },
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
    });

    if (response.data.success && response.data.data.items) {
      console.log(`   ✅ ${response.data.data.items.length}개 결과 수신\n`);
      return response.data.data.items;
    }
    console.log(`   ⚠️  결과 없음\n`);
    return [];
  } catch (error) {
    console.error('   ❌ 오류:', error.message);
    return [];
  }
}

// 나라장터 공식 API 호출 (여러 엔드포인트)
async function getOfficialResults() {
  const apiPaths = [
    'getBidPblancListInfoThngPPSSrch',  // 물품
    'getBidPblancListInfoSvcPPSSrch',   // 용역
    'getBidPblancListInfoCnstwkPPSSrch' // 공사
  ];

  console.log('📡 나라장터 공식 API 호출 중 (3개 엔드포인트)...\n');
  
  const allResults = [];
  
  for (const apiPath of apiPaths) {
    try {
      const url = `${BASE_URL}/${apiPath}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=${testParams.pageNo}&numOfRows=${testParams.numOfRows}&inqryDiv=${testParams.inqryDiv}&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&insttNm=${encodeURIComponent(testParams.insttNm)}&type=json`;

      console.log(`   🔹 ${apiPath} 호출 중...`);
      
      const response = await axios.get(url, {
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 30000,
        validateStatus: () => true
      });

      if (response.status !== 200) {
        console.log(`      ❌ HTTP ${response.status}`);
        continue;
      }

      // 응답 구조 확인
      let items = [];
      if (response.data.response) {
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
      }

      console.log(`      ✅ ${items.length}개 결과`);
      allResults.push(...items);
      
    } catch (error) {
      console.log(`      ❌ 오류: ${error.message}`);
      if (error.response) {
        console.log(`         응답: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }

  console.log(`\n   📊 총 ${allResults.length}개 결과 수집\n`);
  return allResults;
}

// 결과 정규화 (필드명 통일)
function normalizeItem(item) {
  return {
    bidNtceNo: item.bidNtceNo || item.bidNtceNo || '',
    bidNtceNm: item.bidNtceNm || item.bidNtceNm || '',
    insttNm: item.insttNm || item.insttNm || '',
    dmandInsttNm: item.dmandInsttNm || item.dmandInsttNm || '',
    bidNtceDt: item.bidNtceDt || item.bidNtceDt || '',
    bidClseDt: item.bidClseDt || item.bidClseDt || ''
  };
}

// 결과 비교
function compareResults(ourResults, officialResults) {
  console.log('📊 결과 비교:\n');
  console.log(`현재 시스템 결과: ${ourResults.length}개`);
  console.log(`나라장터 공식 결과: ${officialResults.length}개\n`);

  // 정규화
  const ourNormalized = ourResults.map(normalizeItem);
  const officialNormalized = officialResults.map(normalizeItem);

  // 공고번호로 매칭
  const ourMap = new Map();
  ourNormalized.forEach(item => {
    if (item.bidNtceNo) {
      ourMap.set(item.bidNtceNo, item);
    }
  });

  const officialMap = new Map();
  officialNormalized.forEach(item => {
    if (item.bidNtceNo) {
      officialMap.set(item.bidNtceNo, item);
    }
  });

  // 공통 공고번호
  const commonNos = [];
  ourMap.forEach((value, key) => {
    if (officialMap.has(key)) {
      commonNos.push(key);
    }
  });

  console.log(`✅ 공통 공고번호: ${commonNos.length}개\n`);

  // 상세 비교
  if (commonNos.length > 0) {
    console.log('🔍 상세 비교 (첫 5개):\n');
    commonNos.slice(0, 5).forEach((no, idx) => {
      const our = ourMap.get(no);
      const official = officialMap.get(no);
      
      console.log(`${idx + 1}. 공고번호: ${no}`);
      console.log(`   공고명:`);
      console.log(`     현재: ${our.bidNtceNm || 'N/A'}`);
      console.log(`     공식: ${official.bidNtceNm || 'N/A'}`);
      console.log(`   기관명:`);
      console.log(`     현재: ${our.insttNm || 'N/A'}`);
      console.log(`     공식: ${official.insttNm || 'N/A'}`);
      
      const nameMatch = our.bidNtceNm === official.bidNtceNm;
      const insttMatch = our.insttNm === official.insttNm;
      
      if (nameMatch && insttMatch) {
        console.log(`   ✅ 완전 일치\n`);
      } else {
        console.log(`   ⚠️  부분 불일치\n`);
      }
    });
  }

  // 차이점
  const onlyInOurs = Array.from(ourMap.keys()).filter(k => !officialMap.has(k));
  const onlyInOfficial = Array.from(officialMap.keys()).filter(k => !ourMap.has(k));

  console.log(`📈 차이점 분석:\n`);
  console.log(`현재 시스템에만 있는 항목: ${onlyInOurs.length}개`);
  if (onlyInOurs.length > 0 && onlyInOurs.length <= 5) {
    onlyInOurs.forEach(no => console.log(`   - ${no}`));
  } else if (onlyInOurs.length > 5) {
    onlyInOurs.slice(0, 5).forEach(no => console.log(`   - ${no}`));
    console.log(`   ... 외 ${onlyInOurs.length - 5}개`);
  }

  console.log(`\n나라장터에만 있는 항목: ${onlyInOfficial.length}개`);
  if (onlyInOfficial.length > 0 && onlyInOfficial.length <= 5) {
    onlyInOfficial.forEach(no => console.log(`   - ${no}`));
  } else if (onlyInOfficial.length > 5) {
    onlyInOfficial.slice(0, 5).forEach(no => console.log(`   - ${no}`));
    console.log(`   ... 외 ${onlyInOfficial.length - 5}개`);
  }

  // 일치율
  const totalUnique = new Set([...ourMap.keys(), ...officialMap.keys()]).size;
  const matchRate = totalUnique > 0 ? (commonNos.length / totalUnique * 100).toFixed(2) : 0;
  
  console.log(`\n📊 일치율: ${matchRate}% (${commonNos.length}/${totalUnique})`);

  return {
    ourCount: ourResults.length,
    officialCount: officialResults.length,
    commonCount: commonNos.length,
    onlyInOurs: onlyInOurs.length,
    onlyInOfficial: onlyInOfficial.length,
    matchRate: parseFloat(matchRate),
    commonNos: commonNos.slice(0, 10),
    onlyInOursList: onlyInOurs.slice(0, 10),
    onlyInOfficialList: onlyInOfficial.slice(0, 10)
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
    console.log(`   - 나라장터 공식: ${comparison.officialCount}개`);
    console.log(`   - 공통 항목: ${comparison.commonCount}개`);
    console.log(`   - 일치율: ${comparison.matchRate}%`);

    if (comparison.matchRate >= 90) {
      console.log('\n✅ 결과가 매우 일치합니다! (90% 이상)');
    } else if (comparison.matchRate >= 70) {
      console.log('\n⚠️  결과가 대체로 일치합니다. (70-90%)');
    } else if (comparison.matchRate > 0) {
      console.log('\n⚠️  결과 차이가 있습니다. (1-70%)');
      console.log('   가능한 원인:');
      console.log('   - 여러 API 엔드포인트 병합 방식 차이');
      console.log('   - 중복 제거 로직 차이');
      console.log('   - 정렬 순서 차이');
    } else {
      console.log('\n❌ 결과가 일치하지 않습니다. (0%)');
      console.log('   가능한 원인:');
      console.log('   - API 파라미터 차이');
      console.log('   - 날짜 범위 차이');
      console.log('   - 필터링 로직 차이');
    }

    // JSON 출력 (선택사항)
    if (process.argv.includes('--json')) {
      console.log('\n📄 JSON 출력:');
      console.log(JSON.stringify(comparison, null, 2));
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
