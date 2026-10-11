import { type Service, USDC_DEVNET_MINT } from '@402lab/shared';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { address } from '@solana/kit';
import type { FastifyBaseLogger } from 'fastify';

import type { Database } from '../../shared/db/pool.js';
import type { EventsBus } from '../../shared/events-bus.js';
import type { AccountSignature, SolanaChain } from '../../shared/solana/rpc.js';
import { findAllowanceBySession } from '../allowances/repository.js';
import { recordPayment } from '../ledger/repository.js';
import { decodeTreasuryDeposit } from './decode.js';
import { findKnownSignatures, readCursor, saveCursor } from './repository.js';

export type ReconciliationDependencies = {
  db: Database;
  chain: Pick<SolanaChain, 'signaturesForAddress' | 'transaction'>;
  treasuryAddress: string;
  catalog: readonly Service[];
  bus: EventsBus;
  now: () => Date;
  logger: Pick<FastifyBaseLogger, 'error' | 'warn' | 'info'>;
  /** Signatures per RPC page and per round. */
  limit?: number;
};

const RECONCILIATION_INTERVAL_MS = 60_000;
const SIGNATURES_PER_ROUND = 100;

/** The treasury's USDC associated token account: what reconciliation actually watches on chain. */
export const treasuryUsdcAccount = async (treasuryAddress: string): Promise<string> => {
  const [account] = await findAssociatedTokenPda({
    owner: address(treasuryAddress),
    mint: address(USDC_DEVNET_MINT),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return account;
};

/** Pages back from the newest signature to the cursor, so a backlog is worked oldest first.
 * ponytail: the whole backlog is listed every round (one RPC call per `limit` signatures);
 * a backward-scan cursor if a backlog ever reaches tens of thousands. */
const signaturesAfter = async (
  chain: ReconciliationDependencies['chain'],
  account: string,
  until: string | undefined,
  limit: number,
): Promise<AccountSignature[]> => {
  const newestFirst: AccountSignature[] = [];
  let before: string | undefined;

  for (;;) {
    const page = await chain.signaturesForAddress(account, {
      limit,
      ...(until === undefined ? {} : { until }),
      ...(before === undefined ? {} : { before }),
    });
    newestFirst.push(...page);
    before = page.at(-1)?.signature;
    if (page.length < limit || before === undefined) return newestFirst.reverse();
  }
};

const reconcileSignature = async (
  dependencies: ReconciliationDependencies,
  account: string,
  txSignature: string,
): Promise<void> => {
  const { db, chain, catalog, bus, now, logger } = dependencies;

  const deposit = decodeTreasuryDeposit(
    await chain.transaction(txSignature),
    account,
    USDC_DEVNET_MINT,
  );
  // Nothing credited to the treasury: a split, an on-ramp or another outgoing transfer.
  if (!deposit) return;

  // ponytail: the service is inferred from the price, unique per service in the catalog; a
  // manual deposit of exactly a service price is booked as that service.
  const service = catalog.find(({ price }) => price === deposit.amount);
  if (!service) {
    logger.warn(
      { txSignature, payer: deposit.payer, amount: deposit.amount.toString() },
      'unmatched_treasury_deposit',
    );
    return;
  }

  const allowance = await findAllowanceBySession(db, deposit.payer);
  const recorded = await recordPayment(db, {
    serviceId: service.id,
    payerAddress: deposit.payer,
    allowanceId: allowance?.id ?? null,
    amount: deposit.amount,
    txSignature,
    settledAt: deposit.blockTime === null ? now() : new Date(Number(deposit.blockTime) * 1000),
  });
  // The settle hook recorded it between the lookup and here.
  if (recorded === 'duplicate') return;

  logger.info(
    { txSignature, serviceId: service.id, amount: deposit.amount.toString() },
    'payment_reconciled',
  );
  bus.publish(allowance?.ownerAddress ?? null, {
    type: 'payment.settled',
    paymentId: recorded.id,
    serviceId: service.id,
    allowanceId: recorded.allowanceId,
    amount: recorded.amount.toString(),
    txSignature: recorded.txSignature,
    settledAt: recorded.settledAt.toISOString(),
  });
};

/** Books treasury deposits whose settlement never reached the ledger. The cursor moves one
 * signature at a time, so a failure resumes at the signature that failed. */
export const runReconciliationRound = async (
  dependencies: ReconciliationDependencies,
): Promise<void> => {
  const { db, chain, treasuryAddress, limit = SIGNATURES_PER_ROUND } = dependencies;
  const account = await treasuryUsdcAccount(treasuryAddress);

  const pending = (
    await signaturesAfter(chain, account, await readCursor(db, account), limit)
  ).slice(0, limit);
  const known = await findKnownSignatures(
    db,
    pending.map(({ signature }) => signature),
  );

  for (const { signature, failed } of pending) {
    if (!failed && !known.has(signature))
      await reconcileSignature(dependencies, account, signature);
    await saveCursor(db, account, signature);
  }
};

/** Each round is scheduled after the previous one settles, so rounds never overlap. */
export const startReconciliationJob = (
  dependencies: ReconciliationDependencies,
  intervalMs = RECONCILIATION_INTERVAL_MS,
): (() => Promise<void>) => {
  let timer: NodeJS.Timeout | undefined;
  let round: Promise<void> = Promise.resolve();

  const tick = () => {
    round = runReconciliationRound(dependencies)
      .catch((error: unknown) => {
        dependencies.logger.error({ err: error }, 'reconciliation round failed');
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
