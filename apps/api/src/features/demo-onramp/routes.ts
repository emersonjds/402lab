import { atomicStringSchema, USDC_DEVNET_MINT } from '@402lab/shared';
import { address, type KeyPairSigner } from '@solana/kit';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { callerOf } from '../../shared/auth/authenticate.js';
import type { Database } from '../../shared/db/pool.js';
import { AppError, errorSchema } from '../../shared/errors.js';
import { solanaAddressSchema } from '../../shared/schemas.js';
import type { SolanaChain } from '../../shared/solana/rpc.js';
import { findAllowanceBySession } from '../allowances/repository.js';
import { buildSplitTransaction } from '../splits/transaction.js';

/** US$5 per top-up. */
export const MAX_ONRAMP_AMOUNT = 5_000_000n;

/** The on-ramp mints nothing: it only exists where the treasury holds faucet USDC. */
export const isDevnetRpc = (url: string): boolean => new URL(url).hostname.includes('devnet');

const simulateBodySchema = z
  .object({
    sessionAddress: solanaAddressSchema,
    amount: atomicStringSchema
      .max(18)
      .meta({ example: '1000000' })
      .transform((value) => BigInt(value))
      .pipe(z.bigint().positive().max(MAX_ONRAMP_AMOUNT)),
  })
  .meta({ id: 'OnrampSimulation' });

const simulatedSchema = z.object({ signature: z.string() }).meta({ id: 'OnrampTransfer' });

export type OnrampChain = Pick<SolanaChain, 'latestBlockhash' | 'send'>;

export interface OnrampOptions {
  db: Database;
  chain: OnrampChain;
  treasury: KeyPairSigner;
}

export const onrampRoutes: FastifyPluginCallbackZod<OnrampOptions> = (
  app,
  { db, chain, treasury },
  done,
) => {
  app.post(
    '/onramp/simulate',
    {
      schema: {
        tags: ['onramp'],
        summary: 'Simulated top-up (devnet only): the treasury sends USDC to a session wallet',
        security: [{ cookie: [] }, { bearer: [] }],
        body: simulateBodySchema,
        response: {
          200: simulatedSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          502: errorSchema,
        },
      },
    },
    async (request) => {
      const { sessionAddress, amount } = request.body;
      const allowance = await findAllowanceBySession(db, sessionAddress);
      if (allowance?.ownerAddress !== callerOf(request).address) throw AppError.notFound();

      try {
        // A one-line split: create the session ATA if missing, then TransferChecked from the treasury.
        const { signedTransaction, signature } = await buildSplitTransaction({
          treasury,
          payouts: [{ recipient: sessionAddress, role: 'provider', amount }],
          mint: address(USDC_DEVNET_MINT),
          latestBlockhash: await chain.latestBlockhash(),
        });
        await chain.send(signedTransaction);

        return { signature };
      } catch (error) {
        request.log.warn({ err: error }, 'onramp transfer refused by the RPC');
        throw new AppError(502, 'onramp_unavailable');
      }
    },
  );

  done();
};
