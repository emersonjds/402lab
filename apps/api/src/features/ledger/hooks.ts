import { evaluateAllowancePolicy, serviceIdSchema } from '@402lab/shared';
import type { x402ResourceServer } from '@x402/core/server';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

import type { Database } from '../../shared/db/pool.js';
import type { EventsBus } from '../../shared/events-bus.js';
import { findAllowanceBySession } from '../allowances/repository.js';
import { recordPayment, spentToday } from './repository.js';

export type LedgerDependencies = {
  db: Database;
  bus: EventsBus;
  now: () => Date;
  logger: Pick<FastifyBaseLogger, 'error'>;
};

const POLICY_UNAVAILABLE = { abort: true, reason: 'policy_unavailable' } as const;

/** On settle the x402 request context carries `path` but no `routePattern`. */
const settledPaymentSchema = z.object({
  result: z.object({ payer: z.string(), transaction: z.string() }),
  transportContext: z.object({
    request: z.object({
      path: z
        .string()
        .transform((path) => path.replace(/^\/svc\//, ''))
        .pipe(serviceIdSchema),
    }),
  }),
});

export const registerLedgerHooks = (
  resourceServer: x402ResourceServer,
  { db, bus, now, logger }: LedgerDependencies,
): void => {
  // x402 swallows a throwing hook and lets the payment through, so every failure here aborts.
  resourceServer.onAfterVerify(async ({ result, requirements }) => {
    try {
      if (!result.isValid) return;

      const allowance = await findAllowanceBySession(db, z.string().parse(result.payer));
      if (!allowance) return;

      const price = BigInt(requirements.amount);
      const spent = await spentToday(db, allowance.id, now());
      const decision = evaluateAllowancePolicy(allowance, price, spent);
      if (decision.allowed) return;

      if (decision.reason === 'daily_cap_exceeded') {
        bus.publish(allowance.ownerAddress, {
          type: 'allowance.cap_reached',
          allowanceId: allowance.id,
          price: price.toString(),
          spentToday: spent.toString(),
          dailyCap: allowance.dailyCap.toString(),
        });
      }

      return { abort: true, reason: decision.reason };
    } catch (error) {
      logger.error({ err: error }, 'allowance policy unavailable, payment refused');
      return POLICY_UNAVAILABLE;
    }
  });

  resourceServer.onAfterSettle(async (context) => {
    try {
      const {
        result: { payer, transaction },
        transportContext,
      } = settledPaymentSchema.parse(context);
      const serviceId = transportContext.request.path;
      const allowance = await findAllowanceBySession(db, payer);

      const payment = await recordPayment(db, {
        serviceId,
        payerAddress: payer,
        allowanceId: allowance?.id ?? null,
        amount: BigInt(context.requirements.amount),
        txSignature: transaction,
        settledAt: now(),
      });
      if (payment === 'duplicate') return;

      bus.publish(allowance?.ownerAddress ?? null, {
        type: 'payment.settled',
        paymentId: payment.id,
        serviceId,
        allowanceId: payment.allowanceId,
        amount: payment.amount.toString(),
        txSignature: payment.txSignature,
        settledAt: payment.settledAt.toISOString(),
      });
    } catch (error) {
      logger.error(
        { err: error, transaction: context.result.transaction },
        'payment settled but not recorded in the ledger',
      );
    }
  });
};
