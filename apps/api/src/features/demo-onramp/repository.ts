import { and, eq, gte, isNull, or, sql } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { onramps, payments } from '../../shared/db/schema.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const ONRAMP_LOCK_KEY = 402_001;

/** Limits and the treasury reserve are read and the top-up recorded under one lock, so two
 * concurrent top-ups cannot both pass the same check. */
// ponytail: one global lock held across the RPC calls; per-owner locks plus a reserve ledger if top-ups ever need throughput.
export const withOnrampLock = <Result>(
  db: Database,
  work: (transaction: Transaction) => Promise<Result>,
): Promise<Result> =>
  db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(${ONRAMP_LOCK_KEY})`);
    return work(transaction);
  });

/** How much an owner and a session wallet have already topped up since `since`, to enforce the
 * per-owner daily cap and the one-top-up-per-wallet-per-day limit. */
export const onrampUsageSince = async (
  transaction: Transaction,
  {
    ownerAddress,
    sessionAddress,
    since,
  }: { ownerAddress: string; sessionAddress: string; since: Date },
): Promise<{ ownerTotal: bigint; sessionCount: number }> => {
  const [usage] = await transaction
    .select({
      ownerTotal:
        sql`coalesce(sum(${onramps.amount}) filter (where ${onramps.ownerAddress} = ${ownerAddress}), 0)`.mapWith(
          BigInt,
        ),
      sessionCount:
        sql`count(*) filter (where ${onramps.sessionAddress} = ${sessionAddress})`.mapWith(Number),
    })
    .from(onramps)
    .where(
      and(
        gte(onramps.createdAt, since),
        or(eq(onramps.ownerAddress, ownerAddress), eq(onramps.sessionAddress, sessionAddress)),
      ),
    );

  return usage ?? { ownerTotal: 0n, sessionCount: 0 };
};

/** Payments the split worker has yet to pay out, the same set it picks up. */
export const findUnsplitPayments = (transaction: Transaction) =>
  transaction
    .select({ serviceId: payments.serviceId, amount: payments.amount })
    .from(payments)
    .where(
      and(isNull(payments.splitBatchId), sql`${payments.upstreamStatus} is distinct from 'failed'`),
    );

/** Books a simulated top-up after the transfer already landed on devnet. */
export const recordOnramp = async (
  transaction: Transaction,
  onramp: typeof onramps.$inferInsert,
): Promise<void> => {
  await transaction.insert(onramps).values(onramp);
};
