import React, { Fragment } from 'react';
import { Icons } from '../components/Icons';

const AboutView = ({ onBack, content, pageTitles }) => {
    const historyData = [
        { year: "2014", title: content.about_history_2014_title || "지주회사 설립 기획", desc: content.about_history_2014_desc || "부산청년사업가들 필요성 검토 및 기획" },
        { year: "2017", title: content.about_history_2017_title || "커뮤니티 구축", desc: content.about_history_2017_desc || "회원간 소통 내부망 구축 및 카카오 오픈채팅방 개설" },
        { year: "2018", title: content.about_history_2018_title || "첫 오프라인 활동", desc: content.about_history_2018_desc || "창업자들을 위한 첫 세미나 개최 및 네트워킹 모임 운영" },
        { year: "2024", title: content.about_history_2024_title || "정기 세미나 구축", desc: content.about_history_2024_desc || "창업/세무/마케팅 교육 프로그램 및 정기 모임 활성화" },
        { year: "2025", title: content.about_history_2025_title || "비영리 법인 설립", desc: content.about_history_2025_desc || "공식 단체 법인화 및 온라인 플랫폼(어플) 개발 추진" },
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
        { icon: Icons.Smile || Icons.Heart, title: content.about_why_1_title || "고립감/압박감 해소", desc: content.about_why_1_desc || "같은 길을 걷는 동료들과 고민을 나누는 심리적 안전망" },
        { icon: Icons.Shield, title: content.about_why_2_title || "번아웃 방지", desc: content.about_why_2_desc || "일과 삶의 균형을 찾고 리프레시할 수 있는 기회 제공" },
        { icon: Icons.TrendingUp || Icons.ArrowUp, title: content.about_why_3_title || "성장의 한계 극복", desc: content.about_why_3_desc || "다양한 경험 공유를 통해 새로운 인사이트와 협업 기회 획득" },
        { icon: Icons.Users, title: content.about_why_4_title || "네트워크 확장", desc: content.about_why_4_desc || "투자자, 고객, 파트너를 만나 실질적인 비즈니스 기회 창출" }
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-slate-800">
            {/* 1. Hero Section */}
            <section className="pt-32 pb-16 px-6 bg-gray-50 border-b border-gray-100">
                <div className="container mx-auto max-w-3xl text-center">
                    <div className="flex justify-center mb-4 animate-fade-in-up">
                        <div className="inline-block px-4 py-1.5 bg-blue-100 text-brand rounded-full text-sm font-bold shadow-sm">
                            Since 2017
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-dark mb-6 leading-tight break-keep animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                        {content.about_hero_title ? (
                            <Fragment>
                                {content.about_hero_title.split(' ').map((word, idx, arr) => (
                                    <span key={idx}>
                                        {word.includes('사업가') || word.includes('네트워크') ? <span className="text-brand">{word}</span> : word}
                                        {idx < arr.length - 1 && ' '}
                                        {word === '함께' && <br className="md:hidden"/>}
                                    </span>
                                ))}
                            </Fragment>
                        ) : (
                            <Fragment>함께 성장하는 <br className="md:hidden"/> <span className="text-brand">사업가 네트워크</span></Fragment>
                        )}
                    </h1>
                    <p className="text-lg text-gray-600 max-w-xl mx-auto break-keep mb-10 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                        {content.about_hero_desc || "부산 지역 청년 사업가들의 성장과 연결을 돕는 비즈니스 커뮤니티, 부청사입니다."}
                    </p>
                    <div className="w-full rounded-3xl overflow-hidden shadow-xl relative animate-fade-in-up bg-gray-100 mx-auto" style={{aspectRatio: '16/9', animationDelay: '0.3s'}}>
                        {content.about_hero_image && (
                            <img 
                                src={content.about_hero_image} 
                                alt="부청사 소개" 
                                className="w-full h-full object-cover"
                                onError={(e) => {e.target.style.display='none'}}
                            />
                        )}
                        <div className="absolute inset-0 bg-brand/20 mix-blend-multiply"></div>
                    </div>
                </div>
                </section>

            {/* 2. Mission & Intro */}
            <section className="py-20 px-6 bg-white">
                <div className="container mx-auto max-w-4xl">
                    <div className="flex flex-col md:flex-row gap-10 items-center">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-dark mb-6">
                                {content.about_mission_title ? (
                                    <Fragment>
                                        {content.about_mission_title.split(' ').map((word, idx) => (
                                            <span key={idx}>
                                                {word === 'Businessmen' ? <span className="text-brand">{word}</span> : word}
                                                {idx < content.about_mission_title.split(' ').length - 1 && ' '}
                                                {word === 'for' && <br/>}
                                            </span>
                                        ))}
                                    </Fragment>
                                ) : (
                                    <Fragment>Platform for <br/><span className="text-brand">Businessmen</span></Fragment>
                                )}
                            </h2>
                            <div className="space-y-4 text-gray-600 leading-relaxed text-justify break-keep text-sm md:text-base">
                                <p>
                                    {content.about_mission_desc_1 || "부산청년사업가들은 정기적인 네트워킹과 실무 중심의 세미나를 통해 실질적인 도움을 제공합니다."}
                                </p>
                                <p>
                                    {content.about_mission_desc_2 || "업종을 넘어선 협업과 정보 공유를 지원하며, 온·오프라인을 연계해 지속적인 비즈니스 확장을 돕습니다."}
                                </p>
                                <p>
                                    {content.about_mission_desc_3 || "부청사는 단순한 모임을 넘어, 함께 성장하는 플랫폼입니다."}
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                            {[
                                {icon: Icons.Users, title: "네트워킹", sub: "지속적인 교류"},
                                {icon: Icons.Zap || Icons.Bolt, title: "협업 기회", sub: "비즈니스 확장"},
                                {icon: Icons.Target || Icons.ArrowUp, title: "실무 교육", sub: "역량 강화"},
                                {icon: Icons.Shield, title: "심리 안정", sub: "고민 해결"},
                            ].map((item, idx) => (
                                <div key={idx} className="bg-gray-50 p-5 rounded-xl text-center border border-gray-200 hover:border-brand/10 transition-colors">
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand mx-auto mb-2 shadow-sm border border-gray-100">
                                        {React.createElement(item.icon, { size: 20 })}
                                    </div>
                                    <h3 className="font-bold text-dark text-sm">{item.title}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                            </div>
                        ))}
                        </div>
                    </div>
                    </div>
                </section>

            {/* 3. Why We Need It */}
            <section className="py-20 px-6 bg-slate-50 border-y border-gray-100">
                <div className="container mx-auto max-w-5xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-dark mb-2">
                            {content.about_why_title ? (
                                <Fragment>
                                    {content.about_why_title.split(' ').map((word, idx) => (
                                        <span key={idx}>
                                            {word === '필요한' ? <span className="text-brand">{word}</span> : word}
                                            {idx < content.about_why_title.split(' ').length - 1 && ' '}
                                        </span>
                                    ))}
                                </Fragment>
                            ) : (
                                <Fragment>'부청사'가 <span className="text-brand">필요한 이유</span></Fragment>
                            )}
                        </h2>
                        <p className="text-gray-500 text-sm">{content.about_why_subtitle || "혼자 고민하지 마세요. 함께하면 답이 보입니다."}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {whyUs.map((item, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-brand/20 group">
                                <div className="w-12 h-12 bg-brand/5 text-brand rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand group-hover:text-white transition-colors">
                                    {React.createElement(item.icon, { size: 24 })}
                                </div>
                                <h3 className="text-lg font-bold text-dark mb-2 break-keep">{item.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed break-keep">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    </div>
                </section>

            {/* 4. History */}
            <section className="py-20 px-6 bg-white overflow-hidden">
                <div className="container mx-auto max-w-3xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-dark">{content.about_history_title || "HISTORY"}</h2>
                        <p className="text-gray-500 mt-2 text-sm">{content.about_history_subtitle || "부산청년사업가들이 걸어온 길"}</p>
                                            </div>
                    <div className="relative timeline-line pl-0 md:pl-0">
                        <div className="absolute left-[18px] md:left-1/2 top-0 bottom-0 w-0.5 bg-gray-100 transform md:-translate-x-1/2"></div>
                        {historyData.map((item, idx) => (
                            <div key={idx} className={`flex flex-col md:flex-row items-start md:items-center justify-between mb-10 relative z-10 ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                                <div className={`pl-12 md:pl-0 w-full md:w-5/12 ${idx % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                                    <div className="text-3xl font-black text-brand/20 mb-1 font-pop">{item.year}</div>
                                    <h3 className="text-lg font-bold text-dark mb-0.5">{item.title}</h3>
                                    <p className="text-gray-500 text-xs">{item.desc}</p>
                                        </div>
                                <div className="absolute left-[10px] md:left-1/2 top-2 md:top-auto w-4 h-4 bg-brand rounded-full border-4 border-white shadow-md transform md:-translate-x-1/2"></div>
                                <div className="hidden md:block w-5/12"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            {/* 5. Future Plans */}
            <section className="py-20 px-6 bg-gray-50 border-y border-gray-100">
                <div className="container mx-auto max-w-5xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-dark mb-3">{content.about_future_title || "향후 계획 및 목표"}</h2>
                        <p className="text-gray-500 text-sm">{content.about_future_subtitle || "부청사는 멈추지 않고 계속 성장합니다."}</p>
                                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {futurePlans.map((plan) => (
                            <div key={plan.id} className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="text-4xl font-black text-gray-100 mb-3 font-pop">{String(plan.id).padStart(2, '0')}</div>
                                <h3 className="text-lg font-bold text-dark mb-2">{plan.title}</h3>
                                <p className="text-gray-600 text-xs leading-relaxed break-keep">{plan.desc}</p>
                            </div>
                        ))}
                    </div>
                    </div>
                </section>

            {/* 6. Contact */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="container mx-auto max-w-3xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-dark mb-2">CONTACT</h2>
                        <p className="text-gray-500 text-sm">문의사항이 있으시면 언제든지 연락주세요</p>
                    </div>
                    <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm flex-1 flex flex-col items-center border border-gray-100 hover:border-brand/30 transition-all hover:shadow-md">
                            <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-3">
                                <Icons.Phone size={24} />
                        </div>
                            <h3 className="font-bold text-gray-500 mb-1 text-sm">문의 전화</h3>
                            <p className="text-xl font-bold text-dark">{content.about_contact_phone || "010-5323-9310"}</p>
                    </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm flex-1 flex flex-col items-center border border-gray-100 hover:border-brand/30 transition-all hover:shadow-md">
                            <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-3">
                                <Icons.Mail size={24} />
                            </div>
                            <h3 className="font-bold text-gray-500 mb-1 text-sm">이메일</h3>
                            <p className="text-xl font-bold text-dark">{content.about_contact_email || "pujar@naver.com"}</p>
                        </div>
            </div>
                </div>
            </section>
        </div>
    );
};

export default AboutView;
