import { formatUsd, type Service, type ServiceId, SOLANA_DEVNET } from '@402lab/shared';
import { paymentMiddleware } from '@x402/fastify';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { errorSchema } from '../../shared/errors.js';
import { registerLedgerHooks, type LedgerDependencies } from '../ledger/hooks.js';
import { type ServiceAdapters, UpstreamError } from './adapters/types.js';
import { invalidInputSchema, serviceInputSchemas, serviceOutputSchema } from './schemas.js';
import { createResourceServer } from './x402.js';

export interface PaidServiceOptions {
  facilitatorUrl: string;
  treasuryAddress: string;
  catalog: Service[];
  adapters: ServiceAdapters;
  ledger: Omit<LedgerDependencies, 'logger'>;
}

/** One `POST /svc/:id` per catalog service, public but gated by `@x402/fastify`'s own HTTP 402
 * handshake (see the per-route description below) rather than by a session. */
export const paidServiceRoutes: FastifyPluginCallback<PaidServiceOptions> = (
  app,
  { facilitatorUrl, treasuryAddress, catalog, adapters, ledger },
  done,
) => {
  const resourceServer = createResourceServer(facilitatorUrl, app.log);
  registerLedgerHooks(resourceServer, { ...ledger, logger: app.log });

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

  /** Validates the body against that service's own input schema, then runs its adapter
   * (live upstream or demo fallback); the x402 handshake already settled payment before this
   * runs. Public to anyone who pays — never checks a session. */
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

  for (const { id, name, description, price } of catalog) {
    app.post(
      `/svc/${id}`,
      {
        config: { public: true },
        schema: {
          tags: ['paid-services'],
          summary: `Pay-per-call ${name} (${formatUsd(price)} USDC via x402)`,
          description:
            `${description} HTTP 402 handshake: a call with no payment answers 402 with a ` +
            'PAYMENT-REQUIRED header describing what to pay; the same call retried with a ' +
            'PAYMENT-SIGNATURE header (X-PAYMENT also accepted) carrying the signed payment ' +
            'settles and answers 200 with a PAYMENT-RESPONSE header (X-PAYMENT-RESPONSE also ' +
            `accepted) carrying the settlement receipt. Example: \`curl -i .../svc/${id}\` -> ` +
            `402 with \`payment-required: <base64 requirements>\`; \`curl -i -H ` +
            `"payment-signature: <base64 signed payment>" .../svc/${id}\` -> 200 with ` +
            '`payment-response: <base64 receipt>`.',
          body: serviceInputSchemas[id],
          response: { 200: serviceOutputSchema, 400: invalidInputSchema, 502: errorSchema },
        },
      },
      serve(id),
    );
  }

  done();
};
