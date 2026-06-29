import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import { calculateStatus } from '../utils';
import { useSEO } from '../hooks/useSEO';
import { Icons } from '../components/Icons';

const BASE_URL = 'https://bcsa.co.kr';

const StatusBadge = ({ status }) => {
    const map = {
        '모집중': 'bg-green-100 text-green-700',
        '종료': 'bg-gray-100 text-gray-500',
        '마감임박': 'bg-amber-100 text-amber-700',
    };
    return (
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${map[status] || 'bg-blue-100 text-brand'}`}>
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
        overrideTitle: program ? `${program.title} | 부청사 프로그램` : '프로그램 상세 | 부청사',
        overrideDescription: program?.desc
            ? program.desc.slice(0, 120)
            : '부청사 프로그램 상세 정보입니다.',
        overridePath: `/programs/${id}`,
        ogImage: images[0] || null,
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-soft">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (notFound || !program) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-soft gap-4">
                <Icons.AlertCircle className="w-16 h-16 text-gray-300" />
                <p className="text-gray-500 font-medium">프로그램을 찾을 수 없습니다.</p>
                <button
                    onClick={() => navigate('/programs')}
                    className="px-5 py-2 bg-brand text-white rounded-xl font-bold text-sm"
                >
                    프로그램 목록으로
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-soft">
            {/* 헤더 */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate('/programs')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <Icons.ArrowLeft size={20} className="text-dark" />
                </button>
                <span className="font-bold text-dark text-sm truncate">{program.title}</span>
            </div>

            <div className="container mx-auto max-w-2xl px-4 py-6">
                {/* 대표 이미지 */}
                {images[0] && (
                    <div className="rounded-2xl overflow-hidden mb-6 aspect-video bg-gray-100">
                        <img src={images[0]} alt={program.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {/* 제목 / 상태 */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={status} />
                        {program.category && (
                            <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                                {program.category}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-black text-dark leading-tight break-keep">{program.title}</h1>
                </div>

                {/* 기본 정보 */}
                <div className="bg-white rounded-2xl border border-blue-100 divide-y divide-gray-50 mb-5">
                    {program.date && (
                        <div className="flex items-center gap-3 px-5 py-4">
                            <Icons.Calendar size={18} className="text-brand flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">일시</p>
                                <p className="font-semibold text-dark text-sm">{program.date}</p>
                            </div>
                        </div>
                    )}
                    {(program.location || program.locationAddress) && (
                        <div className="flex items-center gap-3 px-5 py-4">
                            <Icons.MapPin size={18} className="text-brand flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">장소</p>
                                <p className="font-semibold text-dark text-sm">{program.location || program.locationAddress}</p>
                                {program.location && program.locationAddress && program.location !== program.locationAddress && (
                                    <p className="text-xs text-gray-400 mt-0.5">{program.locationAddress}</p>
                                )}
                            </div>
                        </div>
                    )}
                    {(program.maxParticipants > 0) && (
                        <div className="flex items-center gap-3 px-5 py-4">
                            <Icons.Users size={18} className="text-brand flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">정원</p>
                                <p className="font-semibold text-dark text-sm">{program.maxParticipants}명</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 px-5 py-4">
                        <Icons.DollarSign size={18} className="text-brand flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">참가비</p>
                            <p className="font-semibold text-dark text-sm">
                                {price > 0 ? `${price.toLocaleString()}원` : '무료'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 상세 설명 */}
                {program.desc && (
                    <div className="bg-white rounded-2xl border border-blue-100 px-5 py-5 mb-5">
                        <h2 className="text-base font-bold text-dark mb-3">프로그램 소개</h2>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line break-keep">
                            {program.desc}
                        </p>
                    </div>
                )}

                {/* 추가 이미지 */}
                {images.length > 1 && (
                    <div className="flex flex-col gap-3 mb-5">
                        {images.slice(1).map((img, idx) => (
                            <div key={idx} className="rounded-2xl overflow-hidden bg-gray-100">
                                <img src={img} alt={`${program.title} ${idx + 2}`} className="w-full object-cover" />
                            </div>
                        ))}
                    </div>
                )}

                {/* 신청 버튼 */}
                <div className="sticky bottom-4">
                    <button
                        onClick={() => navigate(`/program/apply/${program.id}`)}
                        disabled={status === '종료'}
                        className={`w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all
                            ${status === '종료'
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-brand text-white hover:bg-blue-700 active:scale-95'
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
