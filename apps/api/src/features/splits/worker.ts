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
  type SplitBatchRow,
} from './repository.js';
import { buildSplitTransaction } from './transaction.js';

export type SplitRoundDependencies = {
  db: Database;
  chain: SolanaChain;
  treasury: KeyPairSigner;
  catalog: readonly Service[];
  bus: EventsBus;
};

export type SplitWorkerDependencies = SplitRoundDependencies & {
  logger: Pick<FastifyBaseLogger, 'error'>;
};

type SettledPayment = { id: string; serviceId: string; amount: AtomicAmount };

const SPLIT_ROUND_INTERVAL_MS = 30_000;

const payoutsOf = (payment: SettledPayment, catalog: readonly Service[]): PayoutLine[] => {
  const service = catalog.find(({ id }) => id === payment.serviceId);
  if (!service) throw new Error(`Service ${payment.serviceId} is not in the catalog`);

  return aggregatePayouts(computeSplit(payment.amount, service.splits));
};

/** Takes payments in order while all their recipients fit in one transaction. */
export const selectSplitBatch = (
  settled: readonly SettledPayment[],
  catalog: readonly Service[],
  maxTransfers = MAX_TRANSFERS_PER_TRANSACTION,
): { paymentIds: string[]; payouts: PayoutLine[] } => {
  const recipients = new Set<string>();
  const paymentIds: string[] = [];
  const lines: PayoutLine[] = [];

  for (const payment of settled) {
    const paymentLines = payoutsOf(payment, catalog);
    const keys = paymentLines.map(({ role, recipient }) => `${role}:${recipient}`);
    if (new Set([...recipients, ...keys]).size > maxTransfers) continue;

    keys.forEach((key) => recipients.add(key));
    paymentIds.push(payment.id);
    lines.push(...paymentLines);
  }

  return { paymentIds, payouts: aggregatePayouts(lines) };
};

const publishToOwners = async (
  { db, bus }: SplitRoundDependencies,
  batchId: string,
  event: LiveEvent,
): Promise<void> => {
  for (const owner of await findBatchOwners(db, batchId)) bus.publish(owner, event);
};

const failBatch = async (dependencies: SplitRoundDependencies, batch: SplitBatchRow) => {
  const event: LiveEvent = {
    type: 'split.failed',
    batchId: batch.id,
    txSignature: batch.txSignature,
  };
  await publishToOwners(dependencies, batch.id, event);
  await failBatchAndReleasePayments(dependencies.db, batch.id);
};

const reconcileBatch = async (dependencies: SplitRoundDependencies, batch: SplitBatchRow) => {
  const { txSignature, lastValidBlockHeight } = batch;
  // The signature is stored before send, so a batch without one never reached the chain.
  if (txSignature === null || lastValidBlockHeight === null) {
    await failBatch(dependencies, batch);
    return;
  }

  // Height before status: a transaction lands at or below its last valid block height, so
  // once the confirmed height is past it, the status read afterwards is final.
  const height = await dependencies.chain.blockHeight();
  const status = await dependencies.chain.signatureStatus(txSignature);

  if (status === 'confirmed') {
    await confirmBatch(dependencies.db, batch.id);
    await publishToOwners(dependencies, batch.id, {
      type: 'split.confirmed',
      batchId: batch.id,
      txSignature,
    });
    return;
  }

  if (status === 'failed' || height > lastValidBlockHeight) await failBatch(dependencies, batch);
};

export const runSplitRound = async (dependencies: SplitRoundDependencies): Promise<void> => {
  const { db, chain, treasury, catalog } = dependencies;

  for (const batch of await findPendingBatches(db)) await reconcileBatch(dependencies, batch);
  // ponytail: one batch in flight at a time; parallel batches when volume asks for it.
  if ((await findPendingBatches(db)).length > 0) return;

  const { paymentIds, payouts } = selectSplitBatch(await findUnbatchedPayments(db), catalog);
  if (payouts.length === 0) return;

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
  dependencies: SplitWorkerDependencies,
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
