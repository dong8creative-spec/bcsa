import React from 'react';
import { Icons } from '../components/Icons';

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
        <div className="min-h-screen bg-white overflow-y-auto">
            <section
                className="pt-32 pb-24 md:pt-40 md:pb-32 px-6 text-center relative overflow-hidden"
                style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}
            >
                <div className="container mx-auto max-w-2xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> {pageLabel}
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-6">{eyebrow}</p>
                    <div className="w-16 h-16 rounded-2xl bg-soft flex items-center justify-center mx-auto mb-6">
                        <Icons.Settings className="w-8 h-8 text-gray-400" />
                    </div>
                    <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight text-dark break-keep mb-4">{title || '공사중입니다'}</h1>
                    <p className="text-base md:text-lg text-gray-500 max-w-md mx-auto break-keep mb-10">{desc || '더 나은 모습으로 준비해서 곧 찾아뵙겠습니다.'}</p>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }}
                        className="inline-flex px-6 py-3 bg-brand text-white font-semibold rounded-full text-sm hover:bg-[#00327a] transition-colors"
                    >
                        홈으로 돌아가기
                    </button>
                </div>
            </section>
        </div>
    );
}
