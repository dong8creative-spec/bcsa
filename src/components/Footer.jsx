import React from 'react';

const FTC_BIZ_POPUP_URL = 'http://www.ftc.go.kr/bizCommPop.do?wrkr_no=7927200616';

const DEFAULT_DATA = {
  companyName: '부산청년사업가 포럼',
  address: '부산광역시 연제구 법원남로9번길 17(거제동)',
  representative: '정은지',
  businessNumber: '792-72-00616',
  salesReportNumber: '제 2026-부산연제-0018 호',
  phone: '070-8064-7238',
  hours: '평일 09:00~18:00 / 주말·공휴일 휴무',
  email: 'pujar@naver.com',
  hostingProvider: 'Firebase',
};

const NAV_ITEMS = [
  { key: 'about', label: '소개' },
  { key: 'notice', label: '공지사항' },
  { key: 'terms', label: '서비스 이용약관' },
  { key: 'privacy', label: '개인정보 처리방침', highlight: true },
  { key: 'refund', label: '취소/환불 규정' },
  { key: 'admin', label: 'Admin' },
];

/**
 * 컴플라이언스·렌더링 최적화 반영 푸터
 * - 동적 연도, 개인정보처리방침 강조, 호스팅 명시, 공정위 사업자정보 링크
 */
function Footer({
  footerRef,
  content,
  onNavigateToAbout,
  onNavigateToNotice,
  onPrivacy,
  onRefundPolicy,
  onAdmin,
}) {
  const year = new Date().getFullYear();
  const data = {
    ...DEFAULT_DATA,
    ...(content?.footer_title && { companyName: content.footer_title }),
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

  const handleNav = (key, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (key === 'about') { onNavigateToAbout?.(e); return; }
    if (key === 'notice') { onNavigateToNotice?.(e); return; }
    if (key === 'privacy') { onPrivacy?.(e); return; }
    if (key === 'refund') { onRefundPolicy?.(e); return; }
    if (key === 'admin') { onAdmin?.(e); return; }
    if (key === 'terms') { /* 서비스 이용약관 */ return; }
  };

  const linkClass = (item) => {
    if (item.highlight) return 'font-bold text-white hover:text-white/90 transition-colors';
    if (item.key === 'admin') return 'text-gray-400 hover:text-white transition-colors';
    return 'text-gray-300 hover:text-white transition-colors';
  };

  return (
    <footer
      ref={footerRef}
      className="py-12 px-6 bg-blue-800 text-gray-300"
      role="contentinfo"
    >
      <div className="container mx-auto max-w-6xl">
        {/* 모바일: 세로 스택 */}
        <div className="flex flex-col md:hidden gap-4 text-center">
          <h3 className="text-lg font-bold text-white">{data.companyName}</h3>
          <p className="text-sm">{data.address}</p>
          <p className="text-sm">
            대표 {data.representative} | 사업자등록번호 {data.businessNumber}
            <a
              href={FTC_BIZ_POPUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1.5 text-xs text-white underline hover:text-white/90"
            >
              [사업자 정보 확인]
            </a>
          </p>
          {data.salesReportNumber && <p className="text-xs">{data.salesReportNumber}</p>}
          <p className="text-sm">
            <span className="text-white font-bold">대표번호</span>{' '}
            <a href={`tel:${data.phone.replace(/\s/g, '')}`} className="text-white hover:underline">
              {data.phone}
            </a>
            {' '}({data.hours})
          </p>
          <p className="text-sm">
            <span className="text-white font-bold">대표 메일</span>{' '}
            <a href={`mailto:${data.email}`} className="text-white hover:underline">{data.email}</a>
          </p>
          <p className="text-xs text-gray-400">
            호스팅 서비스 제공: {data.hostingProvider}
          </p>
          <p className="text-xs text-gray-400">
            © {year} {data.companyName} (BCSA). All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2" aria-label="하단 링크">
            {NAV_ITEMS.map((item, i) => (
              <span key={item.key} className="flex items-center gap-x-2">
                {i > 0 && <span className="text-gray-500">|</span>}
                <button
                  type="button"
                  onClick={(e) => handleNav(item.key, e)}
                  className={linkClass(item)}
                  title={item.key === 'admin' ? '관리자' : undefined}
                >
                  {item.label}
                </button>
              </span>
            ))}
          </nav>
        </div>

        {/* 데스크톱: 가로 배치 */}
        <div className="hidden md:block text-left">
          <h3 className="text-lg font-bold text-white mb-3">{data.companyName}</h3>
          <p className="text-sm text-gray-300 mb-1">{data.address}</p>
          <p className="text-sm text-gray-300 mb-1">
            대표 {data.representative} | 사업자등록번호 {data.businessNumber}
            <a
              href={FTC_BIZ_POPUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1.5 text-white underline hover:text-white/90"
            >
              [사업자 정보 확인]
            </a>
          </p>
          {data.salesReportNumber && <p className="text-xs text-gray-400 mb-2">{data.salesReportNumber}</p>}
          <p className="text-sm text-gray-300 mb-1">
            대표번호{' '}
            <a href={`tel:${data.phone.replace(/\s/g, '')}`} className="text-white font-bold hover:underline">
              {data.phone}
            </a>
            {' '}({data.hours}) | 대표 메일{' '}
            <a href={`mailto:${data.email}`} className="text-white font-bold hover:underline">{data.email}</a>
          </p>
          <p className="text-xs text-gray-400 mb-2">
            호스팅 서비스 제공: {data.hostingProvider}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            © {year} {data.companyName} (BCSA). All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="하단 링크">
            {NAV_ITEMS.map((item, i) => (
              <span key={item.key} className="flex items-center gap-x-2">
                {i > 0 && <span className="text-gray-500">|</span>}
                <button
                  type="button"
                  onClick={(e) => handleNav(item.key, e)}
                  className={linkClass(item)}
                  title={item.key === 'admin' ? '관리자' : undefined}
                >
                  {item.label}
                </button>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
