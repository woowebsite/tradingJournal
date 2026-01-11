import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api-tcbs': {
        target: 'https://apiextaws.tcbs.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-tcbs/, ''),
        secure: false,
      },
    },
  },
})
