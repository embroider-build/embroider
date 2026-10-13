import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    include: ['**/*.test.ts'],
    // every test here spawns a real type-checker; the 5s default is not enough
    testTimeout: 60_000,
  },
});
