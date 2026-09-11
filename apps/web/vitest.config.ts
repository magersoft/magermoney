import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { alias } from './vite.alias';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias },
  test: { environment: 'happy-dom', include: ['test/**/*.test.ts'] },
});
