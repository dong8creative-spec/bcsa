import React from 'react';
import { Icons } from '../components/Icons';
import { MgWrap, MgPageHead } from '../components/mg/Mg';

/**
 * UnderConstructionView — 아직 실제 기능/데이터 연동이 안 된 페이지용 공통 "공사중" 화면.
 *
 * 뉴스/의뢰/Q&A 페이지는 현재 실제 수집·등록 기능 없이 목업 예시 데이터만 보여주고 있어,
 * 방문자가 실제 정보로 오해하지 않도록 이 화면으로 대체한다. 실제 기능이 붙으면
 * App.jsx에서 해당 dispatch 줄만 원래 뷰(NewsView/RequestsView/QnaView 등)로 되돌리면 된다.
 *
 * @param {string} eyebrow - 상단 소문구 (예: 'NEWS')
 * @param {string} pageLabel - 브레드크럼에 표시할 페이지 이름 (예: '뉴스')
 * @param {string} [title] - 안내 제목
 * @param {string} [desc] - 안내 설명
 * @param {Function} onBack - 홈으로 이동하는 핸들러
 */
export default function UnderConstructionView({ eyebrow, pageLabel, title, desc, onBack }) {
    return (
        <div className="min-h-screen overflow-y-auto bg-white">
            <MgPageHead
                crumbs={
                    <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-white">홈</button>
                        <span className="mx-1.5" aria-hidden="true">/</span> {pageLabel}
                    </>
                }
                eyebrow={eyebrow}
                title={title || '공사중입니다'}
            />
            <section className="py-14 md:py-20">
                <MgWrap>
                    <div className="rounded-xl bg-card px-5 py-10 text-center md:px-10 md:py-14">
                        <Icons.Settings className="mx-auto mb-4 h-8 w-8 text-royal" aria-hidden="true" />
                        <p className="mx-auto max-w-[520px] break-keep text-[16px] leading-relaxed text-[#333] md:text-[18px]">{desc || '더 나은 모습으로 준비해서 곧 찾아뵙겠습니다.'}</p>
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }}
                            className="mt-8 inline-flex h-[52px] items-center justify-center rounded-lg bg-[#1a1a1a] px-8 text-[16px] font-bold tracking-tight text-white transition-colors hover:bg-black"
                        >
                            홈으로 돌아가기
                        </button>
                    </div>
                </MgWrap>
            </section>
        </div>
    );
}
