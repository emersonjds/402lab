import { defineConfig } from 'vitest/config';

// eslint-disable-next-line no-restricted-syntax -- vitest reads this config as a default export
export default defineConfig({
  test: {
    globalSetup: ['./tests/support/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/split-once.ts',
        'src/shared/db/schema.ts',
        'src/shared/db/migrate.ts',
      ],
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
