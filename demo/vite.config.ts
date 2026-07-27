/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 项目站点部署在子路径下（https://<user>.github.io/MAHJONG-HERO-ACADEMY-DEMO/），
// 故生产构建使用该子路径作为 base；本地开发保持 '/'。
const base = process.env.GITHUB_ACTIONS ? '/MAHJONG-HERO-ACADEMY-DEMO/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
