import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { SOLANA_DEVNET, type LiveEvent } from '@402lab/shared';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { paymentMiddleware } from '@x402/fastify';
import { eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerLedgerHooks } from '../src/features/ledger/hooks.js';
import type * as LedgerRepository from '../src/features/ledger/repository.js';
import { recordPayment } from '../src/features/ledger/repository.js';
import { createResourceServer } from '../src/features/paid-services/x402.js';
import { createDatabase, createPool, type Database } from '../src/shared/db/pool.js';
import { allowances, payments } from '../src/shared/db/schema.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import { ADMIN_DATABASE_URL, createTestDatabase, type TestDatabase } from './support/database.js';

vi.mock('../src/features/ledger/repository.js', async (importOriginal) => {
  const repository = await importOriginal<typeof LedgerRepository>();
  return { ...repository, recordPayment: vi.fn(repository.recordPayment) };
});

const TREASURY_ADDRESS = '5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj';
const OWNER_ADDRESS = 'owner-address';
const TRANSLATE_PRICE = 2_000n;

const facilitator: {
  verifyResponse: Record<string, unknown>;
  settleResponse: Record<string, unknown> | (() => Record<string, unknown>);
  failure: { status: number; body: string } | undefined;
  calls: string[];
} = { verifyResponse: {}, settleResponse: {}, failure: undefined, calls: [] };

const answerAsFacilitator = (request: IncomingMessage): unknown => {
  const route = `${request.method ?? ''} ${request.url ?? ''}`;
  facilitator.calls.push(route);

  if (route === 'POST /verify') return facilitator.verifyResponse;
  if (route === 'POST /settle') {
    const { settleResponse } = facilitator;
    return typeof settleResponse === 'function' ? settleResponse() : settleResponse;
  }

  return {
    kinds: [
      {
        x402Version: 2,
        scheme: 'exact',
        network: SOLANA_DEVNET,
        extra: { feePayer: 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5' },
      },
    ],
    extensions: [],
    signers: {},
  };
};

let facilitatorServer: Server;
let facilitatorUrl: string;
let testDatabase: TestDatabase;
let app: FastifyInstance;
let currentTime: Date;
const bus = createEventsBus();
const logger = { error: vi.fn() };
let beforeServing: (reply: FastifyReply) => Promise<void> | void;

const buildPaidApp = async (database: Database): Promise<FastifyInstance> => {
  const paidApp = Fastify({ logger: false });
  const resourceServer = createResourceServer(facilitatorUrl, logger);
  registerLedgerHooks(resourceServer, { db: database, bus, now: () => currentTime, logger });

  const accepts = (price: string) => [
    { scheme: 'exact', price, network: SOLANA_DEVNET, payTo: TREASURY_ADDRESS },
  ];
  paymentMiddleware(
    paidApp,
    {
      'GET /svc/translate': { accepts: accepts('$0.002'), description: 'translate' },
      'GET /svc/unlisted': { accepts: accepts('$0.001'), description: 'not in the catalog' },
    },
    resourceServer,
  );
  paidApp.get('/svc/translate', async (_request, reply) => {
    await beforeServing(reply);
    return { translated: true };
  });
  paidApp.get('/svc/unlisted', () => ({ ok: true }));

  await paidApp.ready();
  return paidApp;
};

beforeAll(async () => {
  facilitatorServer = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      const answer = answerAsFacilitator(request);
      const { failure } = facilitator;
      if (failure && request.url !== '/supported') {
        response.statusCode = failure.status;
        response.end(failure.body);
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(answer));
    });
  });
  await new Promise<void>((resolve) => facilitatorServer.listen(0, '127.0.0.1', resolve));
  const address = facilitatorServer.address();
  if (address === null || typeof address === 'string') throw new Error('facilitator not on TCP');
  const { port }: AddressInfo = address;
  facilitatorUrl = `http://127.0.0.1:${String(port)}`;

  testDatabase = await createTestDatabase();
  app = await buildPaidApp(testDatabase.database);
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
  await new Promise((resolve) => facilitatorServer.close(resolve));
});

/** A fresh session wallet per test, settled under its own signature. */
const usePayer = (): { payer: string; transaction: string } => {
  const payer = `payer-${randomUUID()}`;
  const transaction = `signature-${randomUUID()}`;
  facilitator.verifyResponse = { isValid: true, payer };
  facilitator.settleResponse = { success: true, transaction, network: SOLANA_DEVNET, payer };
  return { payer, transaction };
};

beforeEach(() => {
  facilitator.calls = [];
  facilitator.failure = undefined;
  currentTime = new Date('2026-10-10T15:00:00.000Z');
  logger.error.mockClear();
  beforeServing = () => {};
});

const createAllowance = async (
  sessionAddress: string,
  policy: { status?: 'active' | 'paused'; perCallCap?: bigint; dailyCap?: bigint } = {},
) => {
  const [allowance] = await testDatabase.database
    .insert(allowances)
    .values({
      ownerAddress: OWNER_ADDRESS,
      agentName: 'research-agent',
      sessionAddress,
      perCallCap: policy.perCallCap ?? 5_000n,
      dailyCap: policy.dailyCap ?? 50_000n,
      status: policy.status ?? 'active',
    })
    .returning();

  return allowance!;
};

const pay = async (target: FastifyInstance, url = '/svc/translate') => {
  const terms = await target.inject({ method: 'GET', url });
  const termsHeader = terms.headers['payment-required'];
  if (typeof termsHeader !== 'string') throw new Error('no payment terms');
  const paymentSignature = encodePaymentSignatureHeader({
    x402Version: 2,
    accepted: decodePaymentRequiredHeader(termsHeader).accepts[0]!,
    payload: { transaction: 'signed-transaction-base64' },
  });

  const response = await target.inject({
    method: 'GET',
    url,
    headers: { 'payment-signature': paymentSignature },
  });
  const refusal = response.headers['payment-required'];
  const settlement = response.headers['payment-response'];

  return {
    status: response.statusCode,
    refusedWith:
      typeof refusal === 'string' ? decodePaymentRequiredHeader(refusal).error : undefined,
    settled:
      typeof settlement === 'string'
        ? decodePaymentResponseHeader(settlement).transaction
        : undefined,
  };
};

const listenTo = (ownerAddress: string): LiveEvent[] => {
  const received: LiveEvent[] = [];
  bus.subscribe(ownerAddress, (event) => received.push(event));
  return received;
};

const paymentsSignedWith = (transaction: string) =>
  testDatabase.database.select().from(payments).where(eq(payments.txSignature, transaction));

describe('allowance policy before settlement', () => {
  it('refuses a paused allowance without reaching settle', async () => {
    const { payer } = usePayer();
    await createAllowance(payer, { status: 'paused' });
    const ownerEvents = listenTo(OWNER_ADDRESS);

    const result = await pay(app, '/svc/translate');

    expect(result).toMatchObject({ status: 402, refusedWith: 'allowance_paused' });
    expect(facilitator.calls).not.toContain('POST /settle');
    expect(ownerEvents).toEqual([]);
  });

  it('refuses a price above the per-call cap', async () => {
    const { payer } = usePayer();
    await createAllowance(payer, { perCallCap: TRANSLATE_PRICE - 1n });
    const ownerEvents = listenTo(OWNER_ADDRESS);

    const result = await pay(app, '/svc/translate');

    expect(result).toMatchObject({ status: 402, refusedWith: 'per_call_cap_exceeded' });
    expect(facilitator.calls).not.toContain('POST /settle');
    expect(ownerEvents).toEqual([]);
  });

  it('refuses a payment past the daily cap and tells the owner the cap was reached', async () => {
    const { payer } = usePayer();
    const allowance = await createAllowance(payer, { dailyCap: 3_000n });
    await recordPayment(testDatabase.database, {
      serviceId: 'translate',
      payerAddress: payer,
      allowanceId: allowance.id,
      amount: TRANSLATE_PRICE,
      txSignature: `earlier-${randomUUID()}`,
      settledAt: new Date('2026-10-10T08:00:00.000Z'),
    });
    const ownerEvents = listenTo(OWNER_ADDRESS);

    const result = await pay(app, '/svc/translate');

    expect(result).toMatchObject({ status: 402, refusedWith: 'daily_cap_exceeded' });
    expect(facilitator.calls).not.toContain('POST /settle');
    expect(ownerEvents).toContainEqual({
      type: 'allowance.cap_reached',
      allowanceId: allowance.id,
      price: '2000',
      spentToday: '2000',
      dailyCap: '3000',
    });
  });

  it('leaves a payment the facilitator found invalid to the facilitator', async () => {
    const { payer } = usePayer();
    await createAllowance(payer, { status: 'paused' });
    facilitator.verifyResponse = { isValid: false, invalidReason: 'insufficient_funds', payer };

    const result = await pay(app, '/svc/translate');

    expect(result.status).toBe(402);
    expect(result.refusedWith).not.toBe('allowance_paused');
    expect(facilitator.calls).not.toContain('POST /settle');
  });

  it('refuses when the policy cannot be read, instead of letting the payment through', async () => {
    usePayer();
    const closedPool = createPool(ADMIN_DATABASE_URL);
    await closedPool.end();
    const unreachableApp = await buildPaidApp(createDatabase(closedPool));

    const result = await pay(unreachableApp, '/svc/translate');
    await unreachableApp.close();

    expect(result).toMatchObject({ status: 402, refusedWith: 'policy_unavailable' });
    expect(facilitator.calls).not.toContain('POST /settle');
  });

  it('refuses a verified payment that names no payer', async () => {
    usePayer();
    facilitator.verifyResponse = { isValid: true };

    const result = await pay(app, '/svc/translate');

    expect(result).toMatchObject({ status: 402, refusedWith: 'policy_unavailable' });
  });
});

describe('ledger after settlement', () => {
  it('records the payment under the service and tells the owner', async () => {
    const { payer, transaction } = usePayer();
    const allowance = await createAllowance(payer);
    const ownerEvents = listenTo(OWNER_ADDRESS);

    const result = await pay(app, '/svc/translate');
    const [recorded] = await paymentsSignedWith(transaction);

    expect(result).toMatchObject({ status: 200, settled: transaction });
    expect(recorded).toMatchObject({
      serviceId: 'translate',
      payerAddress: payer,
      allowanceId: allowance.id,
      amount: TRANSLATE_PRICE,
      settledAt: currentTime,
    });
    expect(ownerEvents).toContainEqual({
      type: 'payment.settled',
      paymentId: recorded!.id,
      serviceId: 'translate',
      allowanceId: allowance.id,
      amount: '2000',
      txSignature: transaction,
      settledAt: '2026-10-10T15:00:00.000Z',
    });
  });

  it('lets a payer without allowance pay and records it without allowance', async () => {
    const { transaction } = usePayer();

    const result = await pay(app, '/svc/translate');

    expect(result).toMatchObject({ status: 200, settled: transaction });
    await expect(paymentsSignedWith(transaction)).resolves.toMatchObject([
      { serviceId: 'translate', allowanceId: null, amount: TRANSLATE_PRICE },
    ]);
  });

  it('records a replayed settlement signature once and announces it once', async () => {
    const { payer, transaction } = usePayer();
    await createAllowance(payer);
    const ownerEvents = listenTo(OWNER_ADDRESS);

    await pay(app, '/svc/translate');
    await pay(app, '/svc/translate');

    await expect(paymentsSignedWith(transaction)).resolves.toHaveLength(1);
    expect(ownerEvents.filter((event) => event.type === 'payment.settled')).toHaveLength(1);
  });

  it('flags a settled payment it cannot record when the service is not in the catalog', async () => {
    const { payer, transaction } = usePayer();

    const result = await pay(app, '/svc/unlisted');

    expect(result).toMatchObject({ status: 200, settled: transaction });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        txSignature: transaction,
        payer,
        amount: '1000',
        serviceId: 'unlisted',
      }),
      'settled_payment_not_recorded',
    );
    await expect(paymentsSignedWith(transaction)).resolves.toEqual([]);
  });

  it('records a payment whose service path arrives percent-encoded', async () => {
    const { transaction } = usePayer();

    const result = await pay(app, '/svc/%74ranslate');

    expect(result).toMatchObject({ status: 200, settled: transaction });
    await expect(paymentsSignedWith(transaction)).resolves.toMatchObject([
      { serviceId: 'translate', amount: TRANSLATE_PRICE },
    ]);
  });

  it('retries the ledger write after settlement until it lands', async () => {
    const { transaction } = usePayer();
    vi.mocked(recordPayment)
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection reset'));

    const result = await pay(app);

    expect(result).toMatchObject({ status: 200, settled: transaction });
    await expect(paymentsSignedWith(transaction)).resolves.toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('flags a settled payment whose ledger write keeps failing', async () => {
    const { payer, transaction } = usePayer();
    vi.mocked(recordPayment)
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection reset'));

    const result = await pay(app);

    expect(result).toMatchObject({ status: 200, settled: transaction });
    await expect(paymentsSignedWith(transaction)).resolves.toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        txSignature: transaction,
        payer,
        amount: '2000',
        serviceId: 'translate',
      }),
      'settled_payment_not_recorded',
    );
  });
});

describe('daily cap under concurrent payments', () => {
  it('lets only one of five parallel payments through a cap that fits one', async () => {
    const { payer } = usePayer();
    facilitator.settleResponse = () => ({
      success: true,
      transaction: `parallel-${randomUUID()}`,
      network: SOLANA_DEVNET,
      payer,
    });
    const allowance = await createAllowance(payer, { dailyCap: TRANSLATE_PRICE });

    const results = await Promise.all(Array.from({ length: 5 }, () => pay(app)));
    const recorded = await testDatabase.database
      .select()
      .from(payments)
      .where(eq(payments.allowanceId, allowance.id));

    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.refusedWith === 'daily_cap_exceeded')).toHaveLength(4);
    expect(recorded).toHaveLength(1);
  });

  it('frees the reserved spend when settlement fails', async () => {
    const { payer, transaction } = usePayer();
    await createAllowance(payer, { dailyCap: TRANSLATE_PRICE });
    facilitator.settleResponse = {
      success: false,
      errorReason: 'transaction_failed',
      transaction: '',
      network: SOLANA_DEVNET,
      payer,
    };

    const failed = await pay(app);
    facilitator.settleResponse = { success: true, transaction, network: SOLANA_DEVNET, payer };
    const retried = await pay(app);

    expect(failed.status).toBe(402);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ payer, serviceId: 'translate', amount: '2000' }),
      'payment_settle_failed',
    );
    expect(retried).toMatchObject({ status: 200, settled: transaction });
  });

  it('frees the reserved spend when the handler fails and settlement is canceled', async () => {
    const { payer, transaction } = usePayer();
    await createAllowance(payer, { dailyCap: TRANSLATE_PRICE });
    beforeServing = (reply) => {
      reply.code(502);
    };

    const failed = await pay(app);
    beforeServing = () => {};
    const retried = await pay(app);

    expect(failed.status).toBe(502);
    expect(retried).toMatchObject({ status: 200, settled: transaction });
  });

  it('aborts settlement when the allowance is paused after verification', async () => {
    const { payer, transaction } = usePayer();
    const allowance = await createAllowance(payer, { dailyCap: TRANSLATE_PRICE });
    const setStatus = async (status: 'active' | 'paused') => {
      await testDatabase.database
        .update(allowances)
        .set({ status })
        .where(eq(allowances.id, allowance.id));
    };
    beforeServing = () => setStatus('paused');

    const paused = await pay(app);
    beforeServing = () => {};
    await setStatus('active');
    const resumed = await pay(app);

    expect(paused.status).toBe(402);
    expect(paused.settled).toBeFalsy();
    expect(facilitator.calls.filter((call) => call === 'POST /settle')).toHaveLength(1);
    expect(resumed).toMatchObject({ status: 200, settled: transaction });
  });
});

describe('facilitator failures', () => {
  it.each([
    ['invalid JSON', 200],
    ['an HTTP error', 500],
  ])('answers 502 without the facilitator text when it returns %s', async (_label, status) => {
    usePayer();
    const terms = await app.inject({ method: 'GET', url: '/svc/translate' });
    const termsHeader = terms.headers['payment-required'];
    if (typeof termsHeader !== 'string') throw new Error('no payment terms');
    facilitator.failure = { status, body: 'stack trace from facilitator-internal-host' };

    const response = await app.inject({
      method: 'GET',
      url: '/svc/translate',
      headers: {
        'payment-signature': encodePaymentSignatureHeader({
          x402Version: 2,
          accepted: decodePaymentRequiredHeader(termsHeader).accepts[0]!,
          payload: { transaction: 'signed-transaction-base64' },
        }),
      },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'facilitator_unavailable' });
    expect(JSON.stringify(response.headers)).not.toContain('facilitator-internal-host');
    expect(logger.error).toHaveBeenCalled();
  });
});
