import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  resolve: {
    // Prefer source even when compiled files exists (vi.mock can't intercept)
    extensions: ['.ts', '.js'],
  },
  test: {
    include: ['**/*.test.ts'],
  },
});
