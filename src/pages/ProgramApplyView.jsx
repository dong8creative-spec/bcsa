import React, { useState } from 'react';
import { Icons } from '../components/Icons';

/**
 * 프로그램 신청/결제 전용 페이지 (제품 구매 페이지)
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

    const displayImage = (program.images && program.images[0])
        || (program.imageUrls && program.imageUrls[0])
        || program.imageUrl
        || program.img;
    const isPaid = program.applicationFee != null && Number(program.applicationFee) > 0;

    return (
        <div className="pt-28 pb-20 px-4 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-2xl">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-brand font-bold hover:underline mb-6 px-2 py-1 rounded-lg hover:bg-brand/5 transition-colors"
                >
                    <Icons.ArrowLeft size={20} /> 목록으로
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
                    {/* 프로그램 요약 */}
                    <div className="p-6 border-b border-blue-100">
                        <h1 className="text-2xl font-bold text-dark mb-4">프로그램 신청</h1>
                        {displayImage && (
                            <div className="w-full rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
                                <img src={displayImage} alt={program.title} className="w-full h-full object-cover" />
                            </div>
                        )}
                        <h2 className="text-lg font-bold text-dark mb-2">{program.title}</h2>
                        <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-2"><Icons.Calendar size={16} /> {program.date}</div>
                            {program.location && <div className="flex items-center gap-2"><Icons.MapPin size={16} /> {program.location}</div>}
                            {isPaid && (
                                <div className="font-bold text-brand mt-2">
                                    신청 비용: {new Intl.NumberFormat('ko-KR').format(Number(program.applicationFee))}원
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 신청 폼 */}
                    <div className="p-6 space-y-4">
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
                            disabled={submitting}
                            className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? '처리 중...' : (isPaid ? '결제하기' : '신청하기')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramApplyView;
