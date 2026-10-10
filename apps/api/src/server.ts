import { buildApp } from './app.js';
import { loadConfig } from './shared/config/index.js';
import { applyMigrations } from './shared/db/migrate.js';
import { createDatabase, createPool } from './shared/db/pool.js';
import { createEventsBus } from './shared/events-bus.js';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const database = createDatabase(pool);

await applyMigrations(database);

const app = await buildApp({
  config,
  database,
  bus: createEventsBus(),
  now: () => new Date(),
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void app.close().then(() => pool.end());
  });
}

await app.listen({ port: config.PORT, host: '0.0.0.0' });
