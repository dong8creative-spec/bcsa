/** 세미나 환불 계산 (functions/refund.js) — node --test functions/test/unit/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSeminarRefund, parseSeminarDate, pickPaidAt, isSeminarCancelledByCompany, kstDayNumber,
} from '../../refund.js';

/** KST 시각 문자열 → Date */
const kst = (s) => new Date(`${s}+09:00`);
const base = { paidAmount: 30000, seminarDate: '2026.11.20 19:00' };

test('결제 7일 이내·시작 전이면 날짜가 임박해도 전액 (세미나 이틀 전 결제, 다음 날 취소)', () => {
  const r = calculateSeminarRefund({ ...base, paidAt: kst('2026-11-18T10:00:00'), now: kst('2026-11-19T09:00:00') });
  assert.equal(r.amount, 30000);
  assert.equal(r.rule, 'cooling_off');
  assert.equal(r.withinCoolingOff, true);
});

test('세미나 당일이라도 결제 7일 이내·시작 전이면 전액', () => {
  const r = calculateSeminarRefund({ ...base, paidAt: kst('2026-11-15T10:00:00'), now: kst('2026-11-20T18:59:00') });
  assert.equal(r.amount, 30000);
  assert.equal(r.rule, 'cooling_off');
});

test('7일째 23:59(KST)까지 전액, 8일째 0시부터는 차등 (초일 불산입)', () => {
  const paidAt = kst('2026-11-11T22:00:00');
  const day7 = calculateSeminarRefund({ ...base, paidAt, now: kst('2026-11-18T23:59:00') });
  assert.equal(day7.rule, 'cooling_off');
  assert.equal(day7.amount, 30000);
  const day8 = calculateSeminarRefund({ ...base, paidAt, now: kst('2026-11-19T00:00:00') });
  assert.equal(day8.rule, 'tier_1d');
  assert.equal(day8.amount, 24000);
});

test('UTC 서버 시간대에서도 KST 날짜 기준 (KST 새벽 = UTC 전날)', () => {
  // KST 11/18 08:00 = UTC 11/17 23:00 → 세미나(11/20)까지 2일 전, 결제 8일 경과
  const r = calculateSeminarRefund({ ...base, paidAt: kst('2026-11-10T09:00:00'), now: kst('2026-11-18T08:00:00') });
  assert.equal(r.rule, 'tier_2d');
  assert.equal(r.amount, 27000);
});

test('결제 7일 경과 후: 3일 이상 전 100%, 2일 전 90%, 1일 전 80%, 당일 0%', () => {
  const paidAt = kst('2026-10-01T10:00:00');
  const at = (s) => calculateSeminarRefund({ ...base, paidAt, now: kst(s) });
  assert.deepEqual([at('2026-11-17T23:59:00').amount, at('2026-11-17T23:59:00').rule], [30000, 'tier_3d_or_more']);
  assert.deepEqual([at('2026-11-18T00:00:00').amount, at('2026-11-18T00:00:00').rule], [27000, 'tier_2d']);
  assert.deepEqual([at('2026-11-19T12:00:00').amount, at('2026-11-19T12:00:00').rule], [24000, 'tier_1d']);
  assert.deepEqual([at('2026-11-20T09:00:00').amount, at('2026-11-20T09:00:00').rule], [0, 'same_day']);
});

test('세미나 시작 이후에는 7일 이내여도 0%', () => {
  const r = calculateSeminarRefund({ ...base, paidAt: kst('2026-11-19T10:00:00'), now: kst('2026-11-20T19:00:00') });
  assert.equal(r.amount, 0);
  assert.equal(r.rule, 'started');
  assert.equal(r.beforeStart, false);
});

test('시각 없는 세미나 날짜는 그날 0시(KST)를 시작으로 본다', () => {
  const r = calculateSeminarRefund({ paidAmount: 10000, seminarDate: '2026-11-20', paidAt: kst('2026-11-18T10:00:00'), now: kst('2026-11-20T08:00:00') });
  assert.equal(r.rule, 'started');
  const r2 = calculateSeminarRefund({ paidAmount: 10000, seminarDate: '2026/11/20', paidAt: kst('2026-11-18T10:00:00'), now: kst('2026-11-19T23:00:00') });
  assert.equal(r2.rule, 'cooling_off');
});

test('회사 사정 취소는 시작 후·7일 경과 후에도 전액', () => {
  const r = calculateSeminarRefund({ ...base, paidAt: kst('2026-10-01T10:00:00'), now: kst('2026-11-20T20:00:00'), companyCaused: true });
  assert.equal(r.amount, 30000);
  assert.equal(r.rule, 'company_cancelled');
});

test('결제 시각을 모르면 7일 이내로 본다(사업자가 결제일을 증명할 수 없음)', () => {
  const r = calculateSeminarRefund({ ...base, paidAt: null, now: kst('2026-11-19T10:00:00') });
  assert.equal(r.rule, 'cooling_off');
  assert.equal(r.amount, 30000);
});

test('세미나 날짜를 알 수 없으면 전액(예전 동작 유지)', () => {
  const r = calculateSeminarRefund({ paidAmount: 5000, seminarDate: '', paidAt: kst('2026-01-01T00:00:00'), now: kst('2026-11-19T10:00:00') });
  assert.equal(r.amount, 5000);
  assert.equal(r.rule, 'unknown_date');
});

test('부분 환불은 원 단위 내림', () => {
  const r = calculateSeminarRefund({ paidAmount: 12345, seminarDate: '2026.11.20 19:00', paidAt: kst('2026-10-01T00:00:00'), now: kst('2026-11-18T10:00:00') });
  assert.equal(r.amount, 11110); // 12345 * 0.9 = 11110.5
});

test('parseSeminarDate: 관리자 형식·시각 해석 (KST)', () => {
  const p = parseSeminarDate('2026.11.20 19:30');
  assert.equal(p.hasTime, true);
  assert.equal(new Date(p.startMs).toISOString(), '2026-11-20T10:30:00.000Z');
  assert.equal(parseSeminarDate('미정'), null);
  assert.equal(parseSeminarDate('2026.13.01'), null);
});

test('pickPaidAt: 포트원 → 신청서 paidAt → createdAt → appliedAt 순', () => {
  const createdAt = { seconds: 1_700_000_000, nanoseconds: 0 };
  assert.equal(pickPaidAt({ portonePaidAt: '2026-11-01T01:00:00Z', application: { createdAt } }), Date.parse('2026-11-01T01:00:00Z'));
  assert.equal(pickPaidAt({ application: { paidAt: { toMillis: () => 123 }, createdAt } }), 123);
  assert.equal(pickPaidAt({ application: { createdAt } }), 1_700_000_000_000);
  assert.equal(pickPaidAt({ application: { appliedAt: '2026-11-02T00:00:00.000Z' } }), Date.parse('2026-11-02T00:00:00.000Z'));
  assert.equal(pickPaidAt({ application: {} }), null);
});

test('isSeminarCancelledByCompany', () => {
  assert.equal(isSeminarCancelledByCompany({ cancelledByOrganizer: true }), true);
  assert.equal(isSeminarCancelledByCompany({ status: '폐강' }), true);
  assert.equal(isSeminarCancelledByCompany({ status: '모집중' }), false);
  assert.equal(isSeminarCancelledByCompany(null), false);
});

test('kstDayNumber: KST 자정 경계', () => {
  assert.equal(kstDayNumber(kst('2026-11-20T00:00:00').getTime()) - kstDayNumber(kst('2026-11-19T23:59:59').getTime()), 1);
});
