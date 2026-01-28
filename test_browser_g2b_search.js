/**
 * 브라우저 자동화 테스트 스크립트
 * 나라장터 스크린샷 조건과 동일하게 검색하여 결과 확인
 * 
 * 테스트 순서:
 * 1. 입찰공고 페이지 접속
 * 2. 공고명에 "부산" 입력
 * 3. 공고종류 "실공고" 선택
 * 4. 날짜 범위 설정 (2025-12-30 ~ 2026-01-29)
 * 5. 검색 실행
 * 6. 결과 테이블 확인
 * 7. 공고번호 추출 및 나라장터 스크린샷과 비교
 */

// 이 스크립트는 MCP cursor-browser-extension 도구를 사용하여 실행됩니다.
// 실행 방법: Cursor AI Agent에게 "test_browser_g2b_search.js를 실행해줘"라고 요청

export const testSteps = [
  {
    step: 1,
    description: '입찰공고 페이지 접속',
    action: 'browser_navigate',
    params: { url: 'http://localhost:3000' }
  },
  {
    step: 2,
    description: '입찰공고 메뉴 클릭',
    action: 'browser_click',
    selector: 'button:has-text("입찰공고")'
  },
  {
    step: 3,
    description: '공고명 필드에 "부산" 입력',
    action: 'browser_type',
    selector: 'input[placeholder="공고명 입력"]',
    text: '부산'
  },
  {
    step: 4,
    description: '공고종류 "실공고" 선택',
    action: 'browser_select',
    selector: 'select', // bidNtceDtlClsfCd
    value: '실공고'
  },
  {
    step: 5,
    description: '시작 날짜 입력',
    action: 'browser_type',
    selector: 'input[type="date"]:first',
    text: '2025-12-30'
  },
  {
    step: 6,
    description: '종료 날짜 입력',
    action: 'browser_type',
    selector: 'input[type="date"]:last',
    text: '2026-01-29'
  },
  {
    step: 7,
    description: '검색 버튼 클릭',
    action: 'browser_click',
    selector: 'button:has-text("검색")'
  },
  {
    step: 8,
    description: '검색 결과 대기 (5초)',
    action: 'wait',
    duration: 5000
  },
  {
    step: 9,
    description: '결과 테이블 확인',
    action: 'browser_snapshot',
    verify: 'table with results'
  },
  {
    step: 10,
    description: '콘솔 로그 확인',
    action: 'browser_console_messages',
    verify: 'no errors'
  }
];

export const expectedResults = {
  minResultCount: 5, // 최소 5개 이상
  maxResultCount: 20, // 최대 20개 (페이지당)
  expectedBidNos: [
    // 나라장터 스크린샷에 보이는 공고번호들
    'R26BK01302318',
    'R26BK01266494',
    'R26BK01301862',
    'R26BK01296994',
    'R26BK01298805',
    'R26BK01301585',
    'R26BK01298159',
    'R26BK01300683'
  ],
  mustContainInTitle: '부산', // 공고명에 반드시 포함되어야 할 키워드
  expectedFields: ['bidNtceNo', 'bidNtceNm', 'insttNm', 'dmandInsttNm', 'bidNtceDt', 'bidClseDt']
};

export const validationRules = {
  // 검증 규칙
  resultCountMatch: {
    rule: 'Result count should be between min and max',
    min: expectedResults.minResultCount,
    max: expectedResults.maxResultCount
  },
  titleContainsKeyword: {
    rule: 'All results should contain "부산" in title',
    keyword: expectedResults.mustContainInTitle
  },
  requiredFields: {
    rule: 'All results should have required fields',
    fields: expectedResults.expectedFields
  },
  screenshotMatch: {
    rule: 'At least 50% of screenshot bidNos should be found',
    threshold: 0.5
  }
};

console.log('📋 브라우저 자동화 테스트 스크립트 작성 완료');
console.log('   테스트 단계: ' + testSteps.length + '개');
console.log('   검증 규칙: ' + Object.keys(validationRules).length + '개');
