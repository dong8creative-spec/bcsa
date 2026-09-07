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
        sans: ['SUIT Variable', 'PyeojinGothic', 'sans-serif'],
        pop: ['SUIT Variable', 'PyeojinGothic', 'sans-serif'],
      },
      colors: {
        // 벤토 리디자인 브랜드 컬러 (기존 #0045a5와 사실상 동일한 블루 — 기존 bg-brand/text-brand 사용처는 영향 없음)
        brand: '#0046a5',
        accent: '#3b82f6',
        // dark/soft 값을 벤토 톤(ink/bone)에 맞춰 재지정 → 기존 text-dark/bg-soft 쓰는 곳 전부 자동으로 새 톤 적용
        dark: '#1d1d1f',
        gray: '#64748b',
        soft: '#f5f5f7',
        borderLight: '#93c5fd',
        borderLightHover: '#60a5fa',
        // 벤토 리디자인 신규 토큰 (dark/soft와 동일 값의 별칭 + 신규)
        ink: '#1d1d1f',
        sub: '#6e6e73',
        bone: '#f5f5f7',
        mint: '#0e9f6e',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'float': '0 20px 40px -5px rgba(0, 69, 165, 0.25)', 
        'deep-blue': '0 4px 25px rgba(0, 69, 165, 0.15)',
        'deep-blue-hover': '0 15px 35px rgba(0, 69, 165, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 69, 165, 0.08)',
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




