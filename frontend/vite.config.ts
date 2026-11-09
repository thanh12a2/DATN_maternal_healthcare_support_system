import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const isInsideDocker = process.env.HOST === '0.0.0.0';
const proxyTarget = process.env.VITE_PROXY_TARGET || (isInsideDocker ? 'http://gateway:8000' : 'http://localhost:8080');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
