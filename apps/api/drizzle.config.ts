import { defineConfig } from 'drizzle-kit';

// eslint-disable-next-line no-restricted-syntax -- drizzle-kit reads this config as a default export
export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://lab:lab@localhost:5432/lab402',
  },
  strict: true,
  verbose: true,
});
