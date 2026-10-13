import { generateKeyPairSigner } from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { recordPayment } from '../src/features/ledger/repository.js';
import { allowanceViewSchema, buildTestApp, createAllowance, db, signIn } from './helpers.js';

const pageSchema = z.object({
  payments: z.array(z.object({ id: z.uuid(), amount: z.string(), settledAt: z.string() })),
});

let app: FastifyInstance;
let owner: Awaited<ReturnType<typeof signIn>>;

beforeEach(async () => {
  app = await buildTestApp();
  owner = await signIn(app);
});

afterEach(async () => {
  await app.close();
});

const patch = (id: string, payload: object) =>
  app.inject({ method: 'PATCH', url: `/allowances/${id}`, headers: owner.headers, payload });

describe('allowances CRUD', () => {
  it('creates an allowance with caps as integer strings and lists it with today spend', async () => {
    const created = await createAllowance(app, owner.headers, {
      perCallCap: '5000',
      dailyCap: '9007199254740993',
    });

    expect(created).toMatchObject({
      status: 'active',
      dailyCap: '9007199254740993',
      spentToday: '0',
    });

    const listed = await app.inject({ method: 'GET', url: '/allowances', headers: owner.headers });
    expect(z.object({ allowances: z.array(allowanceViewSchema) }).parse(listed.json())).toEqual({
      allowances: [expect.objectContaining({ id: created.id }) as unknown],
    });
  });

  it('answers 409 for a second allowance on the same session wallet', async () => {
    const { sessionAddress } = await createAllowance(app, owner.headers);

    const again = await app.inject({
      method: 'POST',
      url: '/allowances',
      headers: owner.headers,
      payload: { agentName: 'dup', sessionAddress, perCallCap: '1', dailyCap: '1' },
    });

    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'session_already_has_allowance' });
  });

  it.each([
    { perCallCap: '10', dailyCap: '5' },
    { perCallCap: '0', dailyCap: '5' },
    { perCallCap: '1.5', dailyCap: '5' },
    { perCallCap: 5, dailyCap: 10 },
    { perCallCap: '1', dailyCap: '9999999999999999999' },
  ])('answers 400 for caps %j', async (caps) => {
    const session = await generateKeyPairSigner();

    const response = await app.inject({
      method: 'POST',
      url: '/allowances',
      headers: owner.headers,
      payload: { agentName: 'bad', sessionAddress: session.address, ...caps },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_input' });
  });

  it('pauses and resumes through PATCH, and exposes the policy by session publicly', async () => {
    const { id, sessionAddress } = await createAllowance(app, owner.headers);

    const paused = await patch(id, { status: 'paused' });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({ id, status: 'paused' });

    const policy = await app.inject({
      method: 'GET',
      url: `/allowances/by-session/${sessionAddress}`,
    });
    expect(policy.json()).toEqual({
      status: 'paused',
      perCallCap: '5000',
      dailyCap: '20000',
      spentToday: '0',
    });

    const resumed = await patch(id, { status: 'active' });
    expect(resumed.json()).toMatchObject({ status: 'active' });
  });

  it('changes caps but refuses a per-call cap above the daily cap or an empty change', async () => {
    const { id } = await createAllowance(app, owner.headers);

    expect((await patch(id, { dailyCap: '30000' })).json()).toMatchObject({ dailyCap: '30000' });
    const inverted = await patch(id, { perCallCap: '40000' });
    expect(inverted.statusCode).toBe(400);
    expect((await patch(id, {})).statusCode).toBe(400);

    const current = await app.inject({
      method: 'GET',
      url: `/allowances/${id}`,
      headers: owner.headers,
    });
    expect(current.json()).toMatchObject({ perCallCap: '5000', dailyCap: '30000' });
  });

  it('answers 404 for an unknown session wallet on the public policy route', async () => {
    const stranger = await generateKeyPairSigner();

    const response = await app.inject({
      method: 'GET',
      url: `/allowances/by-session/${stranger.address}`,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /allowances/:id/payments', () => {
  const seed = async (allowanceId: string, total: number) => {
    const base = Date.now() - total * 1_000;
    for (let index = 0; index < total; index += 1) {
      await recordPayment(db, {
        serviceId: 'translate',
        payerAddress: 'payer',
        allowanceId,
        amount: BigInt(index + 1),
        txSignature: `${allowanceId}-${String(index)}`,
        // Pairs share a timestamp so the id tie-break is exercised.
        settledAt: new Date(base + Math.floor(index / 2) * 1_000),
      });
    }
  };

  const page = async (id: string, after?: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/allowances/${id}/payments${after ? `?after=${after}` : ''}`,
      headers: owner.headers,
    });
    expect(response.statusCode).toBe(200);
    return pageSchema.parse(response.json()).payments;
  };

  it('walks every payment exactly once in stable pages of 50, oldest first', async () => {
    const { id } = await createAllowance(app, owner.headers);
    await seed(id, 120);

    const first = await page(id);
    const second = await page(id, first.at(-1)!.id);
    const third = await page(id, second.at(-1)!.id);
    const end = await page(id, third.at(-1)!.id);

    expect([first.length, second.length, third.length, end.length]).toEqual([50, 50, 20, 0]);
    const walked = [...first, ...second, ...third];
    expect(new Set(walked.map((payment) => payment.id)).size).toBe(120);
    expect(walked.map((payment) => payment.amount).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: 120 }, (_, index) => String(index + 1)),
    );
    const times = walked.map((payment) => Date.parse(payment.settledAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));

    expect(await page(id, first.at(-1)!.id)).toEqual(second);
  });

  it('matches nothing for a cursor that belongs to another allowance', async () => {
    const mine = await createAllowance(app, owner.headers);
    const other = await createAllowance(app, owner.headers);
    await seed(mine.id, 3);
    await seed(other.id, 3);
    const [foreign] = await page(other.id);

    expect(await page(mine.id, foreign!.id)).toEqual([]);
  });

  it('answers 400 for a cursor that is not a uuid', async () => {
    const { id } = await createAllowance(app, owner.headers);

    const response = await app.inject({
      method: 'GET',
      url: `/allowances/${id}/payments?after=1`,
      headers: owner.headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('builds the monthly statement with the split by recipient adding up to the total', async () => {
    const { id } = await createAllowance(app, owner.headers);
    await seed(id, 4);
    const month = new Date().toISOString().slice(0, 7);

    const response = await app.inject({
      method: 'GET',
      url: `/allowances/${id}/statement?month=${month}`,
      headers: owner.headers,
    });

    const statement = z
      .object({
        totals: z.object({
          amount: z.string(),
          byProvider: z.array(z.object({ amount: z.string() })),
        }),
        payments: z.array(z.unknown()),
      })
      .parse(response.json());
    expect(statement.totals.amount).toBe('10');
    expect(statement.payments).toHaveLength(4);
    expect(statement.totals.byProvider.reduce((sum, { amount }) => sum + BigInt(amount), 0n)).toBe(
      10n,
    );
  });
});
