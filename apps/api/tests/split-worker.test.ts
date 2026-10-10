import { buildCatalog, type LiveEvent, type ServiceId } from '@402lab/shared';
import {
  blockhash,
  generateKeyPairSigner,
  getBase58Decoder,
  getSignatureFromTransaction,
  type KeyPairSigner,
} from '@solana/kit';
import { asc, eq } from 'drizzle-orm';
import Fastify from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordPayment } from '../src/features/ledger/repository.js';
import { splitRoutes } from '../src/features/splits/routes.js';
import { splitBatchListResponseSchema } from '../src/features/splits/schemas.js';
import {
  runSplitRound,
  selectSplitBatch,
  type SplitRoundDependencies,
  startSplitWorker,
} from '../src/features/splits/worker.js';
import { loadConfig } from '../src/shared/config/index.js';
import { allowances, payments, payouts, splitBatches } from '../src/shared/db/schema.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import type { SignatureStatus, SolanaChain } from '../src/shared/solana/rpc.js';
import { ADMIN_DATABASE_URL, createTestDatabase, type TestDatabase } from './support/database.js';
import { RECIPIENT_ENVIRONMENT, TREASURY_ADDRESS } from './support/environment.js';

const OWNER_ADDRESS = 'owner-address';
const LAST_VALID_BLOCK_HEIGHT = 150n;
const OCR_PROVIDER = RECIPIENT_ENVIRONMENT.PROVIDER_OCR_ADDRESS;
const TRANSLATE_PROVIDER = RECIPIENT_ENVIRONMENT.PROVIDER_TRANSLATE_ADDRESS;
const INTEGRATOR = RECIPIENT_ENVIRONMENT.INTEGRATOR_ADDRESS;

const catalog = buildCatalog({
  provider: {
    ocr: OCR_PROVIDER,
    translate: TRANSLATE_PROVIDER,
    summarize: RECIPIENT_ENVIRONMENT.PROVIDER_SUMMARIZE_ADDRESS,
  },
  integrator: INTEGRATOR,
  platform: TREASURY_ADDRESS,
});

type FakeChain = SolanaChain & {
  status: SignatureStatus;
  height: bigint;
  sendError: Error | undefined;
  sentSignatures: string[];
  /** Batch status found in the database for the signature, read inside `send`. */
  recordedBeforeSend: (string | undefined)[];
};

let testDatabase: TestDatabase;
let treasury: KeyPairSigner;
let chain: FakeChain;
let events: LiveEvent[];
let dependencies: SplitRoundDependencies;
let allowanceId: string;
let paymentCount = 0;

const createFakeChain = (): FakeChain => {
  let blockhashCount = 0;
  const fake: FakeChain = {
    status: 'unknown',
    height: 100n,
    sendError: undefined,
    sentSignatures: [],
    recordedBeforeSend: [],
    latestBlockhash: async () => {
      blockhashCount += 1;
      return {
        blockhash: blockhash(getBase58Decoder().decode(new Uint8Array(32).fill(blockhashCount))),
        lastValidBlockHeight: LAST_VALID_BLOCK_HEIGHT,
      };
    },
    send: async (transaction) => {
      const signature = getSignatureFromTransaction(transaction);
      const [batch] = await testDatabase.database
        .select()
        .from(splitBatches)
        .where(eq(splitBatches.txSignature, signature));
      fake.recordedBeforeSend.push(batch?.status);
      fake.sentSignatures.push(signature);
      if (fake.sendError) throw fake.sendError;
    },
    signatureStatus: async () => fake.status,
    blockHeight: async () => fake.height,
  };

  return fake;
};

const pay = async (serviceId: ServiceId, amount: bigint) => {
  paymentCount += 1;
  const payment = await recordPayment(testDatabase.database, {
    serviceId,
    payerAddress: 'payer-address',
    allowanceId,
    amount,
    txSignature: `payment-signature-${String(paymentCount)}`,
    settledAt: new Date('2026-10-10T12:00:00.000Z'),
  });
  if (payment === 'duplicate') throw new Error('duplicate payment in test setup');

  return payment;
};

const batches = () =>
  testDatabase.database.select().from(splitBatches).orderBy(asc(splitBatches.createdAt));

const payoutsOf = (batchId: string) =>
  testDatabase.database
    .select({ recipient: payouts.recipient, role: payouts.role, amount: payouts.amount })
    .from(payouts)
    .where(eq(payouts.batchId, batchId))
    .orderBy(asc(payouts.recipient));

const batchIdsOfPayments = async () =>
  (
    await testDatabase.database
      .select({ splitBatchId: payments.splitBatchId })
      .from(payments)
      .orderBy(asc(payments.txSignature))
  ).map(({ splitBatchId }) => splitBatchId);

beforeAll(async () => {
  treasury = await generateKeyPairSigner();
});

beforeEach(async () => {
  testDatabase = await createTestDatabase();
  const [allowance] = await testDatabase.database
    .insert(allowances)
    .values({
      ownerAddress: OWNER_ADDRESS,
      agentName: 'research-agent',
      sessionAddress: 'session-address',
      perCallCap: 10_000n,
      dailyCap: 100_000n,
    })
    .returning();
  allowanceId = allowance!.id;
  chain = createFakeChain();
  events = [];
  const bus = createEventsBus();
  bus.subscribe(OWNER_ADDRESS, (event) => events.push(event));
  dependencies = { db: testDatabase.database, chain, treasury, catalog, bus };
});

afterEach(async () => {
  await testDatabase.drop();
});

describe('runSplitRound', () => {
  it('batches 3 payments of 2 services into one transaction with aggregated payouts, recorded before send', async () => {
    await pay('ocr', 5_000n);
    await pay('translate', 2_000n);
    await pay('ocr', 5_000n);

    await runSplitRound(dependencies);

    const [batch, ...others] = await batches();
    expect(others).toEqual([]);
    expect(batch).toMatchObject({
      status: 'pending',
      txSignature: chain.sentSignatures[0],
      lastValidBlockHeight: LAST_VALID_BLOCK_HEIGHT,
    });
    expect(chain.recordedBeforeSend).toEqual(['pending']);
    await expect(payoutsOf(batch!.id)).resolves.toEqual([
      { recipient: INTEGRATOR, role: 'integrator', amount: 600n },
      { recipient: OCR_PROVIDER, role: 'provider', amount: 8_500n },
      { recipient: TRANSLATE_PROVIDER, role: 'provider', amount: 1_700n },
    ]);
    await expect(batchIdsOfPayments()).resolves.toEqual([batch!.id, batch!.id, batch!.id]);
  });

  it('keeps a batch whose send threw pending and confirms it next round without sending again', async () => {
    await pay('ocr', 5_000n);
    chain.sendError = new Error('rpc unavailable');

    await expect(runSplitRound(dependencies)).rejects.toThrow('rpc unavailable');
    const [pendingBatch] = await batches();
    expect(pendingBatch).toMatchObject({
      status: 'pending',
      txSignature: chain.sentSignatures[0],
    });

    chain.sendError = undefined;
    chain.status = 'confirmed';
    await runSplitRound(dependencies);

    await expect(batches()).resolves.toEqual([{ ...pendingBatch, status: 'confirmed' }]);
    expect(chain.sentSignatures).toHaveLength(1);
    expect(events).toEqual([
      { type: 'split.confirmed', batchId: pendingBatch!.id, txSignature: chain.sentSignatures[0] },
    ]);
  });

  it('fails an unconfirmed batch past its last valid block height, releases its payments and batches them again', async () => {
    await pay('ocr', 5_000n);
    await pay('translate', 2_000n);
    await runSplitRound(dependencies);
    const [expiredBatch] = await batches();

    chain.height = LAST_VALID_BLOCK_HEIGHT + 1n;
    await runSplitRound(dependencies);

    const [failedBatch, retryBatch, ...others] = await batches();
    expect(others).toEqual([]);
    expect(failedBatch).toMatchObject({ id: expiredBatch!.id, status: 'failed' });
    expect(retryBatch).toMatchObject({ status: 'pending', txSignature: chain.sentSignatures[1] });
    expect(chain.sentSignatures).toHaveLength(2);
    await expect(batchIdsOfPayments()).resolves.toEqual([retryBatch!.id, retryBatch!.id]);
    expect(events).toEqual([
      { type: 'split.failed', batchId: expiredBatch!.id, txSignature: chain.sentSignatures[0] },
    ]);
  });

  it('fails a batch the chain reports as failed', async () => {
    await pay('ocr', 5_000n);
    await runSplitRound(dependencies);

    chain.status = 'failed';
    await runSplitRound(dependencies);

    const [failedBatch, retryBatch] = await batches();
    expect(failedBatch).toMatchObject({ status: 'failed' });
    expect(retryBatch).toMatchObject({ status: 'pending' });
  });

  it('waits on an unknown batch still within its validity and opens no other batch', async () => {
    await pay('ocr', 5_000n);
    await runSplitRound(dependencies);
    const before = await batches();
    await pay('translate', 2_000n);

    chain.height = LAST_VALID_BLOCK_HEIGHT;
    await runSplitRound(dependencies);

    await expect(batches()).resolves.toEqual(before);
    expect(chain.sentSignatures).toHaveLength(1);
    await expect(batchIdsOfPayments()).resolves.toEqual([before[0]!.id, null]);
    expect(events).toEqual([]);
  });

  it('releases a pending batch that never got a signature, since it was never sent', async () => {
    const payment = await pay('ocr', 5_000n);
    const [unsigned] = await testDatabase.database.insert(splitBatches).values({}).returning();
    await testDatabase.database
      .update(payments)
      .set({ splitBatchId: unsigned!.id })
      .where(eq(payments.id, payment.id));

    await runSplitRound(dependencies);

    const [failedBatch, retryBatch] = await batches();
    expect(failedBatch).toMatchObject({ id: unsigned!.id, status: 'failed' });
    expect(retryBatch).toMatchObject({ status: 'pending' });
    expect(events).toEqual([{ type: 'split.failed', batchId: unsigned!.id, txSignature: null }]);
  });

  it('leaves out payments whose upstream failed', async () => {
    const failed = await pay('summarize', 10_000n);
    await testDatabase.database
      .update(payments)
      .set({ upstreamStatus: 'failed' })
      .where(eq(payments.id, failed.id));

    await runSplitRound(dependencies);
    await expect(batches()).resolves.toEqual([]);

    await pay('translate', 2_000n);
    await runSplitRound(dependencies);

    const [batch] = await batches();
    await expect(payoutsOf(batch!.id)).resolves.toEqual([
      { recipient: INTEGRATOR, role: 'integrator', amount: 100n },
      { recipient: TRANSLATE_PROVIDER, role: 'provider', amount: 1_700n },
    ]);
    const [failedAfter] = await testDatabase.database
      .select()
      .from(payments)
      .where(eq(payments.id, failed.id));
    expect(failedAfter?.splitBatchId).toBeNull();
  });

  it('sends once when two rounds race over the same payments', async () => {
    await pay('ocr', 5_000n);
    await pay('translate', 2_000n);

    await Promise.allSettled([runSplitRound(dependencies), runSplitRound(dependencies)]);

    await expect(batches()).resolves.toHaveLength(1);
    expect(chain.sentSignatures).toHaveLength(1);
  });
});

describe('selectSplitBatch', () => {
  it('takes payments in order while their recipients fit, leaving the rest for the next round', () => {
    const settled = [
      { id: 'first-ocr', serviceId: 'ocr' as const, amount: 5_000n },
      { id: 'translate', serviceId: 'translate' as const, amount: 2_000n },
      { id: 'second-ocr', serviceId: 'ocr' as const, amount: 5_000n },
    ];

    expect(selectSplitBatch(settled, catalog, 2)).toEqual({
      paymentIds: ['first-ocr', 'second-ocr'],
      payouts: [
        { recipient: INTEGRATOR, role: 'integrator', amount: 500n },
        { recipient: OCR_PROVIDER, role: 'provider', amount: 8_500n },
      ],
    });
  });

  it('refuses a payment for a service missing from the catalog', () => {
    expect(() =>
      selectSplitBatch([{ id: 'retired', serviceId: 'retired-service', amount: 1_000n }], catalog),
    ).toThrow('Service retired-service is not in the catalog');
  });
});

describe('startSplitWorker', () => {
  it('logs a failed round, keeps running and stops on demand', async () => {
    await pay('ocr', 5_000n);
    const latestBlockhash = vi.fn(() => Promise.reject(new Error('rpc down')));
    const logger = { error: vi.fn() };

    const stop = startSplitWorker(
      { ...dependencies, chain: { ...chain, latestBlockhash }, logger },
      5,
    );

    await vi.waitFor(() => {
      expect(latestBlockhash.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    await stop();
    const callsAtStop = latestBlockhash.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(latestBlockhash).toHaveBeenCalledTimes(callsAtStop);
    expect(logger.error).toHaveBeenCalledWith({ err: new Error('rpc down') }, 'split round failed');
  });
});

describe('GET /splits', () => {
  it('lists batches newest first with payouts and the explorer link of their transaction', async () => {
    await testDatabase.database
      .insert(splitBatches)
      .values({ status: 'failed', createdAt: new Date('2026-01-01T00:00:00.000Z') });
    await pay('translate', 2_000n);
    await runSplitRound(dependencies);
    const [failed, sent] = await batches();
    const app = Fastify();
    await app.register(splitRoutes, { db: testDatabase.database });

    const response = await app.inject({ method: 'GET', url: '/splits' });

    expect(response.statusCode).toBe(200);
    expect(splitBatchListResponseSchema.parse(response.json())).toEqual({
      batches: [
        {
          id: sent!.id,
          status: 'pending',
          txSignature: chain.sentSignatures[0],
          explorerUrl: `https://solscan.io/tx/${chain.sentSignatures[0]!}?cluster=devnet`,
          createdAt: sent!.createdAt.toISOString(),
          payouts: [
            { recipient: INTEGRATOR, role: 'integrator', amount: '100' },
            { recipient: TRANSLATE_PROVIDER, role: 'provider', amount: '1700' },
          ],
        },
        {
          id: failed!.id,
          status: 'failed',
          txSignature: null,
          explorerUrl: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          payouts: [],
        },
      ],
    });
    await app.close();
  });
});

describe('split worker config', () => {
  const environment = { ...RECIPIENT_ENVIRONMENT, DATABASE_URL: ADMIN_DATABASE_URL };

  it('runs the worker against devnet by default, without a treasury key until one is set', () => {
    const config = loadConfig(environment);

    expect(config.TREASURY_SECRET_KEY).toBeUndefined();
    expect(config).toMatchObject({
      SOLANA_RPC_URL: 'https://api.devnet.solana.com',
      SPLIT_WORKER_ENABLED: true,
    });
  });

  it('turns the worker off with SPLIT_WORKER_ENABLED=false', () => {
    expect(loadConfig({ ...environment, SPLIT_WORKER_ENABLED: 'false' }).SPLIT_WORKER_ENABLED).toBe(
      false,
    );
  });
});
