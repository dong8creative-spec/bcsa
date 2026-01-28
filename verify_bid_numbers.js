#!/usr/bin/env node

/**
 * 현재 시스템이 반환하는 공고번호를 나라장터 API로 직접 검증
 * 각 공고번호가 나라장터에서 실제로 존재하는지 확인
 */

import axios from 'axios';
import https from 'https';

const SERVICE_KEY = process.env.G2B_API_KEY || '05dcc05a47307238cfb74ee633e72290510530f6628b5c1dfd43d11cc421b16b';
const BASE_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const OUR_API = 'https://apibid-oytjv32jna-du.a.run.app/api/bid-search';

// 현재 시스템 결과 가져오기
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

// 공고번호로 나라장터 API에서 직접 조회
async function verifyBidInOfficialApi(bidNo) {
  const apiPaths = [
    'getBidPblancListInfoThngPPSSrch',  // 물품
    'getBidPblancListInfoSvcPPSSrch',   // 용역
    'getBidPblancListInfoCnstwkPPSSrch' // 공사
  ];

  for (const apiPath of apiPaths) {
    try {
      // 입찰공고번호 기준 조회 (inqryDiv=2)
      const url = `${BASE_URL}/${apiPath}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=10&inqryDiv=2&bidNtceNo=${bidNo}&type=json`;

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
          
          const found = items.find(item => item.bidNtceNo === bidNo);
          if (found) {
            return {
              found: true,
              api: apiPath,
              item: found,
              insttNm: found.ntceInsttNm || found.insttNm || 'N/A',
              dmandInsttNm: found.dminsttNm || found.dmandInsttNm || 'N/A'
            };
          }
        }
      }
    } catch (error) {
      // 무시하고 계속
    }
  }

  return { found: false };
}

// 메인 실행
async function main() {
  console.log('🔍 현재 시스템 공고번호 나라장터 검증\n');

  const ourResults = await getOurResults();
  console.log(`📡 현재 시스템 결과: ${ourResults.length}개\n`);

  if (ourResults.length === 0) {
    console.log('❌ 현재 시스템에서 결과가 없습니다.');
    return;
  }

  console.log('🔍 각 공고번호를 나라장터 API에서 검증 중...\n');

  const verificationResults = [];
  const maxCheck = Math.min(ourResults.length, 5); // 처음 5개만 확인

  for (let i = 0; i < maxCheck; i++) {
    const item = ourResults[i];
    const bidNo = item.bidNtceNo;

    console.log(`${i + 1}. 공고번호: ${bidNo}`);
    console.log(`   공고명: ${item.bidNtceNm || 'N/A'}`);
    console.log(`   현재 시스템 기관명: ${item.insttNm || 'N/A'}`);

    const verification = await verifyBidInOfficialApi(bidNo);

    if (verification.found) {
      console.log(`   ✅ 나라장터에서 발견됨 (${verification.api})`);
      console.log(`   나라장터 기관명: ${verification.insttNm}`);
      console.log(`   나라장터 수요기관: ${verification.dmandInsttNm}`);
      
      // 기관명 비교
      const ourInstt = (item.insttNm || '').trim();
      const officialInstt = (verification.insttNm || '').trim();
      const match = ourInstt === officialInstt;
      
      console.log(`   기관명 일치: ${match ? '✅' : '❌'}`);
      
      verificationResults.push({
        bidNo,
        found: true,
        match,
        ourInstt,
        officialInstt
      });
    } else {
      console.log(`   ❌ 나라장터에서 발견되지 않음`);
      verificationResults.push({
        bidNo,
        found: false
      });
    }

    console.log('');
    
    // API 호출 제한을 위한 대기
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 요약
  console.log('📊 검증 요약:\n');
  const foundCount = verificationResults.filter(r => r.found).length;
  const matchCount = verificationResults.filter(r => r.found && r.match).length;
  
  console.log(`검증한 공고: ${verificationResults.length}개`);
  console.log(`나라장터에서 발견: ${foundCount}개`);
  console.log(`기관명 일치: ${matchCount}개`);
  console.log(`발견률: ${(foundCount / verificationResults.length * 100).toFixed(1)}%`);
  console.log(`일치률: ${(matchCount / verificationResults.length * 100).toFixed(1)}%`);

  if (foundCount === verificationResults.length && matchCount === verificationResults.length) {
    console.log('\n✅ 모든 결과가 나라장터와 완전히 일치합니다!');
    console.log('   현재 시스템이 나라장터 원본 API와 동일한 데이터를 반환합니다.\n');
  } else if (foundCount === verificationResults.length) {
    console.log('\n⚠️  모든 결과가 나라장터에서 발견되지만, 일부 기관명이 다릅니다.');
    console.log('   필드명 매핑은 정상 작동하지만, 데이터 자체가 약간 다를 수 있습니다.\n');
  } else if (foundCount > 0) {
    console.log('\n⚠️  일부 결과만 나라장터에서 발견되었습니다.');
    console.log('   가능한 원인:');
    console.log('   - 여러 API 엔드포인트 병합 결과');
    console.log('   - 날짜 범위 차이');
    console.log('   - 필터링 로직 차이\n');
  } else {
    console.log('\n❌ 나라장터에서 발견된 결과가 없습니다.');
    console.log('   가능한 원인:');
    console.log('   - 공고번호가 만료되었거나 삭제됨');
    console.log('   - API 엔드포인트 차이');
    console.log('   - 날짜 범위 차이\n');
  }

  // 상세 결과
  if (verificationResults.some(r => r.found && !r.match)) {
    console.log('📋 기관명 불일치 상세:\n');
    verificationResults
      .filter(r => r.found && !r.match)
      .forEach(r => {
        console.log(`공고번호: ${r.bidNo}`);
        console.log(`  현재 시스템: ${r.ourInstt}`);
        console.log(`  나라장터: ${r.officialInstt}\n`);
      });
  }
}

main().catch(error => {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
});
