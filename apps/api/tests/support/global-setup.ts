import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { ADMIN_DATABASE_URL, TEMPLATE_DATABASE } from './database.js';

/** One migrated template database; every test file clones it, which costs a copy
 * instead of a full migration run. */
export const setup = async (): Promise<void> => {
  const admin = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await admin.end();

  const templateUrl = new URL(ADMIN_DATABASE_URL);
  templateUrl.pathname = `/${TEMPLATE_DATABASE}`;

  const pool = new pg.Pool({ connectionString: templateUrl.toString() });
  await migrate(drizzle(pool), {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
  await pool.end();
};
