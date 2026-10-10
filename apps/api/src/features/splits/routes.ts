import { explorerTxUrl } from '@402lab/shared';
import type { FastifyPluginCallback } from 'fastify';

import type { Database } from '../../shared/db/pool.js';
import { listRecentBatches } from './repository.js';
import type { SplitBatchListResponse } from './schemas.js';

export interface SplitRoutesOptions {
  db: Database;
}

// ponytail: public until LAB-3 auth is merged; the merge registers it behind the session guard.
export const splitRoutes: FastifyPluginCallback<SplitRoutesOptions> = (app, { db }, done) => {
  app.get('/splits', async (): Promise<SplitBatchListResponse> => ({
    batches: (await listRecentBatches(db)).map((batch) => ({
      id: batch.id,
      status: batch.status,
      txSignature: batch.txSignature,
      explorerUrl: explorerTxUrl(batch.txSignature),
      createdAt: batch.createdAt.toISOString(),
      payouts: batch.payouts.map(({ recipient, role, amount }) => ({
        recipient,
        role,
        amount: amount.toString(),
      })),
    })),
  }));

  done();
};
