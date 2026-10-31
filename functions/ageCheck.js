/**
 * 만 14세 미만 가입 차단용 생년월일 확인 — 순수 함수
 * (개인정보 보호법 제22조의2: 만 14세 미만은 법정대리인 동의가 필요 → 사이트는 가입 자체를 받지 않는다)
 *
 * 만 나이는 생일 당일 0시(KST)에 한 살 늘어난다(민법 제158조 출생일 산입). 2월 29일생은 3월 1일로 본다
 * (firestore.rules의 isAtLeast14와 같은 기준).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "1990-01-15" · "19900115" · "1990.01.15" · "1990/1/15" → { y, m, d } (유효하지 않으면 null) */
export function parseBirthdate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  let y; let m; let d;
  const sep = s.match(/^(\d{4})[.\-/\s]\s*(\d{1,2})[.\-/\s]\s*(\d{1,2})$/);
  if (sep) {
    [y, m, d] = [Number(sep[1]), Number(sep[2]), Number(sep[3])];
  } else if (/^\d{8}$/.test(s)) {
    [y, m, d] = [Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8))];
  } else {
    return null;
  }
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null; // 2월 31일 등
  return { y, m, d };
}

/** 만 14세가 되는 순간(KST 0시)의 epoch ms */
export function fourteenthBirthdayMs({ y, m, d }) {
  const [mm, dd] = (m === 2 && d === 29) ? [3, 1] : [m, d];
  return Date.UTC(y + 14, mm - 1, dd) - KST_OFFSET_MS;
}

/** 생년월일을 알 수 있고 만 14세 미만이면 true (알 수 없으면 false — 형식 확인은 화면·규칙에서) */
export function isUnder14(value, now = Date.now()) {
  const b = parseBirthdate(value);
  if (!b) return false;
  return now < fourteenthBirthdayMs(b);
}

/** 회원 문서에서 생년월일 후보(birthdate, 본인인증 verifiedBirthday) 중 판정 가능한 값 */
export function userIsUnder14(u, now = Date.now()) {
  if (!u || typeof u !== 'object') return false;
  return [u.birthdate, u.verifiedBirthday].some((v) => isUnder14(v, now));
}
