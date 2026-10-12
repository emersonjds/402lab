import { serviceIdSchema, type ServiceId } from '@402lab/shared';
import {
  generateKeyPairSigner,
  getBase58Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type KeyPairSigner,
} from '@solana/kit';
import { eq } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { catalogFromConfig } from '../src/app.js';
import { recordPayment } from '../src/features/ledger/repository.js';
import { runSplitRound, startSplitWorker } from '../src/features/splits/worker.js';
import { payments, payouts, splitBatches } from '../src/shared/db/schema.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import { createSolanaChain } from '../src/shared/solana/rpc.js';
import { buildTestApp, config, db, RPC_URL, server, signIn } from './helpers.js';

const LAST_VALID_BLOCK_HEIGHT = 1_000;

const rpcRequestSchema = z.object({
  id: z.unknown(),
  method: z.string(),
  params: z.array(z.unknown()),
});

type Sent = { signature: string; instructions: number; batchPersistedBeforeSend: boolean };

/** A fake Solana JSON-RPC node: what the worker sent, and how the chain answers status reads. */
const chainState = {
  sent: [] as Sent[],
  sendFails: false,
  status: null as null | 'confirmed' | 'failed',
  blockHeight: 500,
  blockhashes: 0,
};

/** A fresh blockhash per read, as a live cluster gives, so a resend signs a new transaction. */
const nextBlockhash = () => {
  chainState.blockhashes += 1;
  return getBase58Decoder().decode(new Uint8Array(32).fill(chainState.blockhashes));
};

const decodeSent = (wire: string) => {
  const transaction = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
  const [signature] = Object.values(transaction.signatures);
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);

  return {
    signature: getBase58Decoder().decode(signature!),
    instructions: 'instructions' in message ? message.instructions.length : 0,
  };
};

const rpcResult = (method: string, params: unknown[]): unknown => {
  switch (method) {
    case 'getLatestBlockhash':
      return {
        context: { slot: 1 },
        value: { blockhash: nextBlockhash(), lastValidBlockHeight: LAST_VALID_BLOCK_HEIGHT },
      };
    case 'getBlockHeight':
      return chainState.blockHeight;
    case 'getSignatureStatuses':
      return {
        context: { slot: 1 },
        value: [
          chainState.status === null
            ? null
            : {
                slot: 1,
                confirmations: null,
                err: chainState.status === 'failed' ? { InstructionError: [0, 'Custom'] } : null,
                confirmationStatus: 'finalized',
              },
        ],
      };
    case 'sendTransaction':
      return (async () => {
        const { signature, instructions } = decodeSent(z.string().parse(params[0]));
        const persisted = await db
          .select()
          .from(splitBatches)
          .where(eq(splitBatches.txSignature, signature));
        chainState.sent.push({
          signature,
          instructions,
          batchPersistedBeforeSend: persisted.length === 1,
        });
        if (chainState.sendFails) throw new Error('blockhash not found');
        return signature;
      })();
    default:
      throw new Error(`unexpected rpc ${method}`);
  }
};

let treasury: KeyPairSigner;

beforeEach(async () => {
  chainState.sent = [];
  chainState.sendFails = false;
  chainState.status = null;
  chainState.blockHeight = 500;
  chainState.blockhashes = 0;
  treasury = await generateKeyPairSigner();
  server.use(
    http.post(RPC_URL, async ({ request }) => {
      const { id, method, params } = rpcRequestSchema.parse(await request.json());
      try {
        return HttpResponse.json({ jsonrpc: '2.0', id, result: await rpcResult(method, params) });
      } catch (error) {
        return HttpResponse.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32002, message: error instanceof Error ? error.message : 'failed' },
        });
      }
    }),
  );
});

const round = () =>
  runSplitRound({
    db,
    chain: createSolanaChain(RPC_URL),
    treasury,
    catalog: catalogFromConfig(config),
    bus: createEventsBus(),
    logger: { error: () => undefined, warn: () => undefined },
  });

const settle = async (serviceIds: readonly ServiceId[]) => {
  const start = Date.now() - serviceIds.length * 1_000;
  for (const [index, serviceId] of serviceIds.entries()) {
    await recordPayment(db, {
      serviceId,
      payerAddress: 'payer',
      allowanceId: null,
      amount: 10_000n,
      txSignature: `payment-${String(index)}`,
      settledAt: new Date(start + index * 1_000),
    });
  }
};

const batches = () => db.select().from(splitBatches);

describe('split worker round', () => {
  it('sends one batch with at most 8 transfers, persisting its signature before the send', async () => {
    // Ten services: ten providers plus the integrator would need 11 transfers.
    await settle(serviceIdSchema.options);

    await round();

    const [batch, ...others] = await batches();
    expect(others).toHaveLength(0);
    expect(chainState.sent).toHaveLength(1);
    const [sent] = chainState.sent;
    expect(sent).toMatchObject({ signature: batch!.txSignature, batchPersistedBeforeSend: true });

    const lines = await db.select().from(payouts).where(eq(payouts.batchId, batch!.id));
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(lines.length).toBe(8);
    // Each transfer travels with its idempotent ATA creation.
    expect(sent!.instructions).toBe(lines.length * 2);

    const batched = await db.select().from(payments).where(eq(payments.splitBatchId, batch!.id));
    expect(batched).toHaveLength(7);
    const paidOut = lines.reduce((sum, { amount }) => sum + amount, 0n);
    // 7 payments of 10000: 8500 provider + 500 integrator each; platform stays in the treasury.
    expect(paidOut).toBe(7n * 9_000n);
  });

  it('keeps one batch in flight per window: the next round only reconciles it', async () => {
    await settle(['ocr', 'translate']);
    await round();

    await round();

    expect(await batches()).toHaveLength(1);
    expect(chainState.sent).toHaveLength(1);
  });

  it('does not pay twice when the send fails and the round is retried', async () => {
    await settle(['ocr', 'translate']);
    chainState.sendFails = true;

    await expect(round()).rejects.toThrow();
    chainState.sendFails = false;
    await round();
    chainState.status = 'confirmed';
    await round();
    await round();

    const all = await batches();
    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe('confirmed');
    expect(chainState.sent).toHaveLength(1);
  });

  it('lets only one of two concurrent rounds batch the same payments', async () => {
    await settle(['ocr', 'translate', 'summarize']);

    await Promise.allSettled([round(), round()]);

    expect(await batches()).toHaveLength(1);
    expect(chainState.sent).toHaveLength(1);
    const unbatched = (await db.select().from(payments)).filter(
      ({ splitBatchId }) => !splitBatchId,
    );
    expect(unbatched).toHaveLength(0);
  });

  it('releases the payments of a failed batch so the next round pays them once', async () => {
    await settle(['ocr']);
    await round();
    chainState.status = 'failed';

    await round();

    const [failed, retried] = await batches().then((rows) =>
      rows.sort(
        (left, right) => Number(left.status === 'pending') - Number(right.status === 'pending'),
      ),
    );
    expect(failed!.status).toBe('failed');
    expect(retried!.status).toBe('pending');
    const [payment] = await db.select().from(payments);
    expect(payment!.splitBatchId).toBe(retried!.id);
  });

  it('fails a batch whose signature stays unknown past expiry in two rounds', async () => {
    await settle(['ocr']);
    await round();
    chainState.blockHeight = LAST_VALID_BLOCK_HEIGHT + 151;

    await round();
    expect((await batches())[0]!.status).toBe('pending');
    await round();

    const statuses = (await batches()).map(({ status }) => status).sort();
    expect(statuses).toEqual(['failed', 'pending']);
  });
});

describe('split worker schedule and GET /splits', () => {
  it('runs rounds on its interval until stopped, then lists the batch to a signed-in owner', async () => {
    await settle(['ocr', 'translate']);
    const stop = startSplitWorker(
      {
        db,
        chain: createSolanaChain(RPC_URL),
        treasury,
        catalog: catalogFromConfig(config),
        bus: createEventsBus(),
        logger: { error: () => undefined, warn: () => undefined },
      },
      10,
    );
    await vi.waitFor(() => {
      expect(chainState.sent).toHaveLength(1);
    });
    await stop();

    const app = await buildTestApp();
    const owner = await signIn(app);
    const listed = await app.inject({ method: 'GET', url: '/splits', headers: owner.headers });
    await app.close();

    expect(listed.statusCode).toBe(200);
    const [batch] = z
      .object({
        batches: z.array(
          z.object({
            txSignature: z.string(),
            explorerUrl: z.string(),
            payouts: z.array(z.unknown()),
          }),
        ),
      })
      .parse(listed.json()).batches;
    expect(batch).toMatchObject({ txSignature: chainState.sent[0]!.signature });
    // ocr provider, translate provider and the integrator.
    expect(batch!.payouts).toHaveLength(3);
  });
});
