# 메인페이지 섹션 정보

이 문서는 메인페이지의 주요 섹션들의 높이, 컬러, 스타일 정보를 정리한 것입니다.

## 섹션 목록

| 섹션명 | 위치 (라인) | 높이 | 배경색/컬러 | 패딩/마진 | 기타 스타일 정보 |
|--------|-------------|------|-------------|-----------|------------------|
| HERO & SEARCH | 5196-5252 | pt-32 pb-16 (모바일) / mb-40 md:mb-20 (하단 마진) | 배경: 기본 (흰색/투명) | px-4 md:px-6 | 히어로 이미지: h-[500px] md:h-[600px] |
| SEMINAR REVIEWS | 5269-5352 | py-6 (상하 패딩) / mb-20 (하단 마진) | bg-gradient-to-r from-blue-50 to-indigo-50 | border-t border-b border-blue-200/30 | 컨테이너 내부 카드: minWidth 300px, maxWidth 600px |
| STATS | 5354-5369 | py-20 (상하 패딩) | bg-soft/50 | px-6 | 그리드: grid-cols-2 md:grid-cols-4 gap-8 |
| FEATURES | 5357-5368 | py-20 (상하 패딩) | bg-white | px-6 | 이미지 컨테이너: h-[300px] md:h-[500px] |
| ACTIVITIES | 5377-5392 | py-20 (상하 패딩) | 기본 배경 (흰색) | px-6 | 조건부 렌더링: menuEnabled['프로그램'] |
| DONATION | 5400-5413 | py-24 (상하 패딩) | bg-gradient-to-br from-green-50 to-emerald-50 | px-6 | 내부 박스: h-[350px], bg-gradient-to-br from-green-600 to-emerald-600 |
| CTA | 5422-5442 | py-24 (상하 패딩) | 기본 배경 (흰색) | px-6 | 내부 박스: h-[400px], bg-brand |
| Footer | 5533-5576 | py-12 (상하 패딩) | bg-white | px-6 | shadow-[0_-4px_25px_rgba(0,69,165,0.05)] |

## 색상 정보

### 주요 색상 코드

- **Brand Color**: `#0066FF` (blue-600 계열)
- **Soft Background**: `bg-soft` (연한 회색 계열)
- **Hero Gradient**: 투명 (scrolled 시 bg-white/80 backdrop-blur-lg)
- **Review Section**: `from-blue-50 to-indigo-50` (그라데이션)
- **Stats Background**: `bg-soft/50` (반투명 연한 회색)
- **Features Background**: `bg-white` (흰색)
- **Donation Section**: 
  - 외부: `from-green-50 to-emerald-50`
  - 내부 박스: `from-green-600 to-emerald-600`
- **CTA Section**: `bg-brand` (브랜드 컬러)
- **Footer**: `bg-white`

## 세부 스타일 정보

### HERO & SEARCH 섹션
- **패딩**: 상단 `pt-32`, 하단 `pb-16`
- **마진**: 하단 `mb-40` (모바일), `md:mb-20` (데스크톱)
- **히어로 이미지 높이**: `h-[500px]` (모바일), `md:h-[600px]` (데스크톱)
- **검색 박스**: `-mt-10 md:-mt-12` (상단 마진으로 히어로 이미지와 겹침)

### SEMINAR REVIEWS 섹션
- **배경**: 그라데이션 `bg-gradient-to-r from-blue-50 to-indigo-50`
- **테두리**: `border-t border-b border-blue-200/30`
- **패딩**: `py-6`
- **마진**: `mb-20`
- **카드 크기**: `minWidth: 300px, maxWidth: 600px`

### STATS 섹션
- **배경**: `bg-soft/50` (반투명 연한 회색)
- **패딩**: `py-20`
- **그리드**: `grid-cols-2 md:grid-cols-4 gap-8`
- **텍스트 크기**: 숫자 `text-3xl md:text-4xl`, 설명 `text-sm`

### FEATURES 섹션
- **배경**: `bg-white`
- **패딩**: `py-20 px-6`
- **이미지 컨테이너**: `h-[300px] md:h-[500px]`
- **그리드**: `grid-cols-1 md:grid-cols-2 gap-16`

### ACTIVITIES 섹션
- **배경**: 기본 (흰색)
- **패딩**: `py-20 px-6`
- **그리드**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- **카드 높이**: 이미지 영역 `h-64`

### DONATION 섹션
- **외부 배경**: `bg-gradient-to-br from-green-50 to-emerald-50`
- **내부 박스**: 
  - 높이: `h-[350px]`
  - 배경: `bg-gradient-to-br from-green-600 to-emerald-600`
  - 그림자: `shadow-2xl shadow-green-500/40`
- **패딩**: `py-24 px-6`

### CTA 섹션
- **배경**: 기본 (흰색)
- **내부 박스**:
  - 높이: `h-[400px]`
  - 배경: `bg-brand`
  - 그림자: `shadow-2xl shadow-brand/40`
- **패딩**: `py-24 px-6`

### Footer
- **배경**: `bg-white`
- **패딩**: `py-12 px-6`
- **그림자**: `shadow-[0_-4px_25px_rgba(0,69,165,0.05)]`
- **하단 테두리**: `border-t border-brand/5`

## 반응형 디자인

모든 섹션은 다음과 같은 반응형 브레이크포인트를 사용합니다:
- **모바일**: 기본 (640px 미만)
- **태블릿/데스크톱**: `md:` 접두사 (768px 이상)
- **큰 화면**: `lg:` 접두사 (1024px 이상)

## 주의사항

1. 맛집 섹션은 제거되었습니다 (이전 섹션 2).
2. SEMINAR REVIEWS 섹션이 새로운 섹션 2가 되었습니다.
3. 모든 섹션은 조건부 렌더링될 수 있습니다 (menuEnabled 설정에 따라).
4. Footer 메뉴 항목들도 menuEnabled 설정에 따라 동적으로 표시/숨김 처리됩니다.

