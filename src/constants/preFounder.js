/**
 * 예비창업자 섹션(/startup) — 지원사업·뉴스 가운데 예비·초기 창업과 관련된 것을 골라 모아 보여 준다.
 *
 * 고르는 기준(classifyPreFounder): 제목·요약·기관·분야에 아래 낱말이 있으면 예비창업 관련으로 본다.
 * 매일 모으는 스크립트(scripts/ingest-daily-feed.mjs)가 이 낱말들로 뉴스를 더 찾아 오고,
 * 기업마당의 「창업」 분야 공고도 함께 받아 온다. 이미 저장된 공고·기사도 화면에서 같은 기준으로 고른다.
 */
export const PRE_FOUNDER_TERMS = [
  '예비창업', '예비 창업', '창업사관학교', '청년창업', '초기창업', '초기 창업', '창업패키지', '창업중심대학',
  '창업지원', '창업 지원', '창업교육', '창업 교육', '창업경진', '창업 경진', '창업보육', '창업기업', '창업자',
  '스타트업', '창업진흥원', 'K-Startup', '창조경제혁신센터', '창업허브', '창업 아이디어', '재창업', '로컬크리에이터',
];

/** 지역: 부산·울산·경남(동남권)을 따로 보고, 다른 지역 이름이 없으면 전국으로 본다 */
const REGION_RULES = [
  ['부산', /(^|[^가-힣])부산/],
  ['경남', /(^|[^가-힣])(경남|경상남도|창원|김해|양산|진주)/],
  ['울산', /(^|[^가-힣])울산/],
];
const OTHER_REGION_RE = /(^|[^가-힣])(서울|경기|인천|강원|충북|충남|충청|대전|세종|전북|전남|전라|광주|대구|경북|경상북도|제주)/;

const textOf = (item) => [item.title, item.org, item.summary, item.source, ...(item.industry || []), item.category, item.target]
  .filter(Boolean).join(' ');

export function isPreFounderItem(item) {
  if (!item) return false;
  if (Array.isArray(item.audience) && item.audience.includes('preFounder')) return true;
  const t = textOf(item);
  return PRE_FOUNDER_TERMS.some((w) => t.includes(w));
}

/** ['부산'] | ['경남'] | ['울산'] | ['전국'] | ['기타지역'] (여러 개일 수 있음) */
export function regionsOf(item) {
  const t = `${item.title || ''} ${item.org || ''} ${(item.region || []).join(' ')}`;
  const found = REGION_RULES.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (found.length) return found;
  return OTHER_REGION_RE.test(t) ? ['기타지역'] : ['전국'];
}

/** 처음 찾아볼 곳 — 2026-11-19 각 주소가 열리고 그 기관 사이트인지 확인함 */
export const PRE_FOUNDER_LINKS = [
  { name: 'K-Startup 창업지원포털', org: '창업진흥원', url: 'https://www.k-startup.go.kr', desc: '정부 창업지원사업 공고를 한곳에 모아 둔 곳이에요. 예비창업패키지 같은 사업도 여기서 공고·접수해요.' },
  { name: '청년창업사관학교', org: '중소벤처기업진흥공단', url: 'https://start.kosmes.or.kr', desc: '청년 예비·초기 창업자에게 창업 공간, 교육·코칭, 사업화 자금을 함께 지원하는 사업이에요.' },
  { name: '기업마당', org: '중소벤처기업부', url: 'https://www.bizinfo.go.kr', desc: '부처·지자체 지원사업 공고를 분야별로 찾아볼 수 있어요. 이 사이트의 지원사업도 여기서 받아 와요.' },
  { name: '부산창조경제혁신센터', org: '부산', url: 'https://ccei.creativekorea.or.kr/busan/', desc: '부산 지역 창업 교육·보육·투자 연계 프로그램을 운영해요.' },
  { name: '경남창조경제혁신센터', org: '경남', url: 'https://ccei.creativekorea.or.kr/gyeongnam/', desc: '경남 지역 창업 교육·보육 프로그램을 운영해요.' },
  { name: '부산경제진흥원', org: '부산', url: 'https://www.bepa.kr', desc: '부산시 산하 기관으로 소상공인·창업 관련 지원사업을 공고해요.' },
];
