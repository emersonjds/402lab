import { defineConfig } from 'vitest/config';

// eslint-disable-next-line no-restricted-syntax -- vitest reads this config as a default export
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
