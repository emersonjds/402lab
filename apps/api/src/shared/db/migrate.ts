import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Database } from './pool.js';

const MIGRATIONS_FOLDER = new URL('../../../drizzle', import.meta.url).pathname;

/** Runs behind an advisory lock, so two instances booting at once cannot apply the
 * same migration twice. */
export const applyMigrations = async (database: Database): Promise<void> => {
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
};
