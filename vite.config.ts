import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/maintenance-management-demo/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // production 빌드: Terser로 강한 난독화 / dev 빌드: esbuild 유지
    minify: mode === 'production' ? 'terser' : 'esbuild',
    terserOptions: {
      compress: {
        // production에서 console.* / debugger 완전 제거
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        // 도달 불가능한 코드 제거, 2회 압축 패스
        dead_code: true,
        passes: 2,
        // 조건식 단순화
        conditionals: true,
        evaluate: true,
        booleans: true,
        // 미사용 변수 제거
        unused: true,
      },
      mangle: {
        // 최상위 레벨 변수·함수명 난독화
        toplevel: true,
        // Safari 관련 버그 우회 비활성화 (불필요)
        safari10: false,
      },
      format: {
        // 주석 전부 제거
        comments: false,
        // 라이선스 주석도 제거
        preserve_annotations: false,
      },
    },
    // 소스맵 비활성화 — 브라우저 개발자 도구로 원본 코드 역추적 방지
    sourcemap: false,
    rollupOptions: {
      output: {
        // 청크 파일명에 해시 포함 (캐시 버스팅 + 파일명 예측 방지)
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-hot-toast', '@headlessui/react'],
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-i18n': ['i18next', 'i18next-browser-languagedetector', 'react-i18next'],
          'vendor-state': ['zustand', '@tanstack/react-query'],
          'vendor-xlsx': ['xlsx', 'xlsx-js-style', 'jszip'],
          'vendor-exceljs': ['exceljs'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-grid': ['hyperformula'],
          'vendor-misc': ['jquery', 'date-fns', 'react-daum-postcode'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}))