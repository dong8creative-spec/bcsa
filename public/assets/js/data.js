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
    // 이미지 URL 필드
    hero_image: "",
    features_image_1: "",
    features_image_2: "",
    activity_seminar_image: "",
    activity_investment_image: "",
    activity_networking_image: "",
    donation_image: "",
    cta_image: "",
};

// 기본 회원 데이터 (테스트 데이터 제거됨 - CSV 또는 localStorage에서 로드)
const defaultMembersData = [];

// 기본 세미나 데이터 (테스트 데이터 제거됨 - CSV 또는 localStorage에서 로드)
const defaultSeminarsData = [].map(item => ({ ...item, status: calculateStatus(item.date) }));

// 기본 커뮤니티 게시글 데이터 (테스트 데이터 제거됨 - Google Apps Script API 또는 localStorage에서 로드)
const defaultCommunityPosts = [];
