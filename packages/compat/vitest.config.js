import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['./tests/*'],
    testTimeout: 15_000
  },
})
