/**
 * 프로그램 팝업을 별도 창에서만 보여주는 전용 페이지.
 * 메인 앱에서 window.open('/program-popup')으로 열며, 동일한 카드 UI와 24시간 숨김/신청하기 동작을 지원합니다.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';

const POPUP_HIDE_UNTIL_KEY = 'busan_ycc_popup_hide_until';

function isDeadlineSoon(seminar) {
    if (!seminar?.date) return false;
    const dateStr = String(seminar.date).trim();
    const match = dateStr.match(/(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})/);
    if (!match) return false;
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    const now = new Date();
    const diffDays = Math.ceil((d - now) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays <= 3;
}

function getUpcomingPrograms(seminarsData) {
    if (!Array.isArray(seminarsData) || seminarsData.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDateObj = (dateVal) => {
        if (dateVal == null) return null;
        if (typeof dateVal.toDate === 'function') return dateVal.toDate();
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
        const str = String(dateVal).trim();
        const matches = str ? str.match(/(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})/) : null;
        if (!matches) return null;
        const d = new Date(parseInt(matches[1], 10), parseInt(matches[2], 10) - 1, parseInt(matches[3], 10));
        return isNaN(d.getTime()) ? null : d;
    };
    return seminarsData
        .filter(s => s.status !== '종료')
        .map(s => {
            const seminarDate = toDateObj(s.date);
            if (!seminarDate) return null;
            seminarDate.setHours(0, 0, 0, 0);
            if (seminarDate >= today) return { ...s, dateObj: seminarDate };
            return null;
        })
        .filter(Boolean)
        .filter(s => !!s.img)
        .filter(s => {
            const is정모 = (s.title || '').includes('정모');
            const isFull = (s.currentParticipants || 0) >= (s.maxParticipants || 999);
            return is정모 || !isFull;
        })
        .sort((a, b) => a.dateObj - b.dateObj)
        .slice(0, 3)
        .map(s => ({ ...s, isDeadlineSoon: isDeadlineSoon(s) }));
}

export default function ProgramPopupWindowView({ seminarsData = [], appliedProgramIds = new Set() }) {
    const navigate = useNavigate();
    const upcomingPrograms = useMemo(() => getUpcomingPrograms(seminarsData), [seminarsData]);

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

    if (!Array.isArray(seminarsData) || seminarsData.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="text-center text-gray-500">
                    <Icons.Calendar className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

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
                        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-shrink-0 w-[85vw] max-w-sm mx-auto md:max-w-[320px] flex flex-col"
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
                                <img
                                    src={program.img}
                                    alt={program.title}
                                    className="w-full h-full object-cover object-center"
                                    loading="eager"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                    <Icons.Calendar size={48} />
                                </div>
                            )}
                        </div>
                        <div className="p-4 pt-3">
                            {(appliedProgramIds && appliedProgramIds.has(String(program.id))) ? (
                                <div className="w-full py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-sm text-center cursor-default">
                                    신청해주셔서 감사합니다
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleApply(program)}
                                    className="w-full py-3.5 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm"
                                >
                                    프로그램 신청하기
                                </button>
                            )}
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
