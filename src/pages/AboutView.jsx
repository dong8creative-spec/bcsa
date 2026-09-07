import React, { Fragment } from 'react';
import { defaultContent } from '../constants/content';

const AboutView = ({ onBack, content, pageTitles }) => {
    const historyData = [
        { year: "2014", title: content.about_history_2014_title || "지주회사 설립 기획", desc: content.about_history_2014_desc || "부산청년사업가들 필요성 검토 및 기획", latest: false },
        { year: "2017", title: content.about_history_2017_title || "커뮤니티 구축", desc: content.about_history_2017_desc || "회원간 소통 내부망 구축 및 오픈채팅방 개설", latest: false },
        { year: "2018", title: content.about_history_2018_title || "첫 오프라인 활동", desc: content.about_history_2018_desc || "창업자들을 위한 첫 세미나 개최 및 네트워킹 모임 운영", latest: false },
        { year: "2024", title: content.about_history_2024_title || "정기 세미나 구축", desc: content.about_history_2024_desc || "창업/세무/마케팅 교육 프로그램 및 정기 모임 활성화", latest: false },
        { year: "2025", title: content.about_history_2025_title || "비영리 법인 설립", desc: content.about_history_2025_desc || "공식 단체 법인화 및 온라인 플랫폼(어플) 개발 추진", latest: true },
    ];

    const futurePlans = [
        { id: 1, title: content.about_future_1_title || "맞춤형 역량 교육", desc: content.about_future_1_desc || "창업 단계별 실무 교육(세무, 마케팅 등)과 멘토링 강화" },
        { id: 2, title: content.about_future_2_title || "공공사업 연계", desc: content.about_future_2_desc || "정부·지자체 사업과 협력하여 실질적 혜택 제공" },
        { id: 3, title: content.about_future_3_title || "온라인 플랫폼", desc: content.about_future_3_desc || "회원들이 연결되고 협업할 수 있는 전용 앱/웹 구축" },
        { id: 4, title: content.about_future_4_title || "사회공헌 활동", desc: content.about_future_4_desc || "멘토링, 재능기부 등 지역사회와 상생하는 프로그램" },
        { id: 5, title: content.about_future_5_title || "정책 제안", desc: content.about_future_5_desc || "부산 청년 창업가 실태조사 기반 맞춤형 정책 제안" },
        { id: 6, title: content.about_future_6_title || "자체 수익모델", desc: content.about_future_6_desc || "교육 콘텐츠, 굿즈 등 지속가능한 운영 기반 마련" },
    ];

    const whyUs = [
        { title: content.about_why_1_title || "고립감·압박감 해소", desc: content.about_why_1_desc || "같은 길을 걷는 동료들과 고민을 나누는 심리적 안전망" },
        { title: content.about_why_2_title || "번아웃 방지", desc: content.about_why_2_desc || "일과 삶의 균형을 찾고 리프레시할 수 있는 기회 제공" },
        { title: content.about_why_3_title || "성장의 한계 극복", desc: content.about_why_3_desc || "다양한 경험 공유를 통해 새로운 인사이트와 협업 기회 획득" },
        { title: content.about_why_4_title || "네트워크 확장", desc: content.about_why_4_desc || "투자자, 고객, 파트너를 만나 실질적인 비즈니스 기회 창출" },
    ];

    const platformCards = [
        { emoji: '🤝', title: '네트워킹', sub: '지속적인 교류' },
        { emoji: '⚡', title: '협업 기회', sub: '비즈니스 확장' },
        { emoji: '🎯', title: '실무 교육', sub: '역량 강화' },
        { emoji: '🛡️', title: '심리 안정', sub: '고민 해결' },
    ];

    const audienceCards = [
        { title: "부산 청년 사업가·자영업자", desc: "부산에서 사업체를 운영 중인 청년 사업가, 자영업자, 소상공인" },
        { title: "경남 사업자·자영업자", desc: "경남 지역에서 사업을 운영하거나 부산·경남 창업을 준비 중인 분" },
        { title: "예비 창업자", desc: "부산·경남에서 창업을 계획 중이며 실전 정보와 네트워크가 필요한 분" },
        { title: "비즈니스 네트워크 확장", desc: "업종을 넘어 새로운 파트너·고객·투자자를 만나고 싶은 사업자" },
    ];

    const heroTitle = (() => {
        const t = (content.about_hero_title || '').trim();
        if (t.startsWith('함께 성장하는')) {
            const rest = t.slice('함께 성장하는'.length).trim() || '사업가 네트워크';
            return <Fragment>함께 성장하는<br />{rest}</Fragment>;
        }
        if (t) return t;
        return <Fragment>함께 성장하는<br />사업가 네트워크</Fragment>;
    })();

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            {/* 1. Hero */}
            <section className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 bg-white">
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 소개
                    </p>
                    <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                        <div>
                            <p className="text-[13px] font-bold text-brand tracking-wide mb-4">SINCE 2017</p>
                            <h1 className="text-[32px] leading-[1.2] md:text-[48px] md:leading-[1.12] font-semibold tracking-tight text-dark break-keep">
                                {heroTitle}
                            </h1>
                            <p className="mt-5 text-base md:text-lg text-gray-500 max-w-md break-keep">
                                {content.about_hero_desc || "부산 지역 청년 사업가들의 성장과 연결을 돕는 비즈니스 커뮤니티, 부청사입니다."}
                            </p>
                        </div>
                        <div className="rounded-[28px] overflow-hidden aspect-[4/3] bg-soft">
                            {content.about_hero_image ? (
                                <img
                                    src={content.about_hero_image}
                                    alt="부청사 소개"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. Platform for Businessmen */}
            <section className="px-6 py-14 md:py-20 bg-soft">
                <div className="container mx-auto max-w-7xl grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <div>
                        <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark mb-5 break-keep">Platform for <span className="text-brand">Businessmen</span></h2>
                        <div className="space-y-4 text-gray-500 text-sm md:text-base leading-relaxed break-keep">
                            <p>{content.about_mission_desc_1 || "부산청년사업가들은 정기적인 네트워킹과 실무 중심의 세미나를 통해 실질적인 도움을 제공합니다."}</p>
                            <p>{content.about_mission_desc_2 || "업종을 넘어선 협업과 정보 공유를 지원하며, 온·오프라인을 연계해 지속적인 비즈니스 확장을 돕습니다."}</p>
                            <p>{content.about_mission_desc_3 || "부청사는 단순한 모임을 넘어, 함께 성장하는 플랫폼입니다."}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {platformCards.map((item) => (
                            <div key={item.title} className="bg-white rounded-2xl p-5 text-center border border-black/[0.06]">
                                <div className="w-10 h-10 bg-soft rounded-full flex items-center justify-center text-lg mx-auto mb-2.5">{item.emoji}</div>
                                <h3 className="font-semibold text-dark text-sm">{item.title}</h3>
                                <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3. Why We Need It */}
            <section className="px-6 py-14 md:py-20 bg-white">
                <div className="container mx-auto max-w-7xl text-center">
                    <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark mb-2 break-keep">'부청사'가 <span className="text-brand">필요한 이유</span></h2>
                    <p className="text-gray-500 text-sm md:text-base mb-10">{content.about_why_subtitle || "혼자 고민하지 마세요. 함께하면 답이 보입니다."}</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                        {whyUs.map((item) => (
                            <div key={item.title} className="bg-soft rounded-2xl p-6">
                                <h3 className="font-semibold text-dark mb-2 break-keep">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed break-keep">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. Who We Are For */}
            <section className="px-6 py-14 md:py-20 bg-soft">
                <div className="container mx-auto max-w-7xl">
                    <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark mb-2 break-keep">부청사와 <span className="text-brand">함께하는 분들</span></h2>
                    <p className="text-gray-500 text-sm md:text-base mb-10 break-keep">부산·경남 지역에서 사업을 운영하거나 창업을 준비하는 누구나 환영합니다</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                        {audienceCards.map((item, idx) => (
                            <div key={item.title} className="bg-white rounded-2xl p-6 border border-black/[0.06]">
                                <p className="text-[13px] font-bold text-brand mb-3">{String(idx + 1).padStart(2, '0')}</p>
                                <h3 className="font-semibold text-dark mb-2 break-keep">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed break-keep">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 leading-relaxed break-keep max-w-3xl">
                        부청사(부산청년사업가들)는 부산사업자모임·부산비즈니스모임·부산청년플랫폼으로서 마케팅 세미나, 정기 네트워킹, 창업 교육 등 실전 프로그램을 운영합니다. 경남 사업자·경남 자영업자도 함께하는 광역 비즈니스 커뮤니티입니다.
                    </p>
                </div>
            </section>

            {/* 5. History */}
            <section className="px-6 py-14 md:py-20 bg-white">
                <div className="container mx-auto max-w-7xl">
                    <div className="grid md:grid-cols-[280px_1fr] gap-10 md:gap-16">
                        <div>
                            <p className="text-[12px] font-semibold text-brand tracking-wide mb-2">HISTORY</p>
                            <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark break-keep">부산청년사업가들이<br />걸어온 길</h2>
                        </div>
                        <div className="relative space-y-9 pl-7" style={{ borderLeft: '1px solid rgba(0,0,0,.08)' }}>
                            {historyData.map((item) => (
                                <div key={item.year} className="relative">
                                    <span
                                        className="absolute -left-[31px] top-1.5 w-[11px] h-[11px] rounded-full bg-white"
                                        style={{ border: `2px solid #0046a5`, background: item.latest ? '#0046a5' : '#fff' }}
                                    />
                                    <p className="text-sm font-bold text-brand mb-1">{item.year}</p>
                                    <h3 className="font-semibold text-dark mb-1 break-keep">{item.title}</h3>
                                    <p className="text-sm text-gray-500 break-keep">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. Moments */}
            <section className="px-6 py-14 md:py-20 bg-soft">
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12px] font-semibold text-gray-500 tracking-wide mb-2">MOMENTS</p>
                    <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark mb-8 break-keep">현장의 순간</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="rounded-[24px] overflow-hidden aspect-[16/10] bg-white">
                            {(content.about_moment_1_image || content.about_hero_image) ? (
                                <img
                                    src={content.about_moment_1_image || content.about_hero_image}
                                    alt="비즈니스 세미나 현장"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : null}
                        </div>
                        <div className="rounded-[24px] overflow-hidden aspect-[16/10] bg-white">
                            {(content.about_moment_2_image || content.about_hero_image) ? (
                                <img
                                    src={content.about_moment_2_image || content.about_hero_image}
                                    alt="사업가 네트워킹 현장"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. Future Plans */}
            <section className="px-6 py-14 md:py-20 text-white" style={{ backgroundColor: '#0b0b0c' }}>
                <div className="container mx-auto max-w-7xl">
                    <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-2 break-keep">{content.about_future_title || "향후 계획 및 목표"}</h2>
                    <p className="text-white/50 text-sm md:text-base mb-10">{content.about_future_subtitle || "부청사는 멈추지 않고 계속 성장합니다."}</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {futurePlans.map((plan) => (
                            <div key={plan.id} className="bg-white/[0.06] rounded-2xl p-6">
                                <p className="text-[13px] font-bold text-white/40 mb-3">{String(plan.id).padStart(2, '0')}</p>
                                <h3 className="font-semibold mb-2 break-keep">{plan.title}</h3>
                                <p className="text-sm text-white/60 leading-relaxed break-keep">{plan.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. Contact */}
            <section className="px-6 py-14 md:py-20 bg-white text-center">
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12px] font-semibold text-gray-500 tracking-wide mb-2">CONTACT</p>
                    <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight text-dark mb-9 break-keep">문의사항이 있으시면 언제든지 연락주세요</h2>
                    <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
                        <div>
                            <p className="text-[12px] font-semibold text-gray-500 tracking-wide mb-1.5">문의 전화</p>
                            <a href={`tel:${content?.about_contact_phone || defaultContent.about_contact_phone}`} className="text-lg md:text-xl font-semibold text-dark hover:text-brand transition-colors">{content?.about_contact_phone || defaultContent.about_contact_phone}</a>
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-gray-500 tracking-wide mb-1.5">이메일</p>
                            <a href={`mailto:${content?.about_contact_email || defaultContent.about_contact_email}`} className="text-lg md:text-xl font-semibold text-dark hover:text-brand transition-colors">{content?.about_contact_email || defaultContent.about_contact_email}</a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AboutView;
