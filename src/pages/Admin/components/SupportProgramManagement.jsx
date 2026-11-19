import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Timestamp } from 'firebase/firestore';
import { uploadImageForAdminWithMeta } from '../../../utils/imageUtils';
import { Icons } from '../../../components/Icons';
import { firestoreLikeToMillis } from '../../../appHelpers';

const emptyForm = () => ({
  title: '',
  org: '',
  summary: '',
  description: '',
  amountText: '',
  regionText: '',
  industryText: '',
  applyUrl: '',
  sourceUrl: '',
  deadlineLocal: '',
  isRolling: false,
  thumbnailUrl: '',
  thumbnailDeleteUrl: '',
  status: 'published',
  enabled: true,
});

function toDatetimeLocalInput(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocal(str) {
  if (!str || typeof str !== 'string') return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitTags(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const SOURCE_TYPE_LABELS = {
  admin_manual: { label: '수동 등록', className: 'bg-card text-sub' },
  site_scan: { label: '자동 수집', className: 'bg-sky text-royal' },
  admin_link: { label: '링크 요약', className: 'bg-[#0c0c0e] text-white' },
  email_forward: { label: '이메일 전달', className: 'bg-royal text-white' },
};

/**
 * 지원사업 자동 수집 피드 관리: 정부·기관 지원사업 카드(D-day/태그/금액)를 등록·관리합니다.
 * 홈 화면 "지금 신청할 수 있는 지원사업" 섹션의 데이터 소스입니다.
 */
export const SupportProgramManagement = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = firebaseService.subscribeSupportPrograms((list) => {
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '',
      org: row.org || '',
      summary: row.summary || '',
      description: row.description || '',
      amountText: row.amountText || '',
      regionText: Array.isArray(row.region) ? row.region.join(', ') : '',
      industryText: Array.isArray(row.industry) ? row.industry.join(', ') : '',
      applyUrl: row.applyUrl || '',
      sourceUrl: row.sourceUrl || '',
      deadlineLocal: toDatetimeLocalInput(firestoreLikeToMillis(row.deadlineAt)),
      isRolling: !!row.isRolling,
      thumbnailUrl: row.thumbnailUrl || '',
      thumbnailDeleteUrl: row.thumbnailDeleteUrl || '',
      status: row.status || 'published',
      enabled: row.enabled !== false,
    });
  };

  const handleThumbnailFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setUploading(true);
      const { url, deleteUrl } = await uploadImageForAdminWithMeta(file);
      if (url) setForm((f) => ({ ...f, thumbnailUrl: url, thumbnailDeleteUrl: deleteUrl || '' }));
      else alert('이미지 URL을 받지 못했습니다.');
    } catch (err) {
      console.error(err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const validate = useCallback(() => {
    if (!(form.title || '').trim()) {
      alert('지원사업명을 입력해주세요.');
      return false;
    }
    if (!form.isRolling) {
      const d = parseDatetimeLocal(form.deadlineLocal);
      if (!d) {
        alert('마감일시를 입력하거나 "상시 모집"을 체크해주세요.');
        return false;
      }
    }
    return true;
  }, [form]);

  const handleSave = async () => {
    if (!validate()) return;
    const editingRow = editingId ? rows.find((row) => row.id === editingId) : null;
    const deadlineDate = form.isRolling ? null : parseDatetimeLocal(form.deadlineLocal);
    const payload = {
      title: form.title.trim(),
      org: (form.org || '').trim(),
      summary: (form.summary || '').trim(),
      description: (form.description || '').trim(),
      amountText: (form.amountText || '').trim(),
      region: splitTags(form.regionText),
      industry: splitTags(form.industryText),
      applyUrl: (form.applyUrl || '').trim(),
      sourceUrl: (form.sourceUrl || '').trim(),
      sourceType: editingRow?.sourceType || 'admin_manual',
      deadlineAt: deadlineDate ? Timestamp.fromDate(deadlineDate) : null,
      isRolling: !!form.isRolling,
      thumbnailUrl: (form.thumbnailUrl || '').trim() || null,
      thumbnailDeleteUrl: (form.thumbnailDeleteUrl || '').trim() || null,
      status: form.status,
      enabled: !!form.enabled,
      sortOrder: editingId ? Number(editingRow?.sortOrder) || 0 : Date.now(),
      createdBy: editingRow?.createdBy || 'admin_manual',
    };
    try {
      setSaving(true);
      if (editingId) {
        await firebaseService.updateSupportProgram(editingId, payload);
        alert('저장되었습니다.');
      } else {
        await firebaseService.createSupportProgram(payload);
        alert('등록되었습니다.');
      }
      openNew();
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다. 로그인 상태를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 지원사업을 삭제하시겠습니까?')) return;
    try {
      await firebaseService.deleteSupportProgram(id);
    } catch (err) {
      console.error(err);
      alert('삭제에 실패했습니다.');
    }
  };

  const nowMs = Date.now();
  const statusFor = (row) => {
    if (row.enabled === false) return { label: '비활성', className: 'bg-card text-sub' };
    if (row.status === 'pending_summary') return { label: '요약 대기중', className: 'bg-sky text-royal' };
    if (row.isRolling) return { label: '상시', className: 'bg-royal text-white' };
    const dMs = firestoreLikeToMillis(row.deadlineAt);
    if (dMs == null) return { label: '일정 미설정', className: 'bg-sky text-royal' };
    if (nowMs > dMs) return { label: '마감', className: 'bg-[#0c0c0e] text-white' };
    const daysLeft = Math.ceil((dMs - nowMs) / 86400000);
    if (daysLeft <= 3) return { label: `마감임박 D-${daysLeft}`, className: 'bg-red-50 text-red-600' };
    return { label: `모집중 D-${daysLeft}`, className: 'bg-royal text-white' };
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 text-[22px] font-bold text-ink md:text-[24px]">지원사업 피드</h2>
        <p className="text-[15px] leading-relaxed text-sub">
          정부·기관 지원사업 카드를 등록하면 홈 화면 "지금 신청할 수 있는 지원사업" 섹션에 자동으로 노출됩니다.
          비활성화하면 즉시 홈 화면에서 숨길 수 있습니다.
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-4 md:p-6">
        <h3 className="text-[18px] font-bold text-ink">{editingId ? '지원사업 수정' : '새 지원사업 등록'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">지원사업명</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 부산 소상공인 디지털 전환 지원"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">주관기관</label>
            <input
              type="text"
              value={form.org}
              onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 부산광역시"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">지원 금액/내용 (요약)</label>
            <input
              type="text"
              value={form.amountText}
              onChange={(e) => setForm((f) => ({ ...f, amountText: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 최대 300만원"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">한 줄 요약</label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="긴 공고문 대신 핵심만 한 줄로"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">상세 설명 (선택)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-line2 bg-white px-3 py-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">지역 태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.regionText}
              onChange={(e) => setForm((f) => ({ ...f, regionText: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 부산 전역, 수영구"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">업종/대상 태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.industryText}
              onChange={(e) => setForm((f) => ({ ...f, industryText: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: 소상공인, 청년창업"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">신청 링크 (선택)</label>
            <input
              type="url"
              value={form.applyUrl}
              onChange={(e) => setForm((f) => ({ ...f, applyUrl: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">출처 URL (공고 원문)</label>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="https://"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">썸네일 이미지 (선택)</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.thumbnailUrl ? (
                <img src={form.thumbnailUrl} alt="" className="h-24 w-24 border border-line bg-white object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center border border-dashed border-line2 bg-white px-1 text-center text-[13px] text-sub">
                  미리보기
                </div>
              )}
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white hover:bg-black focus-within:ring-2 focus-within:ring-royal">
                <Icons.Camera size={18} />
                {uploading ? '업로드 중…' : '이미지 업로드'}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handleThumbnailFile} aria-label="썸네일 이미지 업로드" />
              </label>
              {form.thumbnailUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, thumbnailUrl: '', thumbnailDeleteUrl: '' }))}
                  className="inline-flex h-11 items-center rounded-lg border border-red-200 bg-white px-3 text-[15px] font-semibold text-red-600 hover:border-red-600"
                >
                  URL 지우기
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">마감일시</label>
            <input
              type="datetime-local"
              value={form.deadlineLocal}
              disabled={form.isRolling}
              onChange={(e) => setForm((f) => ({ ...f, deadlineLocal: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none disabled:bg-card disabled:text-sub"
            />
          </div>
          <div className="flex items-end gap-6">
            <label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.isRolling}
                onChange={(e) => setForm((f) => ({ ...f, isRolling: e.target.checked }))}
                className="h-5 w-5 rounded border-line2 accent-[#2d4fe0]"
              />
              상시 모집 (마감일 없음)
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            >
              <option value="published">공개</option>
              <option value="pending_summary">요약 대기중 (홈 미노출)</option>
              <option value="archived">보관 (홈 미노출)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-5 w-5 rounded border-line2 accent-[#2d4fe0]"
              />
              활성화 (홈 노출)
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#0c0c0e] px-6 text-[16px] font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '등록'}
          </button>
          {editingId ? (
            <button type="button" onClick={openNew} className="inline-flex h-12 items-center justify-center rounded-lg border border-line2 bg-white px-6 text-[16px] font-semibold text-ink hover:border-ink">
              새로 작성
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[18px] font-bold text-ink">등록 목록</h3>
        {loading ? (
          <p className="text-[15px] text-sub">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-card px-5 py-8 text-center text-[15px] text-sub">등록된 지원사업이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border-t border-ink">
            <table className="w-full min-w-[760px] text-[15px]">
              <thead className="bg-white text-left">
                <tr>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">상태</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">출처</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">지원사업명</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">주관기관</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">마감</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = statusFor(row);
                  const src = SOURCE_TYPE_LABELS[row.sourceType] || SOURCE_TYPE_LABELS.admin_manual;
                  const dMs = firestoreLikeToMillis(row.deadlineAt);
                  return (
                    <tr key={row.id} className="border-b border-line hover:bg-card">
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle">
                        <span className={`inline-flex h-7 items-center rounded-none px-2 text-[13px] font-semibold ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle">
                        <span className={`inline-flex h-7 items-center rounded-none px-2 text-[13px] font-semibold ${src.className}`}>{src.label}</span>
                      </td>
                      <td className="h-[52px] max-w-[240px] truncate px-4 py-3 align-middle font-medium text-ink" title={row.title || ''}>{row.title || '—'}</td>
                      <td className="h-[52px] max-w-[160px] truncate px-4 py-3 align-middle text-sub" title={row.org || ''}>{row.org || '—'}</td>
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle text-[13px] text-sub">
                        {row.isRolling ? '상시' : dMs != null ? new Date(dMs).toLocaleString('ko-KR') : '—'}
                      </td>
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle">
                        <button type="button" onClick={() => openEdit(row)} className="mr-2 inline-flex h-10 items-center rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-ink hover:border-ink">
                          수정
                        </button>
                        <button type="button" onClick={() => handleDelete(row.id)} className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-3 text-[14px] font-semibold text-red-600 hover:border-red-600">
                          삭제
                        </button>
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
  );
};
