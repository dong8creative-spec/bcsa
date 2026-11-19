import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MgHero, MgWrap, MgSectionHead, MgTabs, MgCard, MgInfoCard } from '../components/mg/Mg';
import { groupService, groupCoverUrl } from '../services/groupService';
import { groupPoster } from '../constants/groupPosters';
import { useCoffeeChat } from '../components/coffee/CoffeeChatProvider';

/**
 * 홈 — 먼저가본 개편(2026-11). 가안(관리자 「개선」)과 같은 5구역:
 *  첫 화면 → 지금 모집 중(클럽: 모임·스터디, 탭: 모집중/모집예정) → 할 수 있는 것 → 프로그램(2026-11-20 운영자 지시로 따로 구역) → 협력기관 → 알림 신청
 * 모임은 groups(운영 중), 프로그램은 seminars(공개 목록)를 그대로 쓴다. 카드를 누르면 기존 상세·신청 화면으로 간다.
 */
const OPEN_STATES = ['모집중', '마감임박'];
const seminarImage = (s) => (s.images && s.images[0]) || (s.imageUrls && s.imageUrls[0]) || s.imageUrl || s.img || '';
const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;

function groupCard(g) {
    const p = groupPoster(g);
    return {
        key: `g-${g.id}`,
        image: (p && (p.card || p.image)) || groupCoverUrl(g),
        imagePosition: p && !p.card ? 'top' : undefined,
        state: g.recruit === 'soon' ? '모집예정' : '모집중',
        title: g.title,
        meta: <>{[g.region, g.schedule].filter(Boolean).join(' ㅣ ') || (g.type === 'study' ? '스터디' : '소모임')}<br />{p ? p.tagline : (g.description || '').slice(0, 40)}</>,
        href: `/groups/${g.id}`,
        sort: p ? 0 : 1,
    };
}

function seminarCard(s) {
    const fee = Number(s.applicationFee) > 0 ? Number(s.applicationFee) : (s.requiresPayment ? Number(s.price) || 0 : 0);
    return {
        key: `s-${s.id}`,
        image: seminarImage(s),
        imagePosition: 'top',
        state: s.status === '모집예정' ? '모집예정' : (s.status || '모집중'),
        stateTone: s.status === '마감임박' ? 'alert' : 'royal',
        title: s.title,
        meta: <>{[s.date, s.location].filter(Boolean).join(' ㅣ ')}<br />{fee > 0 ? `참가비 ${won(fee)}` : '무료'}</>,
        href: `/program/apply/${s.id}`,
        sort: 2,
    };
}

// key·href·sort 는 카드에 넘기지 않는다(React key 경고 방지, 이동은 onClick)
const cardProps = ({ key, href, sort, ...rest }) => rest; // eslint-disable-line no-unused-vars

export default function HomeView({ seminars = [], partnerLogos = [], partnerNames = [], showPrograms = true }) {
    const navigate = useNavigate();
    const cc = useCoffeeChat();
    const [groups, setGroups] = useState(null);
    const [tab, setTab] = useState('open');
    useEffect(() => groupService.subscribeApprovedGroups(setGroups), []);

    const cards = useMemo(() => {
        return (groups || []).filter((x) => x.recruit !== 'hidden').map(groupCard).sort((a, b) => a.sort - b.sort);
    }, [groups]);
    // 프로그램: 모집중·마감임박 먼저, 그다음 모집예정 — 최대 6개, 나머지는 「프로그램 전체 보기」
    const programs = useMemo(() => (showPrograms && Array.isArray(seminars) ? seminars : [])
        .filter((x) => OPEN_STATES.includes(x.status || '모집중') || x.status === '모집예정')
        .map(seminarCard)
        .sort((a, b) => (a.state === '모집예정') - (b.state === '모집예정'))
        .slice(0, 6), [seminars, showPrograms]);
    const shown = cards.filter((c) => (tab === 'soon' ? c.state === '모집예정' : c.state !== '모집예정'));
    const go = (path) => (e) => { e.preventDefault(); navigate(path); window.scrollTo({ top: 0 }); };

    return (
        <div className="bg-white">
            <MgHero image="/assets/images/home/hero.jpg" eyebrow="부산 사업가 커뮤니티"
                title={<>혼자 내리던 첫 결정,<br />먼저 가본 선배와 함께</>} lede="커피챗 · 스터디 · 소모임 · 지원사업" />

            <section className="py-16 md:pb-[60px] md:pt-[100px]" aria-labelledby="home-recruit">
                <MgWrap>
                    <MgSectionHead id="home-recruit" title="지금 모집 중" desc="먼저가본에서 열고 있는 모집을 살펴보세요." />
                    <MgTabs className="mb-[30px] mt-[26px]" label="모집 상태" value={tab} onChange={setTab}
                        items={[['open', '모집중인 클럽'], ['soon', '모집예정인 클럽']]} />
                    {groups === null ? (
                        <p className="py-12 text-center text-[15px] text-sub">불러오는 중…</p>
                    ) : shown.length === 0 ? (
                        <p className="rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">
                            {tab === 'soon' ? '곧 열릴 모임을 준비하고 있어요. 아래에서 알림을 신청하시면 먼저 알려 드릴게요.' : '지금 모집 중인 모임이 없어요. 아래에서 알림을 신청해 주세요.'}
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-2.5 gap-y-6 md:grid-cols-3 md:gap-x-3">
                            {shown.map((c) => <MgCard key={c.key} {...cardProps(c)} onClick={go(c.href)} />)}
                        </div>
                    )}
                </MgWrap>
            </section>

            <section className="py-10 md:py-[50px]" aria-labelledby="home-can">
                <MgWrap>
                    <MgSectionHead id="home-can" title="먼저가본에서 할 수 있는 것" />
                    <div className="mt-[26px] grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
                        <MgInfoCard image="/assets/images/home/can-coffee.webp" en="Coffee Chat" title={<>같은 업종 선배에게<br />1:1로 묻기</>} foot="2만 원부터 · 노하우 무료" onClick={(e) => { e.preventDefault(); cc?.open('hub', { tab: 'feed' }); }} />
                        <MgInfoCard image="/assets/images/home/can-club.webp" en="Club" title={<>스터디·소모임<br />함께하기</>} foot="소모임·스터디" onClick={go('/groups')} />
                        <MgInfoCard image="/assets/images/home/can-prefounder.webp" en="Pre-founders" title={<>예비창업 지원사업<br />한곳에서 찾기</>} foot="예비창업" onClick={go('/startup')} />
                        <MgInfoCard image="/assets/images/home/can-support.webp" en="Support" title={<>부산 지원사업·<br />사업가 뉴스</>} foot="매일 아침 모음" onClick={go('/support')} />
                    </div>
                </MgWrap>
            </section>

            {showPrograms ? (
                <section className="py-10 md:py-[50px]" aria-labelledby="home-programs">
                    <MgWrap>
                        <MgSectionHead id="home-programs" title="프로그램" desc="먼저가본이 직접 여는 세미나·교육·네트워킹입니다."
                            extra={<a href="/programs" onClick={go('/programs')} className="inline-flex h-11 items-center border border-ink px-4 text-[15px] font-semibold text-ink hover:bg-ink hover:text-white">프로그램 전체 보기 →</a>} />
                        {programs.length === 0 ? (
                            <p className="mt-[26px] rounded-xl bg-card px-5 py-11 text-center text-[15px] text-sub">지금 모집 중인 프로그램이 없어요. 새 프로그램이 열리면 이곳에 보여 드릴게요.</p>
                        ) : (
                            <div className="mt-[26px] grid grid-cols-2 gap-x-2.5 gap-y-6 md:grid-cols-3 md:gap-x-3">
                                {programs.map((c) => <MgCard key={c.key} {...cardProps(c)} onClick={go(c.href)} />)}
                            </div>
                        )}
                    </MgWrap>
                </section>
            ) : null}

            {partnerLogos.length ? (
                <section className="pb-16 pt-10 md:pb-[100px] md:pt-[50px]" aria-labelledby="home-partners">
                    <MgWrap>
                        <MgSectionHead id="home-partners" title="협력기관" desc="2017년부터 함께해 온 기관입니다." />
                        <ul className="mt-[26px] grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
                            {partnerLogos.map((src, i) => (
                                <li key={src} className={`flex h-[96px] items-center justify-center border border-[#eee] p-4 md:h-[110px] ${i === partnerLogos.length - 1 && partnerLogos.length % 2 ? 'col-span-2' : ''}`}>
                                    <img src={src} alt={partnerNames[i] || `협력기관 ${i + 1}`} className="max-h-[44px] w-auto max-w-full object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0 md:max-h-[50px]" loading="lazy" decoding="async" />
                                </li>
                            ))}
                        </ul>
                    </MgWrap>
                </section>
            ) : null}

            <NotifySection />
        </div>
    );
}

const WHO = [['owner', '사업을 하고 있어요'], ['pre', '창업을 준비 중이에요']];
const TOPICS = ['마케팅·홍보', '자금·세무', 'AI·업무 자동화', '브랜딩', '판로·커머스', '인사·운영', '네트워킹', '기타'];

/** 「찾는 모임이 없으셨나요?」 — 관심 분야를 남기면 관련 모임이 열릴 때 알린다(interestAlerts, 관리자만 읽음) */
function NotifySection() {
    const [who, setWho] = useState('');
    const [topics, setTopics] = useState([]);
    const [wish, setWish] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [agree, setAgree] = useState(false);
    const [msg, setMsg] = useState({ text: '', ok: false });
    const [busy, setBusy] = useState(false);
    const toggle = (t) => setTopics((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
    const submit = async (e) => {
        e.preventDefault();
        const digits = phone.replace(/\D/g, '');
        if (!who) return setMsg({ text: '지금 상황을 골라 주세요.', ok: false });
        if (!/^01\d{8,9}$/.test(digits)) return setMsg({ text: '알림받으실 휴대폰 번호를 확인해 주세요.', ok: false });
        if (!agree) return setMsg({ text: '개인정보 수집·이용에 동의해 주세요.', ok: false });
        setBusy(true);
        try {
            await addDoc(collection(db, 'interestAlerts'), {
                who, topics: topics.slice(0, 8), wish: wish.trim().slice(0, 200), phone: digits, email: email.trim().slice(0, 120),
                agree: true, createdAt: serverTimestamp(), status: 'new',
            });
            setMsg({ text: '알림 신청을 받았어요. 관련 모임이 열리면 알려 드릴게요.', ok: true });
            setWho(''); setTopics([]); setWish(''); setPhone(''); setEmail(''); setAgree(false);
        } catch {
            setMsg({ text: '지금은 신청을 받지 못했어요. 잠시 뒤 다시 눌러 주시거나 고객센터로 연락해 주세요.', ok: false });
        } finally { setBusy(false); }
    };
    const chip = (on) => `inline-block rounded-full border px-4 py-2 text-[14px] ${on ? 'border-royal font-semibold text-royal' : 'border-line2 text-[#333]'}`;
    const inp = 'h-[52px] w-full rounded-lg border border-line2 px-4 text-[15px] text-[#222] outline-none focus:border-royal';
    return (
        <section className="bg-sky py-10 md:py-[60px]" aria-labelledby="home-notify">
            <MgWrap>
                <form onSubmit={submit} noValidate className="mx-auto max-w-[1040px] rounded-[14px] border border-skyLine bg-white px-5 pb-8 pt-9 md:rounded-[18px] md:px-[60px] md:pb-12 md:pt-14">
                    <h2 id="home-notify" className="text-center text-[24px] font-normal tracking-tight text-[#1a1a1a] md:text-[32px]">찾는 모임이 없으셨나요?</h2>
                    <p className="mb-9 mt-2.5 text-center text-[15px] text-sub">아래 항목을 선택해 주시면 관련 모임이 열릴 때 알려 드리겠습니다.</p>
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                        <legend className="mb-2.5 mt-6 p-0 text-[14px] font-bold text-[#1a1a1a]">지금 상황 *</legend>
                        <div className="flex flex-wrap gap-2">
                            {WHO.map(([v, l]) => (
                                <label key={v} className="relative cursor-pointer">
                                    <input type="radio" name="who" value={v} checked={who === v} onChange={() => setWho(v)} className="peer absolute inset-0 opacity-0" />
                                    <span className={`${chip(who === v)} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-royal`}>{l}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                        <legend className="mb-2.5 mt-6 p-0 text-[14px] font-bold text-[#1a1a1a]">찾고 있는 분야 (복수 선택 가능)</legend>
                        <div className="flex flex-wrap gap-2">
                            {TOPICS.map((t) => (
                                <label key={t} className="relative cursor-pointer">
                                    <input type="checkbox" checked={topics.includes(t)} onChange={() => toggle(t)} className="peer absolute inset-0 opacity-0" />
                                    <span className={`${chip(topics.includes(t))} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-royal`}>{t}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <label htmlFor="n-wish" className="mb-2.5 mt-6 block text-[14px] font-bold text-[#1a1a1a]">원하는 모임 주제가 있다면 입력해 주세요 (선택)</label>
                    <input id="n-wish" className={inp} value={wish} onChange={(e) => setWish(e.target.value)} maxLength={200} placeholder="예) 스마트스토어 상세페이지 스터디, 세무 기초 모임" />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div><label htmlFor="n-phone" className="mb-2.5 mt-6 block text-[14px] font-bold text-[#1a1a1a]">알림받으실 전화번호 *</label>
                            <input id="n-phone" className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" /></div>
                        <div><label htmlFor="n-mail" className="mb-2.5 mt-6 block text-[14px] font-bold text-[#1a1a1a]">알림받으실 이메일</label>
                            <input id="n-mail" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="name@example.com" /></div>
                    </div>
                    <label className="mt-5 flex items-start gap-2 text-[14px] text-[#333]">
                        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-[#2d4fe0]" />
                        <span>개인정보 수집·이용에 동의합니다 (필수) — 휴대폰 번호·이메일·관심 분야를 모임 알림에만 쓰고, 알림을 그만 받길 원하시면 바로 지웁니다.</span>
                    </label>
                    <button type="submit" disabled={busy} className="mt-6 h-[53px] w-full rounded-lg bg-[#1a1a1a] text-[17px] font-bold tracking-tight text-white disabled:opacity-60">{busy ? '보내는 중…' : '알림 신청하기'}</button>
                    <p role="status" aria-live="polite" className={`mt-3 min-h-[1em] text-center text-[14px] ${msg.ok ? 'text-royal' : 'text-red-600'}`}>{msg.text}</p>
                </form>
            </MgWrap>
        </section>
    );
}

