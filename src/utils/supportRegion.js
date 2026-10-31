// ── 부산·전국 공고 판정 (홈 "지금 신청해 볼 만한 지원사업" 목록용) ──────────────────────
// 기업마당 공고는 org(소관기관)가 시·도이거나, 중앙부처라도 제목 앞에 "[인천]"처럼 지역이
// 붙어 있으면 그 지역 기업만 신청할 수 있다. 부산 사업자에게 쓸모없는 공고가 홈에 뜨지 않게
// "부산 공고" 또는 "지역 제한이 보이지 않는 전국 공고"만 남긴다.
const LOCAL_GOV_ORG_SUFFIXES = ['특별자치시', '특별자치도', '특별시', '광역시', '통합특별시', '도', '시', '군', '구'];
const OTHER_REGION_WORDS = ['서울', '인천', '경기', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '충청', '전북', '전남', '전라', '경북', '경남', '경상', '제주', '대경', '수도권'];
// 앞: 맨 앞·공백·괄호·구두점 / 뒤: 공백·구두점·괄호 또는 행정구역 접미어 (예: "투자대전", "인천국제공항"은 지역 제한으로 보지 않음)
const OTHER_REGION_RE = new RegExp(
  `(^|[\\s\\[\\(\\{<'"“‘·ㆍ,/])(${OTHER_REGION_WORDS.join('|')})(?=$|[\\s\\]\\)\\}>'"”’·ㆍ,/]|특별|광역|지역|권|도\\s|시\\s|소재)`
);
const NATIONWIDE_TAG_RE = /^\s*\[(전국|비수도권|지방|지역|공통)[^\]]*\]/;

export function isBusanProgram(p) {
  if (!p) return false;
  if (Array.isArray(p.region) && p.region.includes('부산')) return true;
  const org = String(p.org || '');
  const title = String(p.title || '');
  return org.includes('부산') || /^\s*\[[^\]]*부산[^\]]*\]/.test(title);
}

export function isBusanOrNationwideProgram(p) {
  if (!p) return false;
  if (isBusanProgram(p)) return true;
  const org = String(p.org || '').trim();
  const title = String(p.title || '').trim();
  // 소관기관이 다른 시·도·시군구면 그 지역 공고
  if (org && LOCAL_GOV_ORG_SUFFIXES.some((suf) => org.endsWith(suf)) && !/(부|처|청|원|위원회)$/.test(org)) return false;
  // 제목 앞 지역 꼬리표: [전국]·[비수도권]은 부산 포함이라 통과, 그 밖의 [지역]은 제외
  if (/^\s*\[[^\]]+\]/.test(title)) return NATIONWIDE_TAG_RE.test(title);
  // 제목 본문에 다른 지역 이름이 지역 제한처럼 쓰였으면 제외
  if (OTHER_REGION_RE.test(title)) return false;
  return true;
}
