import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { deleteField } from 'firebase/firestore';
import { firebaseService } from '../../../services/firebaseService';
import {
  ADMIN_HIDDEN_APPLICATIONS_KEY,
  ADMIN_HIDDEN_APPLICATIONS_CHANGED,
  readAdminHiddenEntries,
  writeAdminHiddenEntries,
  notifyAdminHiddenApplicationsChanged,
  collectProgramSeminarKeys,
  isRegisteredApplication,
  isAdminHiddenApplication,
  summarizeProgramApplications,
} from '../../../utils/adminHiddenApplications';
import { AdminPageHeader, LoadError, adminAlert, adminConfirm, adminPrompt, btn, INPUT } from './ui';
import { SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD } from '../../../constants/appConstants';
import { calculateStatus } from '../../../utils';
import { getSeminarCapacity, isSeminarEligibleForFinalParticipantAdjust } from '../../../utils/seminarDisplay';
import { Icons } from '../../../components/Icons';
import { DateTimePicker } from './DateTimePicker';
import { KakaoMapModal } from './KakaoMapModal';
import { uploadImageForAdmin, normalizeImageItem, normalizeImagesList } from '../../../utils/imageUtils';
import { PROGRAM_RECRUITMENT_FIELDS } from '../../../utils/programRecruitmentSettings';
import ModalPortal from '../../../components/ModalPortal';

const MAX_IMAGES = 10;

const SORT_OPTIONS = [
  { value: 'popular', label: '인기순 (신청 많은 순)' },
  { value: 'dateDesc', label: '날짜 최신순' },
  { value: 'dateAsc', label: '날짜 오래된순' },
  { value: 'title', label: '제목 가나다순 (ㄱ~ㅎ)' },
];

const PROGRAM_CATEGORIES = [
  { value: '네트워킹 모임', label: '네트워킹 모임' },
  { value: '교육/세미나', label: '교육/세미나' },
  { value: '커피챗', label: '커피챗' },
];

/** 신청 비용 드롭다운 옵션: 1만원~10만원 (1만원 단위) */
const FEE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 10000);

/** 정원 드롭다운 옵션: 10~90명(10명 단위), 100~500명(100명 단위). 목록에 없는 값은 "직접 입력"으로 처리 */
const CAPACITY_OPTIONS = [
  ...Array.from({ length: 9 }, (_, i) => (i + 1) * 10),
  ...Array.from({ length: 5 }, (_, i) => (i + 1) * 100),
];

const PAGE_SIZE = 6;

/** 오늘 0시 0분 0초 타임스탬프 (지난 프로그램 판별용) */
const getTodayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 프로그램 날짜 문자열을 비교용 타임스탬프로 변환 */
const parseDateForSort = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  const num = trimmed.replace(/\D/g, '');
  if (num.length >= 8) {
    const y = parseInt(num.slice(0, 4), 10);
    const m = parseInt(num.slice(4, 6), 10) - 1;
    const d = parseInt(num.slice(6, 8), 10);
    const h = num.length >= 10 ? parseInt(num.slice(8, 10), 10) : 0;
    const min = num.length >= 12 ? parseInt(num.slice(10, 12), 10) : 0;
    return new Date(y, m, d, h, min).getTime();
  }
  return 0;
};

/** application.seminarId(또는 programId)를 문자열로 통일 (Firestore 참조/문자열/숫자 혼용 대비) */
const toSeminarId = (v) => {
  if (v == null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  if (typeof v === 'object' && v != null) {
    if ('id' in v && v.id != null) return String(v.id);
    if ('path' in v && typeof v.path === 'string') {
      const parts = v.path.split('/');
      return (parts[parts.length - 1] || '').trim();
    }
  }
  return String(v).trim();
};

const applicantDocTime = (app) => {
  const c = app?.createdAt;
  if (c && typeof c.toMillis === 'function') return c.toMillis();
  if (c?.seconds != null) return c.seconds * 1000;
  return 0;
};

const applicationMatchesProgram = (program, app) => {
  const keys = collectProgramSeminarKeys(program);
  if (keys.size === 0) return false;
  const cand = [
    toSeminarId(app.seminarId),
    toSeminarId(app.programId),
    toSeminarId(app.seminar_id),
    toSeminarId(app.program_id),
  ].filter(Boolean);
  return cand.some((c) => keys.has(c));
};

/**
 * 참여 명단 직접 추가용 회원 검색 — 실명·닉네임 중심(공백 무시 부분 일치), 이메일·전화도 지원
 */
const matchesParticipantAddSearch = (user, rawQuery) => {
  const q = String(rawQuery ?? '').trim();
  if (!q) return false;
  const qLower = q.toLowerCase();
  const qNoSpace = qLower.replace(/\s/g, '');

  const name = String(user?.name || '').toLowerCase();
  const nick = String(user?.nickname || '').toLowerCase();
  const email = String(user?.email || '').toLowerCase();
  const phoneDigits = String(user?.phone || user?.phoneNumber || user?.verifiedPhone || '').replace(/\D/g, '');
  const qDigits = q.replace(/\D/g, '');

  const nameNoSpace = name.replace(/\s/g, '');
  const nickNoSpace = nick.replace(/\s/g, '');
  const hay = `${name} ${nick}`.trim();

  if (email.includes(qLower)) return true;
  if (qDigits.length >= 2 && phoneDigits.includes(qDigits)) return true;

  if (name.includes(qLower) || nick.includes(qLower)) return true;
  if (hay.includes(qLower)) return true;
  if (qNoSpace.length >= 1 && (nameNoSpace.includes(qNoSpace) || nickNoSpace.includes(qNoSpace))) return true;

  const parts = qLower.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.every((p) => p && hay.includes(p));
  }
  return false;
};

/** 모집 종료 후 공개 UI에 쓰는 최종 인원 — Firestore `finalParticipantCount` */
function FinalParticipantCountEditor({ program, onUpdated }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v =
      program.finalParticipantCount != null && program.finalParticipantCount !== ''
        ? String(program.finalParticipantCount)
        : String(program.currentParticipants ?? '');
    setValue(v);
  }, [program.id, program.finalParticipantCount, program.currentParticipants]);

  const cap = getSeminarCapacity(program);

  const handleSave = async () => {
    const t = String(value).trim();
    if (t === '') {
      adminAlert('인원 수를 입력하거나, 자동 집계로 되돌리려면 아래 버튼을 누르세요.');
      return;
    }
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) {
      adminAlert('0 이상의 정수를 입력하세요.');
      return;
    }
    if (cap > 0 && n > cap) {
      if (!await adminConfirm(`입력한 ${n}명이 정원 ${cap}명보다 많아요. 그래도 저장할까요?`)) return;
    }
    setSaving(true);
    try {
      await firebaseService.updateSeminar(program.id, { finalParticipantCount: n });
      adminAlert('최종 모집 인원이 저장되었습니다.');
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      adminAlert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!await adminConfirm('직접 정한 인원을 지우고, 명단의 확정 인원을 그대로 보여 줄까요?')) return;
    setSaving(true);
    try {
      await firebaseService.updateSeminar(program.id, { finalParticipantCount: deleteField() });
      adminAlert('자동 집계로 되돌렸습니다.');
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      adminAlert('처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const hasFinalOverride =
    program.finalParticipantCount !== undefined && program.finalParticipantCount !== null && program.finalParticipantCount !== '';

  return (
    <details className="mt-3 pt-3 border-t border-dashed border-black/10 group" open={hasFinalOverride}>
      <summary className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
        {hasFinalOverride ? `공개 인원을 ${program.finalParticipantCount}명으로 직접 정해 둠` : '공개 인원 직접 정하기 (현장 참석 인원이 다를 때만)'}
      </summary>
      <p className="text-xs text-slate-500 leading-snug mt-2">
        모집이 끝난 뒤 홈·프로그램 목록에 보일 인원을 직접 정해요. 비워 두면 명단의 확정 인원이 그대로 보여요.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="w-24 px-2 py-1.5 border border-black/10 rounded-lg text-sm font-bold text-dark"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          aria-label="최종 모집 인원"
        />
        {cap > 0 ? <span className="text-xs text-slate-500">/ 정원 {cap}명</span> : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? '…' : '저장'}
        </button>
        {hasFinalOverride ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            자동 집계
          </button>
        ) : null}
      </div>
    </details>
  );
}

/**
 * 프로그램 관리 컴포넌트
 */
export const ProgramManagement = ({ currentUser }) => {
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    locationLat: null,
    locationLng: null,
    capacity: '',
    category: '',
    applicationFee: '', // 신청 비용 (원, 비어 있으면 무료)
    overflowParticipants: '', // 초과 인원 (정모 등, 선택)
    imageEntries: [] // Array<{ firebase: string | null, imgbb: string | null }>
  });
  const [imageUploading, setImageUploading] = useState(false);
  const programImageInputRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [applicantModalProgram, setApplicantModalProgram] = useState(null);
  const [applicantModalUsers, setApplicantModalUsers] = useState([]);
  const [applicantModalDataLoading, setApplicantModalDataLoading] = useState(false);
  const [participantAddSearch, setParticipantAddSearch] = useState('');
  const [addingParticipantUserId, setAddingParticipantUserId] = useState(null);
  const [recruitmentPaused, setRecruitmentPaused] = useState(false);
  const [savingRecruitmentPause, setSavingRecruitmentPause] = useState(false);
  // 예전에 이 브라우저에만 숨겨 둔 신청(localStorage). DB로 옮기기 전까지만 쓴다.
  const [hiddenEntriesState, setHiddenEntriesState] = useState(() => readAdminHiddenEntries());
  const [applicationsError, setApplicationsError] = useState(false);
  const [showHiddenRows, setShowHiddenRows] = useState(false);
  const [migratingHidden, setMigratingHidden] = useState(false);
  const [isClosingPast, setIsClosingPast] = useState(false);
  const [closingRecruitmentId, setClosingRecruitmentId] = useState(null);

  /** 숨긴 신청 id (DB 숨김 + 예전 브라우저 숨김) */
  const hiddenApplicationIdSet = useMemo(() => {
    const set = new Set(hiddenEntriesState.map((e) => e.applicationId));
    (applications || []).forEach((a) => { if (isAdminHiddenApplication(a) && a.id != null) set.add(String(a.id)); });
    return set;
  }, [hiddenEntriesState, applications]);

  useEffect(() => {
    const sync = () => setHiddenEntriesState(readAdminHiddenEntries());
    window.addEventListener(ADMIN_HIDDEN_APPLICATIONS_CHANGED, sync);
    const onStorage = (e) => {
      if (e.key === ADMIN_HIDDEN_APPLICATIONS_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ADMIN_HIDDEN_APPLICATIONS_CHANGED, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!firebaseService?.subscribeContent) return undefined;
    const unsub = firebaseService.subscribeContent((contentData) => {
      const next = contentData && typeof contentData === 'object' ? contentData : {};
      setRecruitmentPaused(next[PROGRAM_RECRUITMENT_FIELDS.PAUSED] === true);
    });
    return () => unsub();
  }, []);

  const saveRecruitmentPaused = async (paused) => {
    if (paused === recruitmentPaused) return;
    setSavingRecruitmentPause(true);
    try {
      const contentData = await firebaseService.getContent();
      await firebaseService.updateContent({
        ...contentData,
        [PROGRAM_RECRUITMENT_FIELDS.PAUSED]: paused,
      });
      adminAlert(paused ? '전체 모집이 중단되었습니다.' : '전체 모집이 재개되었습니다.');
    } catch (error) {
      console.error('모집 상태 저장 오류:', error);
      adminAlert('모집 상태 저장에 실패했습니다.');
    } finally {
      setSavingRecruitmentPause(false);
    }
  };

  /** 신청자 명단용 회원·applications 갱신 (결제대기 pendingPayments는 관리 화면에 노출하지 않음) */
  const loadApplicantModalData = useCallback(async () => {
    setApplicantModalDataLoading(true);
    try {
      let appsFailed = false;
      const [users, apps] = await Promise.all([
        firebaseService.getUsersAdmin ? firebaseService.getUsersAdmin() : Promise.resolve([]),
        firebaseService.getApplications ? firebaseService.getApplications().catch(() => { appsFailed = true; return null; }) : Promise.resolve([])
      ]);
      setApplicantModalUsers(Array.isArray(users) ? users : []);
      // 실패했을 때 기존 목록을 빈 목록으로 덮어쓰지 않는다 (0명으로 보이는 문제 방지)
      if (Array.isArray(apps)) setApplications(apps);
      setApplicationsError(appsFailed);
    } catch (e) {
      console.error('신청자 명단 보조 데이터 로드 오류:', e);
      setApplicantModalUsers([]);
      try {
        const appsOnly = await (firebaseService.getApplications?.() ?? Promise.resolve([]));
        setApplications(Array.isArray(appsOnly) ? appsOnly : []);
      } catch (_) {
        /* 유지 */
      }
    } finally {
      setApplicantModalDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, []);

  /** 신청자 명단 모달이 닫히면 검색·추가 UI 상태 초기화 */
  useEffect(() => {
    if (!showApplicantModal) {
      setParticipantAddSearch('');
      setAddingParticipantUserId(null);
    }
  }, [showApplicantModal]);

  /** 신청자 명단 모달 열릴 때 회원·신청 목록 최신화 */
  useEffect(() => {
    if (!showApplicantModal || !applicantModalProgram) {
      setApplicantModalUsers([]);
      return;
    }
    loadApplicantModalData();
  }, [showApplicantModal, applicantModalProgram, loadApplicantModalData]);

  const loadPrograms = async () => {
    try {
      setIsLoading(true);
      let appsFailed = false;
      const [programsData, applicationsData] = await Promise.all([
        firebaseService.getSeminars(),
        firebaseService.getApplications().catch((e) => { console.error('신청 목록 로드 오류:', e); appsFailed = true; return []; }),
      ]);
      setPrograms(programsData);
      setApplications(applicationsData || []);
      setApplicationsError(appsFailed);
    } catch (error) {
      console.error('프로그램 목록 로드 오류:', error);
      adminAlert('프로그램 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /** 관리자: Firestore에 신청 1건 생성 + (레거시) 세미나 인원 카운터 증가 */
  const handleAdminAddParticipant = useCallback(
    async (user) => {
      const program = applicantModalProgram;
      if (!program || !user) return;
      const userId = String(user.id || user.uid || '').trim();
      if (!userId) {
        adminAlert('회원 문서에 ID가 없어 추가할 수 없습니다.');
        return;
      }
      const userName = (user.name || '').trim();
      if (!userName) {
        adminAlert('회원 이름이 없습니다.');
        return;
      }
      const email = (user.email || '').toString().trim();
      const phoneRaw = (user.phone || user.phoneNumber || user.verifiedPhone || '').toString().trim();
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      if (!email && phoneDigits.length < 10) {
        adminAlert('이메일 또는 연락처(10자리 이상)가 있는 회원만 추가할 수 있습니다.');
        return;
      }
      const pid = String(program.id);
      const dup = (applications || []).some(
        (app) => applicationMatchesProgram(program, app) && String(app.userId || '') === userId
      );
      if (dup) {
        adminAlert('이 회원은 이미 이 프로그램(정모) 신청 명단에 있습니다.');
        return;
      }
      setAddingParticipantUserId(userId);
      try {
        await firebaseService.createApplication({
          seminarId: pid,
          programId: pid,
          userId,
          userName,
          userEmail: email,
          userPhone: phoneRaw,
          participationPath: '관리자 등록',
          applyReason: '관리자가 참여 명단에 직접 추가함',
          preQuestions: '',
          mealAfter: '',
          privacyAgreed: true,
          reason: '관리자 직접 등록',
          questions: [],
          adminAddedParticipant: true,
          appliedAt: new Date().toISOString(),
        });
        if (program[SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD] !== true && firebaseService.incrementSeminarParticipants) {
          await firebaseService.incrementSeminarParticipants(pid, 1);
        }
        adminAlert('명단에 추가했습니다.');
        await loadApplicantModalData();
        await loadPrograms();
      } catch (e) {
        console.error('관리자 명단 추가 오류:', e);
        adminAlert(e?.message || '추가에 실패했습니다.');
      } finally {
        setAddingParticipantUserId(null);
      }
    },
    [applicantModalProgram, applications, loadApplicantModalData, loadPrograms]
  );

  /**
   * 관리자: 신청을 명단·인원 집계에서 숨김 — DB에 저장해서 모든 운영자·기기·방문자 화면에 똑같이 반영된다.
   * 신청·결제 기록은 지우지 않고 환불도 하지 않는다.
   */
  const handleAdminRemoveApplicant = useCallback(async (applicationId, displayName) => {
    if (!applicationId) return;
    const nameHint = (displayName || '').trim() || '이 신청';
    const ok = await adminConfirm(
      `「${nameHint}」을(를) 명단에서 숨길까요?\n\n• 신청·결제 기록은 지우지 않아요. 환불도 되지 않아요.\n• 홈·프로그램 목록의 신청 인원에서 빠지고, 다른 운영진 화면에도 똑같이 보여요.\n• CSV·붙여넣기에도 나오지 않아요.\n• '숨긴 신청 보기'에서 언제든 되돌릴 수 있어요.`,
      { title: '명단에서 숨기기', okText: '숨기기' }
    );
    if (!ok) return;
    const idStr = String(applicationId);
    try {
      await firebaseService.setApplicationAdminHidden(idStr, true, { uid: currentUser?.uid || currentUser?.id });
      setApplications((prev) => prev.map((a) => (String(a.id) === idStr ? { ...a, adminHidden: true } : a)));
    } catch (e) {
      adminAlert(`숨기지 못했어요. ${e?.message || ''}`);
    }
  }, [currentUser]);

  const handleAdminRestoreApplicant = useCallback(async (applicationId) => {
    const idStr = String(applicationId);
    try {
      if (hiddenEntriesState.some((e) => e.applicationId === idStr)) {
        const next = hiddenEntriesState.filter((e) => e.applicationId !== idStr);
        setHiddenEntriesState(next);
        writeAdminHiddenEntries(next);
        notifyAdminHiddenApplicationsChanged();
      }
      const app = applications.find((a) => String(a.id) === idStr);
      if (isAdminHiddenApplication(app)) {
        await firebaseService.setApplicationAdminHidden(idStr, false);
        setApplications((prev) => prev.map((a) => (String(a.id) === idStr ? { ...a, adminHidden: false } : a)));
      }
    } catch (e) {
      adminAlert(`되돌리지 못했어요. ${e?.message || ''}`);
    }
  }, [applications, hiddenEntriesState]);

  /** 예전에 이 브라우저에만 숨겨 둔 신청을 DB 숨김으로 옮긴다 (옮기면 모든 화면에 같은 숫자) */
  const migrateLocalHidden = useCallback(async () => {
    const entries = hiddenEntriesState;
    if (entries.length === 0) return;
    if (!(await adminConfirm(`이 브라우저에만 숨겨 둔 신청 ${entries.length}건을 모든 운영진·방문자 화면에도 똑같이 숨길까요?\n옮기고 나면 홈·목록의 신청 인원이 그만큼 줄어 보여요.`, { okText: '옮기기' }))) return;
    setMigratingHidden(true);
    const known = new Set(applications.map((a) => String(a.id)));
    const left = [];
    let moved = 0;
    for (const e of entries) {
      if (!known.has(e.applicationId)) { moved += 0; continue; } // 이미 지워진 신청은 버린다
      try {
        await firebaseService.setApplicationAdminHidden(e.applicationId, true, { uid: currentUser?.uid || currentUser?.id });
        moved += 1;
      } catch (err) {
        console.error('숨김 옮기기 실패', e.applicationId, err);
        left.push(e);
      }
    }
    setHiddenEntriesState(left);
    writeAdminHiddenEntries(left);
    notifyAdminHiddenApplicationsChanged();
    setMigratingHidden(false);
    await loadPrograms();
    adminAlert(left.length === 0 ? `${moved}건을 옮겼어요. 이제 모든 화면에서 같은 인원으로 보여요.` : `${moved}건은 옮겼고 ${left.length}건은 옮기지 못했어요. 잠시 뒤 다시 눌러 주세요.`);
  }, [applications, hiddenEntriesState, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 프로그램별 인원 — 카드·명단 창·홈이 모두 같은 기준(확정 = 무료 신청 또는 결제 확인·운영자 등록, 숨김 제외)
   * @type {Record<string, { confirmed: number, awaitingPayment: number, hidden: number }>}
   */
  const applicationSummaryByProgramId = useMemo(() => {
    const map = {};
    (programs || []).forEach((p) => {
      if (p.id == null) return;
      map[String(p.id)] = summarizeProgramApplications(p, applications, hiddenEntriesState);
    });
    return map;
  }, [applications, programs, hiddenEntriesState]);

  /** 확정 인원만 (정렬·삭제 경고용) */
  const applicationCountByProgramId = useMemo(() => {
    const map = {};
    Object.entries(applicationSummaryByProgramId).forEach(([k, v]) => { map[k] = v.confirmed; });
    return map;
  }, [applicationSummaryByProgramId]);

  /** 검색어로 필터 + 정렬된 목록 */
  const filteredAndSortedPrograms = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    let list = programs;
    if (q) {
      list = programs.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const location = (p.location || '').toLowerCase();
        const date = (p.date || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || category.includes(q) || location.includes(q) || date.includes(q);
      });
    }
    const countMap = applicationCountByProgramId;
    const sorted = [...list].sort((a, b) => {
      const aId = a.id != null ? String(a.id) : '';
      const bId = b.id != null ? String(b.id) : '';
      switch (sortBy) {
        case 'popular':
          return (countMap[bId] || 0) - (countMap[aId] || 0);
        case 'dateDesc':
          return parseDateForSort(b.date) - parseDateForSort(a.date);
        case 'dateAsc':
          return parseDateForSort(a.date) - parseDateForSort(b.date);
        case 'title':
          return (a.title || '').localeCompare(b.title || '', 'ko');
        default:
          return parseDateForSort(b.date) - parseDateForSort(a.date);
      }
    });
    return sorted;
  }, [programs, searchQuery, sortBy, applicationCountByProgramId]);

  /** 지난 프로그램 (행사 일자가 오늘 이전인 프로그램) */
  const pastPrograms = useMemo(() => {
    const todayStart = getTodayStart();
    return programs.filter((p) => parseDateForSort(p.date) < todayStart);
  }, [programs]);

  /** 현재 페이지에 표시할 프로그램 (6개) */
  const displayPrograms = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedPrograms.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedPrograms, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPrograms.length / PAGE_SIZE));

  /** 카카오맵 모달 초기 좌표 — 매 렌더마다 새 객체를 만들면 지도가 중복 초기화될 수 있음 */
  const mapInitialLocation = useMemo(() => {
    if (formData.locationLat != null && formData.locationLng != null) {
      return {
        lat: formData.locationLat,
        lng: formData.locationLng,
        address: formData.location || '',
      };
    }
    return null;
  }, [formData.locationLat, formData.locationLng, formData.location]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  /** 지난 프로그램 전부 정원 만석·종료 처리 */
  const handleClosePastPrograms = async () => {
    if (pastPrograms.length === 0) {
      adminAlert('행사일이 지난 프로그램이 없어요.');
      return;
    }
    const targets = pastPrograms.filter((p) => p.status !== '종료');
    if (targets.length === 0) {
      adminAlert('지난 프로그램이 모두 이미 종료 상태예요.');
      return;
    }
    if (!(await adminConfirm(`행사일이 지난 프로그램 ${targets.length}개를 "종료"로 바꿀까요?\n신청 인원 숫자는 바꾸지 않아요. (실제 확정 인원 그대로 보여요)`, { okText: '종료 처리' }))) {
      return;
    }
    setIsClosingPast(true);
    let success = 0;
    let fail = 0;
    for (const p of targets) {
      try {
        // 예전에는 신청 인원을 정원 숫자로 덮어써서 실제와 다른 '만석'이 남았다 → 상태만 바꾼다
        await firebaseService.updateSeminar(p.id, { status: '종료' });
        success += 1;
      } catch (err) {
        fail += 1;
        console.error('매진·종료 처리 실패:', p.id, err);
      }
    }
    await loadPrograms();
    setIsClosingPast(false);
    adminAlert(fail === 0 ? `${success}개 프로그램을 종료 처리했어요.` : `${success}개는 종료했고, ${fail}개는 처리하지 못했어요.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const feeNum = formData.applicationFee === '' ? null : (parseInt(String(formData.applicationFee).replace(/[,\s]/g, ''), 10) || null);
    const capacityNum = formData.capacity ? parseInt(formData.capacity, 10) : null;
    const imageUrls = normalizeImagesList(formData.imageEntries || []);
    const firstImageUrl = imageUrls[0] || '';
    const payload = {
      title: formData.title || '',
      description: formData.description || '',
      desc: formData.description || '',
      date: formData.date || '',
      location: formData.location || '',
      locationLat: formData.locationLat ?? null,
      locationLng: formData.locationLng ?? null,
      capacity: capacityNum != null && !isNaN(capacityNum) ? capacityNum : null,
      maxParticipants: capacityNum != null && !isNaN(capacityNum) ? capacityNum : null,
      category: formData.category || '',
      applicationFee: feeNum != null && !isNaN(feeNum) && feeNum >= 0 ? feeNum : null,
      imageUrl: firstImageUrl,
      img: firstImageUrl,
      images: imageUrls,
      imageUrls
    };
    if (!editingProgram) {
      payload.currentParticipants = 0;
      payload[SEMINAR_PARTICIPANT_FROM_APPLICATIONS_FIELD] = true;
    } else if (editingProgram.currentParticipants != null) {
      payload.currentParticipants = editingProgram.currentParticipants;
    }
    const overflowNum = formData.overflowParticipants !== '' && formData.overflowParticipants != null ? parseInt(String(formData.overflowParticipants).replace(/\D/g, ''), 10) : null;
    if (overflowNum != null && !isNaN(overflowNum) && overflowNum >= 0) {
      payload.overflowParticipants = overflowNum;
    } else {
      payload.overflowParticipants = null;
    }
    try {
      if (editingProgram) {
        await firebaseService.updateSeminar(editingProgram.id, payload);
        adminAlert('프로그램이 수정되었습니다.');
      } else {
        await firebaseService.createSeminar(payload);
        adminAlert('프로그램이 추가되었습니다.');
      }
      setShowModal(false);
      resetForm();
      loadPrograms();
    } catch (error) {
      console.error('프로그램 저장 오류:', error);
      adminAlert('프로그램 저장에 실패했습니다.');
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    const rawImages = program.images || (program.imageUrls ? program.imageUrls : (program.imageUrl ? [program.imageUrl] : []));
    const imageEntries = Array.isArray(rawImages)
      ? rawImages.map((item) =>
          typeof item === 'string'
            ? { firebase: item, imgbb: null }
            : { firebase: item?.firebase ?? null, imgbb: item?.imgbb ?? null }
        )
      : [];
    // 정원은 저장된 값을 그대로 불러온다 (10/100 단위로 반올림하지 않음 — 값이 조용히 바뀌는 것을 방지).
    // 드롭다운에 없는 값이면 "직접 입력"으로 표시되어 그대로 편집·저장할 수 있다.
    const rawCapacity = program.capacity != null && program.capacity !== ''
      ? Number(program.capacity)
      : (program.maxParticipants != null && program.maxParticipants !== '' ? Number(program.maxParticipants) : NaN);
    const capacityValue = !isNaN(rawCapacity) && rawCapacity > 0 ? String(Math.floor(rawCapacity)) : '';
    setFormData({
      title: program.title || '',
      description: program.description || '',
      date: program.date || '',
      location: program.location || '',
      locationLat: program.locationLat || null,
      locationLng: program.locationLng || null,
      capacity: capacityValue,
      category: program.category || '',
      applicationFee: program.applicationFee != null && program.applicationFee !== '' ? String(program.applicationFee) : '',
      overflowParticipants: program.overflowParticipants != null && program.overflowParticipants !== '' ? String(program.overflowParticipants) : '',
      imageEntries
    });
    setShowModal(true);
  };

  const handleDelete = async (programId) => {
    const program = programs.find((p) => String(p.id) === String(programId));
    const summary = applicationSummaryByProgramId[String(programId)] || { confirmed: 0, awaitingPayment: 0 };
    const appCount = summary.confirmed + summary.awaitingPayment;
    const title = program?.title ? `「${program.title}」` : '이 프로그램';
    if (appCount > 0) {
      const typed = await adminPrompt(`${title}에 신청자가 ${appCount}명 있어요.\n삭제해도 신청·결제 기록은 남고 환불은 되지 않아요. 먼저 신청자 명단에서 정리해 주세요.\n\n그래도 삭제하려면 "삭제"라고 입력해 주세요. 되돌릴 수 없어요.`, {
        title: '프로그램 삭제', mustEqual: '삭제', okText: '삭제', danger: true, placeholder: '삭제',
      });
      if (typed === null) return;
    } else if (!(await adminConfirm(`${title}을(를) 삭제할까요? 되돌릴 수 없어요.`, { title: '프로그램 삭제', okText: '삭제', danger: true }))) return;

    try {
      await firebaseService.deleteSeminar(programId);
      adminAlert('프로그램이 삭제되었습니다.');
      loadPrograms();
    } catch (error) {
      console.error('프로그램 삭제 오류:', error);
      adminAlert('프로그램 삭제에 실패했습니다.');
    }
  };

  /** 관리자가 이 프로그램 하나만 모집 중단/재개 토글 (중단 시 사용자 화면에서는 '모집중단', 신청 불가) */
  const handleCloseRecruitment = async (program) => {
    const todayStart = getTodayStart();
    if (parseDateForSort(program.date) < todayStart) {
      adminAlert('이미 지난 프로그램입니다. "지난 프로그램 일괄 종료"를 사용하세요.');
      return;
    }
    const isCurrentlyClosed = !!program.recruitmentClosedByAdmin;
    if (isCurrentlyClosed && program.cancelledByOrganizer === true) {
      adminAlert('회사 사정 취소로 표시된 행사예요. 모집을 다시 열려면 "취소 표시 되돌리기"를 먼저 눌러 주세요.');
      return;
    }
    const action = isCurrentlyClosed ? '재개' : '중단';
    const confirmMsg = isCurrentlyClosed
      ? `"${program.title || '이 프로그램'}" 모집을 재개하시겠습니까?\n재개 후 사용자가 다시 신청할 수 있습니다.`
      : `"${program.title || '이 프로그램'}" 모집을 중단하시겠습니까?\n중단 후에는 이 프로그램만 사용자가 신청할 수 없게 됩니다 (다른 프로그램은 영향 없음).`;
    if (!await adminConfirm(confirmMsg)) return;
    setClosingRecruitmentId(program.id);
    try {
      await firebaseService.updateSeminar(program.id, { recruitmentClosedByAdmin: !isCurrentlyClosed });
      adminAlert(isCurrentlyClosed ? '모집이 재개되었습니다.' : '모집이 중단되었습니다.');
      await loadPrograms();
    } catch (err) {
      console.error(`모집 ${action} 처리 실패:`, err);
      adminAlert(`모집 ${action}에 실패했습니다.`);
    } finally {
      setClosingRecruitmentId(null);
    }
  };

  /**
   * 회사(운영진) 사정으로 행사를 취소했다고 표시한다. 표시되면 서버 환불 계산(functions/refund.js
   * isSeminarCancelledByCompany)이 날짜와 관계없이 전액 환불로 처리하고, 새 신청도 막힌다.
   * (취소/환불 규정: 회사 사정으로 취소되면 전액 환불)
   */
  const handleOrganizerCancel = async (program) => {
    const isCancelled = program.cancelledByOrganizer === true;
    const title = program.title || '이 프로그램';
    const ok = await adminConfirm(
      isCancelled
        ? `"${title}"의 회사 사정 취소 표시를 되돌릴까요?\n되돌리면 환불은 다시 날짜 기준으로 계산되고, 모집 중단 상태는 그대로 남아요.`
        : `"${title}"을(를) 회사 사정으로 취소했다고 표시할까요?\n\n· 새 신청이 막혀요.\n· 신청자가 마이페이지에서 신청을 취소하면 날짜와 관계없이 전액 환불돼요.\n· 신청자에게 취소 사실과 환불 방법은 따로 꼭 알려 주세요.`,
      { okText: isCancelled ? '표시 되돌리기' : '회사 사정으로 취소', danger: !isCancelled }
    );
    if (!ok) return;
    setClosingRecruitmentId(program.id);
    try {
      await firebaseService.updateSeminar(
        program.id,
        isCancelled
          ? { cancelledByOrganizer: false }
          : { cancelledByOrganizer: true, cancelledByOrganizerAt: new Date().toISOString(), recruitmentClosedByAdmin: true }
      );
      adminAlert(isCancelled ? '회사 사정 취소 표시를 되돌렸어요.' : '회사 사정 취소로 표시했어요. 신청자에게 안내를 보내 주세요.');
      await loadPrograms();
    } catch (err) {
      console.error('회사 사정 취소 표시 실패:', err);
      adminAlert('처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setClosingRecruitmentId(null);
    }
  };

  const resetForm = () => {
    setEditingProgram(null);
    setFormData({
      title: '',
      description: '',
      date: '',
      location: '',
      locationLat: null,
      locationLng: null,
      capacity: '',
      category: '',
      applicationFee: '',
      overflowParticipants: '',
      imageEntries: []
    });
  };

  const handleProgramImageChange = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    const current = formData.imageEntries || [];
    if (current.length + files.length > MAX_IMAGES) {
      adminAlert(`이미지는 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    setImageUploading(true);
    try {
      const toUpload = Array.from(files).filter((f) => f.type?.startsWith('image/'));
      const uploadPromises = toUpload.map(async (file) => {
        const url = await uploadImageForAdmin(file);
        return { firebase: null, imgbb: url };
      });
      const results = await Promise.all(uploadPromises);
      const added = results.filter((r) => r?.imgbb);
      if (added.length === 0 && results.length > 0) {
        adminAlert('이미지 업로드에 실패했습니다.');
        return;
      }
      setFormData({ ...formData, imageEntries: [...current, ...added] });
    } catch (err) {
      console.error(err);
      adminAlert(err?.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const removeProgramImage = (index) => {
    const next = (formData.imageEntries || []).filter((_, i) => i !== index);
    setFormData({ ...formData, imageEntries: next });
  };

  const handleLocationSelect = (location) => {
    const locationText = location.displayAddress || location.address;
    setFormData({
      ...formData,
      location: locationText,
      locationLat: location.lat,
      locationLng: location.lng
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-slate-600">프로그램 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <AdminPageHeader
        title="프로그램 · 신청자"
        description="세미나·네트워킹 프로그램을 만들고 신청자 명단을 관리해요. 인원은 모두 '확정' 기준이에요."
      />
      <div className="flex flex-wrap items-center gap-2 mb-5 -mt-2">
          <button type="button" onClick={loadPrograms} className={btn('secondary')}>
            <Icons.RefreshCw size={16} />
            새로고침
          </button>
          <button
            type="button"
            onClick={async () => {
              const next = !recruitmentPaused;
              if (next && !(await adminConfirm('모든 프로그램의 새 신청을 한 번에 막아요.\n(프로그램 하나만 마감하려면 카드의 "모집 중단" 버튼을 쓰세요.)\n\n계속할까요?', { okText: '전체 모집 중단', danger: true }))) return;
              saveRecruitmentPaused(next);
            }}
            disabled={savingRecruitmentPause}
            title="사이트 전체 프로그램의 신규 신청을 한번에 막거나 다시 엽니다 (긴급 상황용). 특정 프로그램 하나만 마감하려면 카드의 개별 버튼을 쓰세요."
            className={btn(recruitmentPaused ? 'primary' : 'danger')}
          >
            {savingRecruitmentPause ? (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : recruitmentPaused ? (
              <Icons.RefreshCw size={16} />
            ) : (
              <Icons.X size={16} />
            )}
            {recruitmentPaused ? '전체 모집 재개' : '전체 모집 중단'}
          </button>
          <button
            type="button"
            onClick={handleClosePastPrograms}
            disabled={isClosingPast}
            title="행사일이 지난 프로그램을 한 번에 종료 상태로 바꿔요 (인원 숫자는 그대로)"
            className={btn('secondary')}
          >
            {isClosingPast ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            ) : null}
            지난 프로그램 일괄 종료
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className={btn('primary')}
          >
            <Icons.Plus size={16} />
            프로그램 추가
          </button>
      </div>

      {applicationsError ? <div className="mb-4"><LoadError what="신청 목록" onRetry={loadPrograms} /></div> : null}
      {hiddenEntriesState.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span className="break-keep">이 브라우저에만 숨겨 둔 신청이 {hiddenEntriesState.length}건 있어요. 다른 운영진·방문자 화면에는 숨김이 적용되지 않아 인원이 다르게 보여요.</span>
          <button type="button" disabled={migratingHidden} onClick={migrateLocalHidden} className={btn('primary', 'sm')}>{migratingHidden ? '옮기는 중…' : '모든 화면에 적용하기'}</button>
        </div>
      ) : null}

      {/* 검색 및 정렬 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 설명, 카테고리, 장소, 일시로 검색..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
          aria-label="프로그램 검색"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2.5 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white font-medium text-slate-700 min-w-[180px]"
          aria-label="정렬 기준"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 프로그램 목록 (카드 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedPrograms.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Icons.Calendar size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {programs.length === 0 ? '등록된 프로그램이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          </div>
        ) : (
          displayPrograms.map((program) => {
            const summary = applicationSummaryByProgramId[String(program.id)] || { confirmed: 0, awaitingPayment: 0, hidden: 0 };
            const cardCap = getSeminarCapacity(program);
            const thumb = normalizeImageItem(program.images?.[0]) || program.imageUrls?.[0] || program.imageUrl;
            const displayStatus = program.cancelledByOrganizer === true ? '행사 취소' : program.recruitmentClosedByAdmin ? '모집중단' : (program.status || calculateStatus(program.date || ''));
            const canToggleRecruitment = parseDateForSort(program.date) >= getTodayStart();
            const isClosingThis = closingRecruitmentId === program.id;
            const isRecruitmentClosed = !!program.recruitmentClosedByAdmin;
            const statusClass = displayStatus === '모집중단' ? 'bg-amber-100 text-amber-800' : displayStatus === '종료' ? 'bg-slate-100 text-slate-600' : displayStatus === '마감임박' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
            return (
              <div key={program.id} className="relative bg-white border border-black/[0.06] rounded-2xl p-4">
                <button
                  type="button"
                  onClick={() => handleDelete(program.id)}
                  className="absolute top-3 right-3 z-10 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="프로그램 삭제"
                  aria-label="삭제"
                >
                  <Icons.Trash2 size={18} />
                </button>
                {thumb && (
                  <img src={thumb} alt={program.title} className="w-full h-40 object-cover rounded-lg mb-3" loading="lazy" decoding="async" />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClass}`}>{displayStatus}</span>
                  <h3 className="font-bold text-lg text-dark flex-1 truncate pr-8">{program.title}</h3>
                </div>
                {program.description && (
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">{program.description}</p>
                )}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Icons.Calendar size={16} />
                    <span>{program.date || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Icons.MapPin size={16} />
                    <span className="line-clamp-1">{program.location || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Icons.Users size={16} className="text-slate-500" />
                    {applicationsError ? (
                      <span className="text-red-600 font-semibold">인원 불러오기 실패</span>
                    ) : (
                      <span className="font-bold text-dark">
                        확정 {summary.confirmed}명{cardCap > 0 ? <span className="font-semibold text-slate-500"> / 정원 {cardCap}명</span> : null}
                      </span>
                    )}
                  </div>
                  {!applicationsError && summary.awaitingPayment > 0 ? (
                    <p className="text-xs text-amber-700 pl-6">결제 확인 안 된 신청 {summary.awaitingPayment}건 (인원에 안 넣음)</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => handleEdit(program)}
                    className={btn('secondary', 'sm')}
                  >
                    <Icons.Edit2 size={16} />
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApplicantModalProgram(program);
                      setShowApplicantModal(true);
                    }}
                    className={btn('primary', 'sm')}
                  >
                    <Icons.Users size={16} />
                    신청자 명단
                  </button>
                  {canToggleRecruitment && (
                    <button
                      type="button"
                      onClick={() => handleCloseRecruitment(program)}
                      disabled={isClosingThis}
                      title={isRecruitmentClosed ? '모집 재개 후 사용자가 다시 신청할 수 있습니다' : '모집 중단 후 이 프로그램만 신청할 수 없습니다'}
                      className={btn('secondary', 'sm')}
                    >
                      {isClosingThis ? (
                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isRecruitmentClosed ? (
                        <Icons.RefreshCw size={16} />
                      ) : (
                        <Icons.X size={16} />
                      )}
                      {isRecruitmentClosed ? '모집 재개' : '모집 중단'}
                    </button>
                  )}
                  {canToggleRecruitment && (
                    <button
                      type="button"
                      onClick={() => handleOrganizerCancel(program)}
                      disabled={isClosingThis}
                      title="회사 사정으로 행사를 취소하면 신청자는 날짜와 관계없이 전액 환불받아요"
                      className={btn(program.cancelledByOrganizer === true ? 'secondary' : 'danger', 'sm')}
                    >
                      {program.cancelledByOrganizer === true ? '취소 표시 되돌리기' : '회사 사정 취소'}
                    </button>
                  )}
                </div>
                {isSeminarEligibleForFinalParticipantAdjust(program) ? (
                  <FinalParticipantCountEditor program={program} onUpdated={loadPrograms} />
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* 페이징 */}
      {filteredAndSortedPrograms.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
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
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={btn('secondary')}
          >
            다음
          </button>
        </div>
      )}

      {/* 프로그램 추가/수정 모달 (ESC 미적용) */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col max-h-[100dvh] md:max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center">
            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6">
              <h3 className="text-2xl font-bold text-dark mb-6">
                {editingProgram ? '프로그램 수정' : '프로그램 추가'}
              </h3>

            <form id="program-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">제목 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">설명 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">일시 *</label>
                <DateTimePicker
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  placeholder="날짜와 시간을 선택하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">장소 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value, locationLat: null, locationLng: null })}
                    required
                    className="flex-1 px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="px-4 py-3 bg-brand text-white rounded-lg font-bold hover:bg-brand/90 transition-colors flex items-center gap-2"
                  >
                    <Icons.MapPin size={18} />
                    지도
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">정원</label>
                <select
                  value={formData.capacity === '' ? '' : CAPACITY_OPTIONS.includes(Number(formData.capacity)) ? formData.capacity : 'direct'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, capacity: v === 'direct' ? formData.capacity : v });
                  }}
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">선택 안 함 (정원 없음)</option>
                  {CAPACITY_OPTIONS.map((n) => (
                    <option key={n} value={String(n)}>{n}명</option>
                  ))}
                  <option value="direct">직접 입력</option>
                </select>
                {(formData.capacity === '' ? '' : CAPACITY_OPTIONS.includes(Number(formData.capacity)) ? formData.capacity : 'direct') === 'direct' && (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="정원 입력 (명)"
                    className="w-full mt-2 px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                  />
                )}
                <p className="text-xs text-slate-500 mt-1">자주 쓰는 인원수는 목록에서 고르고, 그 외 숫자는 "직접 입력"으로 정확히 입력하세요. 목록 선택 시에도 값이 임의로 반올림되지 않습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">초과 인원 (정모 등)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.overflowParticipants}
                  onChange={(e) => setFormData({ ...formData, overflowParticipants: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">내부 기록용입니다. 홈·프로그램 목록의 신청 인원 숫자에는 반영되지 않습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">신청 비용 (원)</label>
                <select
                  value={formData.applicationFee === '' ? '' : FEE_OPTIONS.includes(Number(formData.applicationFee)) ? formData.applicationFee : 'direct'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData({ ...formData, applicationFee: v === 'direct' ? formData.applicationFee : v });
                  }}
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">무료</option>
                  {FEE_OPTIONS.map((n) => (
                    <option key={n} value={String(n)}>{n >= 10000 ? `${n / 10000}만` : n}원</option>
                  ))}
                  <option value="direct">직접 입력</option>
                </select>
                {(formData.applicationFee === '' ? '' : FEE_OPTIONS.includes(Number(formData.applicationFee)) ? formData.applicationFee : 'direct') === 'direct' && (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.applicationFee}
                    onChange={(e) => setFormData({ ...formData, applicationFee: e.target.value })}
                    placeholder="금액 입력 (원)"
                    className="w-full mt-2 px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
                  />
                )}
                <p className="text-xs text-slate-500 mt-1">무료 또는 1만~10만원 선택, 직접 입력도 가능합니다.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">카테고리</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:border-brand focus:outline-none bg-white"
                >
                  <option value="">선택하세요</option>
                  {PROGRAM_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">이미지 (최대 {MAX_IMAGES}장)</label>
                <input
                  ref={programImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleProgramImageChange}
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.imageEntries || []).map((entry, idx) => (
                    <div key={idx} className="relative group">
                      <img src={normalizeImageItem(entry)} alt={`이미지 ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-black/10" loading="lazy" decoding="async" />
                      <button
                        type="button"
                        onClick={() => removeProgramImage(idx)}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-90 hover:opacity-100"
                        aria-label="삭제"
                      >
                        <Icons.X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={(formData.imageEntries?.length || 0) >= MAX_IMAGES || imageUploading}
                  onClick={() => programImageInputRef.current?.click()}
                  className={btn('secondary')}
                >
                  {imageUploading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Icons.Plus size={18} />
                      이미지 추가
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
            <div className="shrink-0 border-t border-black/10 p-4 flex gap-3 justify-end">
              <button
                type="submit"
                form="program-form"
                className="flex-1 max-w-[12rem] px-6 py-3 bg-brand text-white rounded-lg font-bold hover:bg-brand/90 transition-colors"
              >
                {editingProgram ? '수정' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 max-w-[12rem] px-6 py-3 bg-brand text-white font-bold rounded-lg hover:bg-brand/90 hover:scale-[1.02] transition-all duration-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* 신청자명단 모달 */}
      {showApplicantModal && applicantModalProgram && (() => {
        const programIdNorm = toSeminarId(applicantModalProgram.id);
        const allForProgram = (applications || []).filter((app) => applicationMatchesProgram(applicantModalProgram, app));
        const isHiddenRow = (app) => app.id != null && hiddenApplicationIdSet.has(String(app.id));
        const list = allForProgram
          .filter((app) => !isHiddenRow(app))
          .sort((a, b) => applicantDocTime(b) - applicantDocTime(a));
        const hiddenList = allForProgram.filter(isHiddenRow).sort((a, b) => applicantDocTime(b) - applicantDocTime(a));
        const modalFee = Number(applicantModalProgram.applicationFee) || 0;
        const modalSummary = summarizeProgramApplications(applicantModalProgram, applications, hiddenEntriesState);
        const rowsToShow = showHiddenRows ? hiddenList : list;
        const userMap = {};
        const userMapByEmail = {};
        const userMapByPhone = {};
        (applicantModalUsers || []).forEach((u) => {
          if (u.id) { userMap[String(u.id)] = u; userMap[u.id] = u; }
          if (u.uid) { userMap[String(u.uid)] = u; userMap[u.uid] = u; }
          const email = (u.email || '').toString().trim().toLowerCase();
          if (email) userMapByEmail[email] = u;
          const phone = (u.phone || u.phoneNumber || '').toString().replace(/\D/g, '');
          if (phone.length >= 10) userMapByPhone[phone] = u;
        });
        const resolveUser = (app) => {
          const uid = app.userId != null ? String(app.userId) : '';
          let user = userMap[app.userId] || userMap[uid] || userMap[app.userId?.toString()];
          if (!user && app.userEmail) {
            const key = (app.userEmail || '').toString().trim().toLowerCase();
            if (key) user = userMapByEmail[key];
          }
          if (!user && (app.userPhone || app.userPhoneNumber)) {
            const digits = (app.userPhone || app.userPhoneNumber || '').toString().replace(/\D/g, '');
            if (digits.length >= 10) user = userMapByPhone[digits];
          }
          return user;
        };
        const formatDate = (v) => {
          if (!v) return '-';
          if (v.toDate && typeof v.toDate === 'function') return v.toDate().toLocaleString('ko-KR');
          if (v.seconds != null) return new Date(v.seconds * 1000).toLocaleString('ko-KR');
          return String(v);
        };
        const getCell = (val) => (val == null || val === undefined ? '' : String(val).replace(/\n/g, ' ').replace(/"/g, '""'));
        const headers = [
          '번호', '이름', '닉네임(부청사활동)', '성별', '생년월일', '연락처', '이메일',
          '업종/업태', '협업 업종', '핵심 고객',
          '참여 경로', '강연 신청 계기', '강연 사전 질문', '강연 후 식사 여부', '개인정보 동의', '신청일'
        ];
        const toCsvRow = (arr) => arr.map((cell) => `"${getCell(cell)}"`).join(',');
        const rowForApp = (app, i) => {
          const user = resolveUser(app);
          return [
            i + 1,
            (user?.name || app.userName || '').trim() || '-',
            user?.nickname || '',
            user?.gender || '',
            user?.birthdate || '',
            app.userPhone || user?.phone || user?.phoneNumber || '',
            app.userEmail || user?.email || '',
            user?.industry || user?.businessCategory || '',
            user?.collaborationIndustry || '',
            user?.keyCustomers || '',
            app.participationPath || '',
            app.applyReason || '',
            app.preQuestions || '',
            app.mealAfter || '',
            app.privacyAgreed === true ? '동의' : '',
            formatDate(app.createdAt || app.appliedAt)
          ];
        };
        const csvContent = [
          '\uFEFF' + toCsvRow(headers),
          ...list.map((app, i) => toCsvRow(rowForApp(app, i)))
        ].join('\n');
        const tsvContent = [
          headers.join('\t'),
          ...list.map((app, i) => rowForApp(app, i).map((c) => String(c ?? '').replace(/\t/g, ' ')).join('\t'))
        ].join('\n');
        const handleCsvDownload = () => {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `신청자명단_${(applicantModalProgram.title || programIdNorm || '프로그램').replace(/[/\\?%*:|"]/g, '_')}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          adminAlert('CSV 파일이 다운로드되었습니다. Google 스프레드시트에서 파일 → 가져오기로 업로드할 수 있습니다.');
        };
        const handleCopyForSheets = async () => {
          try {
            await navigator.clipboard.writeText(tsvContent);
            adminAlert('신청자명단이 클립보드에 복사되었습니다. Google 스프레드시트에서 붙여넣기(Ctrl+V) 하세요.');
          } catch (e) {
            adminAlert('복사에 실패했습니다. 브라우저에서 클립보드 권한을 허용해 주세요.');
          }
        };
        return (
          <ModalPortal>
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
              <div className="bg-white rounded-2xl max-w-[78.4rem] w-full max-h-[90vh] flex flex-col shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-black/10">
                  <div>
                    <h3 className="text-xl font-bold text-dark">
                      신청자명단: {applicantModalProgram.title || '(제목 없음)'}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      <b className="text-dark">확정 {modalSummary.confirmed}명</b>
                      {getSeminarCapacity(applicantModalProgram) > 0 ? ` / 정원 ${getSeminarCapacity(applicantModalProgram)}명` : ''}
                      {modalSummary.awaitingPayment > 0 ? <span className="text-amber-700"> · 결제 확인 안 됨 {modalSummary.awaitingPayment}건</span> : null}
                      {modalSummary.hidden > 0 ? <span className="text-slate-500"> · 숨김 {modalSummary.hidden}건</span> : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">카드·홈·이 창의 인원은 모두 '확정' 기준이에요. 결제 확인 안 된 신청은 인원에 넣지 않아요.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowApplicantModal(false); setApplicantModalProgram(null); }}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                    aria-label="닫기"
                  >
                    <Icons.X size={24} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 p-4 border-b border-black/[0.06] bg-slate-50/50">
                  <button
                    type="button"
                    onClick={loadApplicantModalData}
                    disabled={applicantModalDataLoading}
                    className={btn('secondary')}
                  >
                    {applicantModalDataLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    목록 새로고침
                  </button>
                  <button
                    type="button"
                    onClick={handleCsvDownload}
                    className={btn('secondary')}
                  >
                    <Icons.FileText size={18} />
                    CSV 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyForSheets}
                    className={btn('secondary')}
                  >
                    스프레드시트에 붙여넣기
                  </button>
                  <span className="hidden sm:inline-block w-px h-8 bg-slate-200 shrink-0 mx-1" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setShowHiddenRows((v) => !v)}
                    className={btn(showHiddenRows ? 'primary' : 'secondary', 'sm')}
                  >
                    {showHiddenRows ? '명단으로 돌아가기' : `숨긴 신청 보기 (${hiddenList.length})`}
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {(() => {
                    const addQuery = participantAddSearch.trim().toLowerCase();
                    const usersForManualAdd =
                      addQuery.length >= 1
                        ? (applicantModalUsers || [])
                            .filter((u) => matchesParticipantAddSearch(u, participantAddSearch))
                            .slice(0, 25)
                        : [];
                    return (
                      <div className="mb-6 p-4 rounded-lg border border-brand/20 bg-gradient-to-br from-blue-50/90 to-white">
                        <h4 className="text-sm font-bold text-dark mb-1 flex items-center gap-2">
                          <Icons.User size={18} className="text-brand shrink-0" />
                          <Icons.Plus size={16} className="text-brand shrink-0" />
                          회원을 참여 명단에 직접 추가
                        </h4>
                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                          이름·닉네임으로 회원을 검색해 명단에 추가할 수 있습니다.
                        </p>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5" htmlFor="participant-add-search">
                          이름·닉네임으로 검색 (이메일·연락처도 가능)
                        </label>
                        <input
                          id="participant-add-search"
                          type="search"
                          value={participantAddSearch}
                          onChange={(e) => setParticipantAddSearch(e.target.value)}
                          placeholder="예: 홍길동, 또는 성/이름 일부"
                          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:border-brand focus:outline-none mb-3"
                          aria-label="회원 검색"
                        />
                        {addQuery.length >= 1 && usersForManualAdd.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">검색 결과가 없습니다.</p>
                        ) : null}
                        {usersForManualAdd.length > 0 ? (
                          <ul className="space-y-2 max-h-52 overflow-y-auto rounded-lg border border-black/[0.06] bg-white/80 p-2">
                            {usersForManualAdd.map((u) => {
                              const uid = String(u.id || u.uid || '');
                              const onList = list.some((app) => String(app.userId || '') === uid);
                              const busy = addingParticipantUserId === uid;
                              return (
                                <li
                                  key={uid || `${u.email}-${u.name}`}
                                  className="flex flex-wrap items-center justify-between gap-2 py-2 px-2 rounded-lg border border-transparent hover:border-black/[0.06] hover:bg-blue-50/50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-dark text-sm truncate">{(u.name || '').trim() || '(이름 없음)'}</div>
                                    <div className="text-xs text-slate-600 truncate">{u.email || '-'} · {u.phone || u.phoneNumber || u.verifiedPhone || '-'}</div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={onList || busy || !uid}
                                    onClick={() => handleAdminAddParticipant(u)}
                                    className="shrink-0 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {busy ? '추가 중…' : onList ? '이미 명단' : '명단에 추가'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })()}
                  {showHiddenRows ? <p className="text-sm font-semibold text-slate-700 mb-2">숨긴 신청 — 인원에서 빠져 있어요. '다시 보이기'를 누르면 명단과 인원에 돌아와요.</p> : null}
                  {rowsToShow.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">{showHiddenRows ? '숨긴 신청이 없어요.' : '신청자가 없어요.'}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[1020px]">
                        <thead>
                          <tr className="border-b border-black/10">
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">번호</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">이름</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">닉네임</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">성별</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">생년월일</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">연락처</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">이메일</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">업종/업태</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">협업 업종</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">핵심 고객</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">참여 경로</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">강연 신청 계기</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">강연 사전 질문</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">식사 여부</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">개인정보 동의</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap">신청일</th>
                            <th className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap sticky right-0 bg-white z-[1] border-l border-black/[0.06] shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)]">
                              관리
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsToShow.map((app, i) => {
                            const user = resolveUser(app);
                            const rowLabel = (user?.name || app.userName || '').trim() || app.userEmail || `신청 ${i + 1}`;
                            return (
                              <tr key={app.id ? `${app.id}-${i}` : `row-${i}`} className="border-b border-black/[0.06]">
                                <td className="px-2 py-2 text-slate-600">{i + 1}</td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  {(user?.name || app.userName || '').trim() || '-'}
                                  {!isRegisteredApplication(app, modalFee) ? <span className="ml-1 text-xs font-bold rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-800 whitespace-nowrap">결제 확인 안 됨</span> : null}
                                </td>
                                <td className="px-2 py-2 text-slate-600">{user?.nickname || '-'}</td>
                                <td className="px-2 py-2 text-slate-600">{user?.gender || '-'}</td>
                                <td className="px-2 py-2 text-slate-600">{user?.birthdate || '-'}</td>
                                <td className="px-2 py-2">{app.userPhone || user?.phone || user?.phoneNumber || '-'}</td>
                                <td className="px-2 py-2">{app.userEmail || user?.email || '-'}</td>
                                <td className="px-2 py-2 max-w-[120px] truncate" title={user?.industry || user?.businessCategory || ''}>{user?.industry || user?.businessCategory || '-'}</td>
                                <td className="px-2 py-2 max-w-[100px] truncate" title={user?.collaborationIndustry || ''}>{user?.collaborationIndustry || '-'}</td>
                                <td className="px-2 py-2 max-w-[100px] truncate" title={user?.keyCustomers || ''}>{user?.keyCustomers || '-'}</td>
                                <td className="px-2 py-2">{app.participationPath || '-'}</td>
                                <td className="px-2 py-2 max-w-[150px] truncate" title={app.applyReason || ''}>{app.applyReason || '-'}</td>
                                <td className="px-2 py-2 max-w-[150px] truncate" title={app.preQuestions || ''}>{app.preQuestions || '-'}</td>
                                <td className="px-2 py-2">{app.mealAfter || '-'}</td>
                                <td className="px-2 py-2">{app.privacyAgreed === true ? '동의' : '-'}</td>
                                <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{formatDate(app.createdAt || app.appliedAt)}</td>
                                <td className="px-2 py-2 align-top sticky right-0 bg-white z-[1] border-l border-black/[0.06] shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)]">
                                  {showHiddenRows ? (
                                    <button type="button" disabled={!app.id} onClick={() => handleAdminRestoreApplicant(app.id)} className={btn('secondary', 'sm')}>
                                      다시 보이기
                                    </button>
                                  ) : (
                                    <button type="button" disabled={!app.id} onClick={() => handleAdminRemoveApplicant(app.id, rowLabel)} className={btn('danger', 'sm')}>
                                      명단에서 숨기기
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}

      {/* 카카오맵 모달 */}
      {showMapModal && (
        <KakaoMapModal
          onClose={() => setShowMapModal(false)}
          onSelectLocation={handleLocationSelect}
          initialLocation={mapInitialLocation}
        />
      )}
    </div>
  );
};
