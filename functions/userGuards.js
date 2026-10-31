/**
 * 회원 문서 서버 확인 (onDocumentWritten users/{userId} → guardUserDoc)
 *
 * 회원 문서는 클라이언트가 직접 만들기 때문에(firestore.rules가 1차로 막음) 서버가 한 번 더 확인한다.
 *  1. 만 14세 미만 (개인정보 보호법 제22조의2)
 *     - 새로 만들어진 문서: 바로 삭제하고 Auth 계정도 지운다(법정대리인 동의 없이 보관할 근거가 없음).
 *       firestore.rules가 "YYYY-MM-DD" 형식은 미리 막으므로, 이 경로는 형식을 바꿔 규칙을 우회한 경우에만 탄다.
 *     - 기존 문서가 승인 상태가 되면 승인 대기로 되돌리고 ageRestricted 표시를 남긴다(운영진 확인용).
 *  2. 강제 탈퇴 후 1년 재가입 제한 (blockedRegistrations 확인값과 대조): 새 문서를 반려(rejected) 상태로 바꾼다.
 */
import { userIsUnder14 } from './ageCheck.js';

export function createUserGuards({ db, admin, blocklist }) {
  const FieldValue = admin.firestore.FieldValue;

  /**
   * @returns {Promise<string>} 수행한 조치 ('none' | 'deleted_under14' | 'reverted_under14' | 'flagged_under14' | 'rejected_blocked')
   */
  async function onUserWritten({ userId, before, after, secret, now = new Date() }) {
    if (!after) return 'none';
    const ref = db.collection('users').doc(userId);
    const isCreate = !before;

    if (userIsUnder14(after, now.getTime())) {
      if (isCreate) {
        await ref.delete();
        const authUid = String(after.uid || userId);
        try {
          await admin.auth().deleteUser(authUid);
        } catch (e) {
          if (e?.code !== 'auth/user-not-found') console.warn('[guardUserDoc] under14 auth delete failed', e?.code || e?.message);
        }
        console.warn('[guardUserDoc] 만 14세 미만 가입 문서 삭제:', userId);
        return 'deleted_under14';
      }
      const approved = !after.approvalStatus || after.approvalStatus === 'approved';
      if (approved) {
        await ref.update({ approvalStatus: 'pending', ageRestricted: true, ageRestrictedAt: FieldValue.serverTimestamp() });
        return 'reverted_under14';
      }
      if (after.ageRestricted !== true) {
        await ref.update({ ageRestricted: true, ageRestrictedAt: FieldValue.serverTimestamp() });
        return 'flagged_under14';
      }
      return 'none';
    }

    if (isCreate && blocklist) {
      const until = await blocklist.findActiveBlock(secret, {
        uid: after.uid || userId,
        email: after.email,
        phone: after.phone || after.phoneNumber,
        now,
      });
      if (until) {
        await ref.update({
          approvalStatus: 'rejected',
          blockedRegistration: true,
          rejectReason: '강제 탈퇴 후 재가입 제한 기간입니다.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'rejected_blocked';
      }
    }
    return 'none';
  }

  return { onUserWritten };
}
