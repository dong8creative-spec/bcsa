import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { apiGet } from '../utils/api';
import ModalPortal from './ModalPortal';

const formatBidNoWithOrd = (item) => {
  if (!item?.bidNtceNo) return '-';
  const ord = item.bidNtceOrd != null && item.bidNtceOrd !== ''
    ? String(item.bidNtceOrd).padStart(3, '0')
    : '000';
  return `${item.bidNtceNo}-${ord}`;
};

const formatDate = (str) => {
  if (!str) return '-';
  const s = String(str).trim().replace(/\s/g, '');
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/);
  if (m) {
    if (m[4] != null) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5] || '00'}`;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return str;
};

const formatPrice = (val) => {
  if (val == null || val === '') return '-';
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[,\s]/g, ''), 10);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('ko-KR').format(num) + '원';
};

// 주요 정보: 금액·일정·자격 (G2B 필드명·오타 변형 포함)
const KEY_AMOUNT = [
  'estPrice', 'bsnsBdgtAmt', 'baseAmt', 'presmtPrce', 'presmptPrce', 'sldngPrce',
  'estmtAmt', 'basePrce', 'sldngLwstPrce', 'sucsfbidAmt',
  'prcurmtAmt', 'prcurmtPrce', 'bsnsBdgt', 'presmtPrc', 'basePrc'
];
const KEY_SCHEDULE = ['bidNtceDt', 'bidClseDt', 'bidClsDt', 'opengDt', 'opengDtTm', 'bidBegnDt', 'bidEndDt'];
const KEY_QUALIFICATION = ['licnsReq', 'licnsReqNm', 'partcptLmt', 'partcptLmtNm', 'bsnsCond', 'bsnsCondNm'];

const AMOUNT_KEY_PATTERN = /amt|price|prce|prc|금액|가격|추정|기초|낙찰|예산/i;

const LABELS = {
  bidNtceNo: '공고번호',
  bidNtceOrd: '공고차수',
  bidNtceNm: '공고명',
  estPrice: '추정가격',
  bsnsBdgtAmt: '기초금액',
  baseAmt: '기초금액',
  presmtPrce: '추정가격',
  presmptPrce: '추정가격',
  sldngPrce: '낙찰하한가',
  estmtAmt: '추정금액',
  basePrce: '기초가격',
  sldngLwstPrce: '낙찰하한가',
  sucsfbidAmt: '낙찰금액',
  prcurmtAmt: '조달금액',
  prcurmtPrce: '조달가격',
  bsnsBdgt: '사업예산',
  presmtPrc: '추정가격',
  basePrc: '기초가격',
  bidNtceDt: '게시일시',
  bidClseDt: '마감일시',
  bidClsDt: '마감일시',
  opengDt: '개찰일시',
  opengDtTm: '개찰일시',
  bidBegnDt: '입찰시작일시',
  bidEndDt: '입찰종료일시',
  licnsReq: '면허제한',
  licnsReqNm: '면허제한',
  partcptLmt: '참가자격',
  partcptLmtNm: '참가자격',
  bsnsCond: '사업조건',
  bsnsCondNm: '사업조건',
  insttNm: '공고기관',
  ntceInsttNm: '공고기관',
  dmandInsttNm: '수요기관',
  dminsttNm: '수요기관'
};

const getLabel = (key) => LABELS[key] || key;

const pickKeySection = (data, keys) => {
  const out = [];
  keys.forEach(k => {
    const v = data?.[k];
    if (v !== undefined && v !== null && v !== '') out.push({ key: k, label: getLabel(k), value: v });
  });
  return out;
};

// 금액 섹션: 고정 키 + API 응답에서 금액/가격 패턴 키 전부 (세부 금액 누락 방지)
const amountSectionEntries = (data) => {
  const fromKeys = pickKeySection(data, KEY_AMOUNT);
  const seen = new Set(fromKeys.map(({ key }) => key));
  if (!data || typeof data !== 'object') return fromKeys;
  Object.entries(data).forEach(([k, v]) => {
    if (k.startsWith('_') || seen.has(k)) return;
    if (v === undefined || v === null || v === '') return;
    if (AMOUNT_KEY_PATTERN.test(k)) {
      seen.add(k);
      fromKeys.push({ key: k, label: getLabel(k), value: v });
    }
  });
  return fromKeys;
};

// 클라이언트 보조: 객체에서 첨부파일 URL 수집 (백엔드에서 빠진 경우 대비)
const collectAttachmentUrlsFromObject = (obj, out = []) => {
  if (!obj) return out;
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s.length > 20 && /^https?:\/\//i.test(s) && /\.(pdf|hwp|hwpx|doc|docx)|fileDown|download|atchFile|pblancFile/i.test(s)) {
      out.push({ url: s, label: decodeURIComponent((s.split('/').pop() || '').split('?')[0]) || '첨부파일' });
    }
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => collectAttachmentUrlsFromObject(item, out));
    return out;
  }
  if (typeof obj === 'object') {
    Object.values(obj).forEach(v => collectAttachmentUrlsFromObject(v, out));
    return out;
  }
  return out;
};

const excludeKeys = new Set([
  '_metadata', 'attachments', 'standardized', 'bidNtceNo', 'bidNtceOrd', 'bidNtceNm',
  ...KEY_AMOUNT, ...KEY_SCHEDULE, ...KEY_QUALIFICATION,
  'insttNm', 'ntceInsttNm', 'dmandInsttNm', 'dminsttNm'
]);

const restEntries = (data) => {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data)
    .filter(([k]) => !excludeKeys.has(k) && !k.startsWith('_') && !AMOUNT_KEY_PATTERN.test(k))
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, value]) => [key, value]);
};

// standardized 기반 표시용 라벨 (영문 키 → 한글)
const STANDARDIZED_LABELS = {
  basePrice: '기초금액',
  estimatedPrice: '추정가격',
  bidFloorPrice: '낙찰하한가',
  successfulBidAmount: '낙찰금액',
  noticeDate: '게시일시',
  deadlineDate: '마감일시',
  openingDate: '개찰일시'
};

const formatRestValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const formatBidNoWithOrdFromItem = (item) => {
  if (!item?.bidNtceNo) return '-';
  const ord = item.bidNtceOrd != null && item.bidNtceOrd !== '' ? String(item.bidNtceOrd).padStart(3, '0') : '000';
  return `${item.bidNtceNo}-${ord}`;
};

export function TenderDetail({ bidNtceNo, bidNtceOrd, onClose, fallbackItem }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!bidNtceNo) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = { bidNtceNo };
    if (bidNtceOrd != null && bidNtceOrd !== '') params.bidNtceOrd = bidNtceOrd;

    apiGet('/api/bid-detail', params)
      .then(res => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data) setData(res.data.data);
        else setError(res.data?.error || '상세 정보를 불러올 수 없습니다.');
      })
      .catch(err => {
        if (cancelled) return;
        const status = err.response?.status;
        const bodyError = err.response?.data?.error;
        const msg = bodyError || (status === 404 ? '해당 공고의 상세 정보를 찾을 수 없습니다. (상세 API 미지원 또는 데이터 없음)' : err.message) || '네트워크 오류';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [bidNtceNo, bidNtceOrd]);

  const std = data?.standardized;
  const hasStandardized = std && typeof std === 'object';

  const amountRows = (() => {
    if (!data) return [];
    if (hasStandardized) {
      const entries = [];
      ['basePrice', 'estimatedPrice', 'bidFloorPrice', 'successfulBidAmount'].forEach(key => {
        const v = std[key];
        if (v !== undefined && v !== null && v !== '') {
          entries.push({ key, label: STANDARDIZED_LABELS[key] || key, value: v });
        }
      });
      if (entries.length > 0) return entries;
    }
    return amountSectionEntries(data);
  })();

  const scheduleRows = (() => {
    if (!data) return [];
    if (hasStandardized) {
      const entries = [];
      ['noticeDate', 'deadlineDate', 'openingDate'].forEach(key => {
        const v = std[key];
        if (v !== undefined && v !== null && v !== '') {
          entries.push({ key, label: STANDARDIZED_LABELS[key] || key, value: v });
        }
      });
      if (entries.length > 0) return entries;
    }
    return pickKeySection(data, KEY_SCHEDULE);
  })();

  const qualRows = (() => {
    if (!data) return [];
    if (hasStandardized && Array.isArray(std.participantQualifications) && std.participantQualifications.length > 0) {
      return std.participantQualifications.map((item, i) => ({
        key: `qual-${i}`,
        label: '참가자격',
        value: typeof item === 'object' ? (item.text || item.name || JSON.stringify(item)) : String(item)
      }));
    }
    return pickKeySection(data, KEY_QUALIFICATION);
  })();

  const rest = data ? restEntries(data) : [];

  const attachmentsFromStd = (std?.attachmentFileUrls || []).filter(a => a?.url);
  const attachmentsFromApi = (data?.attachments || []).filter(a => a?.url);
  const attachmentsFallback = data ? collectAttachmentUrlsFromObject(data) : [];
  const attachments = attachmentsFromStd.length > 0
    ? attachmentsFromStd
    : attachmentsFromApi.length > 0
      ? attachmentsFromApi
      : attachmentsFallback;

  const content = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tender-detail-title"
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 id="tender-detail-title" className="text-lg font-bold text-gray-800">
            입찰공고 상세
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="inline-flex items-center gap-2 text-gray-600">
                <span className="h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                로딩 중...
              </span>
            </div>
          )}

          {error && !loading && (
            <>
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2">
                <Icons.AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
              {fallbackItem && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">기본 정보 (검색 결과)</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-gray-500">공고번호</dt>
                    <dd className="font-mono text-gray-800">{formatBidNoWithOrdFromItem(fallbackItem)}</dd>
                    <dt className="text-gray-500">공고명</dt>
                    <dd className="text-gray-800">{fallbackItem.bidNtceNm || '-'}</dd>
                    <dt className="text-gray-500">공고기관</dt>
                    <dd className="text-gray-800">{fallbackItem.insttNm || fallbackItem.ntceInsttNm || '-'}</dd>
                    <dt className="text-gray-500">수요기관</dt>
                    <dd className="text-gray-800">{fallbackItem.dmandInsttNm || fallbackItem.dminsttNm || '-'}</dd>
                    <dt className="text-gray-500">게시일시</dt>
                    <dd className="text-gray-800">{fallbackItem.bidNtceDt || '-'}</dd>
                    <dt className="text-gray-500">마감일시</dt>
                    <dd className="text-gray-800">{fallbackItem.bidClseDt || '-'}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-gray-500">상세 API에서 추가 정보를 불러오지 못해 검색 결과 기준으로 표시합니다.</p>
                </div>
              )}
            </>
          )}

          {data && !loading && (
            <>
              {/* 상단: 공고번호·공고명·기관 */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-500 mb-1">공고번호</p>
                <p className="font-mono font-bold text-gray-800">{formatBidNoWithOrd(data)}</p>
                <p className="text-base font-medium text-gray-800 mt-2">{data.bidNtceNm || '-'}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.insttNm || data.ntceInsttNm || '-'} / {data.dmandInsttNm || data.dminsttNm || '-'}
                </p>
              </div>

              {/* 주요 정보: 금액·일정·자격 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-bold text-brand mb-2 flex items-center gap-1">
                    <Icons.Banknote className="w-4 h-4" /> 금액
                  </h3>
                  <dl className="space-y-1 text-sm">
                    {amountRows.length ? amountRows.map(({ label, value }) => (
                      <div key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-medium text-gray-800">{typeof value === 'number' || /^\d+$/.test(String(value)) ? formatPrice(value) : value}</dd>
                      </div>
                    )) : <dd className="text-gray-500">-</dd>}
                  </dl>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-bold text-brand mb-2 flex items-center gap-1">
                    <Icons.Calendar className="w-4 h-4" /> 일정
                  </h3>
                  <dl className="space-y-1 text-sm">
                    {scheduleRows.length ? scheduleRows.map(({ label, value }) => (
                      <div key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-medium text-gray-800">{formatDate(value)}</dd>
                      </div>
                    )) : <dd className="text-gray-500">-</dd>}
                  </dl>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-bold text-brand mb-2 flex items-center gap-1">
                    <Icons.Award className="w-4 h-4" /> 참가자격
                  </h3>
                  <dl className="space-y-1 text-sm">
                    {qualRows.length ? qualRows.map(({ label, value }) => (
                      <div key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-medium text-gray-800 break-words">{String(value)}</dd>
                      </div>
                    )) : <dd className="text-gray-500">-</dd>}
                  </dl>
                </div>
              </div>

              {/* 공고서·첨부파일 / Direct Download Links */}
              {attachments.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1">
                    <Icons.Paperclip className="w-4 h-4" /> 공고서·첨부파일
                  </h3>
                  <ul className="space-y-2">
                    {attachments.map((a, i) => (
                      <li key={i}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-brand hover:underline"
                        >
                          {a.label || '첨부파일'}
                          <Icons.Download className="w-4 h-4" aria-hidden />
                          <span>다운로드</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 나머지 항목 테이블 */}
              {rest.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <h3 className="text-sm font-bold text-gray-800 px-4 py-2 bg-gray-50 border-b border-gray-200">
                    기타 항목
                  </h3>
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {rest.map(([key, value]) => (
                        <tr key={key}>
                          <td className="px-4 py-2 text-gray-500 font-medium w-40 align-top">{getLabel(key)}</td>
                          <td className="px-4 py-2 text-gray-800 break-words whitespace-pre-wrap">{formatRestValue(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );

  return <ModalPortal>{content}</ModalPortal>;
}

export default TenderDetail;
