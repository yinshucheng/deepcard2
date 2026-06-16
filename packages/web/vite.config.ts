import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// 端口可由 env 注入，支持多 worktree 并行（见 scripts/wt.sh）：
//   VITE_DEV_PORT  前端 vite 端口（默认 5173）
//   VITE_API_PORT  后端 wrangler 端口，proxy /api 指向它（默认 8787）
const DEV_PORT = Number(process.env.VITE_DEV_PORT) || 5173;
const API_PORT = Number(process.env.VITE_API_PORT) || 8787;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: DEV_PORT,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
