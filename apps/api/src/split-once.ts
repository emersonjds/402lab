import { explorerTxUrl } from '@402lab/shared';

import { catalogFromConfig } from './app.js';
import { listRecentBatches } from './features/splits/repository.js';
import { runSplitRound } from './features/splits/worker.js';
import { loadConfig } from './shared/config/index.js';
import { applyMigrations } from './shared/db/migrate.js';
import { createDatabase, createPool } from './shared/db/pool.js';
import { createEventsBus } from './shared/events-bus.js';
import { createSolanaChain } from './shared/solana/rpc.js';
import { loadTreasurySigner } from './shared/solana/treasury.js';

// Manual devnet smoke: one split round with the real treasury, then the latest batch.
const config = loadConfig();
if (!config.TREASURY_SECRET_KEY) throw new Error('split:once needs TREASURY_SECRET_KEY');

const pool = createPool(config.DATABASE_URL);
const database = createDatabase(pool);

try {
  await applyMigrations(database);
  await runSplitRound({
    db: database,
    chain: createSolanaChain(config.SOLANA_RPC_URL),
    treasury: await loadTreasurySigner(config.TREASURY_SECRET_KEY, config.TREASURY_ADDRESS),
    catalog: catalogFromConfig(config),
    bus: createEventsBus(),
    logger: console,
  });

  const [latest] = await listRecentBatches(database);
  if (!latest) {
    console.log('no split batch yet: no settled payment to distribute');
  } else {
    console.log(latest.status, explorerTxUrl(latest.txSignature));
  }
} finally {
  await pool.end();
}
