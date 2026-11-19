import React, { Fragment } from 'react';
import { defaultContent } from '../constants/content';
import { MgWrap, MgPageHead, MgSectionHead, MgInfoCard } from '../components/mg/Mg';

const AboutView = ({ onBack, content, pageTitles }) => {
    // 연혁은 역사적 사실이므로 옛 이름(부청사·부산청년사업가들)을 그대로 둔다
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
        { en: 'NETWORKING', title: '네트워킹', sub: '지속적인 교류' },
        { en: 'COLLABORATION', title: '협업 기회', sub: '비즈니스 확장' },
        { en: 'EDUCATION', title: '실무 교육', sub: '역량 강화' },
        { en: 'SUPPORT', title: '심리 안정', sub: '고민 해결' },
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

    const moments = [
        { src: content.about_moment_1_image, alt: '비즈니스 세미나 현장' },
        { src: content.about_moment_2_image, alt: '사업가 네트워킹 현장' },
    ].filter((m) => m.src && m.src !== content.about_hero_image);

    const phone = content?.about_contact_phone || defaultContent.about_contact_phone;
    const email = content?.about_contact_email || defaultContent.about_contact_email;

    return (
        <div className="min-h-screen overflow-y-auto bg-white">
            {/* 1. 머리부분 */}
            <MgPageHead
                crumbs={
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-white">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span> 소개
                    </>
                }
                eyebrow="SINCE 2017"
                title={heroTitle}
                desc={content.about_hero_desc || "부산 지역 사업가들의 성장과 연결을 돕는 비즈니스 커뮤니티, 먼저가본입니다."}
            />

            {/* 2. 먼저가본은 이런 곳 */}
            <section className="py-14 md:py-20" aria-labelledby="about-platform">
                <MgWrap>
                    <div data-layout="page" className={`grid gap-8 md:gap-12 ${content.about_hero_image ? 'md:grid-cols-2 md:items-start' : ''}`}>
                        <div>
                            <MgSectionHead id="about-platform" title="Platform for Businessmen" />
                            <div className="mt-5 max-w-[620px] space-y-4 break-keep text-[16px] leading-[1.8] text-[#333] md:text-[17px]">
                                <p>{content.about_mission_desc_1 || "먼저가본은 정기적인 네트워킹과 실무 중심의 세미나를 통해 실질적인 도움을 제공합니다."}</p>
                                <p>{content.about_mission_desc_2 || "업종을 넘어선 협업과 정보 공유를 지원하며, 온·오프라인을 연계해 지속적인 비즈니스 확장을 돕습니다."}</p>
                                <p>{content.about_mission_desc_3 || "먼저가본은 단순한 모임을 넘어, 함께 성장하는 플랫폼입니다."}</p>
                            </div>
                        </div>
                        {content.about_hero_image ? (
                            <div className="aspect-[3/2] overflow-hidden border border-line bg-[#f6f6f6]">
                                <img
                                    src={content.about_hero_image}
                                    alt="먼저가본 소개"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        ) : null}
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-2.5 md:mt-10 md:grid-cols-4 md:gap-3">
                        {platformCards.map((item) => (
                            <MgInfoCard key={item.title} en={item.en} title={item.title} desc={item.sub} />
                        ))}
                    </div>
                </MgWrap>
            </section>

            {/* 3. 필요한 이유 */}
            <section className="py-10 md:py-[50px]" aria-labelledby="about-why">
                <MgWrap>
                    <MgSectionHead id="about-why" title="먼저가본이 필요한 이유" desc={content.about_why_subtitle || "혼자 고민하지 마세요. 함께하면 답이 보입니다."} />
                    <ol className="mt-[26px] border-t border-[#0c0c0e]">
                        {whyUs.map((item, idx) => (
                            <li key={item.title} className="grid grid-cols-[44px_1fr] gap-x-3 border-b border-line py-5 md:grid-cols-[64px_240px_1fr] md:items-baseline md:gap-x-6 md:py-6">
                                <span className="text-[15px] font-semibold text-royal md:text-[16px]">{String(idx + 1).padStart(2, '0')}</span>
                                <h3 className="min-w-0 truncate text-[17px] font-semibold leading-snug text-ink md:text-[18px]" title={item.title}>{item.title}</h3>
                                <p className="col-start-2 mt-1.5 line-clamp-2 min-h-[3.25em] break-keep text-[15px] leading-relaxed text-sub md:col-start-3 md:mt-0 md:text-[16px]">{item.desc || '\u00a0'}</p>
                            </li>
                        ))}
                    </ol>
                </MgWrap>
            </section>

            {/* 4. 함께하는 분들 */}
            <section className="py-10 md:py-[50px]" aria-labelledby="about-audience">
                <MgWrap>
                    <MgSectionHead id="about-audience" title="먼저가본과 함께하는 분들" desc="부산·경남 지역에서 사업을 운영하거나 창업을 준비하는 누구나 환영합니다" />
                    <div className="mt-[26px] grid gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
                        {audienceCards.map((item, idx) => (
                            <MgInfoCard key={item.title} en={String(idx + 1).padStart(2, '0')} title={item.title} desc={item.desc} />
                        ))}
                    </div>
                    <p className="mt-6 max-w-[760px] break-keep text-[15px] leading-relaxed text-sub">
                        먼저가본은 부산사업자모임·부산비즈니스모임·부산청년플랫폼으로서 마케팅 세미나, 정기 네트워킹, 창업 교육 등 실전 프로그램을 운영합니다. 경남 사업자·경남 자영업자도 함께하는 광역 비즈니스 커뮤니티입니다.
                    </p>
                </MgWrap>
            </section>

            {/* 5. 연혁 */}
            <section className="py-10 md:py-[50px]" aria-labelledby="about-history">
                <MgWrap>
                    <MgSectionHead id="about-history" title="걸어온 길" desc="2014년 기획부터 지금까지의 발자취입니다." />
                    <ol className="mt-[26px] border-t border-[#0c0c0e]">
                        {historyData.map((item) => (
                            <li key={item.year} className="grid grid-cols-[64px_1fr] gap-x-3 border-b border-line py-5 md:grid-cols-[120px_1fr] md:gap-x-6 md:py-6">
                                <span className={`text-[17px] font-bold md:text-[20px] ${item.latest ? 'text-royal' : 'text-ink'}`}>{item.year}</span>
                                <div className="min-w-0">
                                    <h3 className="truncate text-[17px] font-semibold leading-snug text-ink md:text-[18px]" title={item.title}>{item.title}</h3>
                                    <p className="mt-1.5 line-clamp-2 min-h-[3.25em] break-keep text-[15px] leading-relaxed text-sub md:text-[16px]">{item.desc || '\u00a0'}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </MgWrap>
            </section>

            {/* 6. 현장 사진 — 전용 사진이 등록된 경우에만 표시 (대표 사진을 반복해 채우지 않음) */}
            {moments.length > 0 ? (
                <section className="py-10 md:py-[50px]" aria-labelledby="about-moments">
                    <MgWrap>
                        <MgSectionHead id="about-moments" title="현장의 순간" />
                        <div className={`mt-[26px] grid gap-2.5 md:gap-3 ${moments.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                            {moments.map((m) => (
                                <div key={m.src} className="aspect-[3/2] overflow-hidden border border-line bg-[#f6f6f6]">
                                    <img
                                        src={m.src}
                                        alt={m.alt}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                            ))}
                        </div>
                    </MgWrap>
                </section>
            ) : null}

            {/* 7. 향후 계획 */}
            <section className="py-10 md:py-[50px]" aria-labelledby="about-future">
                <MgWrap>
                    <MgSectionHead id="about-future" title={content.about_future_title || "향후 계획 및 목표"} desc={content.about_future_subtitle || "먼저가본은 멈추지 않고 계속 성장합니다."} />
                    <div className="mt-[26px] grid gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
                        {futurePlans.map((plan) => (
                            <MgInfoCard key={plan.id} en={String(plan.id).padStart(2, '0')} title={plan.title} desc={plan.desc} />
                        ))}
                    </div>
                </MgWrap>
            </section>

            {/* 8. 문의 */}
            <section className="bg-sky py-10 md:py-[60px]" aria-labelledby="about-contact">
                <MgWrap>
                    <MgSectionHead id="about-contact" title="문의사항이 있으시면 언제든지 연락주세요" />
                    <dl className="mt-[26px] grid gap-2.5 sm:grid-cols-2 md:gap-3">
                        <div className="flex h-full min-h-[104px] min-w-0 flex-col justify-center rounded-xl border border-skyLine bg-white px-5 py-5 md:px-6">
                            <dt className="text-[14px] font-semibold text-royal">문의 전화</dt>
                            <dd className="mt-1.5 min-w-0">
                                <a href={`tel:${phone}`} className="block truncate text-[18px] font-semibold text-ink hover:text-royal md:text-[20px]">{phone}</a>
                            </dd>
                        </div>
                        <div className="flex h-full min-h-[104px] min-w-0 flex-col justify-center rounded-xl border border-skyLine bg-white px-5 py-5 md:px-6">
                            <dt className="text-[14px] font-semibold text-royal">이메일</dt>
                            <dd className="mt-1.5 min-w-0">
                                <a href={`mailto:${email}`} title={email} className="block truncate text-[18px] font-semibold text-ink hover:text-royal md:text-[20px]">{email}</a>
                            </dd>
                        </div>
                    </dl>
                </MgWrap>
            </section>
        </div>
    );
};

export default AboutView;
