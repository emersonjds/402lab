import { explorerTxUrl } from '@402lab/shared';
import type { FastifyPluginCallback } from 'fastify';

import type { Database } from '../../shared/db/pool.js';
import { errorSchema } from '../../shared/errors.js';
import { listRecentBatches } from './repository.js';
import { splitBatchListResponseSchema, type SplitBatchListResponse } from './schemas.js';

export interface SplitRoutesOptions {
  db: Database;
}

const SECURITY = [{ cookie: [] }, { bearer: [] }];

/** Web only (not in the mobile pairing allowlist): every signed-in owner sees every batch, not
 * just their own payments, since a split batch mixes payouts across owners. */
export const splitRoutes: FastifyPluginCallback<SplitRoutesOptions> = (app, { db }, done) => {
  app.get(
    '/splits',
    {
      schema: {
        tags: ['splits'],
        summary: 'Recent settlement batches sent from the treasury, newest first',
        security: SECURITY,
        response: { 200: splitBatchListResponseSchema, 401: errorSchema, 403: errorSchema },
      },
    },
    async (): Promise<SplitBatchListResponse> => ({
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
    }),
  );

  done();
};
