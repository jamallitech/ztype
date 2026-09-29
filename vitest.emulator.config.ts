import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.emulator.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
