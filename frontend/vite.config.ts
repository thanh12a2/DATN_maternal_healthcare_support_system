import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const isInsideDocker = process.env.HOST === '0.0.0.0';
const proxyTarget = process.env.VITE_PROXY_TARGET || (isInsideDocker ? 'http://gateway:8000' : 'http://localhost:8080');
const authProxyTarget = process.env.VITE_AUTH_PROXY_TARGET || proxyTarget;
const catalogProxy = process.env.VITE_CATALOG_PROXY_TARGET
  ? {
      '/api/catalog': {
        target: process.env.VITE_CATALOG_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/catalog/, ''),
      },
    }
  : {};
const patientProxy = process.env.VITE_PATIENT_PROXY_TARGET
  ? {
      '/api/patients': {
        target: process.env.VITE_PATIENT_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/patients/, '/patients'),
      },
    }
  : {};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      ...patientProxy,
      ...catalogProxy,
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: authProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      ...patientProxy,
      ...catalogProxy,
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: authProxyTarget,
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
