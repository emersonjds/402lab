import {
  aggregatePayouts,
  type AtomicAmount,
  computeSplit,
  type LiveEvent,
  MAX_TRANSFERS_PER_TRANSACTION,
  type PayoutLine,
  type Service,
  USDC_DEVNET_MINT,
} from '@402lab/shared';
import { address, type KeyPairSigner } from '@solana/kit';
import type { FastifyBaseLogger } from 'fastify';

import type { Database } from '../../shared/db/pool.js';
import type { EventsBus } from '../../shared/events-bus.js';
import type { SolanaChain } from '../../shared/solana/rpc.js';
import {
  confirmBatch,
  createBatch,
  failBatchAndReleasePayments,
  findBatchOwners,
  findPendingBatches,
  findUnbatchedPayments,
  setExpiredUnknownSeenAt,
  type SplitBatchRow,
} from './repository.js';
import { buildSplitTransaction } from './transaction.js';

export type SplitRoundDependencies = {
  db: Database;
  chain: Pick<SolanaChain, 'latestBlockhash' | 'send' | 'signatureStatus' | 'blockHeight'>;
  treasury: KeyPairSigner;
  catalog: readonly Service[];
  bus: EventsBus;
  logger: Pick<FastifyBaseLogger, 'error' | 'warn'>;
};

type SettledPayment = { id: string; serviceId: string; amount: AtomicAmount };

const SPLIT_ROUND_INTERVAL_MS = 30_000;
/** ~60 s of blocks past the last valid block height before an unknown signature counts as expired. */
const EXPIRY_MARGIN_BLOCKS = 150n;

/** Takes payments in order while all their recipients fit in one transaction; payments of a
 * service missing from the catalog are set aside. */
export const selectSplitBatch = (
  settled: readonly SettledPayment[],
  catalog: readonly Service[],
  maxTransfers = MAX_TRANSFERS_PER_TRANSACTION,
): { paymentIds: string[]; payouts: PayoutLine[]; unknownService: SettledPayment[] } => {
  const recipients = new Set<string>();
  const paymentIds: string[] = [];
  const lines: PayoutLine[] = [];
  const unknownService: SettledPayment[] = [];

  for (const payment of settled) {
    const service = catalog.find(({ id }) => id === payment.serviceId);
    if (!service) {
      unknownService.push(payment);
      continue;
    }
    const paymentLines = aggregatePayouts(computeSplit(payment.amount, service.splits));
    const keys = paymentLines.map(({ role, recipient }) => `${role}:${recipient}`);
    if (new Set([...recipients, ...keys]).size > maxTransfers) continue;

    keys.forEach((key) => recipients.add(key));
    paymentIds.push(payment.id);
    lines.push(...paymentLines);
  }

  return { paymentIds, payouts: aggregatePayouts(lines), unknownService };
};

const publishToOwners = async (
  { db, bus }: SplitRoundDependencies,
  batchId: string,
  event: LiveEvent,
): Promise<void> => {
  for (const owner of await findBatchOwners(db, batchId)) bus.publish(owner, event);
};

const failBatch = async (dependencies: SplitRoundDependencies, batch: SplitBatchRow) => {
  // Owners come from the batch's payments, so they are read before the release unlinks them.
  const owners = await findBatchOwners(dependencies.db, batch.id);
  if (!(await failBatchAndReleasePayments(dependencies.db, batch.id))) return;

  const event: LiveEvent = {
    type: 'split.failed',
    batchId: batch.id,
    txSignature: batch.txSignature,
  };
  for (const owner of owners) dependencies.bus.publish(owner, event);
};

const reconcileBatch = async (dependencies: SplitRoundDependencies, batch: SplitBatchRow) => {
  const { db, chain } = dependencies;
  const { id, txSignature, lastValidBlockHeight, expiredUnknownSeenAt } = batch;

  // Height before status: a transaction lands at or below its last valid block height, so
  // once the confirmed height is past it, the status read afterwards is final.
  const height = await chain.blockHeight();
  const status = await chain.signatureStatus(txSignature);

  if (status === 'confirmed') {
    if (await confirmBatch(db, id)) {
      await publishToOwners(dependencies, id, {
        type: 'split.confirmed',
        batchId: id,
        txSignature,
      });
    }
    return;
  }
  if (status === 'failed') {
    await failBatch(dependencies, batch);
    return;
  }

  // Public RPC endpoints are load-balanced pools: height and status may come from different
  // nodes, and a lagging node answers null for a transaction that landed. Expiry therefore
  // needs a margin past the last valid block height, seen in two consecutive rounds.
  if (height <= lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS) {
    if (expiredUnknownSeenAt !== null) await setExpiredUnknownSeenAt(db, id, null);
    return;
  }
  if (expiredUnknownSeenAt === null) {
    await setExpiredUnknownSeenAt(db, id, new Date());
    return;
  }
  await failBatch(dependencies, batch);
};

/** One worker tick: reconciles any batch already in flight against the chain, and only once
 * none are pending does it group newly settled payments into the next batch and send it. */
export const runSplitRound = async (dependencies: SplitRoundDependencies): Promise<void> => {
  const { db, chain, treasury, catalog, logger } = dependencies;

  for (const batch of await findPendingBatches(db)) await reconcileBatch(dependencies, batch);
  // ponytail: one batch in flight at a time; parallel batches when volume asks for it.
  if ((await findPendingBatches(db)).length > 0) return;

  const { paymentIds, payouts, unknownService } = selectSplitBatch(
    await findUnbatchedPayments(db),
    catalog,
  );
  // ponytail: set-aside payments stay in the queue window; 1000 of them would starve the rest.
  for (const { id, serviceId } of unknownService) {
    logger.warn(
      { paymentId: id, serviceId },
      'split skipped a payment whose service is not in the catalog',
    );
  }
  // ponytail: payments with nothing to transfer leave the queue in a transfer-less transaction
  // (one fee) through the same crash-safe path; a database-only settlement if fees ever matter.
  if (paymentIds.length === 0) return;

  const latestBlockhash = await chain.latestBlockhash();
  const { signedTransaction, signature } = await buildSplitTransaction({
    treasury,
    payouts,
    mint: address(USDC_DEVNET_MINT),
    latestBlockhash,
  });
  await createBatch(db, {
    txSignature: signature,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    payouts,
    paymentIds,
  });

  // A send error marks nothing: the next round reconciles by signature before any resend.
  await chain.send(signedTransaction);
};

/** Each round is scheduled after the previous one settles, so rounds never overlap. */
export const startSplitWorker = (
  dependencies: SplitRoundDependencies,
  intervalMs = SPLIT_ROUND_INTERVAL_MS,
): (() => Promise<void>) => {
  let timer: NodeJS.Timeout | undefined;
  let round: Promise<void> = Promise.resolve();

  const tick = () => {
    round = runSplitRound(dependencies)
      .catch((error: unknown) => {
        dependencies.logger.error({ err: error }, 'split round failed');
      })
      .finally(() => {
        timer = setTimeout(tick, intervalMs);
      });
  };
  timer = setTimeout(tick, intervalMs);

  return async () => {
    clearTimeout(timer);
    await round;
    // The round in flight at stop has scheduled one more tick by now.
    clearTimeout(timer);
  };
};
