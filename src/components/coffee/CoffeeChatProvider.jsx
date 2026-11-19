import React, { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import coffeeChatService, { CC_FAKE_PAY } from '../../services/coffeeChatService';
import HubModal from './HubModal';
import PostDetailModal from './PostDetailModal';
import SeniorProfileModal from './SeniorProfileModal';
import ApplyModal from './ApplyModal';
import CenterModal from './CenterModal';
import ChatDetailModal from './ChatDetailModal';
import ReviewModal from './ReviewModal';
import SeniorRegisterModal from './SeniorRegisterModal';
import PostEditorModal from './PostEditorModal';
import PriceModal from './PriceModal';
import PayReturnModal from './PayReturnModal';

/**
 * 선배 커피챗 창 묶음 (2026-11-20 운영자 지시: 메뉴·페이지는 늘리지 않고 창으로만)
 * 어느 화면에서든 const cc = useCoffeeChat(); cc.open('hub') 처럼 연다. 창은 겹쳐 쌓이고, 닫으면 아래 창으로 돌아간다.
 *
 * 창 이름과 받는 값
 *  hub {tab:'feed'|'seniors'}     선배 노하우(지식피드)·선배 찾기
 *  post {postId}                  노하우 글 상세 → 커피챗 신청
 *  senior {uid}                   선배 프로필(가격·뱃지·후기·글) → 커피챗 신청
 *  apply {seniorUid, postId?}     커피챗 신청서 → 결제 → 신청 완료
 *  center {tab:'mine'|'received'|'senior'|'settle'}  내 커피챗(후배 신청 내역·선배 받은 신청·선배 활동·정산)
 *  chat {chatId}                  신청 한 건 상세(후배: 확정·취소·후기 / 선배: 일정 골라 수락·거절·완료)
 *  review {chatId}                후기·평점
 *  register {}                    선배 등록·프로필 수정
 *  editor {postId?}               노하우 글 쓰기·고치기
 *  prices {}                      커피챗 가격 설정
 *  payReturn {chatId}             모바일 결제 후 돌아와 확인
 */
// 로컬 시험 도구: 개발 화면에서만 불러온다(운영 빌드에서는 코드째 빠짐)
const DevTestPanel = import.meta.env.DEV ? React.lazy(() => import('./DevTestPanel')) : null;

const REGISTRY = {
    hub: HubModal, post: PostDetailModal, senior: SeniorProfileModal, apply: ApplyModal, center: CenterModal,
    chat: ChatDetailModal, review: ReviewModal, register: SeniorRegisterModal, editor: PostEditorModal, prices: PriceModal, payReturn: PayReturnModal,
};

const Ctx = createContext(null);
export const useCoffeeChat = () => useContext(Ctx);

export default function CoffeeChatProvider({ currentUser, onRequireLogin, children }) {
    const [stack, setStack] = useState([]);
    const [mySenior, setMySenior] = useState(undefined); // undefined: 불러오는 중, null: 선배 아님
    const uid = currentUser?.uid || currentUser?.id || null;

    useEffect(() => {
        if (!uid) { setMySenior(null); return undefined; }
        return coffeeChatService.subscribeSenior(uid, setMySenior);
    }, [uid]);

    const open = useCallback((name, props = {}) => setStack((s) => [...s, { name, props, key: `${name}-${Date.now()}-${s.length}` }]), []);
    const replace = useCallback((name, props = {}) => setStack((s) => [...s.slice(0, -1), { name, props, key: `${name}-${Date.now()}-${s.length}` }]), []);
    const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);
    const closeAll = useCallback(() => setStack([]), []);
    /** 로그인이 필요한 동작 앞에서 부른다. 로그인 안 했으면 로그인 창을 띄우고 false */
    const requireLogin = useCallback(() => {
        if (uid) return true;
        onRequireLogin?.();
        return false;
    }, [uid, onRequireLogin]);

    // 모바일 결제 후 돌아옴: 주소의 ?ccpay=1&paymentId=… 를 읽어 결제 확인 창을 띄우고 주소는 정리
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('ccpay') !== '1') return;
        const chatId = sp.get('paymentId') || (() => { try { return sessionStorage.getItem('bcsa_cc_last_payment'); } catch (_) { return ''; } })();
        const failMessage = sp.get('code') ? (sp.get('message') || '결제가 취소되었어요.') : '';
        ['ccpay', 'paymentId', 'code', 'message', 'pgCode', 'pgMessage', 'transactionType', 'txId'].forEach((k) => sp.delete(k));
        const qs = sp.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
        if (chatId) setStack([{ name: 'payReturn', props: { chatId, failMessage }, key: `payReturn-${Date.now()}` }]);
    }, []);

    // 창이 열려 있는 동안 뒤 화면이 스크롤되지 않게
    useEffect(() => {
        if (!stack.length) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [stack.length]);

    const value = useMemo(() => ({
        currentUser, uid, mySenior, isSenior: mySenior?.status === 'approved',
        open, replace, close, closeAll, requireLogin,
    }), [currentUser, uid, mySenior, open, replace, close, closeAll, requireLogin]);

    return (
        <Ctx.Provider value={value}>
            {children}
            {CC_FAKE_PAY && DevTestPanel ? <Suspense fallback={null}><DevTestPanel uid={uid} currentUser={currentUser} /></Suspense> : null}
            {stack.map((m, i) => {
                const C = REGISTRY[m.name];
                return C ? <C key={m.key} {...m.props} depth={i} onClose={close} /> : null;
            })}
        </Ctx.Provider>
    );
}
