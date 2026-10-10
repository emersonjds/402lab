import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const MAX_CONNECTIONS = 10;
const CONNECTION_TIMEOUT_MS = 5_000;
/** Above the slowest aggregation and below the request timeout, so a stuck query
 * gives its connection back instead of starving the pool. */
const STATEMENT_TIMEOUT_MS = 10_000;

export type Database = ReturnType<typeof createDatabase>;

export const createPool = (connectionString: string): pg.Pool =>
  new pg.Pool({
    connectionString,
    max: MAX_CONNECTIONS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });

export const createDatabase = (pool: pg.Pool) => drizzle(pool, { schema });
