import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,ts}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
  },
});
