import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api-tcbs': {
        target: 'https://apiextaws.tcbs.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-tcbs/, ''),
        secure: false,
        ws: true,
      },
      '/openapi-tcbs': {
        target: 'https://openapi.tcbs.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openapi-tcbs/, ''),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        }
      },
      '/api': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
