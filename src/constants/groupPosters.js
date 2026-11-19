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
    card: '/assets/images/groups/cards/card-study.jpg', // 먼저가본 개편: 목록 카드용 3:2 그림(Codex)
    label: '먼저가본 사업스터디 1기 포스터',
    image: '/assets/images/groups/poster-bcsa-study-1.jpg',
    width: 794,
    height: 1123,
    headline: '먼저가본 사업스터디 1기 모집',
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
      title: '먼저가본 사업스터디 1기',
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
      tall: { image: '/assets/images/ads/bcsa-study-1-tall.jpg', width: 320, height: 1200 },
      narrow: { image: '/assets/images/ads/bcsa-study-1-narrow.jpg', width: 240, height: 1200 },
    },
  },
  /**
   * 2026-11-19 운영자 요청: "예비창업자들을 위한 클로드코드 업무 자동화 워크숍" 스터디,
   * 파트너사 블루필드매뉴얼픽쳐스 이동헌 대표 강의. 일정·장소·참가비·정원은 아직 정해지지 않아 적지 않았다
   * (정해지면 그룹 설정의 「모임 주기」·회차에 넣고, 여기 facts 에도 더한다). 포스터·광고는 Codex(image_gen)로 만들었다.
   */
  'claude-workshop-1': {
    card: '/assets/images/groups/cards/card-workshop.jpg', // 먼저가본 개편: 목록 카드용 3:2 그림(Codex)
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
    closing: '먼저가본 파트너사 블루필드매뉴얼픽쳐스와 함께합니다.',
    createDefaults: {
      type: 'study',
      title: '예비창업자들을 위한 클로드 코드 업무 자동화 워크숍',
      description: '창업을 준비하며 늘어나는 반복 업무를 AI 도구 클로드 코드로 자동화해 보는 워크숍입니다.\n\n· 대상: 예비창업자\n· 강사: 블루필드매뉴얼픽쳐스 이동헌 대표 (먼저가본 파트너사)\n· 일정·장소·참가비: 정해지면 이 화면에 안내합니다.\n\n가입 신청할 때 사업 분야(준비 중인 분야)와 자동화하고 싶은 업무 1가지를 적어 주세요.',
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
  /**
   * 「먼저 가본」(정은지 대표 1R 사업계획서, 2026-11) 파일럿 — 같은 업종 현직 대표와 1:1 커피챗.
   * 사업계획서의 「파일럿 커피챗 10건」을 부청사 사이트에서 모으기 위한 모집(웹앱 정식 오픈 전).
   * 결제는 아직 사이트에서 받지 않는다(연결 뒤 운영진이 안내). 가입 신청 메모 = 업종·업력 + 질문 1가지.
   */
  'senior-coffeechat-1': {
    card: '/assets/images/groups/cards/card-coffeechat.jpg', // 먼저가본 개편: 목록 카드용 3:2 그림(Codex)
    label: '먼저 가본 선배 커피챗 파일럿 포스터',
    image: '/assets/images/groups/poster-senior-coffeechat-1.jpg',
    width: 1024,
    height: 1448,
    headline: '먼저 가본 선배에게 1:1로 물어보세요',
    tagline: '같은 업종 현직 대표와 커피챗',
    lead: '혼자 내리던 첫 결정을, 같은 업종 선배와 마주 앉아 내립니다. 신청하시면 운영진이 같은 업종 현직 대표를 찾아 연결해 드려요.',
    facts: [
      ['대상', '업력 3년 이내 사장님 · 예비창업자'],
      ['방식', '같은 업종 현직 대표와 1:1 커피챗'],
      ['비용', '3만 원부터 (선배마다 다름)'],
      ['진행', '파일럿 모집 중 · 결제는 연결 뒤 안내'],
    ],
    sections: [
      { title: '이렇게 진행돼요', items: ['신청할 때 업종·업력과 묻고 싶은 것 1가지를 적어요', '운영진이 같은 업종 현직 대표를 찾아 연결해요', '일정이 정해지면 1:1로 만나 이야기해요'] },
      { title: '이런 분께 맞아요', items: ['업력 3년 이내 사장님', '창업을 준비 중인 예비창업자', '혼자 내리던 첫 결정이 막막한 분'] },
    ],
    howTo: '가입 신청할 때 업종·업력과 선배에게 묻고 싶은 것 1가지를 적어 주세요.',
    joinLabels: { field: '업종·업력', concern: '선배에게 묻고 싶은 것 1가지', concernPlaceholder: '예: 첫 직원을 언제 뽑아야 할지 모르겠어요' },
    closing: '먼저가본 — 선배의 경험이 후배에게 이어지도록.',
    createDefaults: {
      type: 'meetup',
      title: '먼저 가본 선배 1:1 커피챗 (파일럿)',
      description: '같은 업종 현직 대표에게 1:1로 물어보는 커피챗입니다.\n혼자 내리던 첫 결정을, 같은 업종 선배와 마주 앉아 내립니다.\n\n· 대상: 업력 3년 이내 사장님, 예비창업자\n· 비용: 3만 원부터 (선배마다 다름, 연결 뒤 안내)\n· 진행: 신청 → 운영진이 같은 업종 선배 연결 → 일정 확정 → 1:1 대화\n\n가입 신청할 때 업종·업력과 선배에게 묻고 싶은 것 1가지를 적어 주세요.',
      region: '부산', mode: 'offline', schedule: '신청 후 개별 일정', capacity: 0, joinPolicy: 'approval', cover: 'meetup',
    },
    houseAd: {
      alt: '부청사 × 먼저 가본. 먼저 가본 선배에게 1:1로 물어보세요. 같은 업종 현직 대표와 커피챗. 3만 원부터, 파일럿 모집. 커피챗 신청하기',
      banner: { image: '/assets/images/ads/senior-coffeechat-1-wide.jpg', mobile: '/assets/images/ads/senior-coffeechat-1-mobile.jpg', width: 1600, height: 400 },
      rect: { image: '/assets/images/ads/senior-coffeechat-1-rect.jpg', width: 600, height: 500 },
    },
  },
  'senior-host-1': {
    card: '/assets/images/groups/cards/card-host.jpg', // 먼저가본 개편: 목록 카드용 3:2 그림(Codex)
    label: '먼저 가본 선배 모집 포스터',
    image: '/assets/images/groups/poster-senior-host-1.jpg',
    width: 1024,
    height: 1448,
    headline: '당신의 경험이 누군가의 첫 결정을 바꿉니다',
    tagline: '먼저 가본 선배를 찾습니다',
    lead: '그동안 호의로 나누던 경험을, 선배가 정한 가격의 1:1 커피챗과 런치로 나눠 주세요.',
    facts: [
      ['대상', '업력 3년 이상 대표님'],
      ['방식', '1:1 커피챗 · 런치 호스트'],
      ['가격', '선배가 직접 정해요 (커피챗 3만 원부터)'],
      ['진행', '파일럿 선배 모집 중'],
    ],
    sections: [
      { title: '이렇게 함께해요', items: ['신청할 때 업종·업력과 나눌 수 있는 경험 1가지를 적어요', '운영진이 같은 업종 후배의 신청을 연결해 드려요', '편한 시간에 1:1로 만나 경험을 나눠요'] },
    ],
    howTo: '가입 신청할 때 업종·업력과 나눌 수 있는 경험 1가지를 적어 주세요.',
    joinLabels: { field: '업종·업력', concern: '나눌 수 있는 경험 1가지', concernPlaceholder: '예: 오프라인 매장을 온라인 판매로 넓힌 경험' },
    closing: '먼저가본 — 선배의 경험이 후배에게 이어지도록.',
    createDefaults: {
      type: 'meetup',
      title: '먼저 가본 선배 모집 (커피챗·런치 호스트)',
      description: '업력 3년 이상 대표님의 경험을 같은 업종 후배와 1:1로 나눠 주세요.\n\n· 방식: 1:1 커피챗, 런치 호스트\n· 가격: 선배가 직접 정해요 (커피챗 3만 원부터)\n· 진행: 신청 → 운영진이 같은 업종 후배 연결 → 일정 확정\n\n가입 신청할 때 업종·업력과 나눌 수 있는 경험 1가지를 적어 주세요.',
      region: '부산', mode: 'offline', schedule: '신청 후 개별 일정', capacity: 0, joinPolicy: 'approval', cover: 'networking',
    },
    houseAd: {
      alt: '부청사 × 먼저 가본. 당신의 경험이 누군가의 첫 결정을 바꿉니다. 먼저 가본 선배를 찾습니다. 1:1 커피챗, 런치 호스트. 선배로 참여하기',
      rect: { image: '/assets/images/ads/senior-host-1-rect.jpg', width: 600, height: 500 },
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
  'startup-mid-banner': 'senior-coffeechat-1',
  'news-list-native': 'senior-coffeechat-1',
};

/** 지금 광고로 거는 포스터(모집이 바뀌면 이 값과 위 목록만 바꾼다) */
export const HOUSE_AD_POSTER = 'bcsa-study-1';

export const groupPoster = (group) => (group?.poster && GROUP_POSTERS[group.poster]) || null;
