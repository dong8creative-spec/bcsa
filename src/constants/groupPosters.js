/**
 * 그룹 모집 포스터 + 사이트 광고 자리에 거는 자체 모집 광고(하우스 광고)
 *
 * - 운영진이 관리자 화면(소모임·스터디 관리)에서 그룹에 포스터를 지정하면(groups/{id}.poster = 아래 key)
 *   그룹 화면 맨 위에 포스터가 크게 나오고, 소모임 목록 맨 위에 「지금 모집 중」으로 뜬다.
 * - 포스터는 글자가 많은 그림이라, 같은 내용을 글(facts·sections)로도 함께 보여 준다(화면 읽기 프로그램·확대가 필요한 분).
 *   포스터를 바꾸면 이 글도 포스터와 똑같이 고친다.
 * - houseAd: 유료 광고가 등록되지 않은 광고 자리를 이 모집 광고로 채운다. 포스터를 지정한 그룹이
 *   「운영 중」일 때만 보이고, 누르면 그 그룹 화면으로 간다. 이미지는 Codex(image_gen)로 만든 것.
 */
export const GROUP_POSTERS = {
  'bcsa-study-1': {
    label: '부청사 사업스터디 1기 포스터',
    image: '/assets/images/groups/poster-bcsa-study-1.jpg',
    width: 794,
    height: 1123,
    headline: '부청사 사업스터디 1기 모집',
    tagline: '사업을 키우고 싶은 대표들의 작은 사업모임',
    lead: '좋은 사람들이 모여, 각자의 경험과 고민을 나누고 실행으로 이어가는 3개월의 성장 여정에 함께하세요.',
    facts: [
      ['운영 기간', '2026년 10월 ~ 12월'],
      ['형태', '3개월 파일럿'],
      ['모집 인원', '3~5명'],
      ['모임 주기', '월 1회 / 90분'],
      ['참여비', '3개월 3만원'],
    ],
    sections: [
      { title: '이런 이야기를 나눕니다', items: ['매출 증대와 고객 확보', '자금·세금·인건비 관리', '운영 체계와 대표의 고민', '서로의 경험과 실행 아이디어'] },
      { title: '이런 분들과 함께합니다', items: ['사업을 키우고 싶은 대표님', '체계적 관리가 필요한 사업자', '자기 고민을 나눌 수 있는 분', '실질적 도움을 줄 수 있는 전문가'] },
      { title: '운영 원칙', items: ['친목보다 성장과 실행', '모임 내 직접 영업 지양', '개별 자문은 별도 진행'] },
    ],
    howTo: '가입 신청할 때 사업 분야와 현재 고민 1가지를 적어 주세요.',
    closing: '명함 교환보다 고민 공유, 친목보다 실행.',
    /** 「그룹 만들기」를 /groups/new?template=bcsa-study-1 로 열면 미리 채워지는 값(포스터 내용 그대로) */
    createDefaults: {
      type: 'study',
      title: '부청사 사업스터디 1기',
      description: '사업을 키우고 싶은 대표들의 작은 사업모임입니다.\n좋은 사람들이 모여, 각자의 경험과 고민을 나누고 실행으로 이어가는 3개월의 성장 여정에 함께하세요.\n\n· 운영 기간: 2026년 10월 ~ 12월 (3개월 파일럿)\n· 모집 인원: 3~5명\n· 모임 주기: 월 1회 / 90분\n· 참여비: 3개월 3만원\n\n이런 이야기를 나눕니다: 매출 증대와 고객 확보, 자금·세금·인건비 관리, 운영 체계와 대표의 고민, 서로의 경험과 실행 아이디어\n이런 분들과 함께합니다: 사업을 키우고 싶은 대표님, 체계적 관리가 필요한 사업자, 자기 고민을 나눌 수 있는 분, 실질적 도움을 줄 수 있는 전문가\n운영 원칙: 친목보다 성장과 실행, 모임 내 직접 영업 지양, 개별 자문은 별도 진행\n\n가입 신청할 때 사업 분야와 현재 고민 1가지를 적어 주세요.',
      region: '부산',
      mode: 'offline',
      schedule: '월 1회 / 90분',
      capacity: 5,
      joinPolicy: 'approval',
      cover: 'study',
    },
    houseAd: {
      alt: '부청사 사업스터디 1기 모집. 사업을 키우고 싶은 대표들의 작은 사업모임. 3~5명, 월 1회 90분, 3개월 3만원. 자세히 보기',
      banner: { image: '/assets/images/ads/bcsa-study-1-wide.jpg', mobile: '/assets/images/ads/bcsa-study-1-mobile.jpg', width: 1600, height: 400 },
      rect: { image: '/assets/images/ads/bcsa-study-1-rect.jpg', width: 600, height: 500 },
    },
  },
  /**
   * 2026-11-19 운영자 요청: "예비창업자들을 위한 클로드코드 업무 자동화 워크숍" 스터디,
   * 파트너사 블루필드매뉴얼픽쳐스 이동헌 대표 강의. 일정·장소·참가비·정원은 아직 정해지지 않아 적지 않았다
   * (정해지면 그룹 설정의 「모임 주기」·회차에 넣고, 여기 facts 에도 더한다). 포스터·광고는 Codex(image_gen)로 만들었다.
   */
  'claude-workshop-1': {
    imagesPending: true, // 포스터·광고 이미지를 Codex 로 만드는 중 — 들어오면 이 줄을 지운다
    label: '예비창업자 클로드 코드 업무 자동화 워크숍 포스터',
    image: '/assets/images/groups/poster-claude-workshop-1.jpg',
    width: 1024,
    height: 1448,
    headline: '예비창업자들을 위한 클로드 코드 업무 자동화 워크숍',
    tagline: '반복 업무, 클로드 코드로 줄여 보기',
    lead: '창업을 준비하며 늘어나는 반복 업무를 AI 도구 클로드 코드로 자동화해 보는 워크숍입니다.',
    facts: [
      ['대상', '예비창업자'],
      ['강사', '블루필드매뉴얼픽쳐스 이동헌 대표'],
      ['형태', '스터디 · 워크숍'],
      ['일정·장소·참가비', '정해지면 이 화면에 안내해요'],
    ],
    sections: [
      { title: '이런 걸 다뤄요', items: ['클로드 코드가 무엇이고 어떻게 시작하는지', '자주 하는 반복 업무를 자동화로 바꾸는 방법'] },
      { title: '이런 분께 맞아요', items: ['창업을 준비 중인 예비창업자', '혼자 처리할 업무가 많은 1인 대표'] },
    ],
    howTo: '가입 신청할 때 사업 분야(준비 중인 분야)와 자동화하고 싶은 업무 1가지를 적어 주세요.',
    joinLabels: { field: '사업 분야(준비 중인 분야)', concern: '자동화하고 싶은 업무 1가지', concernPlaceholder: '예: 매일 주문 내역을 엑셀로 옮기는 일' },
    closing: '부청사 파트너사 블루필드매뉴얼픽쳐스와 함께합니다.',
    createDefaults: {
      type: 'study',
      title: '예비창업자들을 위한 클로드 코드 업무 자동화 워크숍',
      description: '창업을 준비하며 늘어나는 반복 업무를 AI 도구 클로드 코드로 자동화해 보는 워크숍입니다.\n\n· 대상: 예비창업자\n· 강사: 블루필드매뉴얼픽쳐스 이동헌 대표 (부청사 파트너사)\n· 일정·장소·참가비: 정해지면 이 화면에 안내합니다.\n\n가입 신청할 때 사업 분야(준비 중인 분야)와 자동화하고 싶은 업무 1가지를 적어 주세요.',
      region: '부산',
      mode: 'offline',
      schedule: '',
      capacity: 0,
      joinPolicy: 'approval',
      cover: 'workshop',
    },
    houseAd: {
      alt: '부청사 스터디. 예비창업자들을 위한 클로드 코드 업무 자동화 워크숍. 강사 블루필드매뉴얼픽쳐스 이동헌 대표. 자세히 보기',
      banner: { image: '/assets/images/ads/claude-workshop-1-wide.jpg', mobile: '/assets/images/ads/claude-workshop-1-mobile.jpg', width: 1600, height: 400 },
      rect: { image: '/assets/images/ads/claude-workshop-1-rect.jpg', width: 600, height: 500 },
    },
  },
};

/** 광고 자리 → 하우스 광고 모양. 여기에 없는 자리(세로 긴 사이드바 등)는 비워 둔다 */
export const HOUSE_AD_SLOTS = {
  'home-bento-divider': 'banner',
  'support-top-banner': 'banner',
  'news-list-native': 'banner',
  'startup-mid-banner': 'banner',
  'news-sidebar-1': 'tall',
  'news-sidebar-1b': 'narrow',
  'news-sidebar-2': 'rect',
  'support-sidebar-1': 'tall',
  'support-sidebar-1b': 'narrow',
  'support-sidebar-2': 'rect',
};

/** 자리마다 다른 모집을 걸고 싶을 때(그 그룹이 없으면 HOUSE_AD_POSTER 로 돌아간다) */
export const HOUSE_AD_SLOT_POSTER = {
  'startup-mid-banner': 'claude-workshop-1',
};

/** 지금 광고로 거는 포스터(모집이 바뀌면 이 값과 위 목록만 바꾼다) */
export const HOUSE_AD_POSTER = 'bcsa-study-1';

export const groupPoster = (group) => (group?.poster && GROUP_POSTERS[group.poster]) || null;
