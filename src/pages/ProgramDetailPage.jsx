import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import { calculateStatus } from '../utils';
import { useSEO } from '../hooks/useSEO';
import { Icons } from '../components/Icons';
import { MgInfoTable } from '../components/mg/Mg';

const BASE_URL = 'https://bcsa.co.kr';

// 먼저가본 개편(2026-11): 상태는 작은 네모 — 모집중=로얄블루, 마감임박=빨강, 종료=검정
const StatusBadge = ({ status }) => {
    const map = {
        '모집중': 'bg-royal text-white',
        '종료': 'bg-ink text-white',
        '마감임박': 'bg-red-600 text-white',
    };
    return (
        <span className={`inline-flex h-7 items-center px-2.5 text-[14px] font-semibold ${map[status] || 'bg-sky text-royal'}`}>
            {status}
        </span>
    );
};

const ProgramDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [program, setProgram] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        firebaseService.getSeminar(id)
            .then(data => {
                if (!data) { setNotFound(true); return; }
                setProgram(data);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [id]);

    const status = program
        ? (program.recruitmentClosedByAdmin ? '종료' : calculateStatus(program.date || ''))
        : '';

    const images = (() => {
        if (!program) return [];
        if (Array.isArray(program.images)) return program.images;
        if (typeof program.images === 'string' && program.images.trim()) {
            try { return JSON.parse(program.images); } catch { return [program.images]; }
        }
        if (program.img) return [program.img];
        return [];
    })();

    const price = program?.price != null ? Number(program.price) : 0;

    useSEO({
        view: 'allSeminars',
        overrideTitle: program ? `${program.title} | 먼저가본 프로그램` : '프로그램 상세 | 먼저가본',
        overrideDescription: program?.desc
            ? program.desc.slice(0, 120)
            : '먼저가본 프로그램 상세 정보입니다.',
        overridePath: `/programs/${id}`,
        ogImage: images[0] || null,
    });

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white" role="status" aria-label="불러오는 중">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-royal border-t-transparent" />
            </div>
        );
    }

    if (notFound || !program) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-5 text-center">
                <Icons.AlertCircle className="h-14 w-14 text-sub" aria-hidden="true" />
                <p className="text-[16px] text-ink">프로그램을 찾을 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => navigate('/programs')}
                    className="h-12 rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white"
                >
                    프로그램 목록으로
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* 머리 줄 */}
            <div className="sticky top-0 z-40 border-b border-line bg-white">
                <div className="mx-auto flex h-14 max-w-[760px] items-center gap-2 px-3 md:h-16">
                    <button type="button" onClick={() => navigate('/programs')} aria-label="프로그램 목록으로" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-card">
                        <Icons.ArrowLeft size={22} />
                    </button>
                    <span className="truncate text-[16px] font-semibold text-ink">{program.title}</span>
                </div>
            </div>

            <div className="mx-auto max-w-[760px] px-5 pb-10 pt-6 md:pt-10">
                {/* 대표 이미지 */}
                {images[0] && (
                    <div className="mb-6 aspect-[3/2] overflow-hidden border border-line bg-[#f6f6f6]">
                        <img src={images[0]} alt={program.title} className="h-full w-full object-cover" />
                    </div>
                )}

                {/* 제목 / 상태 */}
                <div className="mb-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} />
                        {program.category && (
                            <span className="inline-flex h-7 items-center border border-line px-2.5 text-[14px] text-sub">
                                {program.category}
                            </span>
                        )}
                    </div>
                    <h1 className="break-keep text-[24px] font-bold leading-[1.4] text-ink md:text-[30px]">{program.title}</h1>
                </div>

                {/* 기본 정보 */}
                <MgInfoTable
                    className="mb-8"
                    rows={[
                        ['일시', program.date || null],
                        ['장소', (program.location || program.locationAddress) ? (
                            <>
                                {program.location || program.locationAddress}
                                {program.location && program.locationAddress && program.location !== program.locationAddress && (
                                    <span className="mt-0.5 block text-[14px] text-sub">{program.locationAddress}</span>
                                )}
                            </>
                        ) : null],
                        ['정원', program.maxParticipants > 0 ? `${program.maxParticipants}명` : null],
                        ['참가비', <span className="font-semibold">{price > 0 ? `${price.toLocaleString()}원` : '무료'}</span>],
                    ]}
                />

                {/* 상세 설명 */}
                {program.desc && (
                    <section className="mb-8" aria-labelledby="program-intro">
                        <h2 id="program-intro" className="mb-3 text-[20px] font-bold text-ink">프로그램 소개</h2>
                        <p className="whitespace-pre-line break-keep text-[16px] leading-relaxed text-[#333]">
                            {program.desc}
                        </p>
                    </section>
                )}

                {/* 추가 이미지 */}
                {images.length > 1 && (
                    <div className="mb-8 flex flex-col gap-3">
                        {images.slice(1).map((img, idx) => (
                            <div key={idx} className="overflow-hidden bg-[#f6f6f6]">
                                <img src={img} alt={`${program.title} ${idx + 2}`} className="w-full object-cover" />
                            </div>
                        ))}
                    </div>
                )}

                {/* 신청 버튼 */}
                <div className="sticky bottom-0 -mx-5 border-t border-line bg-white px-5 py-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/program/apply/${program.id}`)}
                        disabled={status === '종료'}
                        className={`h-[53px] w-full rounded-lg text-[17px] font-bold transition-colors
                            ${status === '종료'
                                ? 'cursor-not-allowed bg-card text-sub'
                                : 'bg-royal text-white hover:bg-royalDark'
                            }`}
                    >
                        {status === '종료' ? '모집이 종료되었습니다' : '신청하기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProgramDetailPage;
