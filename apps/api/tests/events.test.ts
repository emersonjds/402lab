import type { LiveEvent } from '@402lab/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createEventsBus, type EventsBus } from '../src/shared/events-bus.js';
import { buildTestApp, webSession } from './support/app.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

const OWNER_A = 'owner-a-address';
const OWNER_B = 'owner-b-address';

const settled = (paymentId: string): LiveEvent => ({
  type: 'payment.settled',
  paymentId,
  serviceId: 'translate',
  allowanceId: null,
  amount: '2000',
  txSignature: `signature-${paymentId}`,
  settledAt: '2026-10-10T15:00:00.000Z',
});

let testDatabase: TestDatabase;
let app: FastifyInstance;
let baseUrl: string;
const bus = createEventsBus();
let unsubscribed = 0;
const trackedBus: EventsBus = {
  publish: bus.publish,
  subscribe: (owner, listener) => {
    const unsubscribe = bus.subscribe(owner, listener);
    return () => {
      unsubscribed += 1;
      unsubscribe();
    };
  },
};

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  app = await buildTestApp(testDatabase, { bus: trackedBus });
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
});

afterEach(() => {
  vi.useRealTimers();
});

const openStream = async (owner: string) => {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/events`, {
    headers: webSession(owner),
    signal: controller.signal,
  });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let received = '';

  const readUntil = async (marker: string): Promise<string> => {
    while (!received.includes(marker)) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream ended');
      received += value;
    }
    return received;
  };

  return {
    response,
    readUntil,
    close: () => {
      controller.abort();
    },
  };
};

describe('GET /events', () => {
  it("streams the caller's events and none of another owner", async () => {
    const stream = await openStream(OWNER_A);
    await stream.readUntil(': connected');

    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get('content-type')).toBe('text/event-stream');

    trackedBus.publish(OWNER_B, settled('payment-of-b'));
    trackedBus.publish(OWNER_A, settled('payment-of-a'));
    const received = await stream.readUntil('payment-of-a');

    expect(received).toContain(`data: ${JSON.stringify(settled('payment-of-a'))}\n\n`);
    expect(received).not.toContain('payment-of-b');

    const before = unsubscribed;
    stream.close();
    await vi.waitFor(() => {
      expect(unsubscribed).toBe(before + 1);
    });
  });

  it('sends a heartbeat every 15 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const stream = await openStream(OWNER_A);
    await stream.readUntil(': connected');

    vi.advanceTimersByTime(15_000);

    expect(await stream.readUntil(': heartbeat')).toContain(': heartbeat\n\n');
    stream.close();
  });

  it('refuses a caller without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/events' });

    expect(response.statusCode).toBe(401);
  });
});
