import { serviceIdSchema, SOLANA_DEVNET, USDC_DEVNET_MINT } from '@402lab/shared';
import { count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { catalogFromConfig } from '../src/app.js';
import { payments } from '../src/shared/db/schema.js';
import {
  buildTestApp,
  config,
  createAllowance,
  db,
  decodeHeader,
  facilitator,
  pay,
  paymentRequiredSchema,
  server,
  signIn,
  upstream,
} from './helpers.js';

const TRANSLATE = { text: 'hello', targetLanguage: 'pt' };

const ledgerRows = async () => {
  const [row] = await db.select({ total: count() }).from(payments);
  return row?.total ?? 0;
};

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

/** An owner signs in and gives the facilitator's payer an allowance with these caps. */
const payerWithAllowance = async (caps?: { perCallCap: string; dailyCap: string }) => {
  const { headers } = await signIn(app);
  const allowance = await createAllowance(app, headers, caps);
  facilitator.payer = allowance.sessionAddress;
  return { headers, allowance };
};

describe('POST /svc/:id', () => {
  it('answers 402 with the exact devnet USDC requirement when no payment is sent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/svc/ocr',
      payload: { imageUrl: 'https://example.com/receipt.png' },
    });

    expect(response.statusCode).toBe(402);
    const required = paymentRequiredSchema.parse(
      decodeHeader(response.headers['payment-required']),
    );
    expect(required.x402Version).toBe(2);
    expect(required.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: SOLANA_DEVNET,
      asset: USDC_DEVNET_MINT,
      amount: '5000',
      payTo: config.TREASURY_ADDRESS,
      extra: { feePayer: expect.any(String) as unknown },
    });
    expect(facilitator.calls).not.toContain('verify');
  });

  it('serves, settles once and writes one ledger row for a valid payment', async () => {
    const { headers, allowance } = await payerWithAllowance();

    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mode: 'demo', result: '[pt] hello' });
    expect(decodeHeader(response.headers['payment-response'])).toMatchObject({
      success: true,
      transaction: 'settled-tx-1',
      network: SOLANA_DEVNET,
    });
    expect(facilitator.calls.filter((call) => call === 'settle')).toHaveLength(1);

    const listed = await app.inject({
      method: 'GET',
      url: `/allowances/${allowance.id}/payments`,
      headers,
    });
    const body = z
      .object({
        payments: z.array(
          z.object({ serviceId: z.string(), amount: z.string(), txSignature: z.string() }),
        ),
      })
      .parse(listed.json());
    expect(body.payments).toEqual([
      { serviceId: 'translate', amount: '2000', txSignature: 'settled-tx-1' },
    ]);
  });

  it('records a replayed settlement signature only once', async () => {
    await payerWithAllowance();
    await pay(app, 'translate', TRANSLATE);
    facilitator.settled = 0;

    const replay = await pay(app, 'translate', TRANSLATE);

    expect(replay.statusCode).toBe(200);
    expect(await ledgerRows()).toBe(1);
  });

  it('refuses a paused allowance before the facilitator settles', async () => {
    const { headers, allowance } = await payerWithAllowance();
    await app.inject({
      method: 'PATCH',
      url: `/allowances/${allowance.id}`,
      headers,
      payload: { status: 'paused' },
    });

    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBe(402);
    expect(facilitator.calls).toContain('verify');
    expect(facilitator.calls).not.toContain('settle');
    expect(await ledgerRows()).toBe(0);
  });

  it('refuses a price above the per-call cap', async () => {
    await payerWithAllowance({ perCallCap: '1000', dailyCap: '100000' });

    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBe(402);
    expect(facilitator.calls).not.toContain('settle');
    expect(await ledgerRows()).toBe(0);
  });

  it('refuses the call that would cross the daily cap, after the ones that fit', async () => {
    await payerWithAllowance({ perCallCap: '2000', dailyCap: '5000' });

    expect((await pay(app, 'translate', TRANSLATE)).statusCode).toBe(200);
    expect((await pay(app, 'translate', TRANSLATE)).statusCode).toBe(200);
    const third = await pay(app, 'translate', TRANSLATE);

    expect(third.statusCode).toBe(402);
    expect(facilitator.calls.filter((call) => call === 'settle')).toHaveLength(2);
    expect(await ledgerRows()).toBe(2);
  });

  it('writes no ledger row and leaks no facilitator text when settlement fails', async () => {
    await payerWithAllowance();
    facilitator.settleSucceeds = false;

    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(facilitator.calls).toContain('settle');
    expect(response.body).not.toContain('facilitator internal text');
    expect(await ledgerRows()).toBe(0);
  });

  it('answers 502 upstream_unavailable and never settles when the upstream fails', async () => {
    await payerWithAllowance({ perCallCap: '5000', dailyCap: '20000' });
    upstream.azureStatus = 503;

    const response = await pay(app, 'ocr', { imageUrl: 'https://example.com/receipt.png' });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'upstream_unavailable' });
    expect(facilitator.calls).not.toContain('settle');
    expect(await ledgerRows()).toBe(0);
  });

  it('serves the live upstream through the paid route', async () => {
    await payerWithAllowance();

    const response = await pay(app, 'ocr', { imageUrl: 'https://example.com/receipt.png' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mode: 'live', result: 'TOTAL $7.00' });
  });

  it('settles a payer without allowance and records it with no allowance', async () => {
    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBe(200);
    const [row] = await db.select().from(payments).where(eq(payments.txSignature, 'settled-tx-1'));
    expect(row).toMatchObject({ allowanceId: null, amount: 2_000n, serviceId: 'translate' });
  });

  it('serves every catalog service for its own price', async () => {
    const inputs = {
      ocr: { imageUrl: 'https://example.com/a.png' },
      translate: TRANSLATE,
      summarize: { text: 'One. Two. Three. Four.' },
      vision: { imageUrl: 'https://example.com/a.png' },
      chat: { prompt: 'hi' },
      embed: { text: 'hi' },
      image: { prompt: 'a cat' },
      speech: { text: 'hi' },
      transcribe: { audioUrl: 'https://example.com/a.mp3' },
      bedrock: { prompt: 'hi' },
    } as const;

    for (const [serviceId, input] of Object.entries(inputs)) {
      const response = await pay(app, serviceIdSchema.parse(serviceId), input);

      expect(response.statusCode, serviceId).toBe(200);
    }

    const recorded = await db.select().from(payments);
    expect(recorded).toHaveLength(10);
    const prices = new Map(catalogFromConfig(config).map(({ id, price }) => [id, price]));
    for (const { serviceId, amount } of recorded) {
      expect(amount).toBe(prices.get(serviceIdSchema.parse(serviceId)));
    }
  });

  it('answers 502 facilitator_unavailable without the facilitator text when verify breaks', async () => {
    server.use(
      http.post('https://facilitator.test/verify', () =>
        HttpResponse.text('stack trace from the facilitator', { status: 500 }),
      ),
    );

    const response = await pay(app, 'translate', TRANSLATE);

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'facilitator_unavailable' });
    expect(await ledgerRows()).toBe(0);
  });

  it('answers 400 for an invalid body after payment is verified, without settling', async () => {
    await payerWithAllowance();

    const response = await pay(app, 'translate', { text: '' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'invalid_input',
      issues: { text: expect.any(Array) as unknown, targetLanguage: expect.any(Array) as unknown },
    });
    expect(facilitator.calls).not.toContain('settle');
  });
});
