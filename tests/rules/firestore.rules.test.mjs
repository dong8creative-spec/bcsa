/**
 * firestore.rules 테스트 (Firestore 에뮬레이터 필요)
 *   npm run test:rules
 * = firebase emulators:exec --only firestore --project demo-bcsa "node --test tests/rules/"
 * 운영 데이터와 무관한 demo- 프로젝트에서만 돈다.
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, addDoc, serverTimestamp, arrayUnion, Timestamp,
} from 'firebase/firestore';

/** 가입 화면(buildSignupConsents)과 같은 모양의 동의 기록 — 시각은 서버 시각 */
const consents = () => ({
  terms: { agreedAt: serverTimestamp(), version: '2026-11-01' },
  privacy: { agreedAt: serverTimestamp(), version: '2026-11-01' },
  ageOver14: { agreedAt: serverTimestamp(), method: 'birthdate' },
});

const PROJECT_ID = 'demo-bcsa';
let env;

/** 오늘(KST) 기준 n년 전 날짜 + dayShift일 → "YYYY-MM-DD" */
const kstYmdYearsAgo = (years, dayShift = 0) => {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const d = new Date(Date.UTC(kst.getUTCFullYear() - years, kst.getUTCMonth(), kst.getUTCDate() + dayShift));
  return d.toISOString().slice(0, 10);
};

const ctx = {
  anon: () => env.unauthenticatedContext().firestore(),
  as: (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore(),
};

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'users/u_ok'), { uid: 'u_ok', name: '승인', approvalStatus: 'approved' });
    await setDoc(doc(db, 'users/u_old'), { uid: 'u_old', name: '옛 회원(상태값 없음)' });
    await setDoc(doc(db, 'users/u_pend'), { uid: 'u_pend', name: '대기', approvalStatus: 'pending' });
    await setDoc(doc(db, 'users/u_rej'), { uid: 'u_rej', name: '반려', approvalStatus: 'rejected' });
    await setDoc(doc(db, 'users/legacyDoc1'), { uid: 'u_legacy', name: '예전 가입자', approvalStatus: 'approved' });
    await setDoc(doc(db, 'memberAccess/u_legacy'), { docId: 'legacyDoc1', approved: true });
    await setDoc(doc(db, 'users/legacyDoc2'), { uid: 'u_legacy2', name: '백필 전 예전 가입자', approvalStatus: 'approved' });
    await setDoc(doc(db, 'users/u_admin2'), { uid: 'u_admin2', role: 'admin', approvalStatus: 'approved' });
    await setDoc(doc(db, 'publicProfiles/u_ok'), { uid: 'u_ok', name: '승인' });
    await setDoc(doc(db, 'publicStats/members'), { approvedMemberCount: 3 });
    await setDoc(doc(db, 'legalRetention/r1'), { category: 'payment', subjectUid: 'u_ok', name: '승인' });
    await setDoc(doc(db, 'blockedRegistrations/h1'), { uidHash: 'h1' });

    await setDoc(doc(db, 'seminars/free'), { title: '무료', applicationFee: 0 });
    await setDoc(doc(db, 'seminars/freeCancelled'), { title: '취소된 무료', applicationFee: 0, cancelledByOrganizer: true, recruitmentClosedByAdmin: true });
    await setDoc(doc(db, 'seminars/freeClosed'), { title: '모집 중단 무료', applicationFee: 0, recruitmentClosedByAdmin: true });
    await setDoc(doc(db, 'applications/a_free'), { userId: 'u_ok', seminarId: 'free' });
    await setDoc(doc(db, 'applications/a_paid'), { userId: 'u_ok', seminarId: 'paid', merchant_uid: 'p_1' });

    await setDoc(doc(db, 'groups/g1'), { title: '모임', status: 'approved', leaderUid: 'u_leader', joinPolicy: 'open', mode: 'offline', memberCount: 2 });
    await setDoc(doc(db, 'groups/g1/members/u_leader'), { uid: 'u_leader', name: '모임장', role: 'leader', status: 'active' });
    await setDoc(doc(db, 'groups/g1/members/u_mem'), { uid: 'u_mem', name: '멤버', role: 'member', status: 'active' });
    await setDoc(doc(db, 'groups/g1/members/u_pm'), { uid: 'u_pm', name: '대기 멤버', role: 'member', status: 'pending' });
    await setDoc(doc(db, 'groups/g1/sessions/s1'), { title: '1회', fee: 0 });
    await setDoc(doc(db, 'groups/g1/sessions/s1/attendance/u_mem'), { uid: 'u_mem', name: '멤버', method: 'qr' });
    await setDoc(doc(db, 'groupPayments/gp1'), { uid: 'u_mem', leaderUid: 'u_leader', groupId: 'g1', amount: 5000, status: 'paid' });
    await setDoc(doc(db, 'reports/rep1'), { reporterUid: 'u_ok', status: 'open', targetType: 'group', targetId: 'g1', reason: 'x' });
  });
});

describe('publicProfiles (회원명단): 로그인한 승인 회원·관리자만', () => {
  test('비로그인 목록 읽기 거부', async () => { await assertFails(getDocs(collection(ctx.anon(), 'publicProfiles'))); });
  test('비로그인 단건 읽기 거부', async () => { await assertFails(getDoc(doc(ctx.anon(), 'publicProfiles/u_ok'))); });
  test('승인 대기 회원 거부', async () => { await assertFails(getDocs(collection(ctx.as('u_pend'), 'publicProfiles'))); });
  test('반려 회원 거부', async () => { await assertFails(getDocs(collection(ctx.as('u_rej'), 'publicProfiles'))); });
  test('회원 문서 없는 로그인 사용자 거부', async () => { await assertFails(getDocs(collection(ctx.as('u_nobody'), 'publicProfiles'))); });
  test('승인 회원 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_ok'), 'publicProfiles'))); });
  test('승인 상태값이 없는 옛 회원 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_old'), 'publicProfiles'))); });
  test('예전 가입자(문서 id ≠ uid)는 memberAccess 표시로 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_legacy'), 'publicProfiles'))); });
  test('예전 가입자도 memberAccess 백필 전이면 거부(백필 필요)', async () => { await assertFails(getDocs(collection(ctx.as('u_legacy2'), 'publicProfiles'))); });
  test('관리자(claim) 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_admin', { admin: true }), 'publicProfiles'))); });
  test('관리자(회원 문서 role) 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_admin2'), 'publicProfiles'))); });
  test('승인 회원도 쓰기 거부', async () => { await assertFails(setDoc(doc(ctx.as('u_ok'), 'publicProfiles/u_ok'), { name: 'x' })); });
});

describe('publicStats·memberAccess·legalRetention', () => {
  test('홈 회원 수(publicStats) 비로그인 읽기 허용', async () => { await assertSucceeds(getDoc(doc(ctx.anon(), 'publicStats/members'))); });
  test('publicStats 관리자도 쓰기 거부', async () => { await assertFails(setDoc(doc(ctx.as('u_admin', { admin: true }), 'publicStats/members'), { approvedMemberCount: 999 })); });
  test('memberAccess 본인 읽기 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_legacy'), 'memberAccess/u_legacy'))); });
  test('memberAccess 본인 쓰기 거부(스스로 승인 표시 불가)', async () => { await assertFails(setDoc(doc(ctx.as('u_pend'), 'memberAccess/u_pend'), { approved: true })); });
  test('legalRetention 관리자 읽기 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_admin', { admin: true }), 'legalRetention'))); });
  test('legalRetention 기록 당사자(회원) 읽기 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_ok'), 'legalRetention/r1'))); });
  test('legalRetention 비로그인 거부', async () => { await assertFails(getDocs(collection(ctx.anon(), 'legalRetention'))); });
  test('legalRetention 관리자도 쓰기·삭제 거부', async () => {
    const db = ctx.as('u_admin', { admin: true });
    await assertFails(addDoc(collection(db, 'legalRetention'), { category: 'payment' }));
    await assertFails(deleteDoc(doc(db, 'legalRetention/r1')));
  });
  test('blockedRegistrations 관리자도 클라이언트 읽기 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_admin', { admin: true }), 'blockedRegistrations/h1'))); });
});

describe('users 생성·수정: 만 14세 확인', () => {
  const create = (uid, birthdate) => setDoc(doc(ctx.as(uid), `users/${uid}`), { uid, name: '신규', approvalStatus: 'pending', consents: consents(), ...(birthdate === undefined ? {} : { birthdate }) });
  test('만 30세 가입 허용', async () => { await assertSucceeds(create('n1', kstYmdYearsAgo(30))); });
  test('오늘이 만 14세 생일(KST)이면 허용', async () => { await assertSucceeds(create('n2', kstYmdYearsAgo(14))); });
  test('만 14세 생일 하루 전이면 거부', async () => { await assertFails(create('n3', kstYmdYearsAgo(14, 1))); });
  test('만 13세 거부', async () => { await assertFails(create('n4', kstYmdYearsAgo(13))); });
  test('생년월일 없이(카카오 등) 생성 허용', async () => { await assertSucceeds(create('n5')); });
  test('빈 생년월일 허용', async () => { await assertSucceeds(create('n6', '')); });
  test('YYYY-MM-DD가 아닌 형식으로 생성 거부', async () => { await assertFails(create('n7', '2015/01/01')); });
  test('2월 29일생(만 14세 이상) 허용', async () => { await assertSucceeds(create('n8', '2000-02-29')); });
  test('존재하지 않는 날짜 거부', async () => { await assertFails(create('n9', '1990-02-31')); });
  test('수정: 생년월일을 만 14세 미만으로 바꾸기 거부', async () => {
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { birthdate: kstYmdYearsAgo(10) }));
  });
  test('수정: 생년월일을 만 14세 이상으로 바꾸기 허용', async () => {
    await assertSucceeds(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { birthdate: '1990-01-15' }));
  });
  test('수정: 생년월일을 건드리지 않는 수정 허용', async () => {
    await seed((db) => updateDoc(doc(db, 'users/u_ok'), { birthdate: '90/01/15' }));
    await assertSucceeds(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { company: '새 회사' }));
  });
  test('수정: 승인 상태 스스로 변경 거부(기존 규칙 유지)', async () => {
    await assertFails(updateDoc(doc(ctx.as('u_pend'), 'users/u_pend'), { approvalStatus: 'approved' }));
  });
  test('생성: 스스로 승인 상태로 가입 거부(기존 규칙 유지)', async () => {
    await assertFails(setDoc(doc(ctx.as('n10'), 'users/n10'), { uid: 'n10', approvalStatus: 'approved', birthdate: '1990-01-01', consents: consents() }));
  });
});

describe('users 생성: 승인 상태 값 필수', () => {
  test('approvalStatus 없이 가입하면 거부(옛 승인 회원처럼 읽히는 우회 차단)', async () => {
    await assertFails(setDoc(doc(ctx.as('s1'), 'users/s1'), { uid: 's1', name: '우회', birthdate: '1990-01-01', consents: consents() }));
  });
  test('approvalStatus 빈 문자열로 가입 거부', async () => {
    await assertFails(setDoc(doc(ctx.as('s2'), 'users/s2'), { uid: 's2', approvalStatus: '', birthdate: '1990-01-01', consents: consents() }));
  });
});

describe('users 동의 기록: 서버 시각·본인 수정 금지', () => {
  const base = (uid) => ({ uid, name: '신규', approvalStatus: 'pending', birthdate: '1990-01-01' });
  test('동의 기록 없이 가입 거부', async () => {
    await assertFails(setDoc(doc(ctx.as('c1'), 'users/c1'), base('c1')));
  });
  test('동의 시각을 기기 시각으로 넣으면 거부', async () => {
    const t = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
    await assertFails(setDoc(doc(ctx.as('c2'), 'users/c2'), { ...base('c2'), consents: { terms: { agreedAt: t }, privacy: { agreedAt: t }, ageOver14: { agreedAt: t } } }));
  });
  test('만 14세 확인 동의가 빠지면 거부', async () => {
    const c = consents(); delete c.ageOver14;
    await assertFails(setDoc(doc(ctx.as('c3'), 'users/c3'), { ...base('c3'), consents: c }));
  });
  test('광고성 정보 동의를 함께 남길 때 서버 시각이면 허용, 기기 시각이면 거부', async () => {
    await assertSucceeds(setDoc(doc(ctx.as('c4'), 'users/c4'), { ...base('c4'), consents: consents(), marketingConsent: { agreed: true, channels: ['email'], agreedAt: serverTimestamp(), updatedAt: serverTimestamp() } }));
    await assertFails(setDoc(doc(ctx.as('c5'), 'users/c5'), { ...base('c5'), consents: consents(), marketingConsent: { agreed: true, updatedAt: Timestamp.fromDate(new Date()) } }));
  });
  test('가입 뒤 본인이 동의 기록(consents) 수정 거부', async () => {
    await seed((db) => updateDoc(doc(db, 'users/u_ok'), { consents: { terms: { agreedAt: Timestamp.now() } } }));
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { 'consents.terms.version': 'x' }));
  });
  test('마이페이지 수신 설정 변경: 서버 시각 + 이력 추가 허용', async () => {
    await assertSucceeds(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), {
      marketingAgreed: false,
      marketingConsent: { agreed: false, channels: [], agreedAt: null, withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp(), version: '2026-11-01', source: 'mypage', resultNotice: '철회', resultNoticeShownAt: serverTimestamp() },
      marketingConsentLog: arrayUnion({ agreed: false, channels: [], at: new Date().toISOString(), source: 'mypage', version: '2026-11-01' }),
    }));
  });
  test('수신 설정 변경 시각을 기기 시각으로 넣으면 거부', async () => {
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { marketingConsent: { agreed: true, channels: ['sms'], updatedAt: Timestamp.fromDate(new Date('2025-01-01')) } }));
  });
  test('수신 동의 이력 지우기 거부', async () => {
    await seed((db) => updateDoc(doc(db, 'users/u_ok'), { marketingConsentLog: [{ agreed: true, at: '2026-10-01' }] }));
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { marketingConsentLog: [] }));
  });
  test('서버 확인 표시(ageRestricted·blockedRegistration) 본인 수정 거부', async () => {
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { ageRestricted: false }));
    await assertFails(updateDoc(doc(ctx.as('u_ok'), 'users/u_ok'), { blockedRegistration: false }));
  });
});

describe('applications: 무료 신청 생성', () => {
  const apply = (sid) => addDoc(collection(ctx.as('u_ok'), 'applications'), { userId: 'u_ok', seminarId: sid });
  test('모집 중 무료 프로그램 신청 허용', async () => { await assertSucceeds(apply('free')); });
  test('회사 사정 취소된 프로그램 신청 거부', async () => { await assertFails(apply('freeCancelled')); });
  test('관리자 모집 중단 프로그램 신청 거부', async () => { await assertFails(apply('freeClosed')); });
});

describe('applications: 결제 건은 서버만 삭제', () => {
  test('본인 무료 신청 삭제 허용', async () => { await assertSucceeds(deleteDoc(doc(ctx.as('u_ok'), 'applications/a_free'))); });
  test('본인 결제 신청 직접 삭제 거부', async () => { await assertFails(deleteDoc(doc(ctx.as('u_ok'), 'applications/a_paid'))); });
  test('관리자도 결제 신청 클라이언트 삭제 거부', async () => { await assertFails(deleteDoc(doc(ctx.as('u_admin', { admin: true }), 'applications/a_paid'))); });
  test('관리자 무료 신청 삭제 허용', async () => { await assertSucceeds(deleteDoc(doc(ctx.as('u_admin', { admin: true }), 'applications/a_free'))); });
  test('본인 신청 읽기 허용·남의 신청 거부(기존 규칙 유지)', async () => {
    await assertSucceeds(getDoc(doc(ctx.as('u_ok'), 'applications/a_paid')));
    await assertFails(getDoc(doc(ctx.as('u_mem'), 'applications/a_paid')));
  });
});

describe('groups/members: 그룹 멤버·그룹장·관리자만 명단', () => {
  const members = (db) => collection(db, 'groups/g1/members');
  test('비로그인: 승인된 그룹 문서(memberCount 포함)는 읽기 허용', async () => {
    const snap = await assertSucceeds(getDoc(doc(ctx.anon(), 'groups/g1')));
    if (snap.data().memberCount !== 2) throw new Error('memberCount missing');
  });
  test('비로그인: 멤버 명단 거부', async () => { await assertFails(getDocs(members(ctx.anon()))); });
  test('다른 회원: 멤버 명단 거부', async () => { await assertFails(getDocs(members(ctx.as('u_ok')))); });
  test('다른 회원: 남의 멤버 문서 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_ok'), 'groups/g1/members/u_mem'))); });
  test('다른 회원: 내 멤버 문서(없음) 확인은 허용', async () => { await assertSucceeds(getDoc(doc(ctx.as('u_ok'), 'groups/g1/members/u_ok'))); });
  test('활동 멤버: 활동 중 멤버 명단(status 조건) 허용', async () => {
    await assertSucceeds(getDocs(query(members(ctx.as('u_mem')), where('status', '==', 'active'))));
  });
  test('활동 멤버: 조건 없는 전체 명단(대기자 포함) 거부', async () => { await assertFails(getDocs(members(ctx.as('u_mem')))); });
  test('활동 멤버: 가입 대기자 문서 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_mem'), 'groups/g1/members/u_pm'))); });
  test('가입 대기 회원: 내 문서 허용·명단 거부', async () => {
    await assertSucceeds(getDoc(doc(ctx.as('u_pm'), 'groups/g1/members/u_pm')));
    await assertFails(getDocs(query(members(ctx.as('u_pm')), where('status', '==', 'active'))));
  });
  test('그룹장: 전체 명단 허용', async () => { await assertSucceeds(getDocs(members(ctx.as('u_leader')))); });
  test('관리자: 전체 명단 허용', async () => { await assertSucceeds(getDocs(members(ctx.as('u_admin', { admin: true })))); });
  test('그룹장: memberCount 직접 수정 거부', async () => {
    await assertFails(updateDoc(doc(ctx.as('u_leader'), 'groups/g1'), { memberCount: 100 }));
  });
  test('그룹장: 소개 수정 허용(기존 규칙 유지)', async () => {
    await assertSucceeds(updateDoc(doc(ctx.as('u_leader'), 'groups/g1'), { title: '새 이름', updatedAt: serverTimestamp() }));
  });
  test('본인: 탈퇴(left) 처리 허용(기존 규칙 유지)', async () => {
    await assertSucceeds(updateDoc(doc(ctx.as('u_mem'), 'groups/g1/members/u_mem'), { status: 'left' }));
  });
});

describe('출석·결제 장부·신고 (기존 규칙 유지 확인)', () => {
  test('본인 출석 기록 허용', async () => { await assertSucceeds(getDoc(doc(ctx.as('u_mem'), 'groups/g1/sessions/s1/attendance/u_mem'))); });
  test('다른 회원 출석 기록 거부', async () => { await assertFails(getDoc(doc(ctx.as('u_ok'), 'groups/g1/sessions/s1/attendance/u_mem'))); });
  test('그룹장 출석 목록 허용', async () => { await assertSucceeds(getDocs(collection(ctx.as('u_leader'), 'groups/g1/sessions/s1/attendance'))); });
  test('결제 장부: 결제자 본인 허용·다른 회원 거부', async () => {
    await assertSucceeds(getDoc(doc(ctx.as('u_mem'), 'groupPayments/gp1')));
    await assertFails(getDoc(doc(ctx.as('u_ok'), 'groupPayments/gp1')));
  });
  test('신고: 회원은 접수만, 열람 거부', async () => {
    await assertSucceeds(addDoc(collection(ctx.as('u_ok'), 'reports'), {
      targetType: 'group', targetId: 'g1', targetTitle: '모임', reason: '사유', reporterUid: 'u_ok', reporterName: '승인', status: 'open', createdAt: serverTimestamp(),
    }));
    await assertFails(getDoc(doc(ctx.as('u_ok'), 'reports/rep1')));
  });
});
