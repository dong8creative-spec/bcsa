#!/usr/bin/env node
/**
 * 지원사업 + 뉴스 일일 자동 수집 스크립트
 *
 * 매일 07:00(KST)에 GitHub Actions(.github/workflows/daily-content-feed.yml)가 실행합니다.
 * - 지원사업: 기업마당(bizinfo.go.kr) 지원사업정보 오픈API → Firestore `supportPrograms` 컬렉션.
 *   전체 공고 조회 + hashtags=부산 조회를 함께 호출해서, 부산 조회에 포함된 공고는 region:['부산']로
 *   표시한다 — 사이트의 "부산 지원사업" 섹션(SupportProgramsView.jsx)이 이 필드로 걸러 보여준다.
 * - 뉴스: 네이버 뉴스검색 API(NAVER API HUB, naverapihub.apigw.ntruss.com — 네이버가 기존
 *         openapi.naver.com 검색 API를 이쪽으로 이관함)에서 소상공인/자영업/창업 관련 키워드로 검색한
 *         기사 제목·발췌(요약)를 가져와 → Firestore `newsItems` 컬렉션
 *
 * 두 컬렉션 모두 sourceUrl(또는 기사 링크)의 해시를 문서 ID로 사용해 매일 실행해도 중복 등록되지 않습니다(upsert).
 * 관리자가 admin 화면에서 수동으로 만든 문서(sourceType !== 'site_scan')는 절대 덮어쓰지 않고,
 * 자동수집 문서라도 관리자가 껐던 enabled 값은 건드리지 않습니다(관리자 판단을 항상 우선).
 *
 * 노출 기간: 뉴스 기사든 지원사업 공고든 등록/발행 후 1년이 지나면 사이트에서 자동으로 숨겨집니다
 * (Firestore 문서는 그대로 남아있고, 화면 렌더링 단계에서 필터링됩니다 — src/pages/NewsView.jsx,
 * src/pages/SupportProgramsView.jsx의 ONE_YEAR_MS 참고).
 *
 * 마감일 판정 (3단계 폴백):
 *   1) 기업마당 API의 신청기간 필드(reqstBeginEndDe 또는 reqstDt, "20260101 ~ 20260228" 형태)를 우선 사용.
 *   2) 그게 없거나 파싱 실패하면, 공고 제목+요약문 안에서 "OOOO.MM.DD ~ OOOO.MM.DD", "9월 1일부터
 *      9월 30일까지", "~9.30", "9월 30일까지" 같은 기간/마감 표현을 직접 찾는다(extractDeadlineFromText).
 *   3) 그래도 못 찾으면, 공고의 신청 링크(applyUrl → 다르면 sourceUrl 순서)를 실제로 열어서 그 페이지의
 *      본문 텍스트에서 같은 방식으로 기간/마감 표현을 찾는다(fetchDeadlineFromPage) — 기업마당 자체에는
 *      신청기간이 없고 연결된 원문 사이트에만 있는 경우가 많기 때문(예: 특정 기관이 매 회차 접수기간을
 *      자기 사이트에만 공지하는 경우). 페이지 접근에 실패하거나 여기서도 못 찾으면 그때만 "상시모집"으로 남긴다.
 *
 * 실행 전 필요한 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  - 파이어베이스 서비스 계정 키 JSON 전체(문자열)
 *   BIZINFO_API_KEY               - 기업마당 오픈API 인증키(data.go.kr에서 발급). 없으면 지원사업 수집은 건너뜀.
 *   NAVER_CLIENT_ID               - NAVER API HUB 검색 API Client ID (콘솔: console.ncloud.com/naver-api-hub)
 *   NAVER_CLIENT_SECRET           - NAVER API HUB 검색 API Client Secret. 둘 중 하나라도 없으면 뉴스 수집은 건너뜀.
 *
 * 실행:
 *   node scripts/ingest-daily-feed.mjs           # 실제 반영
 *   node scripts/ingest-daily-feed.mjs --dry-run # 수집 결과만 콘솔에 출력, Firestore 미반영
 */

import crypto from 'crypto';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

const isDryRun = process.argv.includes('--dry-run');

// 소스당 1회 실행 최대 처리 건수 캡(오작동 시 대량 오등록 방지 안전장치)
const MAX_ITEMS_PER_SOURCE = 15;
// 지원사업은 전체 조회 + 부산 조회를 합친 뒤 중복 제거하므로, 합친 후에도 한 번 더 상한을 둔다.
const MAX_ITEMS_TOTAL = 25;

// 원문 페이지에서 마감일을 찾기 위해 열어볼 때 쓰는 타임아웃/텍스트 길이 상한
// (느리거나 응답이 없는 사이트 때문에 전체 실행이 오래 걸리지 않도록 방어).
const PAGE_FETCH_TIMEOUT_MS = 8000;
const PAGE_TEXT_MAX_LEN = 20000;

// ==========================================
// 뉴스 수집 설정 — 검색어/분류/필터링
// ==========================================
// 검색어를 "카테고리 그룹"별로 묶어서 관리한다. 그룹마다 기본 카테고리를 붙여두면,
// 어떤 검색어로 찾은 기사인지에 따라 8개 카테고리(지원사업/창업·투자/모집·행사/상권·소비/
// 판로·마케팅/세무·노무/기술·트렌드/위기·대응) 중 하나로 자동 분류할 수 있다(resolveCategory 참고).
// "부산" 접두어가 없는 그룹(세무·노무 등)은 지역 무관하게 전국 사업자 공통 정보라 그대로 둔다.
const NEWS_KEYWORD_GROUPS = [
  {
    category: '지원사업',
    keywords: [
      '부산 소상공인 지원', '부산 청년창업 지원', '부산 창업 지원사업', '부산 중소기업 지원사업',
      '부산 사업화 지원', '부산 정부지원금 사업자', '부산 정책자금 소상공인', '부산 창업자금',
      '부산 소상공인 대출', '부산 신용보증 소상공인', '부산 폐업 지원', '부산 재창업 지원',
    ],
  },
  {
    category: '창업·투자',
    keywords: [
      '부산 창업기업 모집', '부산 스타트업 모집', '부산 입주기업 모집', '부산 창업공간 모집',
      '부산 IR 참가기업 모집', '부산 데모데이',
    ],
  },
  {
    category: '모집·행사',
    keywords: [
      '부산 창업교육 모집', '부산 창업 컨설팅', '부산 창업 공모전', '부산 박람회 참가기업',
      '부산 팝업스토어 모집', '부산 청년사업가 네트워킹',
    ],
  },
  {
    category: '상권·소비',
    keywords: [
      '부산 소상공인', '부산 자영업', '부산 골목상권', '부산 전통시장', '부산 지역상권',
      '부산 상권 분석', '부산 소비동향', '부산 유동인구 상권', '부산 공실률 상가',
      '부산 상가 임대료', '부산 관광객 소비', '부산 외식업 동향',
    ],
  },
  {
    category: '판로·마케팅',
    keywords: [
      '부산 중소기업 판로', '부산 소상공인 판로', '부산 온라인 판로 지원', '부산 라이브커머스 지원',
      '부산 로컬브랜드', '부산 로컬크리에이터', '부산 공동구매', '부산 수출 지원 중소기업',
      '부산 해외 판로', '부산 공공조달 중소기업', '부산 마케팅 지원사업',
    ],
  },
  {
    // 지역명이 없어도 전국 사업자에게 공통으로 적용되는 세무/노무/법률 정보라 "부산" 접두어 없이 수집.
    category: '세무·노무',
    keywords: [
      '소상공인 세금 개정', '자영업자 세금 지원', '사업자 부가가치세', '개인사업자 종합소득세',
      '소상공인 고용지원금', '자영업자 4대보험', '소상공인 최저임금', '사업자 인건비 지원',
      '상가임대차 개정', '전자상거래법 사업자', '표시광고법 소상공인', '배달앱 수수료 소상공인',
      '온라인 플랫폼 규제 소상공인',
    ],
  },
  {
    category: '기술·트렌드',
    keywords: [
      '부산 소상공인 AI', '부산 중소기업 디지털전환', '부산 스마트상점', '부산 콘텐츠기업 지원',
      '부산 관광기업 지원', '부산 식품기업 지원', '부산 뷰티기업 지원', '부산 영상콘텐츠 지원',
      '부산 해양스타트업', '부산 물류스타트업', '소상공인 AI 활용', '자영업 마케팅 트렌드',
      '온라인 소비 트렌드',
    ],
  },
];
const NEWS_KEYWORDS = NEWS_KEYWORD_GROUPS.flatMap((g) => g.keywords);
const KEYWORD_CATEGORY_MAP = new Map();
NEWS_KEYWORD_GROUPS.forEach((g) => g.keywords.forEach((k) => KEYWORD_CATEGORY_MAP.set(k, g.category)));

// 48시간이 지난 기사는 "오늘의 뉴스"로서 의미가 없어 수집하지 않는다.
const NEWS_RECENCY_MS = 48 * 60 * 60 * 1000;
// 검색어가 73개나 되므로(위 그룹 합계) 한 번 실행에 저장하는 뉴스 건수에는 별도 상한을 둔다
// (bizinfo의 MAX_ITEMS_PER_SOURCE와는 별개 — 뉴스는 검색어 자체가 많아 그 캡을 그대로 쓰면 너무 적다).
const NEWS_MAX_ITEMS_PER_RUN = 60;
// 키워드 73개를 연달아 호출하다 네이버 API에 과부하를 주지 않도록 요청 사이에 살짝 텀을 둔다.
const NEWS_REQUEST_INTERVAL_MS = 120;

// 기사 제목/요약에 아래 단어가 하나도 없으면 "사업자에게 필요한 정보"로 보기 어려워 제외한다
// (부산 경제 뉴스만으로 검색하면 대기업 실적·부동산 기사까지 섞이는 것을 막기 위한 핵심 필터).
const REQUIRED_TARGET_WORDS = [
  '소상공인', '자영업자', '개인사업자', '중소기업', '스타트업', '창업기업', '예비창업자',
  '초기창업기업', '청년기업', '청년창업가', '로컬기업', '로컬크리에이터', '지역기업',
  '1인기업', '벤처기업', '사회적기업', '협동조합',
];

// 아래 표현이 제목/요약의 중심이면 대기업 실적·주가·공시 기사일 가능성이 높아 제외 대상으로 본다.
const EXCLUDE_TERMS = [
  '대기업', '재벌', '그룹 총수', '회장 취임', '부회장', '오너가', '계열사 실적', '분기 실적',
  '실적 발표', '영업이익', '매출 전망', '목표주가', '증권가', '특징주', '주가 급등', '주가 하락',
  '시가총액', '배당', '공시', '코스피', '코스닥', '지분 인수', '기업 합병', 'M&A',
];
// 다만 위 EXCLUDE_TERMS가 있어도, 아래 표현이 함께 있으면 소상공인/스타트업과 실제로 관련된
// 기사(협업·입점·상생 등)일 가능성이 커서 제외하지 않는다 — "대기업 이름이 등장했다"는 이유만으로
// 걸러내지 않기 위한 예외 목록.
const OVERRIDE_TERMS = [
  '상생', '협력업체', '납품', '입점', '판로', '지역상생', '오픈이노베이션',
  '스타트업 지원', '소상공인 지원', '공급업체 모집', '참가기업 모집',
];

// 폐업/연체/재기 같은 위기 상황을 다루는 기사는 검색어 그룹과 무관하게 "위기·대응" 카테고리로
// 재분류한다(resolveCategory에서 최우선으로 검사). 너무 흔한 단어(임대료, 수수료 단독)는 상권·세무
// 기사까지 오분류할 수 있어 제외하고, 위기 상황이 뚜렷한 구체적 표현만 골랐다.
const CRISIS_TERMS = [
  '폐업 위기', '폐업 지원', '연체율', '연체 증가', '임대료 부담', '수수료 부담',
  '재기 지원', '재창업 지원', '경영위기', '자금난', '부도',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 제목에서 [단독]/【사진】 같은 대괄호 태그와 기호를 지우고 한글/영문/숫자만 남겨 비교하기 쉽게 만든다. */
function normalizeTitleForDedup(title) {
  return String(title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function charBigramSet(s) {
  const grams = new Set();
  for (let i = 0; i < s.length - 1; i++) grams.add(s.slice(i, i + 2));
  return grams;
}

/** 두 정규화된 제목의 유사도(0~1, 글자 2-gram Jaccard). 같은 사건을 다룬 재작성 기사 판별용. */
function titleSimilarity(a, b) {
  if (!a || !b) return a === b ? 1 : 0;
  const ga = charBigramSet(a);
  const gb = charBigramSet(b);
  if (ga.size === 0 || gb.size === 0) return a === b ? 1 : 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const TITLE_DUP_THRESHOLD = 0.82;

function isDuplicateTitle(normTitle, seenNormTitles) {
  return seenNormTitles.some((seen) => titleSimilarity(normTitle, seen) >= TITLE_DUP_THRESHOLD);
}

/** REQUIRED_TARGET_WORDS를 만족하고(핵심 대상어 최소 1개), EXCLUDE_TERMS에 걸리지 않아야 통과. */
function passesContentFilters(text) {
  const hasRequiredTarget = REQUIRED_TARGET_WORDS.some((w) => text.includes(w));
  if (!hasRequiredTarget) return false;
  const hasExclude = EXCLUDE_TERMS.some((w) => text.includes(w));
  if (hasExclude) {
    const hasOverride = OVERRIDE_TERMS.some((w) => text.includes(w));
    if (!hasOverride) return false;
  }
  return true;
}

/** 위기 관련 표현이 있으면 "위기·대응"으로, 아니면 검색어가 속한 기본 카테고리로 분류. */
function resolveCategory(text, keywordUsed) {
  if (CRISIS_TERMS.some((term) => text.includes(term))) return '위기·대응';
  return KEYWORD_CATEGORY_MAP.get(keywordUsed) || '창업·투자';
}

/** 기사에 언급된 핵심 대상어를 최대 3개까지 뽑아 "이 기사는 누구에게 해당되는가"를 짧게 표시. */
function extractTargets(text) {
  const found = [];
  for (const w of REQUIRED_TARGET_WORDS) {
    if (found.length >= 3) break;
    if (text.includes(w)) found.push(w);
  }
  return found;
}

function formatDeadlineText(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}까지`;
}

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 20);
}

/**
 * HTML(기업마당 bsnsSumryCn, 네이버 뉴스 title/description 등)을 순수 텍스트로 변환.
 * 블록 태그는 지우기 전에 줄바꿈으로 바꿔서 문단이 이어붙지 않게 한다
 * (기업마당 bsnsSumryCn이 <p>...</p><p><br></p><p style="...">...</p> 형태의 raw HTML로 오는 경우가 많음).
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 기사 링크의 도메인을 "출처" 표시용 짧은 이름으로 변환 (예: n.news.naver.com, www.hankyung.com). */
function hostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '네이버뉴스';
  }
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error('[ingest-daily-feed] FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다.');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

/**
 * 공통 upsert 규칙:
 * - 문서가 없으면: 새로 생성 (enabled:true, status:'published', sourceType:'site_scan')
 * - 문서가 있고 sourceType이 'site_scan'이면: 지정된 필드만 갱신(enabled/status/sortOrder는 절대 건드리지 않음 — 관리자 조작 존중)
 * - 문서가 있고 sourceType이 'site_scan'이 아니면(관리자 수동 등록): 완전히 건너뜀
 */
async function upsertDoc(db, collectionName, id, { onCreate, onUpdate }) {
  const ref = db.collection(collectionName).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const data = onCreate();
    if (isDryRun) {
      console.log(`  [DRY-RUN][NEW] ${collectionName}/${id}: ${data.title}`);
      return 'new';
    }
    await ref.set({
      ...data,
      sourceType: 'site_scan',
      enabled: true,
      status: data.status || 'published',
      sortOrder: Date.now(),
      createdBy: 'auto_ingest',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'new';
  }
  const existing = snap.data() || {};
  if (existing.sourceType !== 'site_scan') {
    return 'skipped_manual';
  }
  const updateFields = onUpdate ? onUpdate(existing) : null;
  if (!updateFields) return 'skipped_no_change';
  if (isDryRun) {
    console.log(`  [DRY-RUN][UPDATE] ${collectionName}/${id}`);
    return 'updated';
  }
  await ref.update({
    ...updateFields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return 'updated';
}

/** "20260101 ~ 20260228" 형태 문자열에서 마감일(뒤쪽 날짜)을 Date로 파싱. 실패하면 null. */
function parseDeadlineFromRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const nums = rangeStr.match(/\d{8}/g);
  if (!nums || nums.length === 0) return null;
  const last = nums[nums.length - 1];
  const y = Number(last.slice(0, 4));
  const m = Number(last.slice(4, 6)) - 1;
  const d = Number(last.slice(6, 8));
  const date = new Date(y, m, d, 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 공고 설명문(자유 텍스트) 안에서 기간/마감 표현을 찾아 마감일(Date)을 추출한다.
 * bizinfo API의 reqstBeginEndDe(신청기간 구조화 필드)가 비어있거나 파싱에 실패했을 때 쓰는 보조 수단 —
 * "상시모집"으로 잘못 분류되는 공고를 줄이기 위함. 연도가 없는 표현(예: "9.1~9.30")은 올해로 가정하고,
 * 그 결과가 이미 두 달 이상 지난 날짜라면 내년으로 보정한다(연말에 등록된 "내년 상반기까지" 류 공고 대응).
 * 못 찾으면 null.
 */
function extractDeadlineFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const currentYear = new Date().getFullYear();

  const makeDate = (y, mo, d) => {
    const date = new Date(y, mo - 1, d, 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  // 연도 없는 월/일만 나온 경우: 이미 많이 지난 날짜면 내년으로 보정.
  const makeDateInferYear = (mo, d) => {
    let date = makeDate(currentYear, mo, d);
    if (date && date.getTime() < Date.now() - 60 * 86400000) {
      date = makeDate(currentYear + 1, mo, d);
    }
    return date;
  };

  // 1) "2026.09.01 ~ 2026.09.30" / "2026-09-01~2026-09-30" / "2026년 9월 1일부터 2026년 9월 30일까지"
  let m = text.match(/(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})\s*일?\s*(?:~|-|부터)\s*(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
  if (m) {
    const d = makeDate(Number(m[4]), Number(m[5]), Number(m[6]));
    if (d) return d;
  }

  // 2) "9.1 ~ 9.30" / "09/01~09/30" (연도 없음, 월.일 형식 두 번)
  m = text.match(/(\d{1,2})[.\/](\d{1,2})\s*(?:~|-)\s*(\d{1,2})[.\/](\d{1,2})(?!\d)/);
  if (m) {
    const d = makeDateInferYear(Number(m[3]), Number(m[4]));
    if (d) return d;
  }

  // 3) "9월 1일부터 9월 30일까지" / "9월 1일 ~ 9월 30일"
  m = text.match(/\d{1,2}월\s*\d{1,2}일\s*(?:부터|~|-)\s*(\d{1,2})월\s*(\d{1,2})일\s*까지/);
  if (m) {
    const d = makeDateInferYear(Number(m[1]), Number(m[2]));
    if (d) return d;
  }

  // 4) 종료일만 명시: "~2026.09.30", "2026-09-30까지", "마감: 2026.09.30", "마감일 2026-09-30"
  m = text.match(/(?:~|마감\s*[:：]?\s*|마감일\s*[:：]?\s*)(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
  if (m) {
    const d = makeDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) return d;
  }

  // 5) "9월 30일까지" (연도 없음)
  m = text.match(/(\d{1,2})월\s*(\d{1,2})일\s*까지/);
  if (m) {
    const d = makeDateInferYear(Number(m[1]), Number(m[2]));
    if (d) return d;
  }

  // 6) "접수기간 2026. 09. 14 ~ 2026. 09. 28" 처럼 라벨(접수기간/신청기간/모집기간) 뒤에 붙는 경우도
  //    위 1)에서 대부분 잡히지만, 점 뒤에 공백이 많거나 줄바꿈이 끼는 실제 페이지 레이아웃을 위해
  //    라벨을 기준으로 그 뒤 60자만 잘라 1)의 패턴을 한 번 더 시도한다.
  m = text.match(/(?:접수기간|신청기간|모집기간)\s*[:：]?\s*([\s\S]{4,60})/);
  if (m) {
    const nested = m[1].match(/(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})\s*일?\s*(?:~|-|부터)\s*(20\d{2})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/);
    if (nested) {
      const d = makeDate(Number(nested[4]), Number(nested[5]), Number(nested[6]));
      if (d) return d;
    }
  }

  return null;
}

/** HTML에서 <script>/<style>/주석 블록을 통째로 지운 뒤 나머지를 stripHtml로 텍스트화. */
function htmlPageToText(html) {
  if (!html || typeof html !== 'string') return '';
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return stripHtml(withoutNoise).slice(0, PAGE_TEXT_MAX_LEN);
}

/**
 * 공고의 신청 링크(원문 페이지)를 실제로 열어서 그 페이지 텍스트에서 마감일을 찾는다.
 * 기업마당 API 자체에는 신청기간 정보가 없고, 연결된 기관 사이트에만 접수기간이 적혀 있는 경우를 위한
 * 마지막 폴백. 페이지 접근 실패/타임아웃/HTML이 아닌 응답(PDF 등)이면 조용히 null을 반환하고 넘어간다
 * (원문 크롤링은 "되면 좋고 안 되면 상시로 남기는" 보조 수단이라 실패해도 전체 실행을 막지 않는다).
 */
async function fetchDeadlineFromPage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      timeout: PAGE_FETCH_TIMEOUT_MS,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BCSA-ingest-bot/1.0; +https://bcsa.co.kr)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('xhtml')) return null;
    const html = await res.text();
    const text = htmlPageToText(html);
    return extractDeadlineFromText(text);
  } catch (err) {
    console.log(`  [deadline-crawl] ${url} 접근 실패 또는 시간초과 — 건너뜀 (${err.message})`);
    return null;
  }
}

/**
 * 공고 하나의 마감일을 3단계 폴백으로 판정한다: 구조화 필드 → 제목/요약 텍스트 → 원문 페이지 크롤링.
 * 앞 단계에서 찾으면 뒤 단계(특히 네트워크가 필요한 원문 크롤링)는 건너뛴다.
 * 반환값의 usedCrawl은 원문 페이지 접근을 실제로 시도했는지(로그/통계용) 나타낸다.
 */
async function resolveDeadline({ item, title, summaryText, applyUrl, sourceUrl }) {
  let deadline = parseDeadlineFromRange(item.reqstBeginEndDe || item.reqstDt);
  if (deadline) return { deadline, usedCrawl: false };

  deadline = extractDeadlineFromText(`${title} ${summaryText}`);
  if (deadline) return { deadline, usedCrawl: false };

  deadline = await fetchDeadlineFromPage(applyUrl);
  if (deadline) return { deadline, usedCrawl: true };

  if (sourceUrl && sourceUrl !== applyUrl) {
    deadline = await fetchDeadlineFromPage(sourceUrl);
    if (deadline) return { deadline, usedCrawl: true };
  }

  return { deadline: null, usedCrawl: true };
}

/**
 * 기업마당 지원사업정보 API를 한 번 호출한다. hashtags를 넘기면 그 태그로 필터링된 결과만 온다
 * (예: hashtags='부산' → 부산 지역 공고만). 공식 문서 기준 지역 해시태그는 시/도 한글명 그대로 사용.
 */
async function fetchBizinfoList(apiKey, hashtags) {
  const params = new URLSearchParams({
    crtfcKey: apiKey,
    dataType: 'json',
    pageUnit: String(MAX_ITEMS_PER_SOURCE),
    pageIndex: '1',
  });
  if (hashtags) params.set('hashtags', hashtags);
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`;
  const res = await fetch(url, { timeout: 20000 });
  if (!res.ok) {
    console.error(`[bizinfo${hashtags ? ':' + hashtags : ''}] API 응답 실패: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  // 응답 최상위 배열 키가 버전에 따라 다를 수 있어 방어적으로 탐색.
  const items = json?.jsonArray || json?.items || json?.result || [];
  return Array.isArray(items) ? items.slice(0, MAX_ITEMS_PER_SOURCE) : [];
}

async function ingestBizinfo(db) {
  const apiKey = process.env.BIZINFO_API_KEY;
  if (!apiKey) {
    console.log('[bizinfo] BIZINFO_API_KEY가 없어 지원사업 자동수집을 건너뜁니다.');
    return { new: 0, updated: 0, skipped: 0 };
  }

  // 전체 공고 + 부산 지역 공고(hashtags=부산)를 각각 조회한다. 기업마당 API 자체에 시/도 필드가
  // 없어서(공식 문서 확인 — jrsdInsttNm 등 소관기관명만 있고 별도 지역 필드는 없음), 지역으로
  // 걸러 받으려면 hashtags 파라미터로 조회하는 방법뿐이다. 두 결과를 pblancUrl 기준으로 합쳐서
  // 부산 조회에 포함된 공고만 region:['부산']으로 표시하고, 나머지는 region:[]로 둔다
  // (사이트의 "부산 지원사업" 섹션은 이 region 필드로 걸러 보여준다 — SupportProgramsView.jsx 참고).
  const [generalItems, busanItems] = await Promise.all([
    fetchBizinfoList(apiKey, null),
    fetchBizinfoList(apiKey, '부산'),
  ]);
  if (generalItems.length === 0 && busanItems.length === 0) {
    console.log('[bizinfo] 수집된 공고가 없습니다. (응답 형식이 예상과 다르면 이 스크립트의 필드 매핑을 점검하세요)');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const busanUrlSet = new Set(busanItems.map((i) => i.pblancUrl).filter(Boolean));
  const merged = new Map();
  for (const item of [...generalItems, ...busanItems]) {
    if (item.pblancUrl) merged.set(item.pblancUrl, item);
  }
  const allItems = Array.from(merged.values()).slice(0, MAX_ITEMS_TOTAL);

  const counts = { new: 0, updated: 0, skipped: 0 };
  let crawledCount = 0;
  let busanCount = 0;
  for (const item of allItems) {
    const title = item.pblancNm || item.title || '';
    const org = item.jrsdInsttNm || item.excInsttNm || item.instt || '';
    const sourceUrl = item.pblancUrl || '';
    const applyUrl = item.rceptEngnHmpgUrl || sourceUrl;
    if (!title || !sourceUrl) continue;

    const id = shortHash(sourceUrl);
    // bsnsSumryCn은 <p>/<br> 등이 섞인 raw HTML로 온다 — 화면에 태그가 그대로 노출되지 않도록
    // 순수 텍스트로 정리한 뒤에만 요약/설명/마감일 추출에 사용한다.
    const summaryText = stripHtml(item.bsnsSumryCn || '');

    // 부산 판정: hashtags=부산 조회 결과에 있었거나(busanUrlSet), 제목/소관기관/요약에 "부산"이 직접
    // 나오면 부산으로 본다. hashtags 파라미터가 공식 문서대로 정확히 동작하지 않는 경우(실제로 제목에
    // "[부산]"이 박힌 공고인데도 hashtags=부산 조회에는 안 잡히는 사례를 확인함)를 텍스트 매칭으로
    // 보완하기 위한 이중 판정 — 둘 중 하나만 맞아도 부산으로 분류한다.
    const textMentionsBusan = /부산/.test(`${title} ${org} ${summaryText}`);
    const isBusan = busanUrlSet.has(sourceUrl) || textMentionsBusan;
    if (isBusan) busanCount += 1;
    const region = isBusan ? ['부산'] : [];

    const { deadline, usedCrawl } = await resolveDeadline({ item, title, summaryText, applyUrl, sourceUrl });
    if (usedCrawl) crawledCount += 1;

    const result = await upsertDoc(db, 'supportPrograms', id, {
      onCreate: () => ({
        title,
        org,
        summary: summaryText.slice(0, 120),
        description: summaryText,
        amountText: '',
        region,
        industry: item.pldirSportRealmLclasCodeNm ? [item.pldirSportRealmLclasCodeNm] : [],
        applyUrl,
        sourceUrl,
        deadlineAt: deadline ? admin.firestore.Timestamp.fromDate(deadline) : null,
        isRolling: !deadline,
        thumbnailUrl: null,
        thumbnailDeleteUrl: null,
      }),
      onUpdate: () => ({
        title,
        org,
        summary: summaryText.slice(0, 120),
        description: summaryText,
        region,
        deadlineAt: deadline ? admin.firestore.Timestamp.fromDate(deadline) : null,
        isRolling: !deadline,
      }),
    });
    counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
      (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
  }
  console.log(`[bizinfo] 신규 ${counts.new}건, 갱신 ${counts.updated}건, 건너뜀 ${counts.skipped}건 (부산 ${busanCount}건, 원문 페이지 크롤링 시도 ${crawledCount}건)`);
  return counts;
}

/**
 * NAVER API HUB 뉴스검색 API로 NEWS_KEYWORD_GROUPS의 검색어(73개)를 각각 조회해 newsItems에 upsert.
 * (2026년 이전 구버전 openapi.naver.com/v1/search/news.json + X-Naver-Client-Id 방식은
 * 네이버가 종료하고 NAVER API HUB로 이관함 — 도메인/경로/인증 헤더가 모두 바뀌었다.)
 *
 * 파이프라인(검색어별로 최신순 조회 → 아래 순서로 필터링):
 *  1) 48시간 이내 기사만 (NEWS_RECENCY_MS)
 *  2) REQUIRED_TARGET_WORDS 중 하나 이상 포함 — 아니면 사업자와 무관한 기사로 보고 제외
 *  3) EXCLUDE_TERMS(대기업 실적/주가/공시 등)에 해당하면 제외하되, OVERRIDE_TERMS(상생/입점/
 *     협력 등)가 함께 있으면 제외하지 않음
 *  4) 이미 수집한 기사와 제목이 매우 유사하면(titleSimilarity ≥ TITLE_DUP_THRESHOLD) 재작성
 *     기사로 보고 제외 — 링크가 달라도 같은 사건을 다룬 기사가 여러 매체에서 나오는 경우가 많음
 *  5) CRISIS_TERMS가 있으면 "위기·대응", 아니면 검색어가 속한 그룹의 기본 카테고리로 자동 분류
 *  6) 기사에 언급된 핵심 대상어(최대 3개)와, 제목/요약에서 뽑을 수 있으면 신청기한도 함께 저장
 *
 * API 응답은 기사 제목/발췌(description)만 주기 때문에, summary에는 그 발췌 전문을 담아
 * "기사 발췌" 형태로 보여준다(전체 본문을 가져오는 게 아님 — 원문은 externalUrl로 연결). "2문장
 * 요약"은 네이버가 자체적으로 잘라주는 발췌를 그대로 쓰는 것이고, 기사 본문을 다시 읽고 "왜
 * 중요한지"를 새로 써주는 것은 아니다 — 그렇게 하려면 별도 LLM 요약 호출이 필요해서, 우선 여기까지만
 * 구현했다(필요하면 다음 단계로 추가 가능).
 */
async function ingestNaverNews(db) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('[naver-news] NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 없어 뉴스 자동수집을 건너뜁니다.');
    return { new: 0, updated: 0, skipped: 0 };
  }

  const seenLinks = new Set();
  const seenNormTitles = [];
  const collected = [];
  let rejectedByFilter = 0;
  let rejectedByDup = 0;
  let rejectedByAge = 0;

  for (const query of NEWS_KEYWORDS) {
    if (collected.length >= NEWS_MAX_ITEMS_PER_RUN) break;
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/news?query=${encodeURIComponent(query)}&display=10&sort=date`;
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
        timeout: 8000,
      });
    } catch (err) {
      console.error(`[naver-news:${query}] 요청 실패:`, err.message);
      continue;
    }
    if (!res.ok) {
      console.error(`[naver-news:${query}] API 응답 실패: HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    for (const item of json.items || []) {
      const link = item.originallink || item.link || '';
      if (!link || seenLinks.has(link)) continue;

      const title = stripHtml(item.title);
      if (!title) continue;
      const description = stripHtml(item.description);

      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
      if (Number.isNaN(publishedAt.getTime()) || Date.now() - publishedAt.getTime() > NEWS_RECENCY_MS) {
        rejectedByAge += 1;
        continue;
      }

      const fullText = `${title} ${description}`;
      if (!passesContentFilters(fullText)) {
        rejectedByFilter += 1;
        continue;
      }

      const normTitle = normalizeTitleForDedup(title);
      if (isDuplicateTitle(normTitle, seenNormTitles)) {
        rejectedByDup += 1;
        continue;
      }

      seenLinks.add(link);
      seenNormTitles.push(normTitle);
      collected.push({ link, title, description, publishedAt, query, fullText });
      if (collected.length >= NEWS_MAX_ITEMS_PER_RUN) break;
    }
    await sleep(NEWS_REQUEST_INTERVAL_MS);
  }

  const counts = { new: 0, updated: 0, skipped: 0 };
  for (const c of collected) {
    const { link, title, description, publishedAt, query, fullText } = c;
    const id = shortHash(link);
    const category = resolveCategory(fullText, query);
    const targets = extractTargets(fullText);
    const deadline = extractDeadlineFromText(fullText);

    const result = await upsertDoc(db, 'newsItems', id, {
      onCreate: () => ({
        title,
        source: hostnameLabel(link),
        summary: description.slice(0, 200),
        url: link,
        category,
        target: targets.join(', '),
        deadlineText: deadline ? formatDeadlineText(deadline) : '',
        keyword: query,
        publishedAt: admin.firestore.Timestamp.fromDate(publishedAt),
      }),
      onUpdate: () => null, // 뉴스는 내용이 바뀔 일이 없어 갱신 불필요
    });
    counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] =
      (counts[result === 'new' ? 'new' : result === 'updated' ? 'updated' : 'skipped'] || 0) + 1;
  }
  console.log(
    `[naver-news] 키워드 ${NEWS_KEYWORDS.length}개 조회, 필터 통과 ${collected.length}건 중 신규 ${counts.new}건, 건너뜀 ${counts.skipped}건` +
      ` (제외: 48시간초과 ${rejectedByAge}건, 대상어/대기업필터 ${rejectedByFilter}건, 중복제목 ${rejectedByDup}건)`
  );
  return counts;
}

/**
 * 필터 규칙(REQUIRED_TARGET_WORDS/EXCLUDE_TERMS 등)이 오늘 새로 생기거나 강화돼도, 그 이전에 이미
 * 저장된 자동수집 뉴스 문서에는 소급 적용되지 않는다(운세·부동산 기사가 예전에 잘못 들어와 있어도
 * 그대로 남아있는 이유) — 그래서 매일 실행 때마다 기존 자동수집 문서를 지금 기준으로 다시 검사해서,
 * 더 이상 기준을 통과하지 못하는 문서는 정리한다. 관리자가 admin 화면에서 수동으로 만든 문서
 * (sourceType !== 'site_scan')는 절대 건드리지 않는다.
 */
async function cleanupLegacyNews(db) {
  const snap = await db.collection('newsItems').where('sourceType', '==', 'site_scan').get();
  let removed = 0;
  let kept = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const text = `${data.title || ''} ${data.summary || ''} ${data.description || ''}`;
    if (!passesContentFilters(text)) {
      if (!isDryRun) await doc.ref.delete();
      removed += 1;
    } else {
      kept += 1;
    }
  }
  console.log(`[cleanup-legacy-news] 기준 미달 자동수집 뉴스 ${removed}건 정리, ${kept}건 유지`);
  return { removed, kept };
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log(`[ingest-daily-feed] 시작 (${isDryRun ? 'dry-run' : 'live'}) — ${new Date().toISOString()}`);

  const bizinfoResult = await ingestBizinfo(db);
  const newsResult = await ingestNaverNews(db);
  const cleanupResult = await cleanupLegacyNews(db);

  console.log('[ingest-daily-feed] 완료:', { supportPrograms: bizinfoResult, newsItems: newsResult, cleanup: cleanupResult });
  process.exit(0);
}

main().catch((err) => {
  console.error('[ingest-daily-feed] 오류:', err);
  process.exit(1);
});
