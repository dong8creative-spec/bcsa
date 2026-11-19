/**
 * 토픽(대표자 인터뷰) — 2026-11-20 운영자 요청: 「홈, 소개 다음에 "토픽" 메뉴. 관리자가 대표자와의 인터뷰를 기록하는 곳,
 * 관리자 페이지에서 작성 가능」.
 *
 * Firestore topics/{id}
 *  title        인터뷰 제목
 *  interviewee  대표자 이름
 *  company      회사·가게 이름
 *  role         직함·업종 (예: 대표 · 카페 운영 8년차)
 *  summary      목록 카드·검색용 한두 줄 요약
 *  body         본문. 빈 줄로 문단을 나누고, 「Q.」로 시작하는 줄은 질문으로 굵게 보인다
 *  images       사진 최대 10장 [{url, deleteUrl}] — 첫 장이 대표 사진(목록 카드·본문 맨 위), 나머지는 본문 아래 사진 모음
 *  coverUrl     첫 장 주소(목록·공유용으로 함께 저장)
 *  status       'published'(공개) | 'draft'(임시저장)
 *  publishedAt  공개 날짜(목록 정렬)
 *  createdAt, updatedAt
 * 규칙(firestore.rules): 공개 글은 누구나 읽고, 쓰기·임시저장 글 읽기는 관리자만.
 */
import { collection, doc, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const TOPIC_MAX_IMAGES = 10;
/** 사진 목록(예전 글의 coverUrl 한 장도 받아 준다) */
export const topicImages = (t) => {
  const list = Array.isArray(t?.images) ? t.images.filter((im) => im && im.url) : [];
  if (list.length) return list;
  return t?.coverUrl ? [{ url: t.coverUrl, deleteUrl: t.coverDeleteUrl || '' }] : [];
};
const withId = (d) => ({ id: d.id, ...d.data() });
const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (v ? new Date(v).getTime() : 0)));
const byDateDesc = (a, b) => (toMs(b.publishedAt) || toMs(b.createdAt)) - (toMs(a.publishedAt) || toMs(a.createdAt));
const clean = (data) => ({
  title: String(data.title || '').trim().slice(0, 120),
  interviewee: String(data.interviewee || '').trim().slice(0, 40),
  company: String(data.company || '').trim().slice(0, 60),
  role: String(data.role || '').trim().slice(0, 80),
  summary: String(data.summary || '').trim().slice(0, 300),
  body: String(data.body || '').slice(0, 30000),
  images: topicImages(data).slice(0, TOPIC_MAX_IMAGES).map((im) => ({ url: String(im.url).slice(0, 1000), deleteUrl: String(im.deleteUrl || '').slice(0, 1000) })),
  coverUrl: topicImages(data)[0]?.url || '',
  status: data.status === 'draft' ? 'draft' : 'published',
  publishedAt: data.publishedAt instanceof Date ? Timestamp.fromDate(data.publishedAt) : (data.publishedAt || Timestamp.now()),
});

export const topicService = {
  /** 공개 글 목록(누구나) — 규칙상 status 조건이 꼭 있어야 한다 */
  subscribePublished(callback) {
    const q = query(collection(db, 'topics'), where('status', '==', 'published'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(withId).sort(byDateDesc)), (e) => { console.error('topics', e); callback([]); });
  },
  /** 글 하나(공개 글이거나 관리자) */
  subscribeOne(id, callback) {
    return onSnapshot(doc(db, 'topics', id), (d) => callback(d.exists() ? withId(d) : null), () => callback(null));
  },
  /** 관리자: 전체(임시저장 포함) */
  subscribeAllAdmin(callback) {
    return onSnapshot(collection(db, 'topics'), (snap) => callback(snap.docs.map(withId).sort(byDateDesc)), () => callback([]));
  },
  create(data) {
    return addDoc(collection(db, 'topics'), { ...clean(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },
  update(id, data) {
    return updateDoc(doc(db, 'topics', id), { ...clean(data), updatedAt: serverTimestamp() });
  },
  remove(id) {
    return deleteDoc(doc(db, 'topics', id));
  },
};

/** 본문 → [{type:'q'|'p', text}] — 빈 줄로 문단, 「Q.」「Q:」「질문:」으로 시작하면 질문, 「A.」「A:」는 떼고 답 문단 */
export function parseTopicBody(body) {
  return String(body || '').replace(/\r/g, '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).flatMap((block) => {
    const lines = block.split('\n');
    const out = []; let buf = [];
    const flush = () => { if (buf.length) { out.push({ type: 'p', text: buf.join('\n') }); buf = []; } };
    lines.forEach((ln) => {
      const t = ln.trim();
      if (/^(Q[.:)]|질문\s*[:.])\s*/i.test(t)) { flush(); out.push({ type: 'q', text: t.replace(/^(Q[.:)]|질문\s*[:.])\s*/i, '') }); }
      else buf.push(t.replace(/^(A[.:)]|답변?\s*[:.])\s*/i, ''));
    });
    flush();
    return out;
  });
}

export const topicDateLabel = (t) => {
  const ms = toMs(t?.publishedAt) || toMs(t?.createdAt);
  return ms ? new Date(ms).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
};
