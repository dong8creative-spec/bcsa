#!/usr/bin/env node

/**
 * 현재 시스템 결과의 공고번호로 나라장터 API 직접 검증
 */

import axios from 'axios';
import https from 'https';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 현재 시스템에서 결과 가져오기
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

// 특정 공고번호로 나라장터 API 조회
async function verifyBidNo(bidNo) {
  const apiPath = 'getBidPblancListInfoThngPPSSrch';
  const url = `${BASE_URL}/${apiPath}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=10&inqryDiv=2&bidNtceNo=${bidNo}&type=json`;

  try {
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status !== 200) {
      return { found: false, error: `HTTP ${response.status}` };
    }

    let items = [];
    if (response.data.response) {
      const body = response.data.response.body;
      
      if (body.resultCode && body.resultCode !== '00') {
        return { found: false, error: body.resultMsg || `Result code: ${body.resultCode}` };
      }

      if (body.items) {
        if (Array.isArray(body.items.item)) {
          items = body.items.item;
        } else if (body.items.item) {
          items = [body.items.item];
        }
      }
    }

    const found = items.some(item => item.bidNtceNo === bidNo);
    return { found, item: found ? items.find(item => item.bidNtceNo === bidNo) : null };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

// 여러 API 엔드포인트로 검색
async function searchInAllApis(bidNo, insttNm) {
  const apiPaths = [
    { name: '물품', path: 'getBidPblancListInfoThngPPSSrch' },
    { name: '용역', path: 'getBidPblancListInfoSvcPPSSrch' },
    { name: '공사', path: 'getBidPblancListInfoCnstwkPPSSrch' }
  ];

  const results = [];

  for (const { name, path } of apiPaths) {
    try {
      // 입찰공고번호로 직접 조회
      const url1 = `${BASE_URL}/${path}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=10&inqryDiv=2&bidNtceNo=${bidNo}&type=json`;
      
      const response1 = await axios.get(url1, {
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 30000,
        validateStatus: () => true
      });

      if (response1.status === 200 && response1.data.response) {
        const body = response1.data.response.body;
        if (body.items) {
          let items = [];
          if (Array.isArray(body.items.item)) {
            items = body.items.item;
          } else if (body.items.item) {
            items = [body.items.item];
          }
          
          const found = items.find(item => item.bidNtceNo === bidNo);
          if (found) {
            results.push({ api: name, found: true, item: found });
            continue;
          }
        }
      }

      // 기관명으로 검색 (최근 30일)
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

      const url2 = `${BASE_URL}/${path}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=100&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&insttNm=${encodeURIComponent(insttNm)}&type=json`;

      const response2 = await axios.get(url2, {
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 30000,
        validateStatus: () => true
      });

      if (response2.status === 200 && response2.data.response) {
        const body = response2.data.response.body;
        if (body.items) {
          let items = [];
          if (Array.isArray(body.items.item)) {
            items = body.items.item;
          } else if (body.items.item) {
            items = [body.items.item];
          }
          
          const found = items.find(item => item.bidNtceNo === bidNo);
          if (found) {
            results.push({ api: name, found: true, item: found });
          } else {
            results.push({ api: name, found: false, totalResults: items.length });
          }
        } else {
          results.push({ api: name, found: false, error: 'No items in response' });
        }
      } else {
        results.push({ api: name, found: false, error: `HTTP ${response2.status}` });
      }
    } catch (error) {
      results.push({ api: name, found: false, error: error.message });
    }
  }

  return results;
}

// 메인 실행
async function main() {
  console.log('🔍 현재 시스템 결과 검증 시작...\n');

  // 1. 현재 시스템 결과 가져오기
  console.log('📡 현재 시스템 API 호출 중...');
  const ourResults = await getOurResults();
  console.log(`✅ ${ourResults.length}개 결과 수신\n`);

  if (ourResults.length === 0) {
    console.log('❌ 현재 시스템에서 결과가 없습니다.');
    return;
  }

  // 2. 각 공고번호 검증
  console.log('🔍 나라장터 공식 API로 각 공고번호 검증 중...\n');

  const verificationResults = [];

  for (let i = 0; i < Math.min(ourResults.length, 5); i++) {
    const item = ourResults[i];
    const bidNo = item.bidNtceNo;
    const insttNm = item.insttNm || '부산';

    console.log(`${i + 1}. 공고번호: ${bidNo}`);
    console.log(`   공고명: ${item.bidNtceNm || 'N/A'}`);
    console.log(`   기관명: ${insttNm}`);

    const results = await searchInAllApis(bidNo, insttNm);
    
    const found = results.some(r => r.found);
    if (found) {
      const foundResult = results.find(r => r.found);
      console.log(`   ✅ 나라장터에서 발견됨 (${foundResult.api} API)`);
      
      // 상세 비교
      const official = foundResult.item;
      console.log(`   공식 API 공고명: ${official.bidNtceNm || 'N/A'}`);
      console.log(`   공식 API 기관명: ${official.insttNm || 'N/A'}`);
      
      const nameMatch = (item.bidNtceNm || '') === (official.bidNtceNm || '');
      const insttMatch = (item.insttNm || '') === (official.insttNm || '');
      
      if (nameMatch && insttMatch) {
        console.log(`   ✅ 데이터 완전 일치\n`);
      } else {
        console.log(`   ⚠️  데이터 부분 불일치\n`);
      }
      
      verificationResults.push({ bidNo, found: true, match: nameMatch && insttMatch });
    } else {
      console.log(`   ❌ 나라장터에서 발견되지 않음`);
      results.forEach(r => {
        if (r.error) {
          console.log(`      ${r.api}: ${r.error}`);
        } else if (r.totalResults !== undefined) {
          console.log(`      ${r.api}: ${r.totalResults}개 결과 중 없음`);
        }
      });
      console.log('');
      verificationResults.push({ bidNo, found: false });
    }

    // API 호출 제한을 위한 대기
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 3. 요약
  console.log('\n📊 검증 요약:\n');
  const foundCount = verificationResults.filter(r => r.found).length;
  const matchCount = verificationResults.filter(r => r.found && r.match).length;
  
  console.log(`검증한 공고: ${verificationResults.length}개`);
  console.log(`나라장터에서 발견: ${foundCount}개`);
  console.log(`데이터 일치: ${matchCount}개`);
  console.log(`발견률: ${(foundCount / verificationResults.length * 100).toFixed(1)}%`);
  console.log(`일치률: ${(matchCount / verificationResults.length * 100).toFixed(1)}%`);

  if (foundCount === verificationResults.length && matchCount === verificationResults.length) {
    console.log('\n✅ 모든 결과가 나라장터와 일치합니다!');
  } else if (foundCount === verificationResults.length) {
    console.log('\n⚠️  모든 결과가 나라장터에서 발견되지만, 일부 데이터가 다릅니다.');
  } else {
    console.log('\n⚠️  일부 결과가 나라장터에서 발견되지 않습니다.');
    console.log('   가능한 원인:');
    console.log('   - 날짜 범위 차이');
    console.log('   - API 엔드포인트 차이');
    console.log('   - 필터링 로직 차이');
  }
}

main().catch(error => {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
});
