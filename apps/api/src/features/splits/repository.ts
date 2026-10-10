import { randomUUID } from 'node:crypto';

import type { PayoutLine } from '@402lab/shared';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { allowances, payments, payouts, splitBatches } from '../../shared/db/schema.js';

export type SplitBatchRow = typeof splitBatches.$inferSelect;

// ponytail: caps the IN list of one batch; the rest waits for the next round.
const MAX_PAYMENTS_PER_BATCH = 1_000;
const LISTED_BATCHES = 50;

export const findPendingBatches = (db: Database): Promise<SplitBatchRow[]> =>
  db.select().from(splitBatches).where(eq(splitBatches.status, 'pending'));

/** Payments of a batch made outside any allowance have no owner to notify. */
export const findBatchOwners = async (db: Database, batchId: string): Promise<string[]> => {
  const owners = await db
    .selectDistinct({ ownerAddress: allowances.ownerAddress })
    .from(payments)
    .innerJoin(allowances, eq(payments.allowanceId, allowances.id))
    .where(eq(payments.splitBatchId, batchId));

  return owners.map(({ ownerAddress }) => ownerAddress);
};

const isPending = (batchId: string) =>
  and(eq(splitBatches.id, batchId), eq(splitBatches.status, 'pending'));

/** True only when this call moved the batch out of pending. */
export const confirmBatch = async (db: Database, batchId: string): Promise<boolean> => {
  const confirmed = await db
    .update(splitBatches)
    .set({ status: 'confirmed' })
    .where(isPending(batchId))
    .returning({ id: splitBatches.id });

  return confirmed.length > 0;
};

/** True only when this call moved the batch out of pending; payments are released only then. */
export const failBatchAndReleasePayments = (db: Database, batchId: string): Promise<boolean> =>
  db.transaction(async (transaction) => {
    const failed = await transaction
      .update(splitBatches)
      .set({ status: 'failed' })
      .where(isPending(batchId))
      .returning({ id: splitBatches.id });
    if (failed.length === 0) return false;

    await transaction
      .update(payments)
      .set({ splitBatchId: null })
      .where(eq(payments.splitBatchId, batchId));
    return true;
  });

export const setExpiredUnknownSeenAt = async (
  db: Database,
  batchId: string,
  seenAt: Date | null,
): Promise<void> => {
  await db.update(splitBatches).set({ expiredUnknownSeenAt: seenAt }).where(isPending(batchId));
};

export const findUnbatchedPayments = (db: Database) =>
  db
    .select({ id: payments.id, serviceId: payments.serviceId, amount: payments.amount })
    .from(payments)
    .where(
      and(isNull(payments.splitBatchId), sql`${payments.upstreamStatus} is distinct from 'failed'`),
    )
    .orderBy(asc(payments.settledAt))
    .limit(MAX_PAYMENTS_PER_BATCH);

export type NewSplitBatch = {
  txSignature: string;
  lastValidBlockHeight: bigint;
  payouts: readonly PayoutLine[];
  paymentIds: readonly string[];
};

/** Batch, payouts and payment marks commit together with the signature, so a batch is
 * never pending without the signature that reconciliation looks up. A payment already
 * taken by a concurrent round rolls the whole batch back. */
export const createBatch = async (db: Database, batch: NewSplitBatch): Promise<void> => {
  const batchId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.insert(splitBatches).values({
      id: batchId,
      txSignature: batch.txSignature,
      lastValidBlockHeight: batch.lastValidBlockHeight,
    });
    if (batch.payouts.length > 0) {
      await transaction
        .insert(payouts)
        .values(batch.payouts.map((payout) => ({ ...payout, batchId })));
    }
    const marked = await transaction
      .update(payments)
      .set({ splitBatchId: batchId })
      .where(and(inArray(payments.id, [...batch.paymentIds]), isNull(payments.splitBatchId)))
      .returning({ id: payments.id });

    if (marked.length !== batch.paymentIds.length) {
      throw new Error('payments were batched by a concurrent split round');
    }
  });
};

export const listRecentBatches = async (db: Database) => {
  const batches = await db
    .select()
    .from(splitBatches)
    .orderBy(desc(splitBatches.createdAt))
    .limit(LISTED_BATCHES);
  const lines = await db
    .select()
    .from(payouts)
    .where(
      inArray(
        payouts.batchId,
        batches.map(({ id }) => id),
      ),
    )
    .orderBy(asc(payouts.recipient));

  return batches.map((batch) => ({
    ...batch,
    payouts: lines.filter(({ batchId }) => batchId === batch.id),
  }));
};
