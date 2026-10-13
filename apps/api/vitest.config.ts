import { defineConfig } from 'vitest/config';

// eslint-disable-next-line no-restricted-syntax -- vitest reads this config as a default export
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Every file truncates the same test database.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/features/allowances/**',
        'src/features/auth/**',
        'src/features/ledger/**',
        'src/features/paid-services/**',
        'src/features/splits/**',
        'src/shared/auth/**',
      ],
      // Live Anthropic and AWS SDK adapters are exercised only by the manual devnet e2e.
      exclude: ['src/features/paid-services/adapters/{anthropic-summary,aws-translate}.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { statements: 94, branches: 82, functions: 95, lines: 96 },
    },
  },
});
