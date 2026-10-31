/** 만 14세 확인·재가입 제한 확인값·보존 기록 항목 (순수 함수) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthdate, isUnder14, userIsUnder14, fourteenthBirthdayMs } from '../../ageCheck.js';
import {
  hashIdentifier, hashUid, buildBlockHashes, normalizePhone, normalizeEmail, blockExpiresAt,
} from '../../blocklist.js';
import {
  buildSeminarPaymentRecord, buildGroupPaymentRecord, buildReportRecord, retainUntilDate,
} from '../../retention.js';

const kst = (s) => new Date(`${s}+09:00`).getTime();

test('parseBirthdate: 여러 형식, 잘못된 날짜는 null', () => {
  assert.deepEqual(parseBirthdate('1990-01-15'), { y: 1990, m: 1, d: 15 });
  assert.deepEqual(parseBirthdate('19900115'), { y: 1990, m: 1, d: 15 });
  assert.deepEqual(parseBirthdate('1990.1.5'), { y: 1990, m: 1, d: 5 });
  assert.equal(parseBirthdate('1990-02-31'), null);
  assert.equal(parseBirthdate('90-01-15'), null);
  assert.equal(parseBirthdate(''), null);
});

test('isUnder14: 만 14세 생일 0시(KST) 경계', () => {
  assert.equal(isUnder14('2012-11-01', kst('2026-10-31T23:59:59')), true);
  assert.equal(isUnder14('2012-11-01', kst('2026-11-01T00:00:00')), false);
  assert.equal(isUnder14('1990-01-15', kst('2026-10-31T12:00:00')), false);
  assert.equal(isUnder14('형식 오류', kst('2026-10-31T12:00:00')), false);
});

test('2월 29일생은 평년엔 3월 1일에 만 14세', () => {
  assert.equal(new Date(fourteenthBirthdayMs({ y: 2012, m: 2, d: 29 })).toISOString(), '2026-02-28T15:00:00.000Z');
  assert.equal(isUnder14('2012-02-29', kst('2026-02-28T23:00:00')), true);
  assert.equal(isUnder14('2012-02-29', kst('2026-03-01T00:00:00')), false);
});

test('userIsUnder14: birthdate 또는 본인인증 생년월일', () => {
  const now = kst('2026-10-31T12:00:00');
  assert.equal(userIsUnder14({ birthdate: '' , verifiedBirthday: '20150101' }, now), true);
  assert.equal(userIsUnder14({ birthdate: '1990-01-01' }, now), false);
  assert.equal(userIsUnder14({}, now), false);
});

test('normalizePhone: +82 국가번호·기호 정리', () => {
  assert.equal(normalizePhone('+82 10-1234-5678'), '01012345678');
  assert.equal(normalizePhone('010-1234-5678'), '01012345678');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizeEmail('  A@B.COM '), 'a@b.com');
});

test('확인값: 비밀값별로 다르고, 원문이 들어 있지 않다', () => {
  const a = buildBlockHashes('secret-A', { uid: 'kakao_123', email: 'User@Example.com', phone: '+82 10-1234-5678' });
  const b = buildBlockHashes('secret-B', { uid: 'kakao_123', email: 'user@example.com', phone: '01012345678' });
  assert.match(a.emailHash, /^[0-9a-f]{64}$/);
  assert.notEqual(a.emailHash, b.emailHash);
  assert.equal(a.emailHash, hashIdentifier('secret-A', 'email', 'user@example.com'));
  assert.equal(a.phoneHash, hashIdentifier('secret-A', 'phone', '01012345678'));
  assert.ok(!JSON.stringify(a).includes('example.com'));
  assert.ok(!JSON.stringify(a).includes('12345678'));
});

test('비밀값이 없으면 이메일·전화 확인값을 만들지 않는다(역산 방지), uid는 SHA-256', () => {
  const h = buildBlockHashes('', { uid: 'u1', email: 'a@b.com', phone: '01012345678' });
  assert.equal(h.emailHash, '');
  assert.equal(h.phoneHash, '');
  assert.match(h.uidHash, /^[0-9a-f]{64}$/);
  assert.equal(h.uidHash, hashUid('', 'u1'));
  assert.notEqual(hashUid('s', 'u1'), hashUid('', 'u1'));
});

test('재가입 제한 기한 1년, 보존 기한 결제 5년·분쟁 3년', () => {
  const from = new Date('2026-10-31T00:00:00Z');
  assert.equal(blockExpiresAt(from).toISOString(), '2027-10-31T00:00:00.000Z');
  assert.equal(retainUntilDate('payment', from).toISOString(), '2031-10-31T00:00:00.000Z');
  assert.equal(retainUntilDate('dispute', from).toISOString(), '2029-10-31T00:00:00.000Z');
  assert.throws(() => retainUntilDate('other', from));
});

test('세미나 결제 보존 기록: 최소 항목만 (사전 질문·참여 경로·식사 여부는 복사하지 않음)', () => {
  const r = buildSeminarPaymentRecord({
    application: {
      userId: 'u1', userName: '홍길동', userPhone: '01012345678', userEmail: 'a@b.com', merchant_uid: 'p_1', paidAmount: 30000,
      preQuestions: '비밀 질문', participationPath: '지인', mealAfter: '예', applyReason: '사유', createdAt: new Date('2026-11-01T00:00:00Z'),
    },
    seminar: { title: '세미나', date: '2026.11.20 19:00', applicationFee: 30000, location: '부산' },
    seminarId: 's1', payInfo: null, reason: 'withdrawal',
  });
  assert.equal(r.category, 'payment');
  assert.equal(r.paymentId, 'p_1');
  assert.equal(r.amount, 30000);
  assert.equal(r.amountSource, 'application');
  assert.equal(r.itemTitle, '세미나');
  const json = JSON.stringify(r);
  for (const banned of ['비밀 질문', '지인', '사유', '부산']) assert.ok(!json.includes(banned), banned);
});

test('그룹 결제·신고 보존 기록 항목', () => {
  const g = buildGroupPaymentRecord({ paymentId: 'g_1', pay: { uid: 'u1', name: '홍', amount: 5000, status: 'refunded', refundReason: '불참', groupId: 'g', sessionId: 's', groupTitle: '모임', sessionTitle: '1회' }, reason: 'withdrawal', profile: { phone: '010', email: 'e@x.com' } });
  assert.equal(g.refundAmount, 5000);
  assert.equal(g.note, '불참');
  assert.equal(g.groupTitle, '모임');
  const rep = buildReportRecord({ reportId: 'r1', report: { reporterUid: 'u1', reporterName: '홍', reason: '욕설', targetType: 'group', targetId: 'g', status: 'open' }, reason: 'withdrawal', role: 'reporter' });
  assert.equal(rep.category, 'dispute');
  assert.equal(rep.subjectUid, 'u1');
  assert.equal(rep.reportReason, '욕설');
});
