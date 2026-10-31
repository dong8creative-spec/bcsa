import { useEffect, useMemo, useState } from 'react';
import { firebaseService } from '../../services/firebaseService';
import { groupService } from '../../services/groupService';
import { summarizeProgramApplications, readAdminHiddenEntries } from '../../utils/adminHiddenApplications';
import { getSeminarCapacity } from '../../utils/seminarDisplay';

/** 프로그램 날짜 문자열("2026.11.05 19:00" 등) → 밀리초 */
export const programDateMs = (dateStr) => {
  const num = String(dateStr || '').replace(/\D/g, '');
  if (num.length < 8) return 0;
  const y = +num.slice(0, 4); const m = +num.slice(4, 6) - 1; const d = +num.slice(6, 8);
  const h = num.length >= 10 ? +num.slice(8, 10) : 0; const mi = num.length >= 12 ? +num.slice(10, 12) : 0;
  return new Date(y, m, d, h, mi).getTime();
};

export const isPendingMember = (u) => u?.approvalStatus === 'pending';
export const needsBusinessDocCheck = (u) => !!u?.businessRegistrationDoc && !u?.businessDocVerifiedAt;

/**
 * 관리자 '오늘 할 일' 집계. 각 항목은 { value, error } — 불러오기 실패(error)와 진짜 0을 구분한다.
 * 왼쪽 메뉴 숫자와 홈 카드가 같은 값을 쓰도록 대시보드에서 한 번만 구독한다.
 */
export function useAdminTodo() {
  const [users, setUsers] = useState(null);
  const [groups, setGroups] = useState(null);
  const [reports, setReports] = useState(null);
  const [seminars, setSeminars] = useState(null);
  const [applications, setApplications] = useState(null);
  const [errors, setErrors] = useState({});
  const fail = (k) => () => setErrors((e) => ({ ...e, [k]: true }));

  useEffect(() => firebaseService.subscribeUsersAdmin((v) => { setUsers(v); setErrors((e) => ({ ...e, users: false })); }, fail('users')), []);
  useEffect(() => groupService.subscribeAllGroupsAdmin(setGroups, fail('groups')), []);
  useEffect(() => groupService.subscribeOpenReports(setReports, fail('reports')), []);
  useEffect(() => firebaseService.subscribeSeminars(setSeminars, fail('seminars')), []);
  useEffect(() => firebaseService.subscribeApplications(setApplications, fail('applications')), []);

  return useMemo(() => {
    const item = (list, key, pick) => ({
      loading: list === null && !errors[key],
      error: !!errors[key],
      value: list ? pick(list) : null,
    });
    const hiddenEntries = readAdminHiddenEntries();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const upcoming = (seminars || [])
      .filter((s) => programDateMs(s.date) >= todayStart.getTime())
      .sort((a, b) => programDateMs(a.date) - programDateMs(b.date))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        capacity: getSeminarCapacity(s),
        closed: !!s.recruitmentClosedByAdmin,
        ...(applications ? summarizeProgramApplications(s, applications, hiddenEntries) : { confirmed: null, awaitingPayment: null, hidden: null }),
      }));
    return {
      pendingMembers: item(users, 'users', (l) => l.filter(isPendingMember).length),
      businessDocs: item(users, 'users', (l) => l.filter(needsBusinessDocCheck).length),
      pendingGroups: item(groups, 'groups', (l) => l.filter((g) => g.status === 'pending').length),
      openReports: item(reports, 'reports', (l) => l.length),
      upcoming: {
        loading: (seminars === null && !errors.seminars) || (applications === null && !errors.applications),
        error: !!errors.seminars || !!errors.applications,
        value: upcoming,
      },
    };
  }, [users, groups, reports, seminars, applications, errors]);
}
