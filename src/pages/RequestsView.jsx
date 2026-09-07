import React from 'react';

/**
 * RequestsView — 의뢰(B2B) 페이지 (1단계: 목업 콘텐츠 그대로)
 *
 * bcsa_bento/b2b.html 목업을 그대로 이식한 정적 버전이다. 실제 의뢰 등록/매칭 기능은
 * 2단계(실데이터 연동)에서 추가할 예정이며, 그 전까지는 목업과 동일한 예시 데이터를 보여준다.
 */

const REQUEST_ITEMS = [
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '📸', bg: '#E7A6A0', title: '카페 신메뉴 사진·숏폼 촬영 업체를 찾습니다', meta: '수영구 · 예산 70~100만원 · 18분 전' },
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '🎨', bg: '#EBBB8C', title: '브랜드 로고와 패키지 디자인 리뉴얼', meta: '동래구 · 예산 협의 · 2시간 전' },
    { badge: '신규', badgeClass: 'bg-red-500', emoji: '🧮', bg: '#E9D48C', title: '소규모 법인 월 기장 세무사 상담 요청', meta: '부산진구 · 직원 3명 · 오늘' },
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '🪧', bg: '#A9CB9B', title: '신규 매장 오픈 사인물·현수막 제작', meta: '해운대구 · 예산 50만원 내외 · 어제' },
    { badge: '신규', badgeClass: 'bg-red-500', emoji: '👥', bg: '#9DC3E0', title: '직원 채용 인쇄물 및 노무 자문 요청', meta: '연제구 · 협의 후 결정 · 어제' },
];

const PARTNERS = [
    { initial: 'V', bg: '#BFA8D9', name: 'VCML', category: '영상제작' },
    { initial: 'T', bg: '#C7C7CC', name: '부산 세무 파트너', category: '세무·법인' },
    { initial: 'D', bg: '#E7A6A0', name: '로컬 디자인 스튜디오', category: '브랜딩·패키지' },
    { initial: 'P', bg: '#EBBB8C', name: '부산 인쇄 파트너', category: '인쇄·사인물' },
];

export default function RequestsView({ onBack, goTo }) {
    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 의뢰
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">REQUESTS</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">
                        부산에서 필요한 일,<br />가장 확실한 파트너
                    </h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">
                        의뢰를 올리고 지역 파트너와 바로 연결되는 보드입니다.
                    </p>
                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={() => alert('의뢰 등록 기능은 준비 중입니다. 조금만 기다려주세요!')}
                            className="bg-brand hover:bg-[#00327a] transition-colors text-white font-semibold rounded-full px-6 py-3 text-sm"
                        >
                            의뢰 등록하기
                        </button>
                    </div>
                </div>
            </section>

            <section className="pb-10 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-semibold text-dark">지금 모집 중인 의뢰</h2>
                        <span className="text-xs text-gray-400">최신순</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
                        {REQUEST_ITEMS.map((item) => (
                            <a
                                key={item.title}
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="group shrink-0 w-[220px] sm:w-[240px] transition-transform duration-300 hover:-translate-y-1"
                            >
                                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3 grid place-items-center text-4xl" style={{ background: item.bg }}>
                                    <span className={`absolute top-3 left-3 inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap ${item.badgeClass}`}>{item.badge}</span>
                                    <span className="opacity-20">{item.emoji}</span>
                                </div>
                                <p className="text-sm font-semibold leading-snug break-keep line-clamp-2 min-h-[2.5em] text-dark group-hover:text-brand transition-colors">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.meta}</p>
                            </a>
                        ))}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-8">※ 위 항목은 준비 중인 예시 데이터입니다. 실제 의뢰 등록/매칭 기능은 순차 적용될 예정입니다.</p>
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-semibold text-dark">추천 부산 사업자</h2>
                        <button type="button" onClick={() => goTo('allMembers')} className="text-xs text-brand font-semibold">전체 명단 보기 →</button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
                        {PARTNERS.map((p) => (
                            <button
                                key={p.name}
                                type="button"
                                onClick={() => goTo('allMembers')}
                                className="shrink-0 w-[160px] sm:w-[180px] text-center"
                            >
                                <div className="rounded-2xl aspect-square mb-2.5 grid place-items-center text-2xl font-bold text-dark" style={{ background: p.bg }}>{p.initial}</div>
                                <p className="text-xs font-semibold text-dark truncate">{p.name}</p>
                                <p className="text-[11px] text-gray-500">{p.category}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
