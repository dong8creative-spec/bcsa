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
  admin_manual: { label: '수동 등록', className: 'bg-card text-sub' },
  site_scan: { label: '자동 수집', className: 'bg-sky text-royal' },
};

const CATEGORY_LABELS = {
  notice: { label: '공고', className: 'bg-royal text-white' },
  econ: { label: '경제', className: 'bg-sky text-royal' },
};

const INPUT_CLASS = 'h-12 w-full rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none';
const LABEL_CLASS = 'mb-1.5 block text-[15px] font-semibold text-ink';
const BADGE_CLASS = 'inline-flex h-7 items-center whitespace-nowrap rounded-none px-2 text-[13px] font-semibold';
const TH_CLASS = 'h-[52px] whitespace-nowrap border-b border-line px-4 text-left text-[14px] font-semibold text-sub';
const TD_CLASS = 'h-[52px] px-4 py-3 align-middle';

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
        <h2 className="mb-2 text-[22px] font-bold text-ink md:text-[24px]">뉴스 관리</h2>
        <p className="text-[15px] leading-relaxed text-sub">
          경제뉴스 카드를 등록하면 뉴스 페이지의 "경제" 탭에 노출됩니다. "공고" 탭은 지원사업 피드를 그대로 가져와 보여주므로
          여기서 따로 등록할 필요가 없습니다. 매일 07:00(KST)에 자동으로도 채워집니다(GitHub Actions).
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-5 md:p-6">
        <h3 className="text-[18px] font-bold text-ink">{editingId ? '뉴스 수정' : '새 뉴스 등록'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={INPUT_CLASS}
              placeholder="예: 소상공인 디지털 전환 바우처 2차 신청 안내"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>출처(언론사/기관)</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className={INPUT_CLASS}
              placeholder="예: 한국경제"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>카테고리</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="econ">경제</option>
              <option value="notice">공고</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>한 줄 요약</label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>기사 링크</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className={INPUT_CLASS}
              placeholder="https://"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>발행일시</label>
            <input
              type="datetime-local"
              value={form.publishedLocal}
              onChange={(e) => setForm((f) => ({ ...f, publishedLocal: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="published">공개</option>
              <option value="archived">보관 (미노출)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex h-12 cursor-pointer items-center gap-2 text-[15px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-line2 accent-[#2d4fe0]"
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0c0c0e] px-5 text-[15px] font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '등록'}
          </button>
          {editingId ? (
            <button type="button" onClick={openNew} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line2 bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink">
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
          <p className="text-[15px] text-sub">등록된 뉴스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border-t border-ink">
            <table className="w-full min-w-[820px] text-[15px]">
              <thead className="bg-white">
                <tr>
                  <th className={TH_CLASS}>상태</th>
                  <th className={TH_CLASS}>출처유형</th>
                  <th className={TH_CLASS}>카테고리</th>
                  <th className={TH_CLASS}>제목</th>
                  <th className={TH_CLASS}>언론사</th>
                  <th className={TH_CLASS}>발행일</th>
                  <th className={TH_CLASS}>작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const src = SOURCE_TYPE_LABELS[row.sourceType] || SOURCE_TYPE_LABELS.admin_manual;
                  const cat = CATEGORY_LABELS[row.category] || CATEGORY_LABELS.econ;
                  const pMs = firestoreLikeToMillis(row.publishedAt);
                  return (
                    <tr key={row.id} className="border-b border-line hover:bg-card">
                      <td className={TD_CLASS}>
                        <span className={`${BADGE_CLASS} ${row.enabled !== false ? 'bg-royal text-white' : 'bg-card text-sub'}`}>
                          {row.enabled !== false ? '노출중' : '비활성'}
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className={`${BADGE_CLASS} ${src.className}`}>{src.label}</span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className={`${BADGE_CLASS} ${cat.className}`}>{cat.label}</span>
                      </td>
                      <td className={`${TD_CLASS} max-w-[260px] truncate font-semibold text-ink`} title={row.title || ''}>{row.title || '—'}</td>
                      <td className={`${TD_CLASS} max-w-[140px] truncate text-sub`} title={row.source || ''}>{row.source || '—'}</td>
                      <td className={`${TD_CLASS} whitespace-nowrap text-[13px] text-sub`}>
                        {pMs != null ? new Date(pMs).toLocaleString('ko-KR') : '—'}
                      </td>
                      <td className={`${TD_CLASS} whitespace-nowrap`}>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => openEdit(row)} className="inline-flex h-10 items-center rounded-lg border border-line2 bg-white px-3 text-[14px] font-semibold text-ink hover:border-ink">
                            수정
                          </button>
                          <button type="button" onClick={() => handleDelete(row.id)} className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-3 text-[14px] font-semibold text-red-600 hover:bg-red-50">
                            삭제
                          </button>
                        </div>
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
