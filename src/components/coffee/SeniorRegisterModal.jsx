import React, { useEffect, useRef, useState } from 'react';
import coffeeChatService, { CC_TYPES, CC_TOPICS, CC_INDUSTRIES, CC_PRICE_STEP, won, payoutOf, toMs, checkOpenChat } from '../../services/coffeeChatService';
import { uploadImage } from '../../utils/imageUtils';
import { useCoffeeChat } from './CoffeeChatProvider';
import { CcModal, CcTag, CcChip, CcSegment, CcField, CcNote, CcError, CcAvatar, ccBtn, ccInput } from './ui';

/**
 * 선배 등록·프로필 수정 (창 이름 'register')
 * 새 등록: 1/2 안내 → 2/2 프로필 → 가입 완료. 기존 선배: 같은 폼으로 수정(반려면 저장 시 다시 심사).
 * 작성 중인 내용은 이 기기(브라우저)에 자동 저장 → 창을 닫거나 새로고침해도 다시 열면 이어 쓴다(2026-11-20). 저장에 성공하면 지운다.
 */

const draftKeyOf = (uid) => `bcsa_cc_reg_draft_${uid}`;
const readDraft = (uid) => { try { const v = JSON.parse(localStorage.getItem(draftKeyOf(uid)) || 'null'); return v && v.form ? v : null; } catch (_) { return null; } };
const writeDraft = (uid, mode, form) => { try { localStorage.setItem(draftKeyOf(uid), JSON.stringify({ mode, at: Date.now(), form: { ...form, agree: false } })); return true; } catch (_) { return false; } };
const clearDraft = (uid) => { try { localStorage.removeItem(draftKeyOf(uid)); } catch (_) { /* 저장소를 못 쓰는 브라우저 */ } };
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
const priceOptions = (type) => {
    const out = [];
    for (let v = CC_TYPES[type].min; v <= CC_TYPES[type].max; v += CC_PRICE_STEP) out.push(v);
    return out;
};
/** 기존 가격이 규칙에 맞지 않으면 권장값으로 */
const okPrice = (type, v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= CC_TYPES[type].min && n % CC_PRICE_STEP === 0 && n <= (type === 'online30' ? 100000 : CC_TYPES[type].max) ? n : CC_TYPES[type].recommended;
};

const EMPTY = {
    name: '', bizName: '', industry: '', area: '', years: '', topics: [], intro: '', photoUrl: '', openChatUrl: '',
    online30: CC_TYPES.online30.recommended, visit60: CC_TYPES.visit60.recommended, agree: false,
};

/** 단계별 안내 — 소개 / 새 등록 폼 / 프로필 고치기 / 가입 완료 따로. 머리줄 「단계별 안내」 버튼, 처음 한 번 자동 */
const TOUR_INTRO = {
    id: 'register-intro',
    steps: [
        { title: '선배 사장 등록', body: '업력 3년 이상 사장님이 노하우를 나누고 유료 커피챗을 열 수 있게 등록하는 과정이에요. 두 단계면 끝나요.' },
        { target: 'reg-who', title: '누가 할 수 있나요', body: '업력 3년 이상 사장님이면 신청할 수 있어요. 승인되면 노하우 글을 쓰고 후배와 1:1 커피챗을 진행해요.' },
        { target: 'reg-rules', title: '꼭 알아 둘 규칙', body: '결제 금액의 10%가 수수료이고 정산은 매월 10일이에요. 거절·무응답·제때 한 취소는 후배에게 전액 환불돼요.' },
        { target: 'reg-start', title: '다음에 할 일', body: '「선배로 등록 시작」을 누르면 프로필 입력 화면이 나와요. 등록 신청 뒤 운영진이 승인하면 활동이 시작돼요.' },
    ],
};
const TOUR_FORM = {
    id: 'register-form',
    steps: [
        { title: '선배 프로필 입력', body: '후배들이 보고 선배를 고르는 정보예요. 실명 기반이라 정확히 써 주세요. 빨간 * 표시 칸은 꼭 채워야 해요.' },
        { target: 'reg-name', title: '이름·상호', body: '이름(실명)과 가게 이름을 써 주세요. 후배들에게 공개돼요.' },
        { target: 'reg-years', title: '업종·상권·업력', body: '업종을 고르고 상권(구·동)과 업력을 써 주세요. 업력은 3년 이상이어야 등록돼요.' },
        { target: 'reg-topics', title: '잘 아는 주제', body: '1~4개를 골라 주세요. 후배들이 주제로 선배를 찾아요.' },
        { target: 'reg-kakao', title: '카카오 오픈채팅 주소', body: 'https://open.kakao.com/ 으로 시작하는 1:1 오픈채팅 주소예요. 확정된 후배에게만 보이고, 없으면 신청을 수락할 수 없어요.' },
        { target: 'reg-price', title: '첫 커피챗 가격', body: '30분은 2만~5만 원, 60분은 5만~10만 원에서 5천 원 단위로 골라요. 아래에 수수료 10%를 뺀 받는 금액이 보여요.' },
        { target: 'reg-agree', title: '규정 동의', body: '수수료 10%, 매월 10일 정산, 환불 규정을 확인하고 체크해 주세요.' },
        { target: 'reg-submit', title: '등록 신청하기', body: '누르면 운영진에게 심사가 요청돼요. 승인되면 노하우 글을 쓰고 커피챗 신청을 받을 수 있어요.' },
    ],
};
const TOUR_EDIT = {
    id: 'register-edit',
    steps: [
        { title: '선배 프로필 고치기', body: '후배에게 보이는 내 정보와 오픈채팅 주소를 고치는 화면이에요. 반려된 경우 고쳐서 저장하면 다시 심사를 받아요.' },
        { target: 'reg-name', title: '기본 정보', body: '이름·상호·업종·상권·업력을 고칠 수 있어요. 업력은 3년 이상이어야 해요.' },
        { target: 'reg-topics', title: '잘 아는 주제', body: '1~4개를 골라 주세요. 후배들이 주제로 선배를 찾아요.' },
        { target: 'reg-intro', title: '한 줄 소개', body: '300자까지 쓸 수 있어요. 어떤 가게를 몇 년째 하는지, 무엇을 잘 도와줄 수 있는지 써 주세요.' },
        { target: 'reg-kakao', title: '카카오 오픈채팅 주소', body: '확정된 후배에게만 보이는 주소예요. 바뀌었다면 꼭 고쳐 주세요. 없으면 신청을 수락할 수 없어요.' },
        { target: 'reg-submit', title: '저장하기', body: '누르면 바로 반영돼요. 가격은 「내 커피챗 → 선배 활동 → 가격 수정」에서 바꿔요.' },
    ],
};
const TOUR_DONE = {
    id: 'register-done',
    steps: [
        { title: '등록 신청이 끝났어요', body: '운영진이 확인한 뒤 선배 활동이 시작돼요. 그 전까지 내 프로필은 다른 회원에게 보이지 않아요.' },
        { target: 'reg-done-card', title: '심사 중인 내 프로필', body: '「심사 중」이 「인증 선배」로 바뀌면 승인된 거예요. 「내 커피챗 → 선배 활동」에서 확인할 수 있어요.' },
        { target: 'reg-done-prices', title: '가격 정하기', body: '「커피챗 가격 정하러 가기」에서 30분·60분 가격을 바꿀 수 있어요.' },
        { target: 'reg-done-hub', title: '노하우 둘러보기', body: '다른 선배들이 쓴 글을 둘러보며 내 글은 어떻게 쓸지 생각해 보세요.' },
    ],
};

export default function SeniorRegisterModal({ onClose, depth }) {
    const cc = useCoffeeChat();
    const [step, setStep] = useState('loading'); // loading | intro | form | done
    const [isNew, setIsNew] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [kakaoTouched, setKakaoTouched] = useState(false);
    const [restoredAt, setRestoredAt] = useState(0); // 불러온 임시 저장 시각(0이면 안내 안 함)
    const [savedAt, setSavedAt] = useState(0);
    const senior = cc.mySenior;
    const dirty = useRef(false); // 사용자가 직접 고친 뒤에만 임시 저장
    const done = useRef(false); // 저장에 성공하면 더 저장하지 않음
    const latest = useRef({ form: EMPTY, isNew: false, step: 'loading' });
    const contactUrl = useRef('');

    useEffect(() => {
        if (!cc.uid) { cc.requireLogin(); onClose?.(); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (step !== 'loading' || !cc.uid || senior === undefined) return undefined;
        const d = readDraft(cc.uid);
        if (senior === null) {
            setIsNew(true);
            // 쓰다 만 등록이 있으면 안내를 건너뛰고 이어 쓰기
            if (d && d.mode === 'new') { setForm({ ...EMPTY, ...d.form, agree: false }); setRestoredAt(d.at); setStep('form'); } else { setForm({ ...EMPTY, openChatUrl: contactUrl.current }); setStep('intro'); }
            return undefined;
        }
        setIsNew(false);
        const base = {
            ...EMPTY,
            name: senior.name || '', bizName: senior.bizName || '', industry: senior.industry || '', area: senior.area || '',
            years: senior.years ? String(senior.years) : '', topics: Array.isArray(senior.topics) ? senior.topics : [], intro: senior.intro || '',
            photoUrl: senior.photoUrl || '', openChatUrl: contactUrl.current,
            online30: okPrice('online30', senior.prices?.online30), visit60: okPrice('visit60', senior.prices?.visit60),
        };
        // 고치다 만 내용이 저장된 프로필보다 나중 것이면 이어 쓰기
        if (d && d.mode === 'edit' && d.at > toMs(senior.updatedAt)) { setForm({ ...base, ...d.form, agree: false }); setRestoredAt(d.at); } else setForm(base);
        setStep('form');
        return undefined;
    }, [senior, cc.uid, step]);

    // 오픈채팅 주소는 로그인한 사람이 바뀔 때만 따로 불러온다(위 효과는 step 이 바뀌며 다시 돌아 결과를 버리기 때문)
    useEffect(() => {
        if (!cc.uid) return undefined;
        let alive = true;
        coffeeChatService.getMyContact(cc.uid).then((c) => {
            if (alive && c?.openChatUrl) { contactUrl.current = c.openChatUrl; setForm((f) => (f.openChatUrl ? f : { ...f, openChatUrl: c.openChatUrl })); }
        }).catch(() => {});
        return () => { alive = false; };
    }, [cc.uid]);

    // 자동 임시 저장: 고친 뒤 0.5초 멈추면 저장. 창을 닫거나 페이지를 떠날 때도 바로 저장
    latest.current = { form, isNew, step };
    useEffect(() => {
        if (step !== 'form' || !cc.uid || !dirty.current || done.current) return undefined;
        const t = setTimeout(() => { if (writeDraft(cc.uid, isNew ? 'new' : 'edit', form)) setSavedAt(Date.now()); }, 500);
        return () => clearTimeout(t);
    }, [form, step, isNew, cc.uid]);
    useEffect(() => {
        if (!cc.uid) return undefined;
        const flush = () => {
            const { form: f, isNew: n, step: st } = latest.current;
            if (st === 'form' && dirty.current && !done.current) writeDraft(cc.uid, n ? 'new' : 'edit', f);
        };
        window.addEventListener('pagehide', flush);
        return () => { window.removeEventListener('pagehide', flush); flush(); };
    }, [cc.uid]);

    if (!cc.uid) return null;

    const set = (k) => (v) => { dirty.current = true; setForm((f) => ({ ...f, [k]: v })); setErr(''); };
    const onText = (k) => (e) => set(k)(e.target.value);
    const kakao = checkOpenChat(form.openChatUrl);
    const kakaoErr = kakaoTouched && form.openChatUrl.trim() ? kakao.error : '';
    // 칸을 벗어나면 공유 문구에서 주소만 남기고 https 로 맞춘다
    const onKakaoBlur = () => { setKakaoTouched(true); if (!kakao.error && kakao.url && kakao.url !== form.openChatUrl) set('openChatUrl')(kakao.url); };
    const discardDraft = () => { clearDraft(cc.uid); dirty.current = false; setRestoredAt(0); setSavedAt(0); setErr(''); setKakaoTouched(false); setStep('loading'); };
    const yearsN = Number(form.years);
    const yearsShort = form.years !== '' && Number.isFinite(yearsN) && yearsN < 3;
    const toggleTopic = (t) => { dirty.current = true; setForm((f) => {
        if (f.topics.includes(t)) return { ...f, topics: f.topics.filter((x) => x !== t) };
        return f.topics.length >= 4 ? f : { ...f, topics: [...f.topics, t] };
    }); };

    const onPhoto = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)) { setErr('사진 파일만 올릴 수 있어요.'); return; }
        if (file.size > 10 * 1024 * 1024) { setErr('사진은 10MB 이하로 올려 주세요.'); return; }
        setUploading(true); setErr('');
        try {
            const url = await uploadImage(file, 'community');
            dirty.current = true;
            setForm((f) => ({ ...f, photoUrl: url || '' }));
        } catch (x) {
            setErr(x?.message || '사진을 올리지 못했어요.');
        } finally {
            setUploading(false);
        }
    };

    const validate = () => {
        if (!form.name.trim()) return '이름(실명)을 써 주세요.';
        if (!form.bizName.trim()) return '상호명을 써 주세요.';
        if (!CC_INDUSTRIES.includes(form.industry)) return '업종을 골라 주세요.';
        if (!form.area.trim()) return '상권(구·동)을 써 주세요.';
        if (!Number.isInteger(yearsN) || form.years === '') return '업력을 숫자(년)로 써 주세요.';
        if (yearsN < 3) return '업력 3년 이상부터 선배로 등록할 수 있어요.';
        if (yearsN > 60) return '업력은 60년까지 쓸 수 있어요.';
        if (form.topics.length < 1 || form.topics.length > 4) return '관심(전문) 주제를 1~4개 골라 주세요.';
        if (form.intro.trim().length > 300) return '한 줄 소개는 300자까지 쓸 수 있어요.';
        if (kakao.error) { setKakaoTouched(true); return kakao.error; }
        if (uploading) return '사진을 올리는 중이에요. 잠시만 기다려 주세요.';
        if (isNew && !form.agree) return '수수료·정산·환불 규정에 동의해 주세요.';
        return '';
    };

    const save = async () => {
        const v = validate();
        if (v) { setErr(v); return; }
        setBusy(true); setErr('');
        try {
            const data = {
                name: form.name, bizName: form.bizName, industry: form.industry, area: form.area, years: yearsN,
                topics: form.topics, intro: form.intro, photoUrl: form.photoUrl,
                prices: { online30: Number(form.online30), visit60: Number(form.visit60) },
                accepting: isNew ? true : senior?.accepting !== false,
                resubmit: !isNew && senior?.status === 'rejected',
            };
            await coffeeChatService.saveSenior(cc.uid, data, { isNew, contact: { openChatUrl: kakao.url } });
            done.current = true;
            clearDraft(cc.uid);
            if (isNew) { setStep('done'); setBusy(false); } else onClose?.();
        } catch (x) {
            setErr(x?.message || '저장하지 못했어요. 입력값을 확인해 주세요.');
            setBusy(false);
        }
    };

    const title = step === 'done' ? '가입 완료' : step === 'form' ? (isNew ? '선배 프로필 설정' : '선배 프로필 고치기') : '선배 사장 등록';
    let footer = null;
    if (step === 'intro') footer = <button type="button" data-tour="reg-start" className={ccBtn.primary} onClick={() => setStep('form')}>선배로 등록 시작</button>;
    if (step === 'form') footer = <button type="button" data-tour="reg-submit" className={ccBtn.primary} onClick={save} disabled={busy || uploading}>{busy ? '저장하는 중…' : isNew ? '등록 신청하기' : '저장하기'}</button>;
    if (step === 'done') {
        footer = (
            <div className="grid gap-2">
                <button type="button" data-tour="reg-done-hub" className={ccBtn.primary} onClick={() => { cc.closeAll(); cc.open('hub'); }}>노하우 둘러보기</button>
                <button type="button" data-tour="reg-done-prices" className={ccBtn.line} onClick={() => cc.replace('prices')}>커피챗 가격 정하러 가기</button>
            </div>
        );
    }
    const tour = step === 'intro' ? TOUR_INTRO : step === 'form' ? (isNew ? TOUR_FORM : TOUR_EDIT) : step === 'done' ? TOUR_DONE : undefined;
    const onBack = step === 'form' && isNew ? () => { setStep('intro'); setErr(''); } : depth > 0 ? onClose : undefined;

    return (
        <CcModal title={title} onClose={onClose} onBack={onBack} depth={depth} footer={footer} tour={tour}>
            {step === 'loading' ? <p role="status" className="py-10 text-center text-[15px] text-sub">불러오는 중이에요…</p> : null}

            {step === 'intro' ? (
                <div>
                    <CcTag tone="sky">단계 1/2</CcTag>
                    <h3 className="mt-3 text-[22px] font-bold leading-snug text-ink">먼저가본에서 선배 사장으로<br />노하우를 나눠 주세요</h3>
                    <section data-tour="reg-who" className="mt-5 border border-[#0c0c0e] p-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[18px] font-bold text-ink">선배 사장</p>
                            <CcTag tone="royal">경험 나눔 &amp; 수익 창출</CcTag>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 bg-card px-3 py-3 text-[15px]">
                            <div><dt className="text-[13px] text-sub">자격 요건</dt><dd className="font-semibold text-ink">업력 3년 이상</dd></div>
                            <div><dt className="text-[13px] text-sub">주요 활동</dt><dd className="font-semibold text-ink">노하우 공유 · 커피챗 운영</dd></div>
                        </dl>
                        <p className="mt-3 text-[15px] leading-relaxed text-ink">골목에서 버텨 낸 실전 노하우를 후배 사장에게 전하고, 유료 커피챗으로 보람과 가치를 얻으세요.</p>
                    </section>
                    <section data-tour="reg-rules" className="mt-4 border border-line p-4">
                        <h4 className="text-[16px] font-bold text-ink">운영 규칙 요약</h4>
                        <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-ink">
                            <li>· 수수료 10%: 결제 금액에서 10%를 빼고 받아요. (예: 30,000원 → {won(payoutOf(30000))})</li>
                            <li>· 정산: 매월 10일, 운영진이 확인 후 지급해요.</li>
                            <li>· 환불: 선배가 거절하거나 24시간 안에 답하지 않으면 후배에게 전액 환불돼요. 확정 후에는 약속 24시간 전까지 후배가 취소하면 전액 환불, 선배 사정으로 취소해도 전액 환불돼요.</li>
                            <li>· 등록 신청 후 운영진 확인을 거쳐 활동이 시작돼요.</li>
                        </ul>
                    </section>
                </div>
            ) : null}

            {step === 'form' ? (
                <div>
                    {isNew ? <div className="mb-4"><CcTag tone="sky">단계 2/2</CcTag></div> : null}
                    {!isNew && senior?.status === 'rejected' ? (
                        <div className="mb-5"><CcNote tone="alert" title="등록이 반려됐어요">{senior.rejectReason ? `사유: ${senior.rejectReason}` : '운영진이 남긴 사유가 없어요.'} 고쳐서 저장하면 다시 심사를 받아요.</CcNote></div>
                    ) : null}
                    {!isNew && senior?.status === 'pending' ? <div className="mb-5"><CcNote>운영진이 프로필을 확인하고 있어요. 고친 내용도 함께 확인해요.</CcNote></div> : null}
                    {isNew ? <div className="mb-5"><CcNote title="기본 정보 입력">실명 기반 신뢰 커뮤니티를 위해 정확히 입력해 주세요.</CcNote></div> : null}
                    {restoredAt ? (
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3 text-[14px]">
                            <span className="text-ink"><b>쓰던 내용을 불러왔어요</b> <span className="text-sub">({hhmm(restoredAt)} 저장)</span></span>
                            <button type="button" className={ccBtn.small} onClick={discardDraft}>처음부터 다시 쓰기</button>
                        </div>
                    ) : null}

                    <CcField label="이름(실명)" required htmlFor="cc-reg-name" hint="활동할 때 후배들에게 공개되는 실명이에요.">
                        <input id="cc-reg-name" data-tour="reg-name" value={form.name} maxLength={40} onChange={onText('name')} autoComplete="name" className={`${ccInput} h-12`} />
                    </CcField>
                    <CcField label="상호명" required htmlFor="cc-reg-biz">
                        <input id="cc-reg-biz" value={form.bizName} maxLength={60} onChange={onText('bizName')} placeholder="예: 전포 카페 브루어스" className={`${ccInput} h-12`} />
                    </CcField>
                    <CcField label="업종" required>
                        <CcSegment label="업종" cols={3} value={form.industry} onChange={set('industry')} items={CC_INDUSTRIES.map((x) => [x, x])} />
                    </CcField>
                    <CcField label="상권(구·동)" required htmlFor="cc-reg-area">
                        <input id="cc-reg-area" value={form.area} maxLength={40} onChange={onText('area')} placeholder="예: 부산진구 전포동" className={`${ccInput} h-12`} />
                    </CcField>
                    <CcField label="업력(년)" required htmlFor="cc-reg-years" hint={yearsShort ? null : '3~60년, 숫자로 써 주세요.'}>
                        <input id="cc-reg-years" data-tour="reg-years" type="number" inputMode="numeric" min={3} max={60} step={1} value={form.years} onChange={onText('years')}
                            aria-invalid={yearsShort} aria-describedby={yearsShort ? 'cc-reg-years-err' : undefined} className={`${ccInput} h-12`} />
                        {yearsShort ? <p id="cc-reg-years-err" className="mt-1.5 text-[15px] text-red-600">업력 3년 미만은 선배로 등록할 수 없어요. 3년 이상부터 신청해 주세요.</p> : null}
                    </CcField>
                    <div className="mb-5">
                        <div className="mb-2 flex items-end justify-between gap-2">
                            <p id="cc-reg-topics" className="text-[15px] font-semibold text-ink">관심(전문) 주제<span className="ml-0.5 text-red-600">*</span></p>
                            <span className="text-[13px] text-sub">{form.topics.length}/4개 선택</span>
                        </div>
                        <div data-tour="reg-topics" role="group" aria-labelledby="cc-reg-topics" className="flex flex-wrap gap-2">
                            {CC_TOPICS.map((t) => (
                                <CcChip key={t} on={form.topics.includes(t)} onClick={() => toggleTopic(t)} disabled={!form.topics.includes(t) && form.topics.length >= 4}>#{t}</CcChip>
                            ))}
                        </div>
                    </div>
                    <CcField label="한 줄 소개" htmlFor="cc-reg-intro" counter={`${form.intro.length}/300자`}>
                        <textarea id="cc-reg-intro" data-tour="reg-intro" value={form.intro} maxLength={300} rows={3} onChange={onText('intro')}
                            placeholder="예: 전포동에서 5년째 로스터리 카페를 운영하고 있어요." className={`${ccInput} min-h-[96px] py-3 leading-relaxed`} />
                    </CcField>
                    <div className="mb-5">
                        <label htmlFor="cc-reg-photo" className="mb-2 block text-[15px] font-semibold text-ink">프로필 사진(선택)</label>
                        <div className="flex items-center gap-3">
                            <CcAvatar src={form.photoUrl} name={form.name} size={64} />
                            <div className="flex flex-wrap gap-2">
                                <input id="cc-reg-photo" type="file" accept="image/*" onChange={onPhoto} disabled={uploading} className="sr-only" />
                                <label htmlFor="cc-reg-photo" aria-hidden="true" className={`${ccBtn.small} cursor-pointer`}>{uploading ? '올리는 중…' : form.photoUrl ? '사진 바꾸기' : '사진 올리기'}</label>
                                {form.photoUrl ? <button type="button" className={ccBtn.small} onClick={() => set('photoUrl')('')}>사진 빼기</button> : null}
                            </div>
                        </div>
                    </div>
                    <CcField label="카카오 1:1 오픈채팅 주소" required htmlFor="cc-reg-kakao" hint={kakaoErr ? null : '확정된 후배에게만 보여요. 카카오톡 → 오픈채팅 → 1:1 채팅방 만들기 → 링크 복사로 받을 수 있어요.'}>
                        <input id="cc-reg-kakao" data-tour="reg-kakao" type="url" inputMode="url" value={form.openChatUrl} maxLength={300} onChange={onText('openChatUrl')} onBlur={onKakaoBlur}
                            aria-invalid={!!kakaoErr} aria-describedby={kakaoErr || kakao.warn ? 'cc-reg-kakao-msg' : undefined}
                            placeholder="https://open.kakao.com/o/..." className={`${ccInput} h-12 ${kakaoErr ? 'border-red-500' : ''}`} />
                        {kakaoErr ? <p id="cc-reg-kakao-msg" role="alert" className="mt-1.5 text-[15px] text-red-600">{kakaoErr}</p>
                            : kakao.warn && form.openChatUrl.trim() ? <p id="cc-reg-kakao-msg" className="mt-1.5 text-[15px] text-[#92400e]">{kakao.warn}</p> : null}
                    </CcField>

                    {isNew ? (
                        <>
                            <div className="mb-2 mt-2 text-[15px] font-semibold text-ink">첫 커피챗 가격</div>
                            <p className="mb-3 text-[15px] text-sub">권장 가격으로 시작해요. 5,000원 단위이며, 나중에 「가격 수정」에서 바꿀 수 있어요.</p>
                            <div data-tour="reg-price" className="grid grid-cols-2 gap-2">
                                {['online30', 'visit60'].map((k) => (
                                    <CcField key={k} label={`${CC_TYPES[k].short} 가격`} htmlFor={`cc-reg-price-${k}`} hint={`받는 금액 ${won(payoutOf(form[k]))}`}>
                                        <select id={`cc-reg-price-${k}`} value={form[k]} onChange={(e) => set(k)(Number(e.target.value))} className={`${ccInput} h-12`}>
                                            {priceOptions(k).map((v) => <option key={v} value={v}>{won(v)}{v === CC_TYPES[k].recommended ? ' (권장)' : ''}</option>)}
                                        </select>
                                    </CcField>
                                ))}
                            </div>
                            <div data-tour="reg-agree" className="mb-2 flex min-h-[48px] items-center gap-3 border border-line px-3">
                                <input id="cc-reg-agree" type="checkbox" checked={form.agree} onChange={(e) => set('agree')(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#2d4fe0]" />
                                <label htmlFor="cc-reg-agree" className="py-2 text-[15px] text-ink">수수료 10%·정산·환불 규정에 동의합니다</label>
                            </div>
                        </>
                    ) : (
                        <p className="text-[15px] text-sub">커피챗 가격은 「내 커피챗 → 선배 활동 → 가격 수정」에서 바꿀 수 있어요.</p>
                    )}
                    <CcError>{err}</CcError>
                    <p className="mt-3 text-[13px] text-sub" aria-live="polite">{savedAt ? `작성 중인 내용은 이 기기에 자동 저장돼요 · ${hhmm(savedAt)} 저장됨` : '작성 중인 내용은 이 기기에 자동 저장돼요.'}</p>
                </div>
            ) : null}

            {step === 'done' ? (
                <div>
                    <div className="py-4 text-center">
                        <CcTag tone="sky">선배 사장 가입 완료</CcTag>
                        <p className="mt-3 text-[20px] font-bold leading-snug text-ink">선배 등록 신청 완료 — 운영진 확인 후 활동이 시작돼요</p>
                        <p className="mt-2 text-[15px] text-sub">{form.name} 선배님, 먼저가본에 오신 것을 환영해요.</p>
                    </div>
                    <section data-tour="reg-done-card" className="border border-line p-4">
                        <div className="flex items-center gap-3">
                            <CcAvatar src={form.photoUrl} name={form.name} size={56} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-[17px] font-semibold text-ink">{form.name} 선배</p>
                                    <CcTag tone="royal">심사 중</CcTag>
                                </div>
                                <p className="truncate text-[15px] text-sub">{form.bizName}</p>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1 border-t border-line pt-3 text-[15px]">
                            <div className="flex justify-between gap-3"><span className="text-sub">업종 · 상권</span><span className="truncate font-semibold text-ink">{form.industry} · {form.area}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-sub">현장 업력</span><span className="font-semibold text-ink">{yearsN}년차</span></div>
                            <div className="flex justify-between gap-3"><span className="shrink-0 text-sub">관심 주제</span><span className="truncate text-right font-semibold text-ink">{form.topics.join(' · ')}</span></div>
                        </div>
                        <div className="mt-3"><CcNote title="선배 사장 활동 안내">승인되면 노하우 글을 올리고 후배 사장들과 1:1 커피챗을 진행할 수 있어요.</CcNote></div>
                    </section>
                </div>
            ) : null}
        </CcModal>
    );
}
