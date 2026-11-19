import React from 'react';
import { MgWordmark, MgWrap } from './mg/Mg';
import { BUSINESS_INFO, bizInfoCheckUrl } from '../constants/legal';

const FTC_BIZ_POPUP_URL = bizInfoCheckUrl;
const OPEN_CHAT_URL = 'https://open.kakao.com/o/gMWryRA';

// 법적 표시는 constants/legal.js 의 BUSINESS_INFO(약관·처리방침과 같은 값)를 쓴다
const DEFAULT_DATA = {
  companyName: BUSINESS_INFO.legalName,
  address: BUSINESS_INFO.address,
  representative: BUSINESS_INFO.ceo,
  businessNumber: BUSINESS_INFO.bizNo,
  salesReportNumber: BUSINESS_INFO.mailOrderNo,
  phone: BUSINESS_INFO.phone,
  hours: '평일 09:00~18:00 / 주말·공휴일 휴무',
  email: BUSINESS_INFO.email,
  hostingProvider: BUSINESS_INFO.hosting,
};

/**
 * 푸터 — 먼저가본 개편(2026-11): 사용자가 보낸 정보형(연회색) 푸터 모양.
 * 링크 줄 → (로고·사업자 정보 | 고객센터 | 참가·환불 안내) → 저작권. 상호·사업자 정보는 법적 표기라 관리자 「사이트 문구」 값을 그대로 쓴다.
 */
function Footer({
  footerRef,
  content,
  onNavigateToAbout,
  onNavigateToNotice,
  onPrivacy,
  onRefundPolicy,
  onTerms,
  onAdmin,
}) {
  const year = new Date().getFullYear();
  const data = {
    ...DEFAULT_DATA,
    ...(content?.footer_phone && { phone: content.footer_phone }),
    ...(content?.footer_hours && { hours: content.footer_hours }),
    ...(content?.footer_email && { email: content.footer_email }),
    ...(content?.footer_line2 && (() => {
      const parts = content.footer_line2.split(/\s*\|\s*/);
      const addr = parts[0]?.trim();
      const repMatch = content.footer_line2.match(/대표\s*([^|]+)/);
      const bizMatch = content.footer_line2.match(/사업자등록번호\s*([\d\-]+)/);
      return {
        ...(addr && { address: addr }),
        ...(repMatch && { representative: repMatch[1].trim() }),
        ...(bizMatch && { businessNumber: bizMatch[1].trim() }),
      };
    })()),
  };

  const go = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn?.(e); };
  const linkBase = 'text-[14px] text-[#3b4150] hover:text-ink';

  return (
    <footer ref={footerRef} className="bg-[#f4f5f7] text-ink" role="contentinfo">
      <MgWrap>
        <nav className="flex flex-wrap gap-x-7 gap-y-2 border-b border-[#dfe2e8] py-6" aria-label="사이트 정보">
          <button type="button" onClick={go(onNavigateToAbout)} className="text-[14px] font-bold text-royal">소개</button>
          <button type="button" onClick={go(onNavigateToNotice)} className={linkBase}>공지사항</button>
          <button type="button" onClick={go(onTerms)} className={linkBase}>서비스 이용약관</button>
          <button type="button" onClick={go(onPrivacy)} className="text-[14px] font-bold text-ink">개인정보 처리방침</button>
          <button type="button" onClick={go(onRefundPolicy)} className={linkBase}>취소/환불 규정</button>
          <a href={FTC_BIZ_POPUP_URL} target="_blank" rel="noopener noreferrer" className={linkBase}>사업자정보 조회 ↗</a>
          <button type="button" onClick={go(onAdmin)} className="text-[14px] text-[#9aa0aa] hover:text-ink" title="관리자">Admin</button>
        </nav>

        <div className="grid gap-8 py-11 md:grid-cols-[1.45fr_1fr_1fr] md:gap-10">
          <div>
            <MgWordmark className="text-[28px] text-ink" />
            <p className="mb-7 mt-3 text-[14px] text-[#555c6a]">먼저 가본 선배의 경험을 사고파는 지역 기반 경험 거래 플랫폼.</p>
            <h2 className="mb-4 text-[16px] font-bold">사업자 정보</h2>
            <dl className="grid grid-cols-[104px_1fr] gap-x-3.5 gap-y-2 text-[14px] md:grid-cols-[118px_1fr]">
              <dt className="text-[#6b7280]">상호</dt><dd>{data.companyName}</dd>
              <dt className="text-[#6b7280]">대표자</dt><dd>{data.representative}</dd>
              <dt className="text-[#6b7280]">사업자등록번호</dt><dd>{data.businessNumber}</dd>
              {data.salesReportNumber ? <><dt className="text-[#6b7280]">통신판매업 신고</dt><dd>{data.salesReportNumber}</dd></> : null}
              <dt className="text-[#6b7280]">사업장 주소</dt><dd className="break-keep">{data.address}</dd>
              <dt className="text-[#6b7280]">호스팅 제공</dt><dd>{data.hostingProvider}</dd>
            </dl>
          </div>
          <div>
            <h2 className="mb-4 text-[16px] font-bold">고객센터</h2>
            <p className="mb-4 text-[26px] font-bold text-[#2b2f38] md:text-[30px]">
              <a href={`tel:${data.phone.replace(/[^\d]/g, '')}`}>{data.phone}</a>
            </p>
            <dl className="grid grid-cols-[90px_1fr] gap-x-3.5 gap-y-2 text-[14px]">
              <dt className="text-[#6b7280]">이메일</dt><dd><a className="underline underline-offset-4" href={`mailto:${data.email}`}>{data.email}</a></dd>
              <dt className="text-[#6b7280]">운영시간</dt><dd className="break-keep">{data.hours}</dd>
            </dl>
          </div>
          <div className="text-[14px] text-[#3b4150]">
            <h2 className="mb-4 text-[16px] font-bold text-ink">참가·환불 안내</h2>
            <p className="mb-2.5 font-bold text-ink">참가비는 결제 화면에서 안내합니다.</p>
            <p className="mb-4 break-keep">취소·환불은 취소/환불 규정에 따릅니다. 궁금한 점은 고객센터로 먼저 연락해 주세요.</p>
            <p className="mb-2.5"><button type="button" onClick={go(onRefundPolicy)} className="underline underline-offset-4">취소·환불 기준 자세히 보기</button></p>
            <p><a className="underline underline-offset-4" href={OPEN_CHAT_URL} target="_blank" rel="noopener noreferrer">먼저가본 오픈채팅방 ↗</a></p>
          </div>
        </div>

        <div className="border-t border-[#dfe2e8] py-5 text-[12px] text-[#8c8989]">
          Copyright © {year} 먼저가본 · {data.companyName}. All Rights Reserved
        </div>
      </MgWrap>
    </footer>
  );
}

export default Footer;
