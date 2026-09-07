import React, { useState } from 'react';
import AdSlot, { hasAdSlot } from '../components/AdSlot';

/**
 * NewsView — 뉴스 페이지 (1단계: 목업 콘텐츠 그대로)
 *
 * bcsa_bento/news.html 목업을 그대로 이식한 정적 버전이다. 실제 지원사업 공고/경제뉴스를
 * 자동으로 수집해 보여주는 기능은 2단계(실데이터 연동)에서 추가할 예정이며,
 * 그 전까지는 목업과 동일한 예시 데이터를 보여준다(하단 안내 문구로 명시).
 */

const NOTICE_ITEMS = [
    { badge: '공고', title: '2026년 부산 청년창업 지원사업 2차 공고', meta: '부산시 공고 · 오늘' },
    { badge: '공고', title: '소상공인 정책자금 특별융자 접수, 이달 말 마감', meta: '중소벤처기업부 · 2일 전' },
    { badge: '공고', title: '부산 스마트상점 기술보급 지원사업 참여기업 모집', meta: '부산경제진흥원 · 3일 전' },
    { badge: '공고', title: '청년몰 입점 지원, 최대 500만원 인테리어비 지원', meta: '부산시 공고 · 5일 전', adAfter: true },
    { badge: '공고', title: '소상공인 디지털 전환 바우처 2차 신청 안내', meta: '소상공인시장진흥공단 · 1주 전' },
];

const ECON_ITEMS = [
    { badge: '경제', title: '한국은행 기준금리 동결, 소상공인 대출금리 영향은', meta: '지역경제뉴스 · 오늘' },
    { badge: '경제', title: '상가 임대차 갱신 5% 상한, 올해 달라진 점', meta: '지역경제뉴스 · 1일 전' },
    { badge: '경제', title: '간이과세 기준 매출 상향, 세금 부담 어떻게 바뀌나', meta: '지역경제뉴스 · 2일 전' },
    { badge: '경제', title: '배달앱 수수료 개편 논의, 자영업자 반응은', meta: '지역경제뉴스 · 4일 전' },
    { badge: '경제', title: '유동인구 데이터로 본 부산 상권 트렌드', meta: '지역경제뉴스 · 1주 전' },
];

const CATEGORIES = [
    { id: 'all', label: '전체' },
    { id: 'notice', label: '지원사업 · 공고' },
    { id: 'econ', label: '경제뉴스' },
];

function NewsRow({ item, isLast }) {
    const badgeClass = item.badge === '공고' ? 'bg-sky-500' : 'bg-orange-500';
    return (
        <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={`flex items-center justify-between gap-4 py-5 px-2 -mx-2 rounded-xl hover:bg-soft/70 transition-colors ${isLast ? '' : 'border-b border-black/[0.06]'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[11px] font-bold text-white shrink-0 whitespace-nowrap ${badgeClass}`}>{item.badge}</span>
                <p className="text-sm md:text-base font-semibold text-dark truncate">{item.title}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 ml-4">{item.meta}</span>
        </a>
    );
}

export default function NewsView({ content, onBack }) {
    const [category, setCategory] = useState('all');
    const showNotice = category === 'all' || category === 'notice';
    const showEcon = category === 'all' || category === 'econ';
    // 우측 배너 레일에 실제로 등록된 광고가 하나도 없으면 레일을 아예 접고 본문 폭을 넓힌다.
    const hasSidebarAd = hasAdSlot(content, 'news-sidebar-1') || hasAdSlot(content, 'news-sidebar-1b') || hasAdSlot(content, 'news-sidebar-2');

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 뉴스
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">NEWS</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">뉴스</h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">부산 창업가들이 놓치기 쉬운 소식을 한곳에 모았습니다.</p>
                    <div className="flex items-center gap-2 flex-wrap mt-8">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCategory(c.id)}
                                className={`text-xs font-semibold rounded-full px-3.5 py-2 transition-colors ${category === c.id ? 'text-white bg-brand' : 'text-gray-500 bg-soft hover:bg-[#eceef2]'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="pb-14 md:pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="xl:flex xl:gap-10 xl:items-start">
                        <div className="flex-1 min-w-0">
                            {showNotice ? (
                                <div className="pb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg md:text-xl font-bold text-dark">지원사업 · 공고 소식</h2>
                                        <span className="text-xs text-gray-400">최신순</span>
                                    </div>
                                    <div className="border-t border-black/[0.06]">
                                        {NOTICE_ITEMS.map((item, i) => (
                                            <React.Fragment key={item.title}>
                                                <NewsRow item={item} isLast={i === NOTICE_ITEMS.length - 1} />
                                                {item.adAfter ? <AdSlot slotId="news-list-native" content={content} className="my-1" /> : null}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {showEcon ? (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg md:text-xl font-bold text-dark">창업 · 경제뉴스</h2>
                                        <span className="text-xs text-gray-400">최신순</span>
                                    </div>
                                    <div className="border-t border-black/[0.06]">
                                        {ECON_ITEMS.map((item, i) => (
                                            <NewsRow key={item.title} item={item} isLast={i === ECON_ITEMS.length - 1} />
                                        ))}
                                    </div>
                                    <p className="text-center text-xs text-gray-400 mt-8">※ 위 항목은 준비 중인 예시 데이터입니다. 실제 뉴스/공고 자동 연동은 순차 적용될 예정입니다.</p>
                                </div>
                            ) : null}
                        </div>

                        {/* 우측 배너 광고 레일 — 구글 표준 300px 폭(300×250/300×600) 기준, 최대 3슬롯.
                            실제 광고 소재가 등록되기 전까지는 AdSlot이 아무것도 렌더링하지 않으므로
                            공간을 차지하지 않는다. xl(1280px) 미만에서는 본문 폭 확보를 위해 숨김. */}
                        {/* 160×600(와이드 스카이스크래퍼) 기준 폭 300px 레일 구성.
                            160+120=280px로 300px 폭에 딱 맞아, 옆에 남는 폭에 120×600(스카이스크래퍼)을
                            하나 더 붙였다. 구글 정책상 "한 번에 하나의 sticky 광고만" 허용되므로,
                            둘 중 메인 광고(160×600)만 스크롤을 따라가게 하고 나머지는 일반 흐름으로 둔다.
                            실제 등록된 광고가 하나도 없으면(hasSidebarAd=false) 레일 자체를 렌더링하지
                            않아서, 옆 본문(flex-1)이 그 폭만큼 자연스럽게 넓어진다. */}
                        {hasSidebarAd ? (
                            <aside className="hidden xl:block w-[300px] shrink-0 space-y-6">
                                <div className="flex items-start gap-3">
                                    <div className="sticky top-[76px]">
                                        <AdSlot slotId="news-sidebar-1" content={content} className="w-[160px] h-[600px]" showPlaceholder placeholderSize="160×600" />
                                    </div>
                                    <AdSlot slotId="news-sidebar-1b" content={content} className="w-[120px] h-[600px]" showPlaceholder placeholderSize="120×600" />
                                </div>
                                <AdSlot slotId="news-sidebar-2" content={content} className="w-[300px] h-[250px]" showPlaceholder placeholderSize="300×250" />
                            </aside>
                        ) : null}
                    </div>
                </div>
            </section>
        </div>
    );
}
