import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Timestamp } from 'firebase/firestore';
import { uploadImageForAdminWithMeta } from '../../../utils/imageUtils';
import { Icons } from '../../../components/Icons';
import { firestoreLikeToMillis } from '../../../appHelpers';

const emptyForm = () => ({
  title: '',
  posterUrl: '',
  posterDeleteUrl: '',
  linkUrl: '',
  displayStartLocal: '',
  displayEndLocal: '',
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

/**
 * 외부행사 포스터: 노출 기간·이미지·선택 링크. 홈 프로그램 팝업에 합쳐 최대 3장까지 표시됩니다.
 */
export const ExternalEventPosterManagement = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = firebaseService.subscribeExternalEventPosters((list) => {
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
      posterUrl: row.posterUrl || '',
      posterDeleteUrl: row.posterDeleteUrl || '',
      linkUrl: row.linkUrl || '',
      displayStartLocal: toDatetimeLocalInput(firestoreLikeToMillis(row.displayStartAt)),
      displayEndLocal: toDatetimeLocalInput(firestoreLikeToMillis(row.displayEndAt)),
      enabled: row.enabled !== false,
    });
  };

  const handlePosterFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setUploading(true);
      const { url, deleteUrl } = await uploadImageForAdminWithMeta(file);
      if (url) setForm((f) => ({ ...f, posterUrl: url, posterDeleteUrl: deleteUrl || '' }));
      else alert('이미지 URL을 받지 못했습니다.');
    } catch (err) {
      console.error(err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const validate = useCallback(() => {
    if (!(form.posterUrl || '').trim()) {
      alert('포스터 이미지를 등록해주세요.');
      return false;
    }
    const start = parseDatetimeLocal(form.displayStartLocal);
    const end = parseDatetimeLocal(form.displayEndLocal);
    if (!start || !end) {
      alert('노출 시작·종료 일시를 모두 입력해주세요.');
      return false;
    }
    if (end.getTime() < start.getTime()) {
      alert('종료 일시는 시작 일시 이후여야 합니다.');
      return false;
    }
    return true;
  }, [form]);

  const handleSave = async () => {
    if (!validate()) return;
    const start = parseDatetimeLocal(form.displayStartLocal);
    const end = parseDatetimeLocal(form.displayEndLocal);
    const editingRow = editingId ? rows.find((row) => row.id === editingId) : null;
    const payload = {
      title: (form.title || '').trim() || '외부 행사',
      posterUrl: form.posterUrl.trim(),
      posterDeleteUrl: (form.posterDeleteUrl || '').trim() || null,
      linkUrl: (form.linkUrl || '').trim(),
      displayStartAt: Timestamp.fromDate(start),
      displayEndAt: Timestamp.fromDate(end),
      sortOrder: editingId ? Number(editingRow?.sortOrder) || 0 : 0,
      enabled: !!form.enabled,
    };
    try {
      setSaving(true);
      if (editingId) {
        await firebaseService.updateExternalEventPoster(editingId, payload);
        alert('저장되었습니다.');
      } else {
        await firebaseService.createExternalEventPoster(payload);
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
    if (!confirm('이 포스터를 삭제하시겠습니까?')) return;
    try {
      await firebaseService.deleteExternalEventPoster(id);
    } catch (err) {
      console.error(err);
      alert('삭제에 실패했습니다.');
    }
  };

  const nowMs = Date.now();
  const statusFor = (row) => {
    const a = firestoreLikeToMillis(row.displayStartAt);
    const b = firestoreLikeToMillis(row.displayEndAt);
    if (row.enabled === false) return { label: '비활성', className: 'bg-card text-sub' };
    if (a == null || b == null) return { label: '일정 미설정', className: 'bg-sky text-royal' };
    if (nowMs < a) return { label: '예정', className: 'bg-sky text-royal' };
    if (nowMs > b) return { label: '기간 만료', className: 'bg-[#0c0c0e] text-white' };
    return { label: '노출 중', className: 'bg-royal text-white' };
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 text-[22px] font-bold text-ink md:text-[24px]">외부행사 포스터 (기간제)</h2>
        <p className="text-[15px] leading-relaxed text-sub">
          외부 행사 포스터를 기간으로 지정해 홈 화면 팝업에 노출할 수 있습니다. 팝업은 최대 3장까지 표시됩니다.
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-4 md:p-6">
        <h3 className="text-[18px] font-bold text-ink">{editingId ? '포스터 수정' : '새 포스터 등록'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">행사명 (이미지 대체 텍스트·관리용)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="예: OO 컨퍼런스"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">포스터 이미지</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.posterUrl ? (
                <img src={form.posterUrl} alt="" className="h-40 w-28 border border-line bg-white object-cover" />
              ) : (
                <div className="flex h-40 w-28 items-center justify-center border border-dashed border-line2 bg-white px-1 text-center text-[13px] text-sub">
                  미리보기
                </div>
              )}
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#0c0c0e] px-4 text-[15px] font-bold text-white hover:bg-black focus-within:ring-2 focus-within:ring-royal">
                <Icons.Camera size={18} />
                {uploading ? '업로드 중…' : '이미지 업로드'}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handlePosterFile} aria-label="포스터 이미지 업로드" />
              </label>
              {form.posterUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, posterUrl: '' }))}
                  className="inline-flex h-11 items-center rounded-lg border border-red-200 bg-white px-3 text-[15px] font-semibold text-red-600 hover:border-red-600"
                >
                  URL 지우기
                </button>
              ) : null}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">행사 페이지 URL (선택, 있으면 버튼으로 새 창 열기)</label>
            <input
              type="url"
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">노출 시작</label>
            <input
              type="datetime-local"
              value={form.displayStartLocal}
              onChange={(e) => setForm((f) => ({ ...f, displayStartLocal: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-semibold text-ink">노출 종료</label>
            <input
              type="datetime-local"
              value={form.displayEndLocal}
              onChange={(e) => setForm((f) => ({ ...f, displayEndLocal: e.target.value }))}
              className="h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-5 w-5 rounded border-line2 accent-[#2d4fe0]"
              />
              활성화
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
          <p className="rounded-xl bg-card px-5 py-8 text-center text-[15px] text-sub">등록된 포스터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border-t border-ink">
            <table className="w-full min-w-[640px] text-[15px]">
              <thead className="bg-white text-left">
                <tr>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">상태</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">썸네일</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">행사명</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">노출 기간</th>
                  <th className="h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = statusFor(row);
                  const sMs = firestoreLikeToMillis(row.displayStartAt);
                  const eMs = firestoreLikeToMillis(row.displayEndAt);
                  return (
                    <tr key={row.id} className="border-b border-line hover:bg-card">
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle">
                        <span className={`inline-flex h-7 items-center rounded-none px-2 text-[13px] font-semibold ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="h-[52px] px-4 py-3 align-middle">
                        {row.posterUrl ? (
                          <img src={row.posterUrl} alt="" className="h-16 w-11 border border-line object-cover" />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="h-[52px] max-w-[240px] truncate px-4 py-3 align-middle font-medium text-ink" title={row.title || ''}>{row.title || '—'}</td>
                      <td className="h-[52px] whitespace-nowrap px-4 py-3 align-middle text-[13px] text-sub">
                        {sMs != null ? new Date(sMs).toLocaleString('ko-KR') : '—'}
                        <br />
                        ~ {eMs != null ? new Date(eMs).toLocaleString('ko-KR') : '—'}
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
