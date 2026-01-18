import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Base 경로 동적 설정
  // - 환경 변수 VITE_BASE_PATH가 설정되어 있으면 해당 값 사용 (GitHub Pages 등)
  // - 없으면 기본값 '/' 사용 (Firebase Hosting 등)
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/' : '/'),
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsDir: 'assets',
    copyPublicDir: true,
  },
});



