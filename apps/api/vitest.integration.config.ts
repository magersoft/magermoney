import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts', '../../supabase/test/**/*.test.ts'],
    testTimeout: 20000,
  },
});
