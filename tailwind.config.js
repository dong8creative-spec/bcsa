import defaultColors from 'tailwindcss/colors';
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./admin.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      screens: {
        desktop: '1400px',
      },
      fontFamily: {
        // 먼저가본 개편(2026-11): 본문 프리젠테이션, 로고만 원스토어 모바일 고딕 제목체
        sans: ['Presentation', 'SUIT Variable', 'sans-serif'],
        pop: ['Presentation', 'SUIT Variable', 'sans-serif'],
        logo: ['OneStoreMobileGothicTitleFont', 'Presentation', 'sans-serif'],
      },
      colors: {
        // 벤토 리디자인 브랜드 컬러 (기존 #0045a5와 사실상 동일한 블루 — 기존 bg-brand/text-brand 사용처는 영향 없음)
        // 먼저가본 개편: 검정·흰색·하늘·로얄블루
        brand: '#2d4fe0',
        royal: '#2d4fe0',
        royalDark: '#1f3bb8',
        royalOnBlack: '#8fb0ff',
        sky: '#e8f1fd',
        skyLine: '#dce6f3',
        line: '#dddddd',
        line2: '#dcd7d0',
        card: '#f3f5f8',
        accent: '#3b82f6',
        // dark/soft 값을 벤토 톤(ink/bone)에 맞춰 재지정 → 기존 text-dark/bg-soft 쓰는 곳 전부 자동으로 새 톤 적용
        dark: '#0c0c0b',
        // 예전엔 gray 를 한 색으로 덮어 text-gray-500 같은 회색 단계가 만들어지지 않았다(2026-11 개편 때 발견). 기본 회색표 + text-gray(DEFAULT)
        gray: { ...defaultColors.gray, DEFAULT: '#64748b' },
        soft: '#f3f5f8',
        borderLight: '#93c5fd',
        borderLightHover: '#60a5fa',
        // 벤토 리디자인 신규 토큰 (dark/soft와 동일 값의 별칭 + 신규)
        ink: '#0c0c0b',
        sub: '#5b5a56',
        bone: '#f3f5f8',
        mint: '#0e9f6e',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'float': '0 20px 40px -5px rgba(45, 79, 224, 0.25)', 
        'deep-blue': '0 4px 25px rgba(45, 79, 224, 0.15)',
        'deep-blue-hover': '0 15px 35px rgba(45, 79, 224, 0.3)',
        'glass': '0 8px 32px 0 rgba(45, 79, 224, 0.08)',
      },
      animation: {
        'fade-in-down': 'fadeInDown 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'zoom-in': 'zoomIn 0.2s ease-out forwards',
        'scroll-right': 'scrollRight 40s linear infinite',
        'scroll-right-fast': 'scrollRight 20s linear infinite',
        'scroll-left-slow': 'scrollLeft 60s linear infinite',
        'fade-out': 'fadeOut 2s ease-in-out forwards',
        'fade-in-slow': 'fadeInSlow 2s ease-in-out forwards',
        'program-image-fade-in': 'programImageFadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        programImageFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeInSlow: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scrollRight: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scrollLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}




