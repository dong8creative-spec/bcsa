/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./admin.html",
    "./**/*.{html,js}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        pop: ['Poppins', 'sans-serif'],
      },
      colors: {
        brand: '#0045a5', 
        accent: '#3b82f6',
        dark: '#0f172a',
        gray: '#64748b',
        soft: '#f8fafc',
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
      },
      keyframes: {
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



