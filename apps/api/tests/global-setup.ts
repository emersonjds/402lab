import pg from 'pg';

import { applyMigrations } from '../src/shared/db/migrate.js';
import { createDatabase, createPool } from '../src/shared/db/pool.js';
import { TEST_DATABASE_URL } from './helpers.js';

/** Creates the test database next to the dev one (same server, `_test` name) and migrates it. */
export const setup = async (): Promise<void> => {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [name]);
  if (rowCount === 0) await admin.query(`create database "${name}"`);
  await admin.end();

  const pool = createPool(TEST_DATABASE_URL);
  await applyMigrations(createDatabase(pool));
  await pool.end();
};
