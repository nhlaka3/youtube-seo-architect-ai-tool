import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        about: resolve(__dirname, 'about.html'),
        privacy: resolve(__dirname, 'privacy-policy.html'),
        terms: resolve(__dirname, 'terms-of-service.html'),
        changelog: resolve(__dirname, 'changelog.html'),
        landing: resolve(__dirname, 'warriorplus-landing.html'),
        redirect: resolve(__dirname, 'redirect.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    },
    chunkSizeWarningLimit: 500,
    minify: 'esbuild'
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5175',
        changeOrigin: true
      }
    }
  }
});
