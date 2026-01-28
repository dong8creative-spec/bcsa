#!/usr/bin/env node

/**
 * 나라장터 원본 API와 현재 시스템 최종 비교
 * 공고번호 기준으로 실제 데이터 일치 여부 확인
 */

import axios from 'axios';
import https from 'https';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 날짜 범위
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

console.log('🔍 나라장터 원본 API vs 현재 시스템 최종 비교\n');
console.log('📋 검색 조건: 기관명="부산", 기간=최근 30일\n');

// 현재 시스템 결과
async function getOurResults() {
  try {
    const response = await axios.get(OUR_API, {
      params: {
        insttNm: '부산',
        inqryDiv: '1',
        pageNo: 1,
        numOfRows: 10
      },
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
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

// 나라장터 원본 API 호출 (3개 엔드포인트 모두)
async function getOfficialResults() {
  const apiPaths = [
    { name: '물품', path: 'getBidPblancListInfoThngPPSSrch' },
    { name: '용역', path: 'getBidPblancListInfoSvcPPSSrch' },
    { name: '공사', path: 'getBidPblancListInfoCnstwkPPSSrch' }
  ];

  const allResults = [];

  for (const { name, path } of apiPaths) {
    try {
      const url = `${BASE_URL}/${path}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=100&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&insttNm=${encodeURIComponent('부산')}&type=json`;

      const response = await axios.get(url, {
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 30000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data.response) {
        const body = response.data.response.body;
        
        if (body.resultCode && body.resultCode !== '00') {
          continue;
        }

        if (body.items) {
          let items = [];
          if (Array.isArray(body.items.item)) {
            items = body.items.item;
          } else if (body.items.item) {
            items = [body.items.item];
          }
          
          // 필드명 정규화
          items = items.map(item => ({
            ...item,
            insttNm: item.ntceInsttNm || item.insttNm,
            dmandInsttNm: item.dminsttNm || item.dmandInsttNm
          }));
          
          allResults.push(...items);
        }
      }
    } catch (error) {
      // 무시하고 계속
    }
  }

  return allResults;
}

// 메인 실행
async function main() {
  console.log('📡 API 호출 중...\n');
  
  const [ourResults, officialResults] = await Promise.all([
    getOurResults(),
    getOfficialResults()
  ]);

  console.log(`현재 시스템: ${ourResults.length}개`);
  console.log(`나라장터 원본: ${officialResults.length}개\n`);

  // 공고번호로 매핑
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

  console.log('📊 비교 결과:\n');
  console.log(`✅ 공통 공고번호: ${commonNos.length}개`);
  console.log(`현재 시스템에만 있는 항목: ${onlyInOurs.length}개`);
  console.log(`나라장터에만 있는 항목: ${onlyInOfficial.length}개\n`);

  // 일치율 계산
  const totalUnique = new Set([...ourMap.keys(), ...officialMap.keys()]).size;
  const matchRate = totalUnique > 0 ? (commonNos.length / totalUnique * 100).toFixed(2) : 0;
  
  console.log(`📊 일치율: ${matchRate}% (${commonNos.length}/${totalUnique})\n`);

  // 상세 비교 (공통 항목)
  if (commonNos.length > 0) {
    console.log('🔍 공통 항목 상세 비교 (첫 3개):\n');
    
    commonNos.slice(0, 3).forEach((no, idx) => {
      const our = ourMap.get(no);
      const official = officialMap.get(no);
      
      console.log(`${idx + 1}. 공고번호: ${no}`);
      console.log(`   공고명:`);
      console.log(`     현재: ${our.bidNtceNm || 'N/A'}`);
      console.log(`     원본: ${official.bidNtceNm || 'N/A'}`);
      console.log(`   공고기관:`);
      console.log(`     현재: ${our.insttNm || 'N/A'}`);
      console.log(`     원본: ${official.ntceInsttNm || official.insttNm || 'N/A'}`);
      
      const nameMatch = (our.bidNtceNm || '') === (official.bidNtceNm || '');
      const insttMatch = (our.insttNm || '') === (official.ntceInsttNm || official.insttNm || '');
      
      if (nameMatch && insttMatch) {
        console.log(`   ✅ 완전 일치\n`);
      } else {
        console.log(`   ⚠️  부분 불일치\n`);
      }
    });
  }

  // 현재 시스템에만 있는 항목 분석
  if (onlyInOurs.length > 0) {
    console.log('📋 현재 시스템에만 있는 항목 (첫 5개):\n');
    onlyInOurs.slice(0, 5).forEach((no, idx) => {
      const item = ourMap.get(no);
      console.log(`${idx + 1}. ${no}`);
      console.log(`   공고명: ${item.bidNtceNm || 'N/A'}`);
      console.log(`   기관명: ${item.insttNm || 'N/A'}\n`);
    });
    
    console.log('💡 가능한 원인:');
    console.log('   - 여러 API 엔드포인트 병합 결과');
    console.log('   - 날짜 범위 차이');
    console.log('   - 필터링 로직 차이');
    console.log('   - 페이지네이션 차이\n');
  }

  // 최종 평가
  console.log('🎯 최종 평가:\n');
  
  if (parseFloat(matchRate) >= 80) {
    console.log('✅ 결과가 매우 일치합니다! (80% 이상)');
    console.log('   현재 시스템이 나라장터 원본 API와 거의 동일한 결과를 반환합니다.\n');
  } else if (parseFloat(matchRate) >= 50) {
    console.log('⚠️  결과가 부분적으로 일치합니다. (50-80%)');
    console.log('   일부 차이는 있지만 대부분의 결과가 일치합니다.\n');
  } else if (parseFloat(matchRate) > 0) {
    console.log('⚠️  결과 차이가 있습니다. (1-50%)');
    console.log('   여러 API 엔드포인트를 병합하거나 다른 필터링 로직을 사용할 수 있습니다.\n');
  } else {
    console.log('❌ 결과가 일치하지 않습니다. (0%)');
    console.log('   API 파라미터나 날짜 범위를 확인해야 합니다.\n');
  }

  // 요약
  console.log('📋 요약:');
  console.log(`   - 현재 시스템 결과: ${ourResults.length}개`);
  console.log(`   - 나라장터 원본 결과: ${officialResults.length}개`);
  console.log(`   - 공통 항목: ${commonNos.length}개`);
  console.log(`   - 일치율: ${matchRate}%`);
}

main().catch(error => {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
});
