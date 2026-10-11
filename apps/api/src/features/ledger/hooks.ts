import { setTimeout as sleep } from 'node:timers/promises';

import { evaluateAllowancePolicy, serviceIdSchema } from '@402lab/shared';
import type { x402ResourceServer } from '@x402/core/server';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

import type { Database } from '../../shared/db/pool.js';
import type { AllowanceRow } from '../../shared/db/schema.js';
import type { EventsBus } from '../../shared/events-bus.js';
import { findAllowanceBySession } from '../allowances/repository.js';
import { recordPayment, type RecordPaymentInput, spentToday } from './repository.js';

export type LedgerDependencies = {
  db: Database;
  bus: EventsBus;
  now: () => Date;
  logger: Pick<FastifyBaseLogger, 'error'>;
};

type VerifiedPayment = {
  payer: string;
  serviceId: string | undefined;
  price: bigint;
  allowance: AllowanceRow | undefined;
};

const POLICY_UNAVAILABLE = { abort: true, reason: 'policy_unavailable' } as const;
const ALLOWANCE_PAUSED = { abort: true, reason: 'allowance_paused' } as const;
const RECORD_RETRY_DELAYS_MS = [100, 300];

/** Verify carries `routePattern` (the catalog route, even for a percent-encoded URL); settle only `decodedPath`. */
const transportSchema = z.object({
  request: z.object({ routePattern: z.string().optional(), decodedPath: z.string() }),
});

const serviceIdOf = (transportContext: unknown): string | undefined => {
  const parsed = transportSchema.safeParse(transportContext);
  if (!parsed.success) return undefined;

  const { routePattern, decodedPath } = parsed.data.request;
  return (routePattern ?? decodedPath).replace(/^\/svc\//, '');
};

const recordWithRetry = async (db: Database, input: RecordPaymentInput) => {
  for (const delay of RECORD_RETRY_DELAYS_MS) {
    try {
      return await recordPayment(db, input);
    } catch {
      await sleep(delay);
    }
  }

  return recordPayment(db, input);
};

/** Wires the x402 resource server's verify/settle lifecycle to the allowance policy and the
 * payments ledger: a policy refusal aborts the payment before the facilitator ever settles it,
 * and a settled payment is recorded and published as a `payment.settled` live event. */
export const registerLedgerHooks = (
  resourceServer: x402ResourceServer,
  { db, bus, now, logger }: LedgerDependencies,
): void => {
  // ponytail: reservations and locks live in this process, so the daily cap holds for one API
  // instance and a reservation never expires. Upgrade: pg_advisory_xact_lock per allowance plus a
  // reservations table with expiry.
  const verified = new WeakMap<object, VerifiedPayment>();
  const reservedByAllowance = new Map<string, bigint>();
  const locks = new Map<string, Promise<unknown>>();

  const withAllowanceLock = async <T>(allowanceId: string, task: () => Promise<T>): Promise<T> => {
    const run = (locks.get(allowanceId) ?? Promise.resolve()).then(task);
    const done = run.catch(() => undefined);
    locks.set(allowanceId, done);
    try {
      return await run;
    } finally {
      if (locks.get(allowanceId) === done) locks.delete(allowanceId);
    }
  };

  /** Idempotent: the payload keys at most one reservation. */
  const release = (paymentPayload: object): VerifiedPayment | undefined => {
    const payment = verified.get(paymentPayload);
    verified.delete(paymentPayload);
    if (!payment?.allowance) return payment;

    const { id } = payment.allowance;
    const left = (reservedByAllowance.get(id) ?? 0n) - payment.price;
    if (left > 0n) reservedByAllowance.set(id, left);
    else reservedByAllowance.delete(id);
    return payment;
  };

  // x402 swallows a throwing hook and lets the payment through, so every failure here aborts.
  resourceServer.onAfterVerify(
    async ({ result, requirements, paymentPayload, transportContext }) => {
      try {
        if (!result.isValid) return;

        const payer = z.string().parse(result.payer);
        const allowance = await findAllowanceBySession(db, payer);
        const payment: VerifiedPayment = {
          payer,
          serviceId: serviceIdOf(transportContext),
          price: BigInt(requirements.amount),
          allowance,
        };
        if (!allowance) {
          verified.set(paymentPayload, payment);
          return;
        }

        return await withAllowanceLock(allowance.id, async () => {
          const committed = await spentToday(db, allowance.id, now());
          const reserved = reservedByAllowance.get(allowance.id) ?? 0n;
          const spent = committed + reserved;
          const decision = evaluateAllowancePolicy(allowance, payment.price, spent);

          if (decision.allowed) {
            reservedByAllowance.set(allowance.id, reserved + payment.price);
            verified.set(paymentPayload, payment);
            return undefined;
          }

          if (decision.reason === 'daily_cap_exceeded') {
            bus.publish(allowance.ownerAddress, {
              type: 'allowance.cap_reached',
              allowanceId: allowance.id,
              price: payment.price.toString(),
              spentToday: spent.toString(),
              dailyCap: allowance.dailyCap.toString(),
            });
          }

          return { abort: true, reason: decision.reason } as const;
        });
      } catch (error) {
        logger.error({ err: error }, 'allowance policy unavailable, payment refused');
        return POLICY_UNAVAILABLE;
      }
    },
  );

  resourceServer.onBeforeSettle(async ({ paymentPayload }) => {
    const allowance = verified.get(paymentPayload)?.allowance;
    if (!allowance) return;

    return withAllowanceLock(allowance.id, async () => {
      try {
        const current = await findAllowanceBySession(db, allowance.sessionAddress);
        if (current?.status === 'active') return undefined;

        release(paymentPayload);
        return ALLOWANCE_PAUSED;
      } catch (error) {
        logger.error({ err: error }, 'allowance policy unavailable, settlement aborted');
        release(paymentPayload);
        return POLICY_UNAVAILABLE;
      }
    });
  });

  resourceServer.onAfterSettle(
    async ({ paymentPayload, requirements, result, transportContext }) => {
      const payment = verified.get(paymentPayload);
      const allowance = payment?.allowance;
      const settled = {
        txSignature: result.transaction,
        payer: payment?.payer ?? result.payer,
        amount: requirements.amount,
        serviceId: payment?.serviceId ?? serviceIdOf(transportContext),
      };

      const record = async () => {
        try {
          const serviceId = serviceIdSchema.parse(settled.serviceId);
          const recorded = await recordWithRetry(db, {
            serviceId,
            payerAddress: z.string().parse(settled.payer),
            allowanceId: allowance?.id ?? null,
            amount: BigInt(settled.amount),
            txSignature: settled.txSignature,
            settledAt: now(),
          });
          if (recorded === 'duplicate') return;

          bus.publish(allowance?.ownerAddress ?? null, {
            type: 'payment.settled',
            paymentId: recorded.id,
            serviceId,
            allowanceId: recorded.allowanceId,
            amount: recorded.amount.toString(),
            txSignature: recorded.txSignature,
            settledAt: recorded.settledAt.toISOString(),
          });
        } catch (error) {
          logger.error({ err: error, ...settled }, 'settled_payment_not_recorded');
        } finally {
          release(paymentPayload);
        }
      };

      await (allowance ? withAllowanceLock(allowance.id, record) : record());
    },
  );

  resourceServer.onSettleFailure(({ paymentPayload, requirements, error }) => {
    const payment = release(paymentPayload);
    logger.error(
      {
        err: error,
        payer: payment?.payer,
        serviceId: payment?.serviceId,
        amount: requirements.amount,
      },
      'payment_settle_failed',
    );
    return Promise.resolve();
  });

  resourceServer.onVerifiedPaymentCanceled(({ paymentPayload }) => {
    release(paymentPayload);
    return Promise.resolve();
  });
};
