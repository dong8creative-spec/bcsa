#!/usr/bin/env node

/**
 * 나라장터 원본 API 응답과 현재 시스템 응답 비교
 * 실제 API 응답 구조를 확인하여 필드 매핑 문제 파악
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

console.log('🔍 나라장터 원본 API와 현재 시스템 비교\n');

// 1. 나라장터 원본 API 호출 (공사 API - 부산 검색)
async function getRawApiResponse() {
  try {
    console.log('📡 나라장터 원본 API 호출 중...');
    const apiPath = 'getBidPblancListInfoCnstwkPPSSrch'; // 공사
    const url = `${BASE_URL}/${apiPath}?ServiceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=1&numOfRows=5&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}&insttNm=${encodeURIComponent('부산')}&type=json`;

    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status !== 200) {
      console.log(`   ❌ HTTP ${response.status}`);
      return null;
    }

    console.log(`   ✅ 응답 수신\n`);
    return response.data;
  } catch (error) {
    console.error('   ❌ 오류:', error.message);
    return null;
  }
}

// 2. 현재 시스템 API 호출
async function getOurApiResponse() {
  try {
    console.log('📡 현재 시스템 API 호출 중...');
    const response = await axios.get(OUR_API, {
      params: {
        insttNm: '부산',
        inqryDiv: '1',
        pageNo: 1,
        numOfRows: 5
      },
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 30000
    });

    if (response.data.success) {
      console.log(`   ✅ 응답 수신\n`);
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('   ❌ 오류:', error.message);
    return null;
  }
}

// 메인 실행
async function main() {
  const [rawResponse, ourResponse] = await Promise.all([
    getRawApiResponse(),
    getOurApiResponse()
  ]);

  if (!rawResponse) {
    console.log('❌ 나라장터 원본 API 응답을 받지 못했습니다.');
    return;
  }

  if (!ourResponse) {
    console.log('❌ 현재 시스템 API 응답을 받지 못했습니다.');
    return;
  }

  // 나라장터 원본 응답 구조 분석
  console.log('📊 나라장터 원본 API 응답 구조:\n');
  
  if (rawResponse.response && rawResponse.response.body) {
    const body = rawResponse.response.body;
    console.log(`결과 코드: ${body.resultCode || 'N/A'}`);
    console.log(`결과 메시지: ${body.resultMsg || 'N/A'}`);
    console.log(`전체 개수: ${body.totalCount || 'N/A'}\n`);

    if (body.items) {
      let items = [];
      if (Array.isArray(body.items.item)) {
        items = body.items.item;
      } else if (body.items.item) {
        items = [body.items.item];
      }

      if (items.length > 0) {
        console.log(`✅ ${items.length}개 항목 발견\n`);
        console.log('첫 번째 항목의 필드 구조:');
        const firstItem = items[0];
        console.log(JSON.stringify(firstItem, null, 2));
        console.log('\n');

        // 현재 시스템 결과와 비교
        if (ourResponse.data && ourResponse.data.items && ourResponse.data.items.length > 0) {
          console.log('📊 현재 시스템 응답 구조:\n');
          console.log('첫 번째 항목의 필드 구조:');
          const ourFirstItem = ourResponse.data.items[0];
          console.log(JSON.stringify(ourFirstItem, null, 2));
          console.log('\n');

          // 공고번호로 매칭
          const rawBidNo = firstItem.bidNtceNo;
          const ourItem = ourResponse.data.items.find(item => item.bidNtceNo === rawBidNo);

          if (ourItem) {
            console.log(`✅ 공고번호 ${rawBidNo} 매칭 성공!\n`);
            console.log('🔍 필드별 비교:\n');

            const fieldsToCompare = [
              'bidNtceNo',
              'bidNtceNm',
              'insttNm',
              'dmandInsttNm',
              'bidNtceDt',
              'bidClseDt'
            ];

            fieldsToCompare.forEach(field => {
              const rawValue = firstItem[field] || firstItem[field] || 'N/A';
              const ourValue = ourItem[field] || ourItem[field] || 'N/A';
              const match = rawValue === ourValue;
              console.log(`${field}:`);
              console.log(`  나라장터: ${rawValue}`);
              console.log(`  현재시스템: ${ourValue}`);
              console.log(`  ${match ? '✅ 일치' : '❌ 불일치'}\n`);
            });
          } else {
            console.log(`⚠️  공고번호 ${rawBidNo}가 현재 시스템 결과에 없습니다.`);
            console.log('현재 시스템의 공고번호들:');
            ourResponse.data.items.forEach((item, idx) => {
              console.log(`  ${idx + 1}. ${item.bidNtceNo || 'N/A'}`);
            });
          }
        }
      } else {
        console.log('⚠️  나라장터 API에서 항목을 찾지 못했습니다.');
        console.log('응답 구조:');
        console.log(JSON.stringify(rawResponse.response.body, null, 2));
      }
    } else {
      console.log('⚠️  items 필드가 없습니다.');
      console.log('응답 구조:');
      console.log(JSON.stringify(rawResponse.response.body, null, 2));
    }
  } else {
    console.log('⚠️  예상하지 못한 응답 구조입니다.');
    console.log('전체 응답:');
    console.log(JSON.stringify(rawResponse, null, 2).substring(0, 2000));
  }
}

main().catch(error => {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
});
