/**
 * 프로그램 팝업을 별도 창에서만 보여주는 전용 페이지.
 * 메인 앱에서 window.open('/program-popup')으로 열며, 동일한 카드 UI와 24시간 숨김/신청하기 동작을 지원합니다.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { buildProgramPopupItems } from '../appHelpers';

const POPUP_HIDE_UNTIL_KEY = 'busan_ycc_popup_hide_until';

export default function ProgramPopupWindowView({
    seminarsData = [],
    externalEventPosters = [],
    appliedProgramIds = new Set(),
}) {
    const navigate = useNavigate();
    const upcomingPrograms = useMemo(
        () => buildProgramPopupItems(seminarsData, externalEventPosters),
        [seminarsData, externalEventPosters]
    );

    const handleClose = () => {
        try {
            if (window.opener && !window.opener.closed) window.close();
            else window.close();
        } catch (e) {
            if (window.opener) navigate('/');
            else window.close();
        }
    };

    const handleHide24h = () => {
        try {
            localStorage.setItem(POPUP_HIDE_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (e) {}
        handleClose();
    };

    const handleApply = (program) => {
        if (program?.isExternalPoster) {
            if (program.externalLink) {
                try {
                    window.open(program.externalLink, '_blank', 'noopener,noreferrer');
                } catch (e) {}
            }
            return;
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/program/apply/${program.id}`;
        if (window.opener && !window.opener.closed) {
            window.opener.location.href = url;
            window.close();
        } else {
            navigate(`/program/apply/${program.id}`);
        }
    };

    const removeCard = (idx) => {
        const remaining = upcomingPrograms.filter((_, i) => i !== idx);
        if (remaining.length === 0) handleClose();
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const programsToShow = isMobile ? upcomingPrograms.slice(0, 1) : upcomingPrograms;

    if (programsToShow.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <p className="text-gray-600 mb-4">표시할 프로그램이 없습니다.</p>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700"
                    >
                        닫기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-6 px-4 flex flex-col items-center">
            <div className="flex flex-col md:flex-row gap-6 max-w-6xl w-full justify-center items-start">
                {programsToShow.map((program, idx) => (
                    <div
                        key={program.id || idx}
                        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-shrink-0 w-[85vw] max-w-sm mx-auto flex flex-col md:max-w-[480px]"
                    >
                        <div className="w-full relative" style={{ aspectRatio: '3/4' }}>
                            {program.isDeadlineSoon ? (
                                <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                                    마감임박
                                </div>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => removeCard(idx)}
                                className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-white text-gray-700 z-10 shadow-md border border-gray-200"
                                aria-label="닫기"
                            >
                                <Icons.X size={20} />
                            </button>
                            {program.img ? (
                                program.isExternalPoster && program.externalLink ? (
                                    <a
                                        href={program.externalLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 z-0 block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                                        aria-label={`${program.title || '외부 행사'} 페이지로 이동`}
                                    >
                                        <img
                                            src={program.img}
                                            alt={program.title}
                                            className="w-full h-full object-cover object-center pointer-events-none"
                                            loading="eager"
                                        />
                                    </a>
                                ) : (
                                    <img
                                        src={program.img}
                                        alt={program.title}
                                        className="w-full h-full object-cover object-center"
                                        loading="eager"
                                    />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                    <Icons.Calendar size={48} />
                                </div>
                            )}
                        </div>
                        <div className="p-4 pt-3">
                            {!program.isExternalPoster && (appliedProgramIds && appliedProgramIds.has(String(program.id))) ? (
                                <div className="w-full py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-sm text-center cursor-default">
                                    신청해주셔서 감사합니다
                                </div>
                            ) : !program.isExternalPoster ? (
                                <button
                                    type="button"
                                    onClick={() => handleApply(program)}
                                    className="w-full py-3.5 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm"
                                >
                                    프로그램 신청하기
                                </button>
                            ) : null}
                            <label className="mt-4 flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    onChange={(e) => e.target.checked && handleHide24h()}
                                    className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-800">24시간 동안 팝업 보이지 않기</span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
