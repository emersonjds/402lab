import type { LiveEvent } from '@402lab/shared';
import { generateKeyPairSigner } from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { payments } from '../src/shared/db/schema.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import { buildTestApp, mobileSession, webSession } from './support/app.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { RECIPIENT_ENVIRONMENT, TREASURY_ADDRESS } from './support/environment.js';

const OWNER_A = 'owner-a-address';
const OWNER_B = 'owner-b-address';

type AllowanceView = {
  id: string;
  agentName: string;
  sessionAddress: string;
  status: 'active' | 'paused';
  perCallCap: string;
  dailyCap: string;
  spentToday: string;
  createdAt: string;
};

type PaymentView = { id: string; serviceId: string; amount: string; settledAt: string };

let testDatabase: TestDatabase;
let app: FastifyInstance;
const bus = createEventsBus();

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  app = await buildTestApp(testDatabase, { bus });
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
});

const newSessionAddress = async () => (await generateKeyPairSigner()).address;

const createAllowance = async (owner: string, overrides: Record<string, string> = {}) => {
  const response = await app.inject({
    method: 'POST',
    url: '/allowances',
    headers: webSession(owner),
    payload: {
      agentName: 'research-agent',
      sessionAddress: await newSessionAddress(),
      perCallCap: '5000',
      dailyCap: '50000',
      ...overrides,
    },
  });

  return { response, allowance: response.json<AllowanceView>() };
};

let signatureCounter = 0;
const pay = async (
  allowanceId: string,
  serviceId: 'ocr' | 'translate' | 'summarize',
  amount: bigint,
  settledAt: string,
) => {
  signatureCounter += 1;
  const [payment] = await testDatabase.database
    .insert(payments)
    .values({
      serviceId,
      payerAddress: 'payer',
      allowanceId,
      amount,
      txSignature: `signature-${String(signatureCounter)}`,
      settledAt: new Date(settledAt),
    })
    .returning();

  return payment!;
};

describe('allowance management', () => {
  it('creates, reads, lists and pauses an allowance of the caller', async () => {
    const sessionAddress = await newSessionAddress();
    const { response, allowance } = await createAllowance(OWNER_A, { sessionAddress });

    expect(response.statusCode).toBe(201);
    expect(allowance).toMatchObject({
      agentName: 'research-agent',
      sessionAddress,
      status: 'active',
      perCallCap: '5000',
      dailyCap: '50000',
      spentToday: '0',
    });

    const read = await app.inject({
      method: 'GET',
      url: `/allowances/${allowance.id}`,
      headers: mobileSession(OWNER_A),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(allowance);

    const events: LiveEvent[] = [];
    const unsubscribe = bus.subscribe(OWNER_A, (event) => events.push(event));
    const paused = await app.inject({
      method: 'PATCH',
      url: `/allowances/${allowance.id}`,
      headers: webSession(OWNER_A),
      payload: { status: 'paused', dailyCap: '70000' },
    });
    unsubscribe();

    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({
      status: 'paused',
      perCallCap: '5000',
      dailyCap: '70000',
    });
    expect(events).toEqual([
      {
        type: 'allowance.updated',
        allowanceId: allowance.id,
        status: 'paused',
        perCallCap: '5000',
        dailyCap: '70000',
      },
    ]);
  });

  it("lists only the caller's allowances, with today's spend as an atomic string", async () => {
    const owner = 'listing-owner';
    const { allowance: first } = await createAllowance(owner);
    const { allowance: second } = await createAllowance(owner);
    await createAllowance('someone-else');
    await pay(first.id, 'translate', 2_000n, '2026-10-10T09:00:00.000Z');
    await pay(first.id, 'summarize', 10_000n, '2026-10-10T14:00:00.000Z');
    await pay(first.id, 'ocr', 5_000n, '2026-10-09T23:00:00.000Z');

    const response = await app.inject({
      method: 'GET',
      url: '/allowances',
      headers: webSession(owner),
    });

    expect(response.statusCode).toBe(200);
    const { allowances } = response.json<{ allowances: AllowanceView[] }>();
    expect(allowances.map(({ id, spentToday }) => ({ id, spentToday }))).toEqual([
      { id: first.id, spentToday: '12000' },
      { id: second.id, spentToday: '0' },
    ]);
  });

  it('refuses an invalid session address, a zero cap and an unknown status', async () => {
    const invalidAddress = await createAllowance(OWNER_A, { sessionAddress: 'not-a-wallet' });
    const zeroCap = await createAllowance(OWNER_A, { perCallCap: '0' });
    const notAtomic = await createAllowance(OWNER_A, { dailyCap: '1.5' });

    expect(invalidAddress.response.statusCode).toBe(400);
    expect(invalidAddress.response.json()).toEqual({ error: 'invalid_input' });
    expect(zeroCap.response.statusCode).toBe(400);
    expect(notAtomic.response.statusCode).toBe(400);

    const { allowance } = await createAllowance(OWNER_A);
    const unknownStatus = await app.inject({
      method: 'PATCH',
      url: `/allowances/${allowance.id}`,
      headers: webSession(OWNER_A),
      payload: { status: 'deleted' },
    });
    const emptyChange = await app.inject({
      method: 'PATCH',
      url: `/allowances/${allowance.id}`,
      headers: webSession(OWNER_A),
      payload: {},
    });
    expect(unknownStatus.statusCode).toBe(400);
    expect(emptyChange.statusCode).toBe(400);
  });

  it('answers 409 for a session wallet that already has an allowance', async () => {
    const sessionAddress = await newSessionAddress();
    await createAllowance(OWNER_A, { sessionAddress });

    const { response } = await createAllowance(OWNER_B, { sessionAddress });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'session_already_has_allowance' });
  });

  it("answers 404 when B reads, changes, polls or asks the statement of A's allowance", async () => {
    const { allowance } = await createAllowance(OWNER_A);
    const asB = webSession(OWNER_B);

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: `/allowances/${allowance.id}`, headers: asB }),
      app.inject({
        method: 'PATCH',
        url: `/allowances/${allowance.id}`,
        headers: asB,
        payload: { status: 'paused' },
      }),
      app.inject({ method: 'GET', url: `/allowances/${allowance.id}/payments`, headers: asB }),
      app.inject({
        method: 'GET',
        url: `/allowances/${allowance.id}/statement?month=2026-10`,
        headers: asB,
      }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404]);
    expect(responses[0].json()).toEqual({ error: 'not_found' });

    const stillActive = await app.inject({
      method: 'GET',
      url: `/allowances/${allowance.id}`,
      headers: webSession(OWNER_A),
    });
    expect(stillActive.json()).toMatchObject({ status: 'active' });
  });

  it('answers 400 for an id that is not a uuid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/allowances/not-a-uuid',
      headers: webSession(OWNER_A),
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /allowances/by-session/:address', () => {
  it('publishes caps, status and today spend without authentication', async () => {
    const sessionAddress = await newSessionAddress();
    const { allowance } = await createAllowance(OWNER_A, { sessionAddress });
    await pay(allowance.id, 'translate', 2_000n, '2026-10-10T10:00:00.000Z');

    const response = await app.inject({
      method: 'GET',
      url: `/allowances/by-session/${sessionAddress}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'active',
      perCallCap: '5000',
      dailyCap: '50000',
      spentToday: '2000',
    });
  });

  it('answers 404 for a wallet without allowance', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/allowances/by-session/${await newSessionAddress()}`,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /allowances/:id/payments', () => {
  const poll = (allowanceId: string, after?: string) =>
    app
      .inject({
        method: 'GET',
        url: `/allowances/${allowanceId}/payments${after ? `?after=${after}` : ''}`,
        headers: mobileSession(OWNER_A),
      })
      .then((response) => response.json<{ payments: PaymentView[] }>().payments);

  it('pages oldest first after the cursor and never repeats a payment', async () => {
    const { allowance } = await createAllowance(OWNER_A);
    const { allowance: other } = await createAllowance(OWNER_A);
    await pay(allowance.id, 'summarize', 10_000n, '2026-10-10T11:00:00.000Z');
    await pay(allowance.id, 'translate', 2_000n, '2026-10-10T10:00:00.000Z');
    await pay(allowance.id, 'ocr', 5_000n, '2026-10-10T11:00:00.000Z');
    await pay(other.id, 'ocr', 5_000n, '2026-10-10T10:30:00.000Z');

    const all = await poll(allowance.id);
    expect(all).toHaveLength(3);
    expect(all[0]).toMatchObject({
      serviceId: 'translate',
      amount: '2000',
      settledAt: '2026-10-10T10:00:00.000Z',
    });

    expect(await poll(allowance.id, all[0]!.id)).toEqual(all.slice(1));
    expect(await poll(allowance.id, all[1]!.id)).toEqual(all.slice(2));
    expect(await poll(allowance.id, all[2]!.id)).toEqual([]);
  });

  it('hands out at most 50 payments per poll', async () => {
    const { allowance } = await createAllowance(OWNER_A);
    for (let minute = 0; minute < 51; minute += 1) {
      await pay(
        allowance.id,
        'translate',
        2_000n,
        `2026-10-10T08:${String(minute % 60).padStart(2, '0')}:00.000Z`,
      );
    }

    const firstPage = await poll(allowance.id);
    const secondPage = await poll(allowance.id, firstPage.at(-1)!.id);

    expect(firstPage).toHaveLength(50);
    expect(secondPage).toHaveLength(1);
  });
});

describe('GET /allowances/:id/statement', () => {
  const statementOf = (allowanceId: string, month: string) =>
    app.inject({
      method: 'GET',
      url: `/allowances/${allowanceId}/statement?month=${month}`,
      headers: webSession(OWNER_A),
    });

  it('totals the month by service and by split recipient, with the card-cost comparison', async () => {
    const { allowance } = await createAllowance(OWNER_A);
    const { allowance: other } = await createAllowance(OWNER_A);
    await pay(allowance.id, 'translate', 2_000n, '2026-10-01T00:00:00.000Z');
    await pay(allowance.id, 'summarize', 10_000n, '2026-10-15T12:00:00.000Z');
    await pay(allowance.id, 'translate', 2_000n, '2026-10-31T23:59:59.999Z');
    await pay(allowance.id, 'ocr', 5_000n, '2026-09-30T23:59:59.999Z');
    await pay(allowance.id, 'ocr', 5_000n, '2026-11-01T00:00:00.000Z');
    await pay(other.id, 'ocr', 5_000n, '2026-10-10T10:00:00.000Z');

    const response = await statementOf(allowance.id, '2026-10');

    expect(response.statusCode).toBe(200);
    const statement = response.json<{
      month: string;
      totals: object;
      payments: PaymentView[];
    }>();
    expect(statement.month).toBe('2026-10');
    expect(statement.totals).toEqual({
      amount: '14000',
      // per payment: (amount + 2.9% + 300000) × 1.035, floored → 312630 + 321150 + 312630
      cardEquivalent: '946410',
      byService: [
        { serviceId: 'translate', count: 2, amount: '4000' },
        { serviceId: 'summarize', count: 1, amount: '10000' },
      ],
      byProvider: [
        {
          recipient: RECIPIENT_ENVIRONMENT.PROVIDER_TRANSLATE_ADDRESS,
          role: 'provider',
          amount: '3400',
        },
        { recipient: RECIPIENT_ENVIRONMENT.INTEGRATOR_ADDRESS, role: 'integrator', amount: '700' },
        { recipient: TREASURY_ADDRESS, role: 'platform', amount: '1400' },
        {
          recipient: RECIPIENT_ENVIRONMENT.PROVIDER_SUMMARIZE_ADDRESS,
          role: 'provider',
          amount: '8500',
        },
      ],
    });
    expect(statement.payments.map(({ settledAt }) => settledAt)).toEqual([
      '2026-10-01T00:00:00.000Z',
      '2026-10-15T12:00:00.000Z',
      '2026-10-31T23:59:59.999Z',
    ]);
  });

  it('answers zero totals for a month without payments', async () => {
    const { allowance } = await createAllowance(OWNER_A);

    const response = await statementOf(allowance.id, '2026-02');

    expect(response.json()).toEqual({
      month: '2026-02',
      totals: { amount: '0', cardEquivalent: '0', byService: [], byProvider: [] },
      payments: [],
    });
  });

  it('refuses a month that is not YYYY-MM', async () => {
    const { allowance } = await createAllowance(OWNER_A);

    const responses = await Promise.all(
      ['2026-13', '2026-1', 'october'].map((month) => statementOf(allowance.id, month)),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400, 400]);
  });
});

describe('OpenAPI', () => {
  it('documents the new routes at /docs/json', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json<{ paths: object }>().paths)).toEqual(
      expect.arrayContaining([
        '/auth/nonce',
        '/auth/verify',
        '/auth/pair',
        '/allowances',
        '/allowances/{id}',
        '/allowances/by-session/{address}',
        '/allowances/{id}/payments',
        '/allowances/{id}/statement',
      ]),
    );
  });
});
