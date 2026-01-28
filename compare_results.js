#!/usr/bin/env node

/**
 * 나라장터 공식 API와 현재 시스템 결과 비교 스크립트
 * 
 * 사용법:
 * node compare_results.js
 */

import axios from 'axios';
import https from 'https';

// API 키 (환경 변수에서 가져오거나 직접 입력)
const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';

// 현재 시스템 API
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 날짜 범위 설정 (최근 30일)
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

// 테스트 파라미터
const testParams = {
  insttNm: '부산',
  inqryDiv: '1',
  inqryBgnDt,
  inqryEndDt,
  pageNo: 1,
  numOfRows: 10
};

console.log('🔍 나라장터 결과 비교 테스트 시작...\n');
console.log('📋 검색 조건:');
console.log(`   - 기관명: ${testParams.insttNm}`);
console.log(`   - 조회기간: ${inqryBgnDt} ~ ${inqryEndDt}`);
console.log(`   - 페이지: ${testParams.pageNo}, 행 수: ${testParams.numOfRows}\n`);

// 1. 현재 시스템 API 호출
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
      httpsAgent: new https.Agent({ keepAlive: true })
    });

    if (response.data.success && response.data.data.items) {
      return response.data.data.items;
    }
    return [];
  } catch (error) {
    console.error('❌ 현재 시스템 API 오류:', error.message);
    return [];
  }
}

// 2. 나라장터 공식 API 직접 호출
async function getOfficialResults() {
  try {
    console.log('📡 나라장터 공식 API 호출 중...');
    
    // 물품 API 호출
    const apiPath = 'getBidPblancListInfoThngPPSSrch';
    const url = `${BASE_URL}/${apiPath}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=${testParams.pageNo}&numOfRows=${testParams.numOfRows}&inqryDiv=${testParams.inqryDiv}&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&insttNm=${encodeURIComponent(testParams.insttNm)}&type=json`;

    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
    });

    // JSON 응답 파싱
    let items = [];
    if (response.data.response && response.data.response.body) {
      const body = response.data.response.body;
      if (body.items) {
        if (Array.isArray(body.items.item)) {
          items = body.items.item;
        } else if (body.items.item) {
          items = [body.items.item];
        }
      }
    }

    return items;
  } catch (error) {
    console.error('❌ 나라장터 공식 API 오류:', error.message);
    if (error.response) {
      console.error('   응답 데이터:', JSON.stringify(error.response.data).substring(0, 500));
    }
    return [];
  }
}

// 3. 결과 비교
function compareResults(ourResults, officialResults) {
  console.log('\n📊 결과 비교:\n');
  console.log(`현재 시스템 결과: ${ourResults.length}개`);
  console.log(`나라장터 공식 결과: ${officialResults.length}개\n`);

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

  // 공통 공고번호 찾기
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
      console.log(`     현재 시스템: ${our.bidNtceNm || our.bidNtceNm || 'N/A'}`);
      console.log(`     나라장터: ${official.bidNtceNm || official.bidNtceNm || 'N/A'}`);
      console.log(`   공고기관:`);
      console.log(`     현재 시스템: ${our.insttNm || our.insttNm || 'N/A'}`);
      console.log(`     나라장터: ${official.insttNm || official.insttNm || 'N/A'}`);
      
      // 일치 여부 확인
      const nameMatch = (our.bidNtceNm || '') === (official.bidNtceNm || '');
      const insttMatch = (our.insttNm || '') === (official.insttNm || '');
      
      if (nameMatch && insttMatch) {
        console.log(`   ✅ 완전 일치`);
      } else {
        console.log(`   ⚠️  부분 불일치`);
        if (!nameMatch) console.log(`      - 공고명 불일치`);
        if (!insttMatch) console.log(`      - 기관명 불일치`);
      }
      console.log('');
    });
  }

  // 현재 시스템에만 있는 항목
  const onlyInOurs = [];
  ourMap.forEach((value, key) => {
    if (!officialMap.has(key)) {
      onlyInOurs.push(key);
    }
  });

  // 나라장터에만 있는 항목
  const onlyInOfficial = [];
  officialMap.forEach((value, key) => {
    if (!ourMap.has(key)) {
      onlyInOfficial.push(key);
    }
  });

  console.log(`\n📈 차이점 분석:\n`);
  console.log(`현재 시스템에만 있는 항목: ${onlyInOurs.length}개`);
  if (onlyInOurs.length > 0 && onlyInOurs.length <= 10) {
    onlyInOurs.forEach(no => console.log(`   - ${no}`));
  } else if (onlyInOurs.length > 10) {
    onlyInOurs.slice(0, 10).forEach(no => console.log(`   - ${no}`));
    console.log(`   ... 외 ${onlyInOurs.length - 10}개`);
  }

  console.log(`\n나라장터에만 있는 항목: ${onlyInOfficial.length}개`);
  if (onlyInOfficial.length > 0 && onlyInOfficial.length <= 10) {
    onlyInOfficial.forEach(no => console.log(`   - ${no}`));
  } else if (onlyInOfficial.length > 10) {
    onlyInOfficial.slice(0, 10).forEach(no => console.log(`   - ${no}`));
    console.log(`   ... 외 ${onlyInOfficial.length - 10}개`);
  }

  // 일치율 계산
  const totalUnique = new Set([...ourMap.keys(), ...officialMap.keys()]).size;
  const matchRate = totalUnique > 0 ? (commonNos.length / totalUnique * 100).toFixed(2) : 0;
  
  console.log(`\n📊 일치율: ${matchRate}% (${commonNos.length}/${totalUnique})`);

  return {
    ourCount: ourResults.length,
    officialCount: officialResults.length,
    commonCount: commonNos.length,
    onlyInOurs: onlyInOurs.length,
    onlyInOfficial: onlyInOfficial.length,
    matchRate: parseFloat(matchRate)
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
    
    // 요약
    console.log('📋 요약:');
    console.log(`   - 현재 시스템: ${comparison.ourCount}개`);
    console.log(`   - 나라장터 공식: ${comparison.officialCount}개`);
    console.log(`   - 공통 항목: ${comparison.commonCount}개`);
    console.log(`   - 일치율: ${comparison.matchRate}%`);

    if (comparison.matchRate >= 90) {
      console.log('\n✅ 결과가 매우 일치합니다! (90% 이상)');
    } else if (comparison.matchRate >= 70) {
      console.log('\n⚠️  결과가 대체로 일치합니다. (70-90%)');
    } else {
      console.log('\n❌ 결과 차이가 있습니다. (70% 미만)');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
