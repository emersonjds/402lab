import { formatUsd, type Service, type ServiceId, SOLANA_DEVNET } from '@402lab/shared';
import { paymentMiddleware } from '@x402/fastify';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { type ServiceAdapters, UpstreamError } from './adapters/types.js';
import { serviceInputSchemas } from './schemas.js';
import { createResourceServer } from './x402.js';

export interface PaidServiceOptions {
  facilitatorUrl: string;
  treasuryAddress: string;
  catalog: Service[];
  adapters: ServiceAdapters;
}

export const paidServiceRoutes: FastifyPluginCallback<PaidServiceOptions> = (
  app,
  { facilitatorUrl, treasuryAddress, catalog, adapters },
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
    Object.fromEntries(
      catalog.map((service) => [
        `POST /svc/${service.id}`,
        {
          accepts: [
            {
              scheme: 'exact',
              price: formatUsd(service.price),
              network: SOLANA_DEVNET,
              payTo: treasuryAddress,
            },
          ],
          description: service.description,
          mimeType: 'application/json',
        },
      ]),
    ),
    resourceServer,
  );

  const serve =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Id ties each schema to its own adapter
    <Id extends ServiceId>(id: Id) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        const input = serviceInputSchemas[id].safeParse(request.body);

        if (!input.success) {
          return reply
            .code(400)
            .send({ error: 'invalid_input', issues: z.flattenError(input.error).fieldErrors });
        }

        try {
          return await adapters[id](input.data);
        } catch (error) {
          if (!(error instanceof UpstreamError)) {
            throw error;
          }

          request.log.warn({ err: error }, 'upstream unavailable');
          return reply.code(502).send({ error: 'upstream_unavailable' });
        }
      };

  for (const { id } of catalog) {
    app.post(`/svc/${id}`, serve(id));
  }

  done();
};
