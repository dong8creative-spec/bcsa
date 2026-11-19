import React from 'react';
import { MgWrap, MgPageHead, MgSectionHead } from '../components/mg/Mg';

/**
 * RequestsView — 의뢰(B2B) 페이지 (1단계: 목업 콘텐츠 그대로)
 *
 * bcsa_bento/b2b.html 목업을 그대로 이식한 정적 버전이다. 실제 의뢰 등록/매칭 기능은
 * 2단계(실데이터 연동)에서 추가할 예정이며, 그 전까지는 목업과 동일한 예시 데이터를 보여준다.
 */

const REQUEST_ITEMS = [
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '📸', bg: '#E7A6A0', title: '카페 신메뉴 사진·숏폼 촬영 업체를 찾습니다', meta: '수영구 · 예산 70~100만원 · 18분 전' },
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '🎨', bg: '#EBBB8C', title: '브랜드 로고와 패키지 디자인 리뉴얼', meta: '동래구 · 예산 협의 · 2시간 전' },
    { badge: '신규', badgeClass: 'bg-[#0c0c0e]', emoji: '🧮', bg: '#E9D48C', title: '소규모 법인 월 기장 세무사 상담 요청', meta: '부산진구 · 직원 3명 · 오늘' },
    { badge: '견적 모집중', badgeClass: 'bg-brand', emoji: '🪧', bg: '#A9CB9B', title: '신규 매장 오픈 사인물·현수막 제작', meta: '해운대구 · 예산 50만원 내외 · 어제' },
    { badge: '신규', badgeClass: 'bg-[#0c0c0e]', emoji: '👥', bg: '#9DC3E0', title: '직원 채용 인쇄물 및 노무 자문 요청', meta: '연제구 · 협의 후 결정 · 어제' },
];

const PARTNERS = [
    { initial: 'V', bg: '#BFA8D9', name: 'VCML', category: '영상제작' },
    { initial: 'T', bg: '#C7C7CC', name: '부산 세무 파트너', category: '세무·법인' },
    { initial: 'D', bg: '#E7A6A0', name: '로컬 디자인 스튜디오', category: '브랜딩·패키지' },
    { initial: 'P', bg: '#EBBB8C', name: '부산 인쇄 파트너', category: '인쇄·사인물' },
];

export default function RequestsView({ onBack, goTo }) {
    return (
        <div className="min-h-screen overflow-y-auto bg-white">
            <MgPageHead
                crumbs={
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-white">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span> 의뢰
                    </>
                }
                eyebrow="REQUESTS"
                title={<>부산에서 필요한 일,<br />가장 확실한 파트너</>}
                desc="의뢰를 올리고 지역 파트너와 바로 연결되는 보드입니다."
            >
                <button
                    type="button"
                    onClick={() => alert('의뢰 등록 기능은 준비 중입니다. 조금만 기다려주세요!')}
                    className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-royal px-6 text-[16px] font-bold text-white transition-colors hover:bg-royalDark"
                >
                    의뢰 등록하기
                </button>
            </MgPageHead>

            <section className="py-14 md:py-20" aria-labelledby="req-list">
                <MgWrap>
                    <MgSectionHead id="req-list" title="지금 모집 중인 의뢰" extra={<span className="text-[13px] text-sub">최신순</span>} />
                    <ul className="mt-[26px] border-t border-[#0c0c0e]">
                        {REQUEST_ITEMS.map((item) => (
                            <li key={item.title} className="flex min-h-[72px] flex-col gap-2 border-b border-line py-5 md:flex-row md:items-center md:gap-6">
                                <span className={`inline-flex w-fit shrink-0 items-center px-2.5 py-1 text-[13px] text-white md:w-[96px] md:justify-center ${item.badgeClass}`}>{item.badge}</span>
                                <p className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-snug text-ink md:text-[17px]" title={item.title}>{item.title}</p>
                                <p className="truncate text-[14px] text-sub md:w-[300px] md:shrink-0 md:text-right">{item.meta}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-6 break-keep text-[13px] text-sub">※ 위 항목은 준비 중인 예시 데이터입니다. 실제 의뢰 등록/매칭 기능은 순차 적용될 예정입니다.</p>
                </MgWrap>
            </section>

            <section className="pb-16 pt-4 md:pb-[100px]" aria-labelledby="req-partners">
                <MgWrap>
                    <MgSectionHead
                        id="req-partners"
                        title="추천 부산 사업자"
                        extra={<button type="button" onClick={() => goTo('allMembers')} className="min-h-[44px] text-[15px] font-semibold text-royal hover:underline">전체 명단 보기 →</button>}
                    />
                    <div className="mt-[26px] grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
                        {PARTNERS.map((p) => (
                            <button
                                key={p.name}
                                type="button"
                                onClick={() => goTo('allMembers')}
                                className="flex h-full min-h-[132px] min-w-0 flex-col items-start rounded-xl bg-card px-4 pb-5 pt-5 text-left transition-colors hover:bg-[#e9edf3] md:min-h-[150px] md:px-6 md:pb-[30px] md:pt-[26px]"
                            >
                                <span className="mb-3 flex h-10 w-10 items-center justify-center bg-[#0c0c0e] text-[17px] font-bold text-white" aria-hidden="true">{p.initial}</span>
                                <span className="w-full truncate text-[16px] font-semibold text-ink md:text-[17px]">{p.name}</span>
                                <span className="mt-1 w-full truncate text-[14px] text-sub">{p.category || '\u00a0'}</span>
                            </button>
                        ))}
                    </div>
                </MgWrap>
            </section>
        </div>
    );
}
