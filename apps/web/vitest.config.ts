import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// eslint-disable-next-line no-restricted-syntax -- vitest reads this config as a default export
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/api/client.ts',
        'src/shared/api/use-api-query.ts',
        'src/shared/api/use-all-payments.ts',
        'src/shared/api/query-provider.tsx',
        'src/shared/auth/session-context.tsx',
        'src/widgets/payments/payments-table.tsx',
        'src/widgets/allowance-detail/status-header.tsx',
      ],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
});
