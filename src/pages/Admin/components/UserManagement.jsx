import React, { useState, useEffect } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Icons } from '../../../components/Icons';
import { getInitialMemberEditForm, EDITABLE_FIELD_LABELS, BUSINESS_CATEGORIES } from '../constants/memberFields';
import { isPendingMember, needsBusinessDocCheck } from '../useAdminTodo';
import { AdminPageHeader, CARD, INPUT, LoadError, adminAlert, adminConfirm, adminPrompt, btn, chip } from './ui';

const PAGE_SIZE = 10;

// 회원등급 표시·정렬 순서: 마스터 → 운영진(운영자) → 파트너사 → 사업자 → 예창(예비창업자) → 대기자(대기)
const MEMBER_GRADE_OPTIONS = [
  { value: '', label: '등급 없음' },
  { value: '마스터', label: '마스터' },
  { value: '운영진', label: '운영진' },
  { value: '파트너사', label: '파트너사' },
  { value: '사업자', label: '사업자' },
  { value: '예창', label: '예창' },
  { value: '대기자', label: '대기자' },
];
const GRADE_PRIORITY = { 마스터: 0, 운영진: 1, 파트너사: 2, 사업자: 3, 예창: 4, 대기자: 5 };

/**
 * 등급을 정하면 권한·승인 상태도 함께 정한다.
 * - 마스터·운영진: 관리자 권한
 * - 대기자·등급 없음: 승인 대기로 둔다 (예전에는 이 경우에도 자동 승인되던 문제)
 */
const gradePayload = (gradeValue) => {
  const grade = String(gradeValue || '').trim();
  const waiting = !grade || grade === '대기자';
  return {
    memberGrade: grade,
    approvalStatus: waiting ? 'pending' : 'approved',
    role: grade === '마스터' || grade === '운영진' ? 'admin' : 'user',
  };
};

/** 승인할 때 기본으로 고를 등급: 사업자 정보가 있으면 사업자, 아니면 예창 */
const defaultApproveGrade = (u) => (u?.userType === '사업자' || u?.businessRegistrationNumber || u?.company ? '사업자' : '예창');

const VIEW_FILTERS = [
  ['all', '전체'],
  ['pending', '승인 대기'],
  ['businessDoc', '등록증 확인'],
  ['rejected', '거절'],
];

const VALID_MEMBER_GRADES = new Set(MEMBER_GRADE_OPTIONS.map((o) => o.value).filter(Boolean));

/** 통계·정렬: 화면상 '등급 없음'(빈 값 등)과 옵션에 없는 값은 '대기자'와 동일하게 취급 */
function gradeBucketForStats(memberGrade) {
  const t = String(memberGrade ?? '').trim();
  if (!t || t === '등급 없음' || t === '등급없음') return '대기자';
  if (VALID_MEMBER_GRADES.has(t)) return t;
  return '대기자';
}

/** 등급별 통계 카드 배경/텍스트 색상 (한눈에 구분) */
const GRADE_STYLES = {
  '': 'bg-slate-100 text-slate-700 border-slate-200',
  '마스터': 'bg-amber-100 text-amber-800 border-amber-200',
  '운영진': 'bg-red-100 text-red-800 border-red-200',
  '파트너사': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  '사업자': 'bg-blue-100 text-blue-800 border-black/10',
  '예창': 'bg-slate-100 text-slate-700 border-slate-200',
  '대기자': 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * 회원 관리 컴포넌트
 * @param {Object} props
 * @param {Object} [props.currentUser] - Firebase 로그인 사용자 (쓰기 시 필수)
 */
export const UserManagement = ({ currentUser, initialView }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewFilter, setViewFilter] = useState(VIEW_FILTERS.some(([k]) => k === initialView) ? initialView : null);
  const [approveTarget, setApproveTarget] = useState(null); // { user, grade }
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [memberModalUser, setMemberModalUser] = useState(null);
  const [bulkGradeValue, setBulkGradeValue] = useState('');
  const [sortKey, setSortKey] = useState('memberGrade');
  const [sortOrder, setSortOrder] = useState('asc');
  const [memberModalEditing, setMemberModalEditing] = useState(false);
  const [memberEditForm, setMemberEditForm] = useState(() => getInitialMemberEditForm(null));
  const [savingMember, setSavingMember] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMemberGrade, setFilterMemberGrade] = useState('');

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersData = await firebaseService.getUsersAdmin();
      setUsers(usersData);
      setLoadError(false);
    } catch (error) {
      console.error('회원 목록 로드 오류:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 처음 들어왔을 때: 승인 대기가 있으면 승인 대기부터 보여 준다
  useEffect(() => {
    if (viewFilter !== null || isLoading) return;
    setViewFilter(users.some(isPendingMember) ? 'pending' : 'all');
  }, [isLoading, users, viewFilter]);

  useEffect(() => {
    if (VIEW_FILTERS.some(([k]) => k === initialView)) setViewFilter(initialView);
  }, [initialView]);

  useEffect(() => {
    if (firebaseService.subscribeUsersAdmin) {
      setIsLoading(true);
      const unsubscribe = firebaseService.subscribeUsersAdmin((usersData) => {
        setUsers(usersData);
        setLoadError(false);
        setIsLoading(false);
      }, () => { setLoadError(true); setIsLoading(false); });
      return () => unsubscribe();
    }
    loadUsers();
  }, []);

  /** 강제 탈퇴 실제 처리 (확인창 없이). 실패하면 예외를 던진다 */
  const withdrawUser = async (user) => {
    const uid = user?.uid || user?.id;
    const userId = user?.id || user?.uid;
    const email = (user?.email || '').toString().trim();
    const phone = (user?.phone || user?.phoneNumber || '').toString().trim();
    if (firebaseService.purgeUserRelatedData) {
      await firebaseService.purgeUserRelatedData({
        id: userId,
        uid: uid || userId,
        name: user.name,
        email: user.email,
        phone: user.phone || user.phoneNumber,
      });
    }
    if (firebaseService.addBlockedRegistration && uid) {
      await firebaseService.addBlockedRegistration(uid, email, phone);
    }
    if (firebaseService.deleteAuthUser && uid) {
      await firebaseService.deleteAuthUser(uid);
    }
    await firebaseService.deleteUser(userId);
  };

  const handleDeleteUser = async (user) => {
    if (!currentUser) {
      adminAlert('탈퇴 처리를 하려면 먼저 로그인해 주세요. 메인 페이지에서 로그인한 뒤 관리자 페이지로 다시 들어와 주세요.');
      return false;
    }
    const who = user?.name ? `${user.name}님` : '이 회원';
    if (!(await adminConfirm(`${who}을(를) 강제 탈퇴 처리할까요?\n탈퇴한 회원은 1년 동안 다시 가입할 수 없어요. 되돌릴 수 없어요.`, { title: '강제 탈퇴', okText: '탈퇴 처리', danger: true }))) return false;
    try {
      await withdrawUser(user);
      adminAlert('강제 탈퇴 처리했어요. 이 회원은 1년 동안 다시 가입할 수 없어요.');
      if (!firebaseService.subscribeUsersAdmin) loadUsers();
      return true;
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      adminAlert(`강제 탈퇴하지 못했어요. ${error?.message || ''}`);
      return false;
    }
  };

  const markBusy = (id, on) => setBusyIds((prev) => { const n = new Set(prev); if (on) n.add(String(id)); else n.delete(String(id)); return n; });

  /** 가입 승인: 등급을 골라 승인 (승인 창에서 확정) */
  const confirmApprove = async () => {
    if (!approveTarget) return;
    const { user, grade } = approveTarget;
    const id = String(user.id || user.uid);
    const payload = gradePayload(grade);
    if (payload.role === 'admin' && !(await adminConfirm(`${grade}은(는) 관리자 권한이 생겨요. 회원 정보·결제·설정을 모두 바꿀 수 있게 돼요. 계속할까요?`, { danger: true, okText: '관리자로 승인' }))) return;
    setApproveTarget(null);
    markBusy(id, true);
    try {
      await firebaseService.updateUser(id, { ...payload, rejectReason: '', approvedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((u) => (String(u.id) === id ? { ...u, ...payload, rejectReason: '' } : u)));
    } catch (error) {
      adminAlert(`승인하지 못했어요. ${error?.message || ''}`);
    } finally {
      markBusy(id, false);
    }
  };

  /** 가입 거절: 사유를 남기고 거절 상태로 (회원 문서는 지우지 않음 — 회원은 마이페이지에서 사유를 봄) */
  const handleReject = async (user) => {
    const who = user?.name ? `${user.name}님` : '이 회원';
    const reason = await adminPrompt(`${who}의 가입을 거절할게요.\n거절 사유를 적어 주세요. 회원 마이페이지에 그대로 보여요.`, {
      title: '가입 거절', multiline: true, required: true, maxLength: 300, okText: '거절하기', danger: true,
      placeholder: '예: 부산 지역 사업자·예비창업자만 가입할 수 있어요.',
    });
    if (reason === null) return;
    const id = String(user.id || user.uid);
    const payload = { approvalStatus: 'rejected', rejectReason: reason.trim(), rejectedAt: new Date().toISOString() };
    markBusy(id, true);
    try {
      await firebaseService.updateUser(id, payload);
      setUsers((prev) => prev.map((u) => (String(u.id) === id ? { ...u, ...payload } : u)));
    } catch (error) {
      adminAlert(`거절하지 못했어요. ${error?.message || ''}`);
    } finally {
      markBusy(id, false);
    }
  };

  /** 회원등급 지정 시 승인 처리 + 역할 지정(마스터/운영진=관리자, 그 외=일반 회원) */
  const handleGradeChange = async (userId, value) => {
    if (!currentUser) {
      adminAlert('메인 페이지에서 로그인한 뒤 다시 시도해 주세요.');
      return;
    }
    const id = String(userId ?? '').trim();
    if (!id) {
      adminAlert('회원 정보를 찾을 수 없어요.');
      return;
    }
    const payload = gradePayload(value);
    const { memberGrade: grade, role } = payload;
    // 드롭다운을 바꾸는 즉시 저장되므로 반드시 확인을 거친다 (마스터·운영진은 관리자 권한이 생김)
    const target = users.find((u) => String(u.id) === id || String(u.uid) === id);
    const who = target?.name ? `${target.name}님` : '이 회원';
    const label = MEMBER_GRADE_OPTIONS.find((o) => o.value === grade)?.label || grade || '등급 없음';
    const warn = role === 'admin'
      ? `\n\n${label}은(는) 관리자 권한이 생겨요. 회원 정보·결제·설정을 모두 바꿀 수 있게 돼요.`
      : '';
    const what = payload.approvalStatus === 'approved' ? '바꾸고 가입을 승인할까요?' : '바꿀까요? 승인 대기 상태가 돼요.';
    if (!(await adminConfirm(`${who}의 등급을 "${label}"(으)로 ${what}${warn}`, { title: '등급 변경', okText: '바꾸기', danger: role === 'admin' }))) return;
    try {
      await firebaseService.updateUser(id, payload);
      setUsers(prev => prev.map(u => (String(u.id) === id || String(u.uid) === id) ? { ...u, ...payload } : u));
      if (memberModalUser && (String(memberModalUser.id) === id || String(memberModalUser.uid) === id)) {
        setMemberModalUser(prev => prev ? { ...prev, ...payload } : null);
      }
      if (!firebaseService.subscribeUsersAdmin) loadUsers();
    } catch (error) {
      console.error('회원등급 변경 오류:', error);
      adminAlert(`등급을 바꾸지 못했어요. ${error?.message || ''}`);
    }
  };

  /**
   * 사업자등록증 사본 보기. 회원이 직접 넣는 값이라 이미지/PDF data URL 형식만 허용하고,
   * HTML 문자열을 쓰지 않고 요소를 만들어 src만 지정한다 (관리자 화면 스크립트 삽입 방지).
   */
  const openBusinessDoc = (value) => {
    const v = String(value || '');
    const m = v.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/);
    if (!m) { adminAlert('열 수 없는 형식의 파일이에요.'); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.title = '사업자등록증';
    const el = w.document.createElement(m[1] === 'application/pdf' ? 'iframe' : 'img');
    el.src = v;
    el.style.cssText = m[1] === 'application/pdf' ? 'width:100%;height:100vh;border:0' : 'max-width:100%';
    w.document.body.appendChild(el);
  };

  /** 사업자등록증 확인 완료: 사본 이미지를 지우고 확인 시각만 남긴다 */
  const handleBusinessDocVerified = async () => {
    if (!memberModalUser) return;
    if (!(await adminConfirm('사업자등록증 내용을 확인하셨나요?\n확인 완료로 표시하고 사본 이미지는 지워요.', { okText: '확인 완료' }))) return;
    const id = memberModalUser.id || memberModalUser.uid;
    const payload = { businessRegistrationDoc: '', businessRegistrationFileName: '', businessVerified: true, businessDocVerifiedAt: new Date().toISOString() };
    try {
      await firebaseService.updateUser(id, payload);
      setMemberModalUser((prev) => (prev ? { ...prev, ...payload } : prev));
      setUsers((prev) => prev.map((u) => (String(u.id) === String(id) ? { ...u, ...payload } : u)));
    } catch (error) {
      adminAlert(`처리하지 못했어요. ${error?.message || ''}`);
    }
  };

  const openMemberEdit = () => {
    setMemberEditForm(getInitialMemberEditForm(memberModalUser));
    setMemberModalEditing(true);
  };

  const handleMemberEditSave = async () => {
    if (!memberModalUser) return;
    if (!currentUser) {
      adminAlert('메인 페이지에서 로그인한 뒤 다시 시도해 주세요.');
      return;
    }
    const userId = memberModalUser.id || memberModalUser.uid;
    const u = memberModalUser;
    const payload = {};
    const correctedFields = [];
    const str = (v) => String(v ?? '').trim();

    if (str(memberEditForm.memberGrade) !== str(u.memberGrade)) {
      Object.assign(payload, gradePayload(memberEditForm.memberGrade));
      if (payload.role === 'admin' && !(await adminConfirm(`${payload.memberGrade}은(는) 관리자 권한이 생겨요. 저장할까요?`, { danger: true, okText: '저장' }))) return;
      correctedFields.push('memberGrade');
    }
    if (str(memberEditForm.company) !== str(u.company)) { payload.company = memberEditForm.company; correctedFields.push('company'); }
    if (str(memberEditForm.companyPhone) !== str(u.companyPhone)) { payload.companyPhone = memberEditForm.companyPhone; correctedFields.push('companyPhone'); }
    if (str(memberEditForm.companyWebsite) !== str(u.companyWebsite)) { payload.companyWebsite = memberEditForm.companyWebsite; correctedFields.push('companyWebsite'); }
    const nextCategory = str(memberEditForm.businessCategory) || str(memberEditForm.industry);
    const currCategory = str(u.businessCategory) || str(u.industry);
    if (nextCategory !== currCategory) { payload.businessCategory = nextCategory; payload.industry = nextCategory; correctedFields.push('businessCategory'); }
    if (str(memberEditForm.position) !== str(u.position)) { payload.position = memberEditForm.position; correctedFields.push('position'); }
    if (str(memberEditForm.collaborationIndustry) !== str(u.collaborationIndustry)) { payload.collaborationIndustry = memberEditForm.collaborationIndustry; correctedFields.push('collaborationIndustry'); }
    if (str(memberEditForm.keyCustomers) !== str(u.keyCustomers)) { payload.keyCustomers = memberEditForm.keyCustomers; correctedFields.push('keyCustomers'); }

    if (Object.keys(payload).length === 0) {
      setMemberModalEditing(false);
      return;
    }
    setSavingMember(true);
    try {
      await firebaseService.updateUser(userId, payload);
      const message = correctedFields.length > 0
        ? `${correctedFields.map(f => EDITABLE_FIELD_LABELS[f] || f).join(', ')}가 정정되었습니다.`
        : '회원정보가 정정되었습니다.';
      // 회원 정보는 이미 저장됨. 정정 알림은 부가 기능이라 실패해도 저장 실패로 보이지 않게 따로 처리
      let notified = false;
      if (firebaseService.addUserNotification) {
        try {
          await firebaseService.addUserNotification(userId, { type: 'profile_corrected', message, correctedFields });
          notified = true;
        } catch (notifyError) {
          console.warn('정정 알림 전달 실패(정보는 저장됨):', notifyError);
        }
      }
      adminAlert(notified ? '저장했어요. 회원에게 정정 알림도 보냈어요.' : '저장했어요. (회원 알림은 보내지 못했어요)');
      setMemberModalEditing(false);
      setMemberModalUser(prev => prev ? { ...prev, ...payload } : null);
      if (!firebaseService.subscribeUsersAdmin) loadUsers();
    } catch (error) {
      console.error('회원 정보 수정 오류:', error);
      adminAlert(`저장하지 못했어요. ${error?.message || ''}`);
    } finally {
      setSavingMember(false);
    }
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedUsers.map(u => u.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    if (allOnPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkGradeChange = async () => {
    if (!currentUser) {
      adminAlert('메인 페이지에서 로그인한 뒤 다시 시도해 주세요.');
      return;
    }
    if (selectedIds.size === 0) {
      adminAlert('등급을 바꿀 회원을 골라 주세요.');
      return;
    }
    const payload = gradePayload(bulkGradeValue);
    const label = MEMBER_GRADE_OPTIONS.find(o => o.value === payload.memberGrade)?.label || payload.memberGrade || '등급 없음';
    const warn = payload.role === 'admin' ? `\n\n${label}은(는) 관리자 권한이 생겨요.` : '';
    if (!(await adminConfirm(`고른 ${selectedIds.size}명의 등급을 "${label}"(으)로 바꿀까요?${warn}`, { title: '등급 일괄 변경', okText: '바꾸기', danger: payload.role === 'admin' }))) return;

    const ids = [...selectedIds];
    const done = new Set();
    let failed = 0;
    for (const id of ids) {
      try {
        await firebaseService.updateUser(id, payload);
        done.add(id);
      } catch (error) {
        failed += 1;
        console.error('일괄 등급 변경 오류:', id, error);
      }
    }
    setUsers(prev => prev.map(u => (done.has(u.id) || done.has(u.uid)) ? { ...u, ...payload } : u));
    if (memberModalUser && (done.has(memberModalUser.id) || done.has(memberModalUser.uid))) {
      setMemberModalUser(prev => prev ? { ...prev, ...payload } : null);
    }
    adminAlert(failed === 0 ? `${done.size}명의 등급을 바꿨어요.` : `${done.size}명은 바꿨고, ${failed}명은 바꾸지 못했어요. 바꾸지 못한 회원은 선택된 채로 남겨 뒀어요.`);
    setSelectedIds(new Set(ids.filter((id) => !done.has(id))));
    if (failed === 0) setBulkGradeValue('');
    if (!firebaseService.subscribeUsersAdmin) loadUsers();
  };

  /**
   * 일괄 탈퇴: 검색·필터로 화면에 안 보이는 회원도 고른 사람 전원을 처리한다
   * (예전에는 지금 검색 결과에 보이는 사람만 처리하고 완료 알림은 고른 전체 인원으로 나오던 문제).
   */
  const handleBulkWithdraw = async () => {
    if (!currentUser) {
      adminAlert('메인 페이지에서 로그인한 뒤 다시 시도해 주세요.');
      return;
    }
    const targets = users.filter((u) => selectedIds.has(u.id));
    if (targets.length === 0) {
      adminAlert('탈퇴 처리할 회원을 골라 주세요.');
      return;
    }
    const names = targets.slice(0, 5).map((u) => u.name || '(이름 없음)').join(', ') + (targets.length > 5 ? ` 외 ${targets.length - 5}명` : '');
    const typed = await adminPrompt(`고른 ${targets.length}명을 강제 탈퇴 처리할게요.\n${names}\n\n탈퇴한 회원은 1년 동안 다시 가입할 수 없고, 되돌릴 수 없어요.\n계속하려면 "탈퇴"라고 입력해 주세요.`, {
      title: '일괄 강제 탈퇴', mustEqual: '탈퇴', okText: `${targets.length}명 탈퇴 처리`, danger: true, placeholder: '탈퇴',
    });
    if (typed === null) return;

    const done = new Set();
    const failedNames = [];
    for (const user of targets) {
      try {
        await withdrawUser(user);
        done.add(user.id);
      } catch (error) {
        console.error('일괄 탈퇴 오류:', user.id, error);
        failedNames.push(user.name || user.id);
      }
    }
    setSelectedIds(new Set([...selectedIds].filter((id) => !done.has(id))));
    setMemberModalUser(null);
    adminAlert(failedNames.length === 0
      ? `${done.size}명을 탈퇴 처리했어요. 1년 동안 다시 가입할 수 없어요.`
      : `${done.size}명은 탈퇴 처리했고, ${failedNames.length}명은 처리하지 못했어요.\n처리 못 한 회원: ${failedNames.slice(0, 10).join(', ')}`);
    if (!firebaseService.subscribeUsersAdmin) loadUsers();
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = !filterMemberGrade || gradeBucketForStats(user.memberGrade) === filterMemberGrade;
    const v = viewFilter || 'all';
    const matchesView = v === 'all'
      || (v === 'pending' && isPendingMember(user))
      || (v === 'businessDoc' && needsBusinessDocCheck(user))
      || (v === 'rejected' && user.approvalStatus === 'rejected');
    return matchesSearch && matchesGrade && matchesView;
  });

  const sortedUsers = React.useMemo(() => {
    const getVal = (u, k) => {
      if (k === 'createdAt') {
        const c = u.createdAt;
        if (!c) return 0;
        if (typeof c.toDate === 'function') return c.toDate().getTime();
        if (typeof c === 'string') return new Date(c).getTime();
        return 0;
      }
      if (k === 'memberGrade') {
        const b = gradeBucketForStats(u.memberGrade);
        return GRADE_PRIORITY[b] ?? 5;
      }
      return (u[k] || '').toString().trim().toLowerCase();
    };
    const list = [...filteredUsers];
    const order = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (sortKey === 'createdAt') return order * (va - vb);
      if (sortKey === 'memberGrade') return order * (va - vb);
      if (va < vb) return -1 * order;
      if (va > vb) return 1 * order;
      return 0;
    });
    return list;
  }, [filteredUsers, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const paginatedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  /** 등급별 인원 수 (memberGrade 기준, role 사용 안 함). '등급 없음'·미지정·알 수 없는 값 → 대기자에 합산 */
  const gradeCounts = React.useMemo(() => {
    const counts = { 마스터: 0, 운영진: 0, 파트너사: 0, 사업자: 0, 예창: 0, 대기자: 0 };
    users.forEach((u) => {
      const b = gradeBucketForStats(u.memberGrade);
      counts[b] += 1;
    });
    return counts;
  }, [users]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMemberGrade, sortKey, sortOrder, viewFilter]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-slate-600">회원 목록을 불러오는 중…</p>
        </div>
      </div>
    );
  }

  const viewCounts = {
    all: users.length,
    pending: users.filter(isPendingMember).length,
    businessDoc: users.filter(needsBusinessDocCheck).length,
    rejected: users.filter((u) => u.approvalStatus === 'rejected').length,
  };
  const joinedDate = (u) => u.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? (typeof u.createdAt === 'string' ? new Date(u.createdAt).toLocaleDateString('ko-KR') : '') ?? '';

  /** 승인 대기 회원 줄에 붙는 승인·거절 버튼 */
  const renderApprovalActions = (user) => {
    const busy = busyIds.has(String(user.id));
    if (isPendingMember(user)) {
      return (
        <div className="flex gap-1.5 justify-center">
          <button type="button" disabled={busy} onClick={() => setApproveTarget({ user, grade: defaultApproveGrade(user) })} className={btn('primary', 'sm')}>승인</button>
          <button type="button" disabled={busy} onClick={() => handleReject(user)} className={btn('danger', 'sm')}>거절</button>
        </div>
      );
    }
    if (user.approvalStatus === 'rejected') {
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">거절됨</span>
          <button type="button" disabled={busy} onClick={() => setApproveTarget({ user, grade: defaultApproveGrade(user) })} className="text-xs font-semibold text-brand hover:underline">다시 승인</button>
        </div>
      );
    }
    return <span className="text-xs font-semibold text-emerald-700">승인됨</span>;
  };

  return (
    <div>
      <AdminPageHeader
        title="회원"
        description="가입 신청을 승인·거절하고 등급을 정해요. 마스터·운영진은 관리자 권한이 생겨요."
        actions={!firebaseService.subscribeUsersAdmin ? (
          <button type="button" onClick={loadUsers} className={btn('secondary')}><Icons.RefreshCw size={16} />새로고침</button>
        ) : null}
      />

      {loadError ? <div className="mb-4"><LoadError what="회원 목록" onRetry={loadUsers} /></div> : null}

      {/* 상태별 보기 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {VIEW_FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setViewFilter(k)} className={chip((viewFilter || 'all') === k)}>
            {label} {viewCounts[k]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="이름 또는 이메일로 찾기"
          aria-label="회원 검색"
          className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border border-black/10 bg-white text-sm focus:border-brand focus:outline-none"
        />
        <select value={filterMemberGrade} onChange={(e) => setFilterMemberGrade(e.target.value)} aria-label="등급으로 거르기"
          className="px-3 py-2 rounded-lg border border-black/10 bg-white text-sm focus:border-brand focus:outline-none">
          <option value="">모든 등급 ({users.length})</option>
          {MEMBER_GRADE_OPTIONS.filter((o) => o.value).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label} ({gradeCounts[opt.value] ?? 0})</option>
          ))}
        </select>
      </div>

      {/* 일괄 작업 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-2xl bg-soft">
        <button type="button" onClick={toggleSelectAll} className={btn('secondary', 'sm')}>
          {paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.has(u.id)) ? '이 쪽 선택 해제' : '이 쪽 전체 선택'}
        </button>
        {selectedIds.size > 0 ? (
          <>
            <span className="text-sm text-slate-600 font-semibold">{selectedIds.size}명 선택</span>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold text-slate-500 hover:underline">선택 비우기</button>
            <select
              value={bulkGradeValue}
              onChange={(e) => setBulkGradeValue(e.target.value)}
              aria-label="일괄 변경할 등급"
              className="px-2.5 py-1.5 rounded-lg border border-black/10 text-xs bg-white focus:border-brand focus:outline-none"
            >
              <option value="">등급 고르기</option>
              {MEMBER_GRADE_OPTIONS.filter(o => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="button" onClick={handleBulkGradeChange} disabled={!bulkGradeValue} className={btn('primary', 'sm')}>등급 일괄 변경</button>
            <button type="button" onClick={handleBulkWithdraw} className={btn('danger', 'sm')}>일괄 강제 탈퇴</button>
          </>
        ) : <span className="text-xs text-slate-500">회원을 고르면 등급을 한꺼번에 바꿀 수 있어요.</span>}
      </div>

      {/* 휴대폰: 카드 목록 */}
      <ul className="md:hidden space-y-2">
        {paginatedUsers.length === 0 ? (
          <li className={`${CARD} p-6 text-center text-sm text-slate-500`}>해당하는 회원이 없어요.</li>
        ) : paginatedUsers.map((user) => (
          <li key={user.id} className={`${CARD} p-3`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelectOne(user.id)} aria-label={`${user.name || '회원'} 선택`} className="mt-1 w-4 h-4" />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setMemberModalUser(user)} className="font-bold text-brand hover:underline text-left">{user.name || '-'}</button>
                <p className="text-xs text-slate-500 truncate">{[user.company, joinedDate(user) && `${joinedDate(user)} 가입`].filter(Boolean).join(' · ') || '-'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <select value={user.memberGrade || ''} onChange={(e) => handleGradeChange(user.id || user.uid, e.target.value)} aria-label="등급"
                    className="px-2 py-1 rounded-lg border border-black/10 text-xs bg-white">
                    {MEMBER_GRADE_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                  </select>
                  {renderApprovalActions(user)}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 회원 목록: 회원등급 | 회원명 | 가입일자 | 탈퇴 (항목별 오름/내림차순 정렬) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black/10 bg-blue-50/50">
              <th className="px-4 py-3 text-center w-12 align-middle">
                <input
                  type="checkbox"
                  checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.has(u.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand"
                />
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-slate-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('memberGrade')}
              >
                <span className="block text-center">회원등급</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white/90 text-slate-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'memberGrade' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-slate-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('name')}
              >
                <span className="block text-center">회원명</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white/90 text-slate-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'name' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-slate-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('company')}
              >
                <span className="block text-center">회사명</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white/90 text-slate-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'company' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th
                className="relative px-4 py-3 pr-12 text-center text-sm font-bold text-slate-700 cursor-pointer hover:bg-brand/10 select-none align-middle"
                onClick={() => handleSort('createdAt')}
              >
                <span className="block text-center">가입일자</span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 bg-white/90 text-slate-500 shadow-sm" aria-hidden="true">
                  {sortKey === 'createdAt' ? (sortOrder === 'asc' ? <Icons.ChevronUp size={18} className="text-brand" /> : <Icons.ChevronDown size={18} className="text-brand" />) : <Icons.ChevronUp size={14} className="opacity-40" />}
                </span>
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-700 align-middle">가입 승인</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-slate-700 align-middle">탈퇴</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  해당하는 회원이 없어요.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-black/[0.06] hover:bg-slate-50">
                  <td className="px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelectOne(user.id)}
                      className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand"
                    />
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <select
                      value={user.memberGrade || ''}
                      onChange={(e) => handleGradeChange(user.id || user.uid, e.target.value)}
                      className="mx-auto block max-w-[140px] px-2 py-1.5 border border-black/10 rounded-lg text-sm focus:border-brand focus:outline-none bg-white"
                    >
                      {MEMBER_GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => setMemberModalUser(user)}
                      className="text-sm font-bold text-brand hover:underline"
                    >
                      {user.name || '-'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-center align-middle">{user.company || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-center align-middle">
                    {user.createdAt?.toDate?.().toLocaleDateString('ko-KR') ?? (typeof user.createdAt === 'string' ? new Date(user.createdAt).toLocaleDateString('ko-KR') : user.createdAt) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center align-middle">{renderApprovalActions(user)}</td>
                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      className={btn('danger', 'sm')}
                    >
                      탈퇴
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className={btn('secondary')}
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm font-bold text-slate-700">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className={btn('secondary')}
          >
            다음
          </button>
        </div>
      )}

      {/* 회원 정보 모달: 열람(전체) + 수정(수정 가능 필드만) */}
      {memberModalUser && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setMemberModalEditing(false); setMemberModalUser(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-xl font-bold text-dark">{memberModalEditing ? '회원 정보 수정' : '회원 정보'}</h3>
              <button type="button" onClick={() => { setMemberModalEditing(false); setMemberModalUser(null); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">×</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {/* 열람 전용: 개인정보·본인인증·주소·사업자등록번호 */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <h4 className="font-bold text-slate-700 mb-3">개인정보 (열람 전용)</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">회원명</span><span className="text-dark">{memberModalUser.name || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">이메일</span><span className="text-dark">{memberModalUser.email || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">연락처</span><span className="text-dark">{memberModalUser.phone || memberModalUser.phoneNumber || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">생년월일</span><span className="text-dark">{memberModalUser.birthdate || '-'}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">성별</span><span className="text-dark">{memberModalUser.gender === 'M' ? '남성' : memberModalUser.gender === 'F' ? '여성' : (memberModalUser.gender || '-')}</span></div>
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">주소</span><span className="text-dark">{[memberModalUser.roadAddress, memberModalUser.detailAddress].filter(Boolean).join(' ') || memberModalUser.address || memberModalUser.region || '-'}</span></div>
                  {memberModalUser.zipCode && <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">우편번호</span><span className="text-dark">{memberModalUser.zipCode}</span></div>}
                  <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">가입일자</span><span className="text-dark">{memberModalUser.createdAt?.toDate?.().toLocaleString('ko-KR') ?? (typeof memberModalUser.createdAt === 'string' ? new Date(memberModalUser.createdAt).toLocaleString('ko-KR') : memberModalUser.createdAt) ?? '-'}</span></div>
                  {(memberModalUser.businessRegistrationNumber || memberModalUser.company) && (
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">사업자등록번호</span><span className="text-dark">{memberModalUser.businessRegistrationNumber || '-'}</span></div>
                  )}
                </div>
              </div>

              {memberModalEditing ? (
                <div className="rounded-lg bg-blue-50/50 border border-black/10 p-4">
                  <h4 className="font-bold text-slate-700 mb-3">수정 가능 항목</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">회원등급</span>
                      <select value={memberEditForm.memberGrade ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, memberGrade: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white">
                        {MEMBER_GRADE_OPTIONS.map(opt => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">회사명</span>
                      <input type="text" value={memberEditForm.company ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, company: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="회사명" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">회사 전화</span>
                      <input type="text" value={memberEditForm.companyPhone ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyPhone: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="회사 전화번호" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">회사 사이트</span>
                      <input type="url" value={memberEditForm.companyWebsite ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, companyWebsite: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="https://..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">업종/업태</span>
                      <select value={memberEditForm.businessCategory ?? memberEditForm.industry ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, businessCategory: e.target.value, industry: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white">
                        <option value="">선택</option>
                        {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">직책</span>
                      <input type="text" value={memberEditForm.position ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, position: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="직책" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">협업 업종</span>
                      <input type="text" value={memberEditForm.collaborationIndustry ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, collaborationIndustry: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="협업 업종" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-32 font-bold text-slate-600 shrink-0">핵심고객</span>
                      <input type="text" value={memberEditForm.keyCustomers ?? ''} onChange={e => setMemberEditForm(f => ({ ...f, keyCustomers: e.target.value }))} className="flex-1 px-3 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none" placeholder="핵심고객" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-blue-50/50 border border-black/10 p-4">
                  <h4 className="font-bold text-slate-700 mb-3">수정 가능 항목 (현재 값)</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">회원등급</span><span className="text-dark">{memberModalUser.memberGrade || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">회사명</span><span className="text-dark">{memberModalUser.company || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">회사 전화</span><span className="text-dark">{memberModalUser.companyPhone || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">회사 사이트</span><span className="text-dark">{memberModalUser.companyWebsite ? <a href={memberModalUser.companyWebsite.startsWith('http') ? memberModalUser.companyWebsite : `https://${memberModalUser.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{memberModalUser.companyWebsite}</a> : '-'}</span></div>

                    {/* 사업자등록증: 확인 후 사본은 지우고 확인 여부만 남긴다 (개인정보 최소 보관) */}
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">사업자등록증</span><span className="text-dark flex flex-wrap items-center gap-2">
                      {memberModalUser.businessRegistrationDoc ? (
                        <>
                          <button type="button" onClick={() => openBusinessDoc(memberModalUser.businessRegistrationDoc)} className="text-brand hover:underline">등록증 보기</button>
                          <button type="button" onClick={handleBusinessDocVerified} className={btn('primary', 'sm')}>확인 완료 · 사본 삭제</button>
                        </>
                      ) : memberModalUser.businessDocVerifiedAt ? (
                        <span className="text-emerald-700 text-sm">확인 완료 ({String(memberModalUser.businessDocVerifiedAt).slice(0, 10)}) · 사본 삭제됨</span>
                      ) : '-'}
                    </span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">업종/업태</span><span className="text-dark">{memberModalUser.businessCategory || memberModalUser.industry || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">직책</span><span className="text-dark">{memberModalUser.position || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">협업 업종</span><span className="text-dark">{memberModalUser.collaborationIndustry || '-'}</span></div>
                    <div className="flex"><span className="w-32 font-bold text-slate-600 shrink-0">핵심고객</span><span className="text-dark">{memberModalUser.keyCustomers || '-'}</span></div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-black/[0.06] flex gap-2 justify-end">
              {!memberModalEditing && (
                <button
                  type="button"
                  onClick={async () => {
                    const deleted = await handleDeleteUser(memberModalUser);
                    if (deleted) setMemberModalUser(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  강제 탈퇴
                </button>
              )}
              {memberModalEditing ? (
                <>
                  <button type="button" onClick={() => setMemberModalEditing(false)} className={btn('secondary')}>취소</button>
                  <button type="button" onClick={handleMemberEditSave} disabled={savingMember} className={btn('primary')}>저장</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={openMemberEdit} className={btn('primary')}>수정</button>
                  <button type="button" onClick={() => setMemberModalUser(null)} className={btn('secondary')}>닫기</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 가입 승인 창: 등급을 골라 승인 */}
      {approveTarget ? (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setApproveTarget(null); }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-bold text-dark mb-1">가입 승인</h3>
            <p className="text-sm text-slate-600 mb-4 break-keep">
              {approveTarget.user.name || '이 회원'}님{approveTarget.user.company ? ` (${approveTarget.user.company})` : ''}을(를) 어떤 등급으로 승인할까요?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['사업자', '예창', '파트너사', '운영진', '마스터'].map((v) => MEMBER_GRADE_OPTIONS.find((o) => o.value === v)).filter(Boolean).map((o) => (
                <button key={o.value} type="button" onClick={() => setApproveTarget((t) => ({ ...t, grade: o.value }))}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${approveTarget.grade === o.value ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 text-slate-700'}`}>
                  {o.label}{o.value === '마스터' || o.value === '운영진' ? ' (관리자)' : ''}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setApproveTarget(null)} className={btn('secondary')}>취소</button>
              <button type="button" onClick={confirmApprove} className={btn('primary')}>{approveTarget.grade}(으)로 승인</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
