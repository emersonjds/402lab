import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { waitlist } from '../src/shared/db/schema.js';
import { buildTestApp } from './support/app.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let testDatabase: TestDatabase;
let app: FastifyInstance;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  app = await buildTestApp(testDatabase);
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
});

const join = (email: string, remoteAddress: string) =>
  app.inject({ method: 'POST', url: '/waitlist', payload: { email }, remoteAddress });

describe('POST /waitlist', () => {
  it('refuses something that is not an e-mail', async () => {
    const response = await join('not-an-email', '10.0.0.1');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_input' });
  });

  it('answers 201 for a repeated e-mail without storing it twice', async () => {
    const first = await join('Ada@Example.com', '10.0.0.2');
    const repeated = await join('ada@example.com', '10.0.0.2');

    expect(first.statusCode).toBe(201);
    expect(repeated.statusCode).toBe(201);
    expect(await testDatabase.database.select().from(waitlist)).toEqual([
      { email: 'ada@example.com', createdAt: expect.any(Date) as Date },
    ]);
  });

  it('allows 5 sign-ups per minute per address, then answers a fixed 429', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await join(`user${String(attempt)}@example.com`, '10.0.0.3')).statusCode);
    }
    const throttled = await join('user5@example.com', '10.0.0.3');
    const otherAddress = await join('other@example.com', '10.0.0.4');

    expect(statuses).toEqual([201, 201, 201, 201, 201]);
    expect(throttled.statusCode).toBe(429);
    expect(throttled.json()).toEqual({ error: 'too_many_requests' });
    expect(otherAddress.statusCode).toBe(201);
  });
});
