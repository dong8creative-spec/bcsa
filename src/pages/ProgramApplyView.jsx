import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons } from '../components/Icons';

const DISSOLVE_DURATION_MS = 1000;
const DISPLAY_DURATION_MS = 3000;
const AUTO_ADVANCE_INTERVAL_MS = DISPLAY_DURATION_MS + DISSOLVE_DURATION_MS;

const getStatusColor = (status) => {
    switch (status) {
        case '모집중': return 'bg-blue-100 text-blue-700';
        case '마감임박': return 'bg-orange-100 text-orange-700';
        case '후기작성가능': return 'bg-green-100 text-green-700';
        case '종료': return 'bg-gray-100 text-gray-600';
        default: return 'bg-gray-100 text-gray-600';
    }
};

const getCategoryColor = (category) => {
    const colorMap = {
        '네트워킹 모임': 'bg-green-100 text-green-700',
        '교육/세미나': 'bg-blue-100 text-blue-700',
        '커피챗': 'bg-amber-100 text-amber-700',
        '네트워킹/모임': 'bg-green-100 text-green-700',
        '투자/IR': 'bg-orange-100 text-orange-700',
        '멘토링/상담': 'bg-purple-100 text-purple-700',
        '기타': 'bg-gray-100 text-gray-700'
    };
    return colorMap[category] || 'bg-gray-100 text-gray-700';
};

/**
 * 프로그램 신청/결제 전용 페이지 (상세 보기 + 결제·신청)
 * URL: /program/apply/:programId
 */
const ProgramApplyView = ({
    program,
    currentUser,
    onApply,
    onBack,
}) => {
    const [applicationData, setApplicationData] = useState({ reason: '', questions: ['', ''] });
    const [submitting, setSubmitting] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [dissolvePhase, setDissolvePhase] = useState('idle'); // 'idle' | 'fadeOut' | 'fadeIn'
    const nextIndexRef = useRef(null);
    const intervalRef = useRef(null);
    const timeoutRefs = useRef([]);
    const currentImageIndexRef = useRef(0);
    const dissolvePhaseRef = useRef('idle');

    currentImageIndexRef.current = currentImageIndex;
    dissolvePhaseRef.current = dissolvePhase;

    const clearTimers = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        timeoutRefs.current.forEach((t) => t != null && clearTimeout(t));
        timeoutRefs.current = [];
    };

    const goToIndex = (targetIndex) => {
        if (dissolvePhaseRef.current !== 'idle') return;
        if (targetIndex === currentImageIndex) return;
        nextIndexRef.current = targetIndex;
        setDissolvePhase('fadeOut');
        dissolvePhaseRef.current = 'fadeOut';
        const half = DISSOLVE_DURATION_MS / 2;
        const t1 = setTimeout(() => {
            setCurrentImageIndex(nextIndexRef.current);
            setDissolvePhase('fadeIn');
            dissolvePhaseRef.current = 'fadeIn';
            const t2 = setTimeout(() => {
                setDissolvePhase('idle');
                dissolvePhaseRef.current = 'idle';
            }, half);
            timeoutRefs.current.push(t2);
        }, half);
        timeoutRefs.current.push(t1);
    };

    const images = useMemo(() => {
        if (!program) return [];
        let list = [];
        const raw = program.images || program.imageUrls;
        if (raw && Array.isArray(raw) && raw.length > 0) {
            list = raw.filter(img => img && typeof img === 'string' && img.trim() !== '');
        }
        if (list.length === 0 && program.imageUrl) list = [program.imageUrl];
        if (list.length === 0 && program.img) list = [program.img];
        return list;
    }, [program]);

    useEffect(() => {
        if (!program || images.length <= 1) {
            clearTimers();
            return;
        }
        intervalRef.current = setInterval(() => {
            const next = (currentImageIndexRef.current + 1) % images.length;
            goToIndex(next);
        }, AUTO_ADVANCE_INTERVAL_MS);
        return () => clearTimers();
    }, [program, images.length]);

    useEffect(() => () => clearTimers(), []);

    const handleSubmit = async () => {
        if (!program) return;
        if (!applicationData.reason.trim()) {
            alert('신청사유를 입력해주세요.');
            return;
        }
        if (!applicationData.questions[0].trim() || !applicationData.questions[1].trim()) {
            alert('사전질문 2개를 모두 입력해주세요.');
            return;
        }
        setSubmitting(true);
        try {
            const success = await onApply(program, applicationData);
            if (success) {
                setApplicationData({ reason: '', questions: ['', ''] });
                onBack();
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!program) {
        return (
            <div className="pt-32 pb-20 px-4 min-h-screen bg-soft">
                <div className="container mx-auto max-w-2xl">
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 text-center">
                        <Icons.AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-dark mb-2">프로그램을 찾을 수 없습니다</h2>
                        <p className="text-gray-600 mb-6">존재하지 않거나 삭제된 프로그램일 수 있습니다.</p>
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const displayImage = images.length > 0 ? images[Math.min(currentImageIndex, images.length - 1)] : null;
    const hasMultipleImages = images.length > 1;

    const isPaid = program.applicationFee != null && Number(program.applicationFee) > 0;
    const isEnded = program.status === '종료';

    return (
        <div className="pt-28 pb-20 px-4 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-3xl">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-brand font-bold hover:underline mb-6 px-2 py-1 rounded-lg hover:bg-brand/5 transition-colors"
                >
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>

                {/* ========== 프로그램 상세 영역 ========== */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden mb-6">
                    <div className="p-6 md:p-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-dark mb-4">프로그램 상세</h1>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {program.status && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(program.status)}`}>
                                    {program.status}
                                </span>
                            )}
                            {program.category && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getCategoryColor(program.category)}`}>
                                    {program.category}
                                </span>
                            )}
                            <span className="text-xs font-bold px-2 py-1 bg-brand/10 text-brand rounded-full">
                                {isPaid ? `${new Intl.NumberFormat('ko-KR').format(Number(program.applicationFee))}원` : '무료'}
                            </span>
                        </div>

                        {/* 이미지 갤러리 - 3초 표시, 1초 디졸브 자동 재생 + 하단 썸네일로 선택 */}
                        {displayImage && (
                            <div className="mb-6">
                                <div className="rounded-xl overflow-hidden relative bg-gray-50">
                                    <img
                                        key={currentImageIndex}
                                        src={displayImage}
                                        alt={program.title}
                                        className={`w-full h-auto max-w-full object-contain block transition-opacity duration-[500ms] ${
                                            dissolvePhase === 'fadeOut' ? 'opacity-0' : dissolvePhase === 'fadeIn' ? 'animate-program-image-fade-in' : 'opacity-100'
                                        }`}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {hasMultipleImages && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => goToIndex((currentImageIndex - 1 + images.length) % images.length)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                                            >
                                                <Icons.ChevronLeft size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => goToIndex((currentImageIndex + 1) % images.length)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                                            >
                                                <Icons.ChevronRight size={20} />
                                            </button>
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                                {currentImageIndex + 1} / {images.length}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {hasMultipleImages && (
                                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
                                        {images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => goToIndex(idx)}
                                                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                                    idx === currentImageIndex
                                                        ? 'border-brand ring-2 ring-brand/30'
                                                        : 'border-gray-200 hover:border-brand/50'
                                                }`}
                                            >
                                                <img
                                                    src={img}
                                                    alt={`${program.title} ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <h2 className="text-xl font-bold text-dark mb-4">{program.title}</h2>
                        <div className="space-y-2 text-gray-600 mb-6">
                            <div className="flex items-center gap-2"><Icons.Calendar size={18} /> {program.date}</div>
                            {program.location && (
                                <div className="flex items-center gap-2"><Icons.MapPin size={18} /> {program.location}</div>
                            )}
                            <div className="text-sm text-gray-500">
                                신청 인원: {program.currentParticipants ?? 0} / {program.maxParticipants ?? 0}명
                            </div>
                        </div>

                        {/* 상세 설명 */}
                        {program.desc && (
                            <div className="bg-soft rounded-xl p-5 border border-brand/5 mb-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">상세 내용</h3>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{program.desc}</p>
                            </div>
                        )}

                        {isPaid && (
                            <div className="flex items-center gap-2 p-4 bg-brand/5 rounded-xl border border-brand/20">
                                <Icons.DollarSign size={20} className="text-brand" />
                                <span className="font-bold text-brand">
                                    신청 비용: {new Intl.NumberFormat('ko-KR').format(Number(program.applicationFee))}원
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ========== 취소/환불 규정 (결제 및 신청 바로 위) ========== */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden mb-6 p-6 md:p-8" style={{ fontSize: 'calc(0.75rem * 0.3 * 3)' }}>
                    <h2 className="text-gray-800 font-bold mb-4" style={{ fontSize: '1.2em' }}>[부산청년사업가 포럼] 취소 및 환불 규정</h2>
                    <div className="text-gray-800 leading-relaxed space-y-4">
                        <section>
                            <h3 className="font-bold text-gray-800 mb-2">제1조 (목적)</h3>
                            <p className="mb-0">본 규정은 '부산청년사업가 포럼'(이하 "포럼")이 제공하는 유료 세미나 및 교육 프로그램의 취소 및 환불에 관한 사항을 규정함을 목적으로 합니다.</p>
                        </section>
                        <section>
                            <h3 className="font-bold text-gray-800 mb-2">제2조 (환불 기준)</h3>
                            <p className="mb-3">회원은 세미나 시작 전까지 취소를 요청할 수 있으며, 환불액은 '소비자분쟁해결기준'에 의거하여 취소 시점에 따라 차등 적용됩니다.</p>
                            <div className="mb-3">
                                <h4 className="font-bold text-gray-800 mb-2">1. 환불 적용 기간 및 비율</h4>
                                <ul className="list-none space-y-2 pl-0">
                                    <li className="flex gap-2"><span className="text-brand shrink-0">◦</span><span>세미나 개최 3일 전 (23:59까지): 결제 금액 100% 환불</span></li>
                                    <li className="flex gap-2"><span className="text-brand shrink-0">◦</span><span>세미나 개최 2일 전 (23:59까지): 결제 금액의 90% 환불 (위약금 10% 공제)</span></li>
                                    <li className="flex gap-2"><span className="text-brand shrink-0">◦</span><span>세미나 개최 1일 전 (23:59까지): 결제 금액의 80% 환불 (위약금 20% 공제)</span></li>
                                    <li className="flex gap-2"><span className="text-brand shrink-0">◦</span><span>세미나 당일 및 시작 시간 이후: 환불 불가 (노쇼 포함)</span></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">2. 패키지 상품 (세미나+자료) 예외 조항</h4>
                                <ul className="list-none space-y-2 pl-0">
                                    <li className="flex gap-2"><span className="text-brand shrink-0">◦</span><span>세미나 참가권과 디지털 자료(PDF, 영상 등)가 결합된 상품의 경우, 자료를 다운로드하거나 열람한 이력이 확인되면 해당 자료 비용(정가 기준)을 공제한 후 남은 차액에 대해 위 기간별 비율을 적용합니다.</span></li>
                                </ul>
                            </div>
                        </section>
                        <section>
                            <h3 className="font-bold text-gray-800 mb-2">제3조 (환불 신청 방법)</h3>
                            <ol className="list-decimal list-inside space-y-2 pl-2">
                                <li>환불 신청은 [마이페이지 &gt; 결제내역]에서 직접 취소하거나, 포럼 공식 이메일로 접수해야 합니다.</li>
                                <li>유선(전화)을 통한 구두 취소는 정확한 시점 확인이 어려워 인정되지 않으며, 시스템상 기록이 남는 온라인 신청을 원칙으로 합니다.</li>
                            </ol>
                        </section>
                        <section>
                            <h3 className="font-bold text-gray-800 mb-2">제4조 (포럼 귀책사유 및 폐강)</h3>
                            <ol className="list-decimal list-inside space-y-2 pl-2">
                                <li>천재지변, 강사 부재, 최소 인원 미달 등 포럼 측의 사정으로 세미나가 취소될 경우, 시점과 관계없이 결제 금액 100%를 전액 환불합니다.</li>
                                <li>환불 처리는 취소 확정일로부터 영업일 기준 3~5일 이내에 진행됩니다.</li>
                            </ol>
                        </section>
                    </div>
                </div>

                {/* ========== 결제 및 신청 영역 ========== */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-blue-100">
                        <h2 className="text-xl font-bold text-dark">결제 및 신청</h2>
                        <p className="text-sm text-gray-500 mt-1">아래 항목을 입력한 뒤 {isPaid ? '결제하기' : '신청하기'} 버튼을 눌러주세요.</p>
                    </div>
                    <div className="p-6 md:p-8 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">신청사유 *</label>
                            <textarea
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-32 resize-none"
                                value={applicationData.reason}
                                onChange={(e) => setApplicationData({ ...applicationData, reason: e.target.value })}
                                placeholder="이 프로그램에 신청하는 이유를 작성해주세요"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">사전질문 *</label>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    className="w-full p-3 border border-blue-200 rounded-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={applicationData.questions[0]}
                                    onChange={(e) => {
                                        const q = [...applicationData.questions];
                                        q[0] = e.target.value;
                                        setApplicationData({ ...applicationData, questions: q });
                                    }}
                                    placeholder="사전질문 1"
                                />
                                <input
                                    type="text"
                                    className="w-full p-3 border border-blue-200 rounded-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    value={applicationData.questions[1]}
                                    onChange={(e) => {
                                        const q = [...applicationData.questions];
                                        q[1] = e.target.value;
                                        setApplicationData({ ...applicationData, questions: q });
                                    }}
                                    placeholder="사전질문 2"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || isEnded}
                            className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            {isEnded
                                ? '종료된 프로그램입니다'
                                : submitting
                                    ? (isPaid ? '결제 진행 중...' : '신청 처리 중...')
                                    : (isPaid ? '결제하기' : '신청하기')
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramApplyView;
