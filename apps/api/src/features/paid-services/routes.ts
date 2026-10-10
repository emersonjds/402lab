import { SOLANA_DEVNET } from '@402lab/shared';
import { paymentMiddleware } from '@x402/fastify';
import type { FastifyPluginCallback } from 'fastify';

import { createResourceServer } from './x402.js';

export interface PaidServiceOptions {
  facilitatorUrl: string;
  treasuryAddress: string;
}

export const paidServiceRoutes: FastifyPluginCallback<PaidServiceOptions> = (
  app,
  { facilitatorUrl, treasuryAddress },
  done,
) => {
  const resourceServer = createResourceServer(facilitatorUrl)
    .onAfterVerify(({ result, requirements }) => {
      app.log.info({ result, amount: requirements.amount }, 'x402 payment verified');
      return Promise.resolve();
    })
    .onAfterSettle(({ result, requirements }) => {
      app.log.info({ result, amount: requirements.amount }, 'x402 payment settled');
      return Promise.resolve();
    });

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
