import React from 'react';

/**
 * AdSlot — 광고 슬롯 컴포넌트
 *
 * 목업(bcsa_bento)에는 실제 광고가 들어갈 자리를 표시하는 빨간 점선 placeholder가
 * 있었지만("광고 A/B/C · ... · N원/일"), 이는 디자인 시안용일 뿐 실제 방문자에게
 * 보여져서는 안 된다. 이 컴포넌트는 그 자리를 실제 코드로 대체한 것으로,
 * `content.ad_<slotId>_image` 필드가 채워져 있을 때만(= 실제 광고 소재가 등록된 이후)
 * 렌더링되고, 그 전까지는 완전히 아무것도 렌더링하지 않는다(빈 공간도 차지하지 않음).
 *
 * 광고 소재 등록은 향후 관리자 페이지 개편(4단계 계획 중 3단계) 시
 * ContentManagement 또는 별도 광고관리 화면에서 `content` 문서에
 * 아래 필드를 채워 넣는 방식으로 연결할 예정:
 *   - ad_<slotId>_image : 광고 이미지 URL (필수 — 없으면 렌더링 안 함)
 *   - ad_<slotId>_link  : 클릭 시 이동할 URL (선택, 없으면 '#')
 *   - ad_<slotId>_label : 스크린리더/광고 표시용 대체 텍스트 (선택)
 *
 * 목업에 정의된 슬롯 목록(참고용):
 *   - home-bento-divider : 홈 벤토 그리드 상/하단 사이 풀너비 배너 (1200×90, 모바일 320×80)
 *   - support-top-banner : 지원사업 페이지 상단 배너 (1160×80)
 *   - news-list-native   : 뉴스 리스트 내 네이티브 배너 (1160×72)
 *
 * 우측 배너 광고 레일 (목업에는 없던 신규 슬롯, 구글 표준 사이드바 광고 규격 기준, 전체 폭 300px):
 *   - news-sidebar-1     : 160×600 Wide Skyscraper — 레일 상단, sticky(스크롤 고정) 적용
 *   - news-sidebar-1b    : 120×600 Skyscraper — sidebar-1 옆 남는 폭(140px)에 배치, sticky 아님
 *   - news-sidebar-2     : 300×250 Medium Rectangle — 레일 하단, 일반 흐름
 *   - support-sidebar-1/1b/2 : 지원사업 페이지도 동일 구성
 *   (구글 sticky 광고 정책상 "한 번에 하나의 sticky 광고만" 허용되어, 두 스카이스크래퍼 중
 *    1(160×600)만 sticky로 두고 1b(120×600)와 2(300×250)는 일반 스크롤 흐름에 둔다.
 *    xl(1280px) 미만 화면에서는 본문 폭 확보를 위해 레일 전체가 숨김 처리된다.)
 *
 * @param {string} slotId - 광고 슬롯 식별자 (위 목록 참고)
 * @param {object} content - 사이트 콘텐츠 객체 (App.jsx의 content state)
 * @param {string} [className] - 래퍼에 추가할 클래스
 * @param {boolean} [showPlaceholder] - true면 실제 소재 등록 전에도 자리 확인용 점선 박스를 보여준다.
 *   레이아웃/사이즈 검토 단계에서만 켜두는 값 — 정식 오픈 전에는 반드시 false로 되돌리거나
 *   실제 광고 소재를 등록해서 이 분기 자체가 타지 않도록 해야 한다(방문자에게 빈 광고 박스를
 *   보여주지 않기 위함).
 * @param {string} [placeholderSize] - 점선 박스에 표시할 권장 소재 규격 텍스트 (예: '300×250')
 */
/**
 * hasAdSlot — 특정 슬롯에 실제 광고 소재(이미지)가 등록되어 있는지 여부.
 * 사이드바처럼 "광고가 하나도 없으면 레일 자체를 접고 본문 폭을 넓힌다" 같은
 * 레이아웃 분기에 사용한다(플레이스홀더 표시 여부와는 무관 — 실제 소재 기준).
 */
export function hasAdSlot(content, slotId) {
    return Boolean(content?.[`ad_${slotId}_image`]);
}

export default function AdSlot({ slotId, content, className = '', showPlaceholder = false, placeholderSize = '' }) {
    const imageUrl = content?.[`ad_${slotId}_image`];

    if (!imageUrl) {
        if (!showPlaceholder) return null;
        return (
            <div className={className} data-ad-slot={slotId} data-ad-placeholder="true">
                <div className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-red-400 bg-red-500/5">
                    <span className="text-red-500 text-[11px] font-bold text-center px-3 leading-relaxed">
                        광고 자리 · {slotId}
                        {placeholderSize ? <><br />{placeholderSize}</> : null}
                    </span>
                </div>
            </div>
        );
    }

    const linkUrl = content?.[`ad_${slotId}_link`] || '#';
    const label = content?.[`ad_${slotId}_label`] || '광고';

    return (
        <div className={className} data-ad-slot={slotId}>
            <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="block w-full overflow-hidden rounded-2xl"
                aria-label={label}
            >
                <img
                    src={imageUrl}
                    alt={label}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                    decoding="async"
                />
            </a>
        </div>
    );
}
