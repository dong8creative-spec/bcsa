import React, { useState, useMemo } from 'react';
import { Icons } from '../components/Icons';
import { normalizeImagesList } from '../utils/imageUtils';

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
    isTestPage = false,
    onApply,
    onBack,
}) => {
    const [applicationData, setApplicationData] = useState({ participationPath: '', applyReason: '', preQuestions: '', mealAfter: '', privacyAgreed: false });
    const [submitting, setSubmitting] = useState(false);
    const [heroImageError, setHeroImageError] = useState(false);

    const images = useMemo(() => {
        if (!program) return [];
        let list = [];
        const raw = program.images || program.imageUrls;
        if (raw && Array.isArray(raw) && raw.length > 0) {
            list = normalizeImagesList(raw);
        }
        if (list.length === 0 && program.imageUrl) list = [program.imageUrl];
        if (list.length === 0 && program.img) {
            const img = program.img;
            if (Array.isArray(img)) {
                list = normalizeImagesList(img);
            } else if (typeof img === 'string' && img.trim() !== '') {
                if (img.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(img);
                        if (Array.isArray(parsed)) list = normalizeImagesList(parsed);
                        else list = [img];
                    } catch { list = [img]; }
                } else {
                    list = [img];
                }
            }
        }
        return list;
    }, [program]);

    const handleSubmit = async () => {
        if (!program) return;
        if (!applicationData.participationPath) {
            alert('참여 경로를 선택해주세요.');
            return;
        }
        if (!applicationData.mealAfter) {
            alert('강연 후 식사 여부를 선택해주세요.');
            return;
        }
        if (!applicationData.privacyAgreed) {
            alert('개인정보 동의에 체크해주세요.');
            return;
        }
        setSubmitting(true);
        try {
            const success = await onApply(program, applicationData);
            if (success) {
                setApplicationData({ participationPath: '', applyReason: '', preQuestions: '', mealAfter: '', privacyAgreed: false });
                onBack();
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!program) {
        return (
            <div className="pt-32 pb-20 px-4 min-h-screen bg-soft overflow-y-auto min-h-0">
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

    const displayImage = images.length > 0 ? images[0] : null;

    const isPaid = program.applicationFee != null && Number(program.applicationFee) > 0;
    const isEnded = program.status === '종료';

    return (
        <>
        <div className="pt-28 pb-20 px-4 min-h-screen bg-soft animate-fade-in relative overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-3xl">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-brand font-bold hover:underline mb-6 px-2 py-1 rounded-lg hover:bg-brand/5 transition-colors"
                >
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>

                {/* ========== 프로그램 상세 영역 (히어로형) ========== */}
                <div className="bg-white rounded-2xl shadow-lg border border-blue-200 overflow-hidden mb-6">
                    {/* 히어로: 풀폭 이미지 + 그라데이션 위에 프로그램명 강조 */}
                    <div className="relative min-h-[260px] md:min-h-[320px] bg-gradient-to-br from-brand/20 to-brand/5">
                        {displayImage && !heroImageError ? (
                            <>
                                <img
                                    src={displayImage}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover block"
                                    onError={() => setHeroImageError(true)}
                                    onLoad={() => setHeroImageError(false)}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                            </>
                        ) : displayImage && heroImageError ? (
                            <>
                                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                                    <Icons.Image className="w-16 h-16 text-gray-400" />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-brand/30 to-brand/10" />
                        )}
                        {/* 상단 뱃지: 상태, 카테고리 */}
                        <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2 z-10">
                            {program.status && (
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-md ${getStatusColor(program.status)} backdrop-blur-sm`}>
                                    {program.status}
                                </span>
                            )}
                            {program.category && (
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-md ${getCategoryColor(program.category)} backdrop-blur-sm`}>
                                    {program.category}
                                </span>
                            )}
                        </div>
                        {/* 프로그램명: 이미지 위 하단에 크게 */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8 z-10">
                            <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-lg">
                                {program.title}
                            </h1>
                        </div>
                    </div>

                    <div className="p-6 md:p-8">
                        {/* 신청 비용: 독립 카드로 강조 */}
                        <div className={`rounded-2xl border-2 p-5 md:p-6 mb-6 ${isPaid ? 'bg-brand/5 border-brand/30' : 'bg-green-50 border-green-200'}`}>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">신청 비용</div>
                            {isPaid ? (
                                <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-3xl md:text-4xl font-extrabold text-brand">
                                        {new Intl.NumberFormat('ko-KR').format(Number(program.applicationFee))}
                                    </span>
                                    <span className="text-xl md:text-2xl font-bold text-brand">원</span>
                                </div>
                            ) : (
                                <span className="inline-block text-2xl md:text-3xl font-extrabold text-green-700 bg-white/80 px-4 py-2 rounded-xl shadow-sm">
                                    무료
                                </span>
                            )}
                        </div>

                        {/* 첨부 사진: 신청 비용 박스와 동일 폭, 세로 나열 (상세페이지 스타일) */}
                        {images.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-700 mb-3">첨부 사진</h3>
                                <div className="flex flex-col gap-3">
                                    {images.map((src, idx) => (
                                        <img
                                            key={idx}
                                            src={src}
                                            alt={`${program.title} ${idx + 1}`}
                                            className="w-full max-w-full block rounded-xl object-contain border border-gray-200"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 일시 · 장소 · 정원: 아이콘 카드 3열 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-soft border border-blue-100">
                                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                                    <Icons.Calendar size={20} className="text-brand" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">일시</div>
                                    <div className="text-sm font-semibold text-dark leading-snug">{program.date}</div>
                                </div>
                            </div>
                            {program.location && (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-soft border border-blue-100">
                                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                                        <Icons.MapPin size={20} className="text-brand" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">장소</div>
                                        <div className="text-sm font-semibold text-dark leading-snug line-clamp-2">{program.location}</div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-soft border border-blue-100">
                                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                                    <Icons.Users size={20} className="text-brand" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">정원</div>
                                    <div className="text-sm font-semibold text-dark">
                                        {program.currentParticipants ?? 0} / {program.maxParticipants ?? 0}명
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 상세 설명 */}
                        {program.desc && (
                            <div className="bg-soft rounded-xl p-5 border border-brand/5 mb-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">상세 내용</h3>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{program.desc}</p>
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
                            <label className="block text-sm font-bold text-gray-700 mb-2">참여 경로 <span className="text-red-500">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {['부청사 오픈채팅', 'SNS', '지인 추천', '기타'].map((opt) => (
                                    <button key={opt} type="button" onClick={() => setApplicationData({ ...applicationData, participationPath: opt })} className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-colors ${applicationData.participationPath === opt ? 'border-brand bg-brand/10 text-brand' : 'border-gray-200 text-gray-600 hover:border-brand/50'}`}>{opt}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">강연 신청 계기 <span className="text-gray-400 text-xs">(선택)</span></label>
                            <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-24 resize-none" value={applicationData.applyReason} onChange={(e) => setApplicationData({ ...applicationData, applyReason: e.target.value })} placeholder="신청 계기를 입력해주세요" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">강연 사전 질문 <span className="text-gray-400 text-xs">(선택)</span></label>
                            <textarea className="w-full p-3 border border-blue-200 rounded-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-24 resize-none" value={applicationData.preQuestions} onChange={(e) => setApplicationData({ ...applicationData, preQuestions: e.target.value })} placeholder="사전 질문을 입력해주세요" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">강연 후 식사 여부 <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mealAfter" checked={applicationData.mealAfter === '참석'} onChange={() => setApplicationData({ ...applicationData, mealAfter: '참석' })} className="w-4 h-4 text-brand" /> 참석</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mealAfter" checked={applicationData.mealAfter === '미참석'} onChange={() => setApplicationData({ ...applicationData, mealAfter: '미참석' })} className="w-4 h-4 text-brand" /> 미참석</label>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={applicationData.privacyAgreed} onChange={(e) => setApplicationData({ ...applicationData, privacyAgreed: e.target.checked })} className="w-4 h-4 text-brand rounded" />
                                <span className="text-sm font-bold text-gray-700">개인정보 수집·이용에 동의합니다 <span className="text-red-500">*</span></span>
                            </label>
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
    </>
    );
};

export default ProgramApplyView;
