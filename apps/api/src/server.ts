import { buildApp, catalogFromConfig } from './app.js';
import { startReconciliationJob } from './features/reconciliation/job.js';
import { startSplitWorker } from './features/splits/worker.js';
import { loadConfig } from './shared/config/index.js';
import { applyMigrations } from './shared/db/migrate.js';
import { createDatabase, createPool } from './shared/db/pool.js';
import { createEventsBus } from './shared/events-bus.js';
import { createSolanaChain } from './shared/solana/rpc.js';
import { loadTreasurySigner } from './shared/solana/treasury.js';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const database = createDatabase(pool);
const bus = createEventsBus();

await applyMigrations(database);

const now = () => new Date();
const app = await buildApp({ config, database, bus, now });
const chain = createSolanaChain(config.SOLANA_RPC_URL);

const startWorker = async (): Promise<() => Promise<void>> => {
  if (!config.SPLIT_WORKER_ENABLED) return async () => {};
  if (!config.TREASURY_SECRET_KEY) {
    app.log.warn('split worker off: TREASURY_SECRET_KEY is not set');
    return async () => {};
  }

  return startSplitWorker({
    db: database,
    chain,
    treasury: await loadTreasurySigner(config.TREASURY_SECRET_KEY, config.TREASURY_ADDRESS),
    catalog: catalogFromConfig(config),
    bus,
    logger: app.log,
  });
};

const stopSplitWorker = await startWorker();
const stopReconciliation = config.RECONCILIATION_ENABLED
  ? startReconciliationJob({
      db: database,
      chain,
      treasuryAddress: config.TREASURY_ADDRESS,
      catalog: catalogFromConfig(config),
      bus,
      now,
      logger: app.log,
    })
  : async () => {};

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void Promise.all([stopSplitWorker(), stopReconciliation()])
      .then(() => app.close())
      .then(() => pool.end());
  });
}

await app.listen({ port: config.PORT, host: '0.0.0.0' });
