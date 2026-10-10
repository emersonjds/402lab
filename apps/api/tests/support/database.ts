import { randomUUID } from 'node:crypto';

import pg from 'pg';

import { createDatabase, createPool, type Database } from '../../src/shared/db/pool.js';

export const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://lab:lab@localhost:5432/lab402';

export const TEMPLATE_DATABASE = 'lab402_test_template';

export interface TestDatabase {
  database: Database;
  drop: () => Promise<void>;
}

const urlFor = (name: string): string => {
  const url = new URL(ADMIN_DATABASE_URL);
  url.pathname = `/${name}`;

  return url.toString();
};

/** A disposable database cloned from the migrated template, so no test file can see
 * another file's rows. */
export const createTestDatabase = async (): Promise<TestDatabase> => {
  const name = `lab402_test_${randomUUID().replaceAll('-', '')}`;

  const admin = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`);
  await admin.end();

  const pool = createPool(urlFor(name));

  return {
    database: createDatabase(pool),
    drop: async () => {
      await pool.end();
      const cleanup = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
};
