/**
 * 외부행사 포스터를 프로그램 팝업과 분리해 보여주는 전용 창.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { buildActiveExternalPosterItems } from '../appHelpers';

const EXTERNAL_POSTER_HIDE_UNTIL_KEY = 'busan_ycc_external_poster_popup_hide_until';

export default function ExternalPosterPopupView({ externalEventPosters = [] }) {
    const navigate = useNavigate();
    const [dismissedIds, setDismissedIds] = useState(() => new Set());

    const activePosters = useMemo(
        () => buildActiveExternalPosterItems(externalEventPosters),
        [externalEventPosters]
    );
    const postersToShow = activePosters.filter((poster) => !dismissedIds.has(String(poster.id))).slice(0, 3);

    const handleClose = useCallback(() => {
        try {
            if (window.opener && !window.opener.closed) window.close();
            else window.close();
        } catch (e) {
            navigate('/');
        }
    }, [navigate]);

    useEffect(() => {
        if (activePosters.length === 0) return;
        const visible = activePosters.filter((p) => !dismissedIds.has(String(p.id)));
        if (visible.length === 0) {
            handleClose();
        }
    }, [activePosters, dismissedIds, handleClose]);

    const handleRemoveCard = (posterId) => {
        setDismissedIds((prev) => {
            const next = new Set(prev);
            next.add(String(posterId));
            return next;
        });
    };

    const handleHide24h = () => {
        try {
            localStorage.setItem(EXTERNAL_POSTER_HIDE_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (e) {}
        handleClose();
    };

    const handleOpenLink = (url) => {
        if (!url) return;
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {}
    };

    if (postersToShow.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <p className="text-gray-600 mb-4">표시할 외부행사 포스터가 없습니다.</p>
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
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl justify-center items-start">
                {postersToShow.map((poster) => (
                    <div
                        key={poster.id}
                        className="bg-white rounded-3xl shadow-2xl overflow-hidden w-[92vw] max-w-[384px] flex flex-col flex-shrink-0"
                    >
                        <div className="w-full relative bg-gray-100" style={{ aspectRatio: '3/4' }}>
                            <button
                                type="button"
                                onClick={() => handleRemoveCard(poster.id)}
                                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/95 hover:bg-white text-gray-700 z-20 shadow-md border border-gray-200"
                                aria-label="닫기"
                            >
                                <Icons.X size={22} />
                            </button>
                            {poster.img ? (
                                <img
                                    src={poster.img}
                                    alt={poster.title}
                                    className="w-full h-full object-cover object-center"
                                    loading="eager"
                                    fetchPriority="high"
                                    decoding="async"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                    <Icons.Image size={56} />
                                </div>
                            )}
                            {poster.externalLink ? (
                                <button
                                    type="button"
                                    onClick={() => handleOpenLink(poster.externalLink)}
                                    className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-800 shadow-lg hover:bg-brand hover:text-white transition-colors"
                                >
                                    <Icons.ExternalLink size={14} />
                                    해당 페이지로 이동
                                </button>
                            ) : null}
                        </div>
                        <div className="px-5 py-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
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
