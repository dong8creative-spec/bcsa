import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../../../services/firebaseService';
import { Timestamp } from 'firebase/firestore';
import { Icons } from '../../../components/Icons';
import { firestoreLikeToMillis } from '../../../appHelpers';

const emptyForm = () => ({
  title: '',
  source: '',
  summary: '',
  url: '',
  category: 'econ',
  publishedLocal: '',
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

const SOURCE_TYPE_LABELS = {
  admin_manual: { label: '수동 등록', className: 'bg-gray-200 text-gray-700' },
  site_scan: { label: '자동 수집', className: 'bg-purple-100 text-purple-700' },
};

const CATEGORY_LABELS = {
  notice: { label: '공고', className: 'bg-sky-100 text-sky-700' },
  econ: { label: '경제', className: 'bg-orange-100 text-orange-700' },
};

/**
 * 뉴스 피드 관리: 지원사업 공고/경제뉴스 카드를 등록·관리합니다.
 * 뉴스 페이지("경제" 카테고리)의 데이터 소스입니다. "공고" 카테고리는 지원사업 피드(supportPrograms)를 그대로 재사용하므로
 * 여기서는 주로 "경제" 뉴스를 관리합니다.
 */
export const NewsManagement = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = firebaseService.subscribeNewsItems((list) => {
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
      source: row.source || '',
      summary: row.summary || '',
      url: row.url || '',
      category: row.category || 'econ',
      publishedLocal: toDatetimeLocalInput(firestoreLikeToMillis(row.publishedAt)),
      status: row.status || 'published',
      enabled: row.enabled !== false,
    });
  };

  const validate = useCallback(() => {
    if (!(form.title || '').trim()) {
      alert('제목을 입력해주세요.');
      return false;
    }
    if (!(form.url || '').trim()) {
      alert('기사 링크를 입력해주세요.');
      return false;
    }
    return true;
  }, [form]);

  const handleSave = async () => {
    if (!validate()) return;
    const editingRow = editingId ? rows.find((row) => row.id === editingId) : null;
    const publishedDate = parseDatetimeLocal(form.publishedLocal) || new Date();
    const payload = {
      title: form.title.trim(),
      source: (form.source || '').trim(),
      summary: (form.summary || '').trim(),
      url: (form.url || '').trim(),
      category: form.category,
      sourceType: editingRow?.sourceType || 'admin_manual',
      publishedAt: Timestamp.fromDate(publishedDate),
      status: form.status,
      enabled: !!form.enabled,
      sortOrder: editingId ? Number(editingRow?.sortOrder) || 0 : Date.now(),
      createdBy: editingRow?.createdBy || 'admin_manual',
    };
    try {
      setSaving(true);
      if (editingId) {
        await firebaseService.updateNewsItem(editingId, payload);
        alert('저장되었습니다.');
      } else {
        await firebaseService.createNewsItem(payload);
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
    if (!confirm('이 뉴스 항목을 삭제하시겠습니까?')) return;
    try {
      await firebaseService.deleteNewsItem(id);
    } catch (err) {
      console.error(err);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-dark mb-2">뉴스 관리</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          경제뉴스 카드를 등록하면 뉴스 페이지의 "경제" 탭에 노출됩니다. "공고" 탭은 지원사업 피드를 그대로 가져와 보여주므로
          여기서 따로 등록할 필요가 없습니다. 매일 07:00(KST)에 자동으로도 채워집니다(GitHub Actions).
        </p>
      </div>

      <div className="rounded-[24px] border border-black/[0.06] p-6 bg-soft/80 space-y-4">
        <h3 className="text-lg font-semibold text-dark">{editingId ? '뉴스 수정' : '새 뉴스 등록'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
              placeholder="예: 소상공인 디지털 전환 바우처 2차 신청 안내"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">출처(언론사/기관)</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
              placeholder="예: 한국경제"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">카테고리</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
            >
              <option value="econ">경제</option>
              <option value="notice">공고</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">한 줄 요약</label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">기사 링크</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">발행일시</label>
            <input
              type="datetime-local"
              value={form.publishedLocal}
              onChange={(e) => setForm((f) => ({ ...f, publishedLocal: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-4 py-2 border border-black/[0.06] rounded-2xl focus:border-brand/40 focus:outline-none"
            >
              <option value="published">공개</option>
              <option value="archived">보관 (미노출)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-brand"
              />
              활성화 (노출)
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-3 bg-brand text-white font-semibold rounded-full hover:bg-[#00327a] transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '등록'}
          </button>
          {editingId ? (
            <button type="button" onClick={openNew} className="px-6 py-3 bg-white border border-black/[0.06] text-dark font-semibold rounded-full hover:bg-soft transition-colors">
              새로 작성
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-dark mb-3">등록 목록</h3>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 뉴스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-black/[0.06]">
            <table className="min-w-full text-sm">
              <thead className="bg-soft text-left">
                <tr>
                  <th className="p-3 font-semibold text-gray-700">상태</th>
                  <th className="p-3 font-semibold text-gray-700">출처유형</th>
                  <th className="p-3 font-semibold text-gray-700">카테고리</th>
                  <th className="p-3 font-semibold text-gray-700">제목</th>
                  <th className="p-3 font-semibold text-gray-700">언론사</th>
                  <th className="p-3 font-semibold text-gray-700">발행일</th>
                  <th className="p-3 font-semibold text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const src = SOURCE_TYPE_LABELS[row.sourceType] || SOURCE_TYPE_LABELS.admin_manual;
                  const cat = CATEGORY_LABELS[row.category] || CATEGORY_LABELS.econ;
                  const pMs = firestoreLikeToMillis(row.publishedAt);
                  return (
                    <tr key={row.id} className="border-t border-black/[0.06] hover:bg-soft/70">
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${row.enabled !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                          {row.enabled !== false ? '노출중' : '비활성'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${src.className}`}>{src.label}</span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cat.className}`}>{cat.label}</span>
                      </td>
                      <td className="p-3 font-medium max-w-[260px] truncate">{row.title || '—'}</td>
                      <td className="p-3 text-gray-600 max-w-[120px] truncate">{row.source || '—'}</td>
                      <td className="p-3 text-gray-600 whitespace-nowrap text-xs">
                        {pMs != null ? new Date(pMs).toLocaleString('ko-KR') : '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(row)} className="text-brand font-semibold mr-3 hover:underline">
                          수정
                        </button>
                        <button type="button" onClick={() => handleDelete(row.id)} className="text-red-600 font-semibold hover:underline">
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
