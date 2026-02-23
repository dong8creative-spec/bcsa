#!/usr/bin/env node
/**
 * 지난 세미나 만석·종료 일회성 스크립트
 *
 * Firestore `seminars` 컬렉션에서 행사 일자(date)가 오늘 0시 이전인 문서만 골라
 * status: '종료', currentParticipants: maxParticipants(또는 capacity) 로 일괄 업데이트합니다.
 *
 * 실행 전:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * 실행:
 *   node scripts/close-past-seminars.mjs           # 실제 업데이트
 *   node scripts/close-past-seminars.mjs --dry-run # 대상만 출력, 업데이트 없음
 */

import admin from 'firebase-admin';

const isDryRun = process.argv.includes('--dry-run');

/** 날짜 문자열을 비교용 타임스탬프로 변환 (앱 parseDateForSort와 동일) */
function parseDateForSort(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = String(dateStr).trim();
  const num = trimmed.replace(/\D/g, '');
  if (num.length >= 8) {
    const y = parseInt(num.slice(0, 4), 10);
    const m = parseInt(num.slice(4, 6), 10) - 1;
    const d = parseInt(num.slice(6, 8), 10);
    const h = num.length >= 10 ? parseInt(num.slice(8, 10), 10) : 0;
    const min = num.length >= 12 ? parseInt(num.slice(10, 12), 10) : 0;
    const date = new Date(y, m, d, h, min);
    return date.getTime();
  }
  return 0;
}

/** 오늘 0시 0분 0초 타임스탬프 (로컬) */
function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();
  const todayStart = getTodayStart();

  const snapshot = await db.collection('seminars').get();
  const all = snapshot.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

  const past = all.filter((doc) => parseDateForSort(doc.date) < todayStart);

  console.log(`[close-past-seminars] 전체 세미나: ${all.length}건, 오늘 이전(대상): ${past.length}건`);
  if (past.length === 0) {
    console.log('[close-past-seminars] 처리할 대상이 없습니다.');
    process.exit(0);
    return;
  }

  if (isDryRun) {
    console.log('[close-past-seminars] --dry-run: 실제 업데이트 없이 대상만 출력합니다.');
    for (const doc of past) {
      const cap = Number(doc.maxParticipants ?? doc.capacity ?? 0);
      console.log(`  ${doc.id} | date=${doc.date ?? '-'} | title=${(doc.title ?? '').slice(0, 40)} | cap=${cap}`);
    }
    console.log(`[close-past-seminars] dry-run 완료. 위 ${past.length}건이 적용 대상입니다.`);
    process.exit(0);
    return;
  }

  let success = 0;
  let fail = 0;
  for (const doc of past) {
    const cap = Number(doc.maxParticipants ?? doc.capacity ?? 0);
    try {
      await doc.ref.update({ status: '종료', currentParticipants: cap });
      success += 1;
      console.log(`  [OK] ${doc.id} (${doc.title ?? '-'})`);
    } catch (err) {
      fail += 1;
      console.error(`  [FAIL] ${doc.id}:`, err.message);
    }
  }

  console.log(`[close-past-seminars] 완료: 성공 ${success}건, 실패 ${fail}건`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[close-past-seminars] 오류:', err);
  process.exit(1);
});
