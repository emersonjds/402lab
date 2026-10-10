import { SOLANA_DEVNET } from '@402lab/shared';
import { paymentMiddleware } from '@x402/fastify';
import type { FastifyPluginCallback } from 'fastify';

import { registerLedgerHooks, type LedgerDependencies } from '../ledger/hooks.js';
import { createResourceServer } from './x402.js';

export interface PaidServiceOptions {
  facilitatorUrl: string;
  treasuryAddress: string;
  ledger: Omit<LedgerDependencies, 'logger'>;
}

export const paidServiceRoutes: FastifyPluginCallback<PaidServiceOptions> = (
  app,
  { facilitatorUrl, treasuryAddress, ledger },
  done,
) => {
  const resourceServer = createResourceServer(facilitatorUrl);
  registerLedgerHooks(resourceServer, { ...ledger, logger: app.log });

  paymentMiddleware(
    app,
    {
      'GET /svc/echo': {
        accepts: [
          { scheme: 'exact', price: '$0.001', network: SOLANA_DEVNET, payTo: treasuryAddress },
        ],
        description: 'spike',
      },
    },
    resourceServer,
  );

  app.get('/svc/echo', () => ({ ok: true }));

  done();
};
