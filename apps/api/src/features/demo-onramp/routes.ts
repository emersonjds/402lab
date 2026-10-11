import {
  atomicStringSchema,
  computeSplit,
  type Service,
  SOLANA_DEVNET,
  USDC_DEVNET_MINT,
} from '@402lab/shared';
import { address, type KeyPairSigner } from '@solana/kit';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { callerOf } from '../../shared/auth/authenticate.js';
import type { Database } from '../../shared/db/pool.js';
import { AppError, errorSchema } from '../../shared/errors.js';
import { solanaAddressSchema } from '../../shared/schemas.js';
import type { DevnetChain } from '../../shared/solana/rpc.js';
import { findAllowanceBySession } from '../allowances/repository.js';
import { buildSplitTransaction } from '../splits/transaction.js';
import {
  findUnsplitPayments,
  onrampUsageSince,
  recordOnramp,
  withOnrampLock,
} from './repository.js';

/** US$5 per top-up. */
export const MAX_ONRAMP_AMOUNT = 5_000_000n;
/** US$10 per owner per UTC day, across all session wallets. */
export const MAX_ONRAMP_PER_OWNER_PER_DAY = 10_000_000n;
const TOP_UPS_PER_MINUTE = 3;

/** The on-ramp mints nothing: it only exists where the treasury holds faucet USDC. */
export const isDevnetRpc = (url: string): boolean => new URL(url).hostname.includes('devnet');

/** CAIP-2 names a cluster by the first 32 characters of its genesis hash. */
export const isDevnetGenesis = (genesisHash: string): boolean =>
  genesisHash.slice(0, 32) === SOLANA_DEVNET.split(':')[1];

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

export type OnrampChain = Pick<
  DevnetChain,
  'latestBlockhash' | 'send' | 'genesisHash' | 'usdcBalance'
>;

export interface OnrampOptions {
  db: Database;
  chain: OnrampChain;
  treasury: KeyPairSigner;
  catalog: readonly Service[];
  now: () => Date;
}

const startOfUtcDay = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** What the split worker still has to send out of the treasury: provider and integrator shares. */
const owedToRecipients = (
  unsplit: readonly { serviceId: string; amount: bigint }[],
  catalog: readonly Service[],
): bigint =>
  unsplit.reduce((total, payment) => {
    const service = catalog.find(({ id }) => id === payment.serviceId);
    if (!service) return total;

    return computeSplit(payment.amount, service.splits)
      .filter(({ role }) => role !== 'platform')
      .reduce((sum, line) => sum + line.amount, total);
  }, 0n);

/** RPC failures reach the client as a fixed code, never the RPC text. */
const viaRpc = async <Result>(request: FastifyRequest, call: () => Promise<Result>) => {
  try {
    return await call();
  } catch (error) {
    request.log.warn({ err: error }, 'onramp refused by the RPC');
    throw new AppError(502, 'onramp_unavailable');
  }
};

/** Devnet-only demo faucet; `app.ts` registers it only when the configured RPC answers with the
 * devnet genesis hash and a treasury key is set, so it is simply absent on any other cluster. */
export const onrampRoutes: FastifyPluginCallbackZod<OnrampOptions> = (
  app,
  { db, chain, treasury, catalog, now },
  done,
) => {
  /** Web or mobile. 404 when the session wallet's allowance belongs to another owner; 429 past
   * one top-up per wallet per UTC day or past the owner's daily cap. */
  app.post(
    '/onramp/simulate',
    {
      config: {
        rateLimit: {
          max: TOP_UPS_PER_MINUTE,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (request) => callerOf(request).address,
        },
      },
      schema: {
        tags: ['onramp'],
        summary:
          'Simulated top-up (devnet only): the treasury sends USDC to a session wallet; US$10 per owner and one top-up per wallet per UTC day',
        security: [{ cookie: [] }, { bearer: [] }],
        body: simulateBodySchema,
        response: {
          200: simulatedSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
          429: errorSchema,
          502: errorSchema,
        },
      },
    },
    async (request) => {
      const { sessionAddress, amount } = request.body;
      const ownerAddress = callerOf(request).address;
      const allowance = await findAllowanceBySession(db, sessionAddress);
      if (allowance?.ownerAddress !== ownerAddress) throw AppError.notFound();

      return withOnrampLock(db, async (transaction) => {
        const toppedUpAt = now();
        const usage = await onrampUsageSince(transaction, {
          ownerAddress,
          sessionAddress,
          since: startOfUtcDay(toppedUpAt),
        });
        if (usage.sessionCount > 0 || usage.ownerTotal + amount > MAX_ONRAMP_PER_OWNER_PER_DAY) {
          throw new AppError(429, 'onramp_limit_reached');
        }

        const owed = owedToRecipients(await findUnsplitPayments(transaction), catalog);
        const balance = await viaRpc(request, () => chain.usdcBalance(treasury.address));
        if (balance - amount < owed) throw new AppError(409, 'onramp_unavailable');

        const signature = await viaRpc(request, async () => {
          // A one-line split: create the session ATA if missing, then TransferChecked from the treasury.
          const built = await buildSplitTransaction({
            treasury,
            payouts: [{ recipient: sessionAddress, role: 'provider', amount }],
            mint: address(USDC_DEVNET_MINT),
            latestBlockhash: await chain.latestBlockhash(),
          });
          await chain.send(built.signedTransaction);
          return built.signature;
        });

        await recordOnramp(transaction, {
          signature,
          ownerAddress,
          sessionAddress,
          amount,
          createdAt: toppedUpAt,
        });

        return { signature };
      });
    },
  );

  done();
};
