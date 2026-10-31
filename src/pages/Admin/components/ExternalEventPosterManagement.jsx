import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Timestamp } from 'firebase/firestore';
import { uploadImageForAdminWithMeta } from '../../../utils/imageUtils';
import { AdminPageHeader, adminAlert, adminConfirm, btn } from './ui';
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

  const [formOpen, setFormOpen] = useState(false);

  /** 저장·취소 후: 입력칸을 비우고 닫는다 */
  const openNew = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  /** 새로 등록: 빈 입력칸을 연다 */
  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      else adminAlert('이미지 URL을 받지 못했습니다.');
    } catch (err) {
      console.error(err);
      adminAlert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const validate = useCallback(() => {
    if (!(form.posterUrl || '').trim()) {
      adminAlert('포스터 이미지를 등록해주세요.');
      return false;
    }
    const start = parseDatetimeLocal(form.displayStartLocal);
    const end = parseDatetimeLocal(form.displayEndLocal);
    if (!start || !end) {
      adminAlert('노출 시작·종료 일시를 모두 입력해주세요.');
      return false;
    }
    if (end.getTime() < start.getTime()) {
      adminAlert('종료 일시는 시작 일시 이후여야 합니다.');
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
        adminAlert('저장되었습니다.');
      } else {
        await firebaseService.createExternalEventPoster(payload);
        adminAlert('등록되었습니다.');
      }
      openNew();
    } catch (err) {
      console.error(err);
      adminAlert('저장에 실패했습니다. 로그인 상태를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await adminConfirm('이 포스터를 삭제할까요? 되돌릴 수 없어요.', { okText: '삭제', danger: true })) return;
    try {
      await firebaseService.deleteExternalEventPoster(id);
    } catch (err) {
      console.error(err);
      adminAlert('삭제에 실패했습니다.');
    }
  };

  const nowMs = Date.now();
  const statusFor = (row) => {
    const a = firestoreLikeToMillis(row.displayStartAt);
    const b = firestoreLikeToMillis(row.displayEndAt);
    if (row.enabled === false) return { label: '비활성', className: 'bg-slate-200 text-slate-700' };
    if (a == null || b == null) return { label: '일정 미설정', className: 'bg-amber-100 text-amber-800' };
    if (nowMs < a) return { label: '예정', className: 'bg-blue-100 text-blue-800' };
    if (nowMs > b) return { label: '기간 만료', className: 'bg-slate-100 text-slate-600' };
    return { label: '노출 중', className: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="외부행사 포스터"
        description='기간을 정해 홈 화면 팝업에 외부 행사 포스터를 띄워요. 팝업은 한 번에 3장까지 보여요.'
        actions={!formOpen ? <button type="button" onClick={startNew} className={btn('primary')}><Icons.Plus size={16} />새 포스터 등록</button> : null}
      />

      {formOpen ? (
      <div className="border border-black/[0.06] rounded-2xl p-6 bg-slate-50/80 space-y-4">
        <h3 className="text-lg font-bold text-dark">{editingId ? '포스터 수정' : '새 포스터 등록'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-1">행사명 (이미지 대체 텍스트·관리용)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
              placeholder="예: OO 컨퍼런스"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-1">포스터 이미지</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.posterUrl ? (
                <img src={form.posterUrl} alt="" className="h-40 w-28 object-cover rounded-lg border border-slate-200" />
              ) : (
                <div className="h-40 w-28 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center px-1">
                  미리보기
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg font-bold cursor-pointer hover:bg-brand/90 text-sm">
                <Icons.Camera size={18} />
                {uploading ? '업로드 중…' : '이미지 업로드'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handlePosterFile} />
              </label>
              {form.posterUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, posterUrl: '' }))}
                  className="px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg"
                >
                  URL 지우기
                </button>
              ) : null}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-1">행사 페이지 URL (선택, 있으면 버튼으로 새 창 열기)</label>
            <input
              type="url"
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
              className="w-full px-4 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">노출 시작</label>
            <input
              type="datetime-local"
              value={form.displayStartLocal}
              onChange={(e) => setForm((f) => ({ ...f, displayStartLocal: e.target.value }))}
              className="w-full px-4 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">노출 종료</label>
            <input
              type="datetime-local"
              value={form.displayEndLocal}
              onChange={(e) => setForm((f) => ({ ...f, displayEndLocal: e.target.value }))}
              className="w-full px-4 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand"
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
            className="px-6 py-3 bg-brand text-white font-bold rounded-lg hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '등록'}
          </button>
          <button type="button" onClick={openNew} className={btn('secondary')}>
              취소
            </button>
        </div>
      </div>
      ) : null}

      <div>
        <h3 className="text-lg font-bold text-dark mb-3">등록 목록</h3>
        {loading ? (
          <p className="text-slate-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">등록된 포스터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-black/[0.06]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-bold text-slate-700">상태</th>
                  <th className="p-3 font-bold text-slate-700">썸네일</th>
                  <th className="p-3 font-bold text-slate-700">행사명</th>
                  <th className="p-3 font-bold text-slate-700">노출 기간</th>
                  <th className="p-3 font-bold text-slate-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = statusFor(row);
                  const sMs = firestoreLikeToMillis(row.displayStartAt);
                  const eMs = firestoreLikeToMillis(row.displayEndAt);
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="p-3">
                        {row.posterUrl ? (
                          <img src={row.posterUrl} alt="" className="h-16 w-11 object-cover rounded-lg border" />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 font-medium max-w-[200px] truncate">{row.title || '—'}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap text-xs">
                        {sMs != null ? new Date(sMs).toLocaleString('ko-KR') : '—'}
                        <br />
                        ~ {eMs != null ? new Date(eMs).toLocaleString('ko-KR') : '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(row)} className="text-brand font-bold mr-3 hover:underline">
                          수정
                        </button>
                        <button type="button" onClick={() => handleDelete(row.id)} className="text-red-600 font-bold hover:underline">
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
