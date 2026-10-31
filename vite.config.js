import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { publicPartnersPlugin } from './vite-plugins/publicPartners.js';

export default defineConfig({
  plugins: [react(), publicPartnersPlugin()],
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
    host: '127.0.0.1',
    open: true,
  },
  preview: {
    port: 4173,
    // SPA 라우팅을 위한 fallback 설정
    // 모든 경로를 index.html로 리다이렉트
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    // 소스맵은 운영 사이트에 공개하지 않음 (원본 소스 전체 노출 방지)
    sourcemap: false,
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // 자주 바뀌지 않는 라이브러리를 따로 묶어, 사이트를 다시 배포해도 재방문자는 캐시를 그대로 쓴다
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Storage는 업로드할 때만 따로 받도록 묶음에서 뺀다 (src/utils/imageUtils.js 동적 import)
          if (/node_modules\/(@firebase\/storage|firebase\/storage)/.test(id)) return undefined;
          // Firebase는 한 묶음으로 둔다 (두 묶음으로 나누면 서로를 불러오는 순환 구조가 생김)
          if (/node_modules\/(firebase|@firebase|idb)\//.test(id)) return 'vendor-firebase';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
    // 빌드 시 SPA 라우팅을 위한 rollup 플러그인 설정은 불필요
    // Vite가 자동으로 처리함
  },
});



