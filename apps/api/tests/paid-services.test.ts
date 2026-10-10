import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { SOLANA_DEVNET, USDC_DEVNET_MINT } from '@402lab/shared';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/shared/config/index.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import { ADMIN_DATABASE_URL, createTestDatabase, type TestDatabase } from './support/database.js';

const TREASURY_ADDRESS = '5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj';
const PAYER_ADDRESS = '3Vp5E3DjqXhDJT3QuUGDhE4e6bnHxLgpnQY33oKtyUKQ';
const SETTLED_SIGNATURE = '5fakeSettledSignature';

const facilitatorResponses: Record<string, unknown> = {
  'GET /supported': {
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
  },
  'POST /verify': { isValid: true, payer: PAYER_ADDRESS },
  'POST /settle': {
    success: true,
    transaction: SETTLED_SIGNATURE,
    network: SOLANA_DEVNET,
    payer: PAYER_ADDRESS,
  },
};

const facilitatorCalls: string[] = [];

const answerAsFacilitator = (request: IncomingMessage): unknown => {
  const route = `${request.method ?? ''} ${request.url ?? ''}`;
  facilitatorCalls.push(route);
  return facilitatorResponses[route];
};

let facilitator: Server;
let app: FastifyInstance;
let testDatabase: TestDatabase;

beforeAll(async () => {
  facilitator = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(answerAsFacilitator(request)));
    });
  });
  await new Promise<void>((resolve) => facilitator.listen(0, '127.0.0.1', resolve));
  const { port } = facilitator.address() as AddressInfo;
  testDatabase = await createTestDatabase();

  app = await buildApp({
    config: loadConfig({
      FACILITATOR_URL: `http://127.0.0.1:${String(port)}`,
      TREASURY_ADDRESS,
      DATABASE_URL: ADMIN_DATABASE_URL,
      LOG_LEVEL: 'silent',
    }),
    database: testDatabase.database,
    bus: createEventsBus(),
    now: () => new Date('2026-10-10T15:00:00.000Z'),
  });
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
  await new Promise((resolve) => facilitator.close(resolve));
});

const requestPaymentTerms = async () => {
  const response = await app.inject({ method: 'GET', url: '/svc/echo' });
  return {
    response,
    paymentRequired: decodePaymentRequiredHeader(response.headers['payment-required'] as string),
  };
};

describe('paid services', () => {
  it('answers 402 with devnet USDC terms paying the treasury when no payment is sent', async () => {
    const { response, paymentRequired } = await requestPaymentTerms();

    expect(response.statusCode).toBe(402);
    expect(paymentRequired.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: SOLANA_DEVNET,
      payTo: TREASURY_ADDRESS,
      asset: USDC_DEVNET_MINT,
      amount: '1000',
    });
  });

  it('serves the route and returns the settled signature once the facilitator settles', async () => {
    const { paymentRequired } = await requestPaymentTerms();
    const paymentSignature = encodePaymentSignatureHeader({
      x402Version: 2,
      accepted: paymentRequired.accepts[0]!,
      payload: { transaction: 'signed-transaction-base64' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/svc/echo',
      headers: { 'payment-signature': paymentSignature },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(
      decodePaymentResponseHeader(response.headers['payment-response'] as string),
    ).toMatchObject({
      success: true,
      transaction: SETTLED_SIGNATURE,
      payer: PAYER_ADDRESS,
    });
    expect(facilitatorCalls).toEqual(expect.arrayContaining(['POST /verify', 'POST /settle']));
  });
});

describe('config', () => {
  it('defaults to the public x402.org facilitator', () => {
    expect(loadConfig({ TREASURY_ADDRESS, DATABASE_URL: ADMIN_DATABASE_URL }).FACILITATOR_URL).toBe(
      'https://x402.org/facilitator',
    );
  });

  it('refuses to boot without a valid treasury address', () => {
    expect(() =>
      loadConfig({ TREASURY_ADDRESS: 'not-a-solana-address', DATABASE_URL: ADMIN_DATABASE_URL }),
    ).toThrow(/TREASURY_ADDRESS/);
    expect(() => loadConfig({})).toThrow(/TREASURY_ADDRESS/);
  });

  it('refuses to boot without a postgres connection string', () => {
    expect(() => loadConfig({ TREASURY_ADDRESS })).toThrow(/DATABASE_URL/);
    expect(() =>
      loadConfig({ TREASURY_ADDRESS, DATABASE_URL: 'mysql://lab@localhost/lab' }),
    ).toThrow(/DATABASE_URL/);
  });
});
