/**
 * 기본 데이터 정의
 */

// 기본 콘텐츠 데이터
const defaultContent = {
    hero_title: "함께 성장하는\n청년 사업가 커뮤니티",
    hero_desc: "부산 지역 청년 사업가들이 모여 아이디어를 공유하고, 네트워킹하며 함께 성장해나가는 공간입니다.",
    stat_1_val: "200+", 
    stat_1_desc: "활동중인 사업가",
    stat_2_val: "80+", 
    stat_2_desc: "진행된 세미나",
    stat_3_val: "35+", 
    stat_3_desc: "투자 성공 사례",
    stat_4_val: "100%", 
    stat_4_desc: "성장 열정",
    cta_title: "사업의 꿈을 현실로!",
    cta_desc: "혼자 고민하지 마세요. 부산 최고의 청년 사업가들과 함께 당신의 비즈니스를 다음 단계로 끌어올리세요.",
    category_area_options: ["부산 전체", "해운대구 / IT", "부산진구 / 유통", "남구 / 금융"],
    category_activity_options: ["비즈니스 세미나", "투자 설명회", "네트워킹 파티", "멘토링"],
    category_target_options: ["예비/초기 창업가", "시리즈A 단계", "대학생", "일반인"],
};

// 기본 회원 데이터
const defaultMembersData = [
    { id: 1, name: "김민수", industry: "IT/소프트웨어", role: "CEO", company: "넥스트웨이브", img: "https://randomuser.me/api/portraits/men/32.jpg" },
    { id: 2, name: "이영희", industry: "유통/무역", role: "대표", company: "글로벌트레이드", img: "https://randomuser.me/api/portraits/women/44.jpg" },
    { id: 3, name: "박지성", industry: "제조업", role: "이사", company: "부산정밀", img: "https://randomuser.me/api/portraits/men/85.jpg" },
    { id: 4, name: "최수진", industry: "디자인", role: "프리랜서", company: "크리에이티브랩", img: "https://randomuser.me/api/portraits/women/65.jpg" },
];

// 기본 세미나 데이터
const defaultSeminarsData = [
    { id: 1, category: "투자/IR", title: "2025 상반기 스타트업 투자 트렌드", date: "2025.03.15", location: "부산 유라시아 플랫폼 104호", desc: "VC 심사역 초청, 2025년 주목해야 할 스타트업 트렌드와 투자 유치 전략 공유.", img: "https://images.unsplash.com/photo-1544531586-fde5298cdd40?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", currentParticipants: 142, maxParticipants: 150 },
    { id: 2, category: "네트워킹/모임", title: "부산 청년 창업가 네트워킹 나이트", date: "2025.03.22", location: "해운대 더베이 101 루프탑", desc: "부산 지역 청년 창업가들이 모여 자유롭게 네트워킹하고 협업 기회를 찾는 파티.", img: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", currentParticipants: 85, maxParticipants: 100 },
    { id: 3, category: "교육/세미나", title: "초기 창업가를 위한 세무/노무 특강", date: "2025.04.05", location: "부산창조경제혁신센터 3층", desc: "창업 초기에 꼭 알아야 할 세금 관리와 근로 계약서 작성법 실무 강의.", img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", currentParticipants: 20, maxParticipants: 50 },
].map(item => ({ ...item, status: calculateStatus(item.date) }));

// 기본 커뮤니티 게시글 데이터
const defaultCommunityPosts = [
    { id: 1, category: '공지사항', title: '부청사 커뮤니티 이용 가이드', author: '관리자', date: '2025.03.01', views: 120, content: '서로 존중하며 유익한 정보를 나누는 공간이 됩시다.', isSecret: false, password: 'admin', reply: null },
    { id: 2, category: '인력구인', title: '프론트엔드 개발자 구합니다 (React)', author: '김스타트', date: '2025.03.02', views: 45, content: '부산 센텀시티 근무, 경력 3년차 이상 구합니다.', isSecret: false, password: '123', reply: null },
    { id: 3, category: '세미나 후기', title: '지난 투자 세미나 정말 유익했습니다', author: '이성장', date: '2025.03.03', views: 30, content: '투자 심사역님의 피드백이 큰 도움이 되었습니다.', isSecret: false, password: '123', reply: "감사합니다. 다음 세미나도 기대해주세요!" },
    { id: 4, category: '건의사항', title: '다음 모임 장소 관련 건의드립니다', author: '박제안', date: '2025.03.04', views: 10, content: '비밀글입니다.', isSecret: true, password: '123', reply: null },
];
