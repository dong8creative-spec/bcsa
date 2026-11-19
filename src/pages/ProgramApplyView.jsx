import React, { useState, useMemo } from 'react';
import { Icons } from '../components/Icons';
import { MgPageHead, MgInfoTable, HEADER_OFFSET_CLASS } from '../components/mg/Mg';
import { normalizeImagesList } from '../utils/imageUtils';
import { getParticipantCountDisplay, getSeminarCapacity, getDisplayedParticipantCurrent, is정모 } from '../utils/seminarDisplay';
import { getEffectiveCapacityLimit } from '../utils/adminHiddenApplications';

// 먼저가본 개편(2026-11): 상태 표시는 작은 네모 — 모집중=로얄블루, 마감임박=빨강, 종료=검정 바탕 위 흰 네모
const getStatusColor = (status) => {
    switch (status) {
        case '모집중': return 'bg-royal text-white';
        case '마감임박': return 'bg-red-600 text-white';
        case '후기작성가능': return 'bg-white text-ink';
        case '종료': return 'bg-white text-ink';
        default: return 'bg-sky text-royal';
    }
};

// 참여 경로 선택지 — 저장되는 값(관리자 화면 집계용)은 그대로 두고, 화면 글만 새 서비스 이름으로 보여준다.
const PARTICIPATION_PATHS = ['부청사 오픈채팅', 'SNS', '지인 추천', '기타'];
const participationPathLabel = (opt) => (opt === '부청사 오픈채팅' ? '먼저가본 오픈채팅' : opt);

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
            <div className={`min-h-screen min-h-0 overflow-y-auto bg-white px-5 pb-20 ${HEADER_OFFSET_CLASS}`}>
                <div className="mx-auto mt-12 max-w-[560px] rounded-xl bg-card px-6 py-10 text-center md:mt-16">
                    <Icons.AlertCircle className="mx-auto mb-4 h-12 w-12 text-sub" aria-hidden="true" />
                    <h2 className="mb-2 text-[22px] font-bold text-ink">프로그램을 찾을 수 없습니다</h2>
                    <p className="mb-6 text-[16px] text-sub">존재하지 않거나 삭제된 프로그램일 수 있습니다.</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-12 rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white transition-colors hover:bg-black"
                    >
                        돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const isPaid = program.applicationFee != null && Number(program.applicationFee) > 0;
    const isEnded = program.status === '종료';
    const currentCap = getDisplayedParticipantCurrent(program);
    const effectiveLimit = getEffectiveCapacityLimit(program);
    const isDisabledByCapacity = Number.isFinite(effectiveLimit) && currentCap >= effectiveLimit;
    const maxCap = getSeminarCapacity(program);

    const fieldLabel = 'mb-2 block text-[15px] font-semibold text-ink';
    const textareaCls = 'h-28 w-full resize-none rounded-lg border border-line2 bg-white p-3 text-[16px] text-ink placeholder:text-[#9a9a9a] focus:border-royal focus:outline-none';
    const choiceCls = (on) => `inline-flex h-12 items-center justify-center rounded-lg border px-4 text-[15px] font-semibold transition-colors ${on ? 'border-royal bg-sky text-royal' : 'border-line2 bg-white text-ink hover:border-ink'}`;

    return (
        <>
        <div className="relative min-h-screen min-h-0 overflow-y-auto bg-white">
            <MgPageHead
                crumbs={(
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] text-white/80 transition-colors hover:text-white"
                    >
                        <Icons.ArrowLeft size={18} /> 목록으로
                    </button>
                )}
                title={<span className="break-keep">{program.title}</span>}
            >
                {(program.status || program.category) ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {program.status && (
                            <span className={`inline-flex h-7 items-center px-2.5 text-[14px] font-semibold ${getStatusColor(program.status)}`}>
                                {program.status}
                            </span>
                        )}
                        {program.category && (
                            <span className="inline-flex h-7 items-center border border-white/40 px-2.5 text-[14px] text-white">
                                {program.category}
                            </span>
                        )}
                    </div>
                ) : null}
            </MgPageHead>

            <div className="mx-auto max-w-[760px] px-5 pb-20 pt-8 md:pt-12">
                {/* ========== 프로그램 상세 영역 ========== */}
                <section aria-label="프로그램 정보" className="mb-10">
                    {/* 신청 비용 · 일시 · 장소 · 정원 — 얇은 선 정보 표 */}
                    <MgInfoTable
                        rows={[
                            ['신청 비용', isPaid ? (
                                <span className="text-[20px] font-bold text-royal">
                                    {new Intl.NumberFormat('ko-KR').format(Number(program.applicationFee))}원
                                </span>
                            ) : (
                                <span className="text-[20px] font-bold text-ink">무료</span>
                            )],
                            ['일시', program.date || '\u00a0'],
                            ['장소', program.location || null],
                            ['정원', (() => {
                                const d = getParticipantCountDisplay(program);
                                if (d.mode === 'noCapacity') return `${d.current}명`;
                                return `${d.current} / ${d.max}명`;
                            })()],
                        ]}
                    />

                    {/* 상세 설명 */}
                    {program.desc && (
                        <div className="mt-8">
                            <h2 className="mb-3 text-[20px] font-bold text-ink">상세 내용</h2>
                            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#333]">{program.desc}</p>
                        </div>
                    )}

                    {/* 첨부 사진: 세로 나열 (상세페이지 스타일, 잘림 없이) */}
                    {images.length > 0 && (
                        <div className="mt-8">
                            <h2 className="mb-3 text-[20px] font-bold text-ink">첨부 사진</h2>
                            <div className="flex flex-col gap-3">
                                {images.map((src, idx) => (
                                    <img
                                        key={idx}
                                        src={src}
                                        alt={`${program.title} ${idx + 1}`}
                                        className="block w-full max-w-full border border-line object-contain"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ========== 취소/환불 규정 (결제 및 신청 바로 위) ========== */}
                <section className="mb-10 rounded-xl bg-card p-5 text-[15px] md:p-7">
                    <h2 className="mb-4 text-[18px] font-bold text-ink">[부산청년사업가 포럼] 취소 및 환불 규정</h2>
                    <div className="space-y-4 leading-relaxed text-[#333]">
                        <section>
                            <h3 className="mb-2 font-semibold text-ink">제1조 (목적)</h3>
                            <p className="mb-0">본 규정은 '부산청년사업가 포럼'(이하 "포럼")이 제공하는 유료 세미나 및 교육 프로그램의 취소 및 환불에 관한 사항을 규정함을 목적으로 합니다.</p>
                        </section>
                        <section>
                            <h3 className="mb-2 font-semibold text-ink">제2조 (환불 기준)</h3>
                            <p className="mb-3">회원은 세미나 시작 전까지 취소를 요청할 수 있으며, 환불액은 '소비자분쟁해결기준'에 의거하여 취소 시점에 따라 차등 적용됩니다.</p>
                            <div className="mb-3">
                                <h4 className="mb-2 font-semibold text-ink">1. 환불 적용 기간 및 비율</h4>
                                <ul className="list-none space-y-2 pl-0">
                                    <li className="flex gap-2"><span className="shrink-0 text-royal">◦</span><span>세미나 개최 3일 전 (23:59까지): 결제 금액 100% 환불</span></li>
                                    <li className="flex gap-2"><span className="shrink-0 text-royal">◦</span><span>세미나 개최 2일 전 (23:59까지): 결제 금액의 90% 환불 (위약금 10% 공제)</span></li>
                                    <li className="flex gap-2"><span className="shrink-0 text-royal">◦</span><span>세미나 개최 1일 전 (23:59까지): 결제 금액의 80% 환불 (위약금 20% 공제)</span></li>
                                    <li className="flex gap-2"><span className="shrink-0 text-royal">◦</span><span>세미나 당일 및 시작 시간 이후: 환불 불가 (노쇼 포함)</span></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="mb-2 font-semibold text-ink">2. 패키지 상품 (세미나+자료) 예외 조항</h4>
                                <ul className="list-none space-y-2 pl-0">
                                    <li className="flex gap-2"><span className="shrink-0 text-royal">◦</span><span>세미나 참가권과 디지털 자료(PDF, 영상 등)가 결합된 상품의 경우, 자료를 다운로드하거나 열람한 이력이 확인되면 해당 자료 비용(정가 기준)을 공제한 후 남은 차액에 대해 위 기간별 비율을 적용합니다.</span></li>
                                </ul>
                            </div>
                        </section>
                        <section>
                            <h3 className="mb-2 font-semibold text-ink">제3조 (환불 신청 방법)</h3>
                            <ol className="list-inside list-decimal space-y-2 pl-2">
                                <li>환불 신청은 [마이페이지 &gt; 결제내역]에서 직접 취소하거나, 포럼 공식 이메일로 접수해야 합니다.</li>
                                <li>유선(전화)을 통한 구두 취소는 정확한 시점 확인이 어려워 인정되지 않으며, 시스템상 기록이 남는 온라인 신청을 원칙으로 합니다.</li>
                            </ol>
                        </section>
                        <section>
                            <h3 className="mb-2 font-semibold text-ink">제4조 (포럼 귀책사유 및 폐강)</h3>
                            <ol className="list-inside list-decimal space-y-2 pl-2">
                                <li>천재지변, 강사 부재, 최소 인원 미달 등 포럼 측의 사정으로 세미나가 취소될 경우, 시점과 관계없이 결제 금액 100%를 전액 환불합니다.</li>
                                <li>환불 처리는 취소 확정일로부터 영업일 기준 3~5일 이내에 진행됩니다.</li>
                            </ol>
                        </section>
                    </div>
                </section>

                {/* ========== 결제 및 신청 영역 ========== */}
                <section aria-labelledby="apply-form-title" className="rounded-[18px] border border-line">
                    <div className="border-b border-line p-5 md:p-8">
                        <h2 id="apply-form-title" className="text-[22px] font-bold text-ink">결제 및 신청</h2>
                        <p className="mt-1 text-[15px] text-sub">아래 항목을 입력한 뒤 참여신청 버튼을 눌러주세요.</p>
                    </div>
                    <div className="space-y-6 p-5 md:p-8">
                        <fieldset>
                            <legend className={fieldLabel}>참여 경로 <span className="text-red-600">*</span></legend>
                            <div className="flex flex-wrap gap-2">
                                {PARTICIPATION_PATHS.map((opt) => (
                                    <button key={opt} type="button" aria-pressed={applicationData.participationPath === opt} onClick={() => setApplicationData({ ...applicationData, participationPath: opt })} className={choiceCls(applicationData.participationPath === opt)}>{participationPathLabel(opt)}</button>
                                ))}
                            </div>
                        </fieldset>
                        <div>
                            <label htmlFor="apply-reason" className={fieldLabel}>강연 신청 계기 <span className="text-[14px] font-normal text-sub">(선택)</span></label>
                            <textarea id="apply-reason" className={textareaCls} value={applicationData.applyReason} onChange={(e) => setApplicationData({ ...applicationData, applyReason: e.target.value })} placeholder="신청 계기를 입력해주세요" />
                        </div>
                        <div>
                            <label htmlFor="apply-prequestions" className={fieldLabel}>강연 사전 질문 <span className="text-[14px] font-normal text-sub">(선택)</span></label>
                            <textarea id="apply-prequestions" className={textareaCls} value={applicationData.preQuestions} onChange={(e) => setApplicationData({ ...applicationData, preQuestions: e.target.value })} placeholder="사전 질문을 입력해주세요" />
                        </div>
                        <fieldset>
                            <legend className={fieldLabel}>강연 후 식사 여부 <span className="text-red-600">*</span></legend>
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                <label className={`${choiceCls(applicationData.mealAfter === '참석')} cursor-pointer gap-2 sm:min-w-[120px]`}><input type="radio" name="mealAfter" checked={applicationData.mealAfter === '참석'} onChange={() => setApplicationData({ ...applicationData, mealAfter: '참석' })} className="h-4 w-4 accent-royal" /> 참석</label>
                                <label className={`${choiceCls(applicationData.mealAfter === '미참석')} cursor-pointer gap-2 sm:min-w-[120px]`}><input type="radio" name="mealAfter" checked={applicationData.mealAfter === '미참석'} onChange={() => setApplicationData({ ...applicationData, mealAfter: '미참석' })} className="h-4 w-4 accent-royal" /> 미참석</label>
                            </div>
                        </fieldset>
                        <div className="rounded-lg bg-card px-4 py-3">
                            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                                <input type="checkbox" checked={applicationData.privacyAgreed} onChange={(e) => setApplicationData({ ...applicationData, privacyAgreed: e.target.checked })} className="h-5 w-5 shrink-0 accent-royal" />
                                <span className="text-[15px] font-semibold text-ink">개인정보 수집·이용에 동의합니다 <span className="text-red-600">*</span></span>
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || isEnded || isDisabledByCapacity}
                            className="h-[53px] w-full rounded-lg bg-royal text-[17px] font-bold text-white transition-colors hover:bg-royalDark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isEnded
                                ? '종료된 프로그램입니다'
                                : isDisabledByCapacity
                                    ? '정원 마감'
                                    : submitting
                                        ? (isPaid ? '결제 진행 중...' : '신청 처리 중...')
                                        : (maxCap > 0 && currentCap >= maxCap)
                                            ? '정원 초과 접수 중'
                                            : '참여신청'
                            }
                        </button>
                    </div>
                </section>
            </div>
        </div>
    </>
    );
};

export default ProgramApplyView;
