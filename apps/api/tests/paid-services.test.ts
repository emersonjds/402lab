import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { SOLANA_DEVNET, USDC_DEVNET_MINT } from '@402lab/shared';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { resolveAdapters } from '../src/features/paid-services/adapters/index.js';
import { UpstreamError } from '../src/features/paid-services/adapters/types.js';
import { type Config, loadConfig } from '../src/shared/config/index.js';
import { createEventsBus } from '../src/shared/events-bus.js';
import { ADMIN_DATABASE_URL, createTestDatabase, type TestDatabase } from './support/database.js';
import { RECIPIENT_ENVIRONMENT, TREASURY_ADDRESS } from './support/environment.js';

const ENVIRONMENT = { ...RECIPIENT_ENVIRONMENT, DATABASE_URL: ADMIN_DATABASE_URL };

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
let config: Config;
let app: FastifyInstance;
let testDatabase: TestDatabase;

const ledgerDependencies = () => ({
  database: testDatabase.database,
  bus: createEventsBus(),
  now: () => new Date('2026-10-10T15:00:00.000Z'),
});

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

  config = loadConfig({
    ...ENVIRONMENT,
    FACILITATOR_URL: `http://127.0.0.1:${String(port)}`,
    LOG_LEVEL: 'silent',
  });
  app = await buildApp({ config, ...ledgerDependencies() });
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
  await new Promise((resolve) => facilitator.close(resolve));
});

beforeEach(() => {
  facilitatorCalls.length = 0;
});

const TRANSLATE_INPUT = { text: 'Hello world', targetLanguage: 'pt' };

const payAndCall = async (target: FastifyInstance, url: string, payload: object) => {
  const terms = await target.inject({ method: 'POST', url, payload });
  const paymentRequired = decodePaymentRequiredHeader(terms.headers['payment-required'] as string);
  const paymentSignature = encodePaymentSignatureHeader({
    x402Version: 2,
    accepted: paymentRequired.accepts[0]!,
    payload: { transaction: 'signed-transaction-base64' },
  });

  return target.inject({
    method: 'POST',
    url,
    payload,
    headers: { 'payment-signature': paymentSignature },
  });
};

describe('paid services', () => {
  it.each([
    ['/svc/ocr', { imageUrl: 'https://images.example.com/receipt.png' }, '5000'],
    ['/svc/translate', TRANSLATE_INPUT, '2000'],
    ['/svc/summarize', { text: 'A long article.' }, '10000'],
  ])(
    'answers %s with 402 and devnet USDC terms paying the treasury',
    async (url, payload, amount) => {
      const response = await app.inject({ method: 'POST', url, payload });

      expect(response.statusCode).toBe(402);
      expect(
        decodePaymentRequiredHeader(response.headers['payment-required'] as string).accepts[0],
      ).toMatchObject({
        scheme: 'exact',
        network: SOLANA_DEVNET,
        payTo: TREASURY_ADDRESS,
        asset: USDC_DEVNET_MINT,
        amount,
      });
    },
  );

  it('asks for payment before looking at the body', async () => {
    const response = await app.inject({ method: 'POST', url: '/svc/translate', payload: {} });

    expect(response.statusCode).toBe(402);
  });

  it('serves the demo translation and returns the settled signature once paid', async () => {
    const response = await payAndCall(app, '/svc/translate', TRANSLATE_INPUT);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mode: 'demo', result: '[pt] Hello world' });
    expect(
      decodePaymentResponseHeader(response.headers['payment-response'] as string),
    ).toMatchObject({ success: true, transaction: SETTLED_SIGNATURE, payer: PAYER_ADDRESS });
    expect(facilitatorCalls).toEqual(expect.arrayContaining(['POST /verify', 'POST /settle']));
  });

  it('refuses an invalid body with 400 and never settles', async () => {
    const response = await payAndCall(app, '/svc/translate', {
      text: '',
      targetLanguage: 'portuguese',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_input' });
    expect(facilitatorCalls).toContain('POST /verify');
    expect(facilitatorCalls).not.toContain('POST /settle');
  });

  it('refuses an image URL that is not http or https', async () => {
    const response = await payAndCall(app, '/svc/ocr', { imageUrl: 'file:///etc/passwd' });

    expect(response.statusCode).toBe(400);
    expect(facilitatorCalls).not.toContain('POST /settle');
  });

  it('no longer sells the spike echo route', async () => {
    const response = await app.inject({ method: 'GET', url: '/svc/echo' });

    expect(response.statusCode).toBe(404);
  });

  it('lists the catalog publicly, without payment', async () => {
    const response = await app.inject({ method: 'GET', url: '/services' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      services: [
        { id: 'ocr', price: '5000', mode: 'demo' },
        { id: 'translate', price: '2000', mode: 'demo' },
        { id: 'summarize', price: '10000', mode: 'demo' },
      ],
    });
  });
});

describe('paid services with a failing upstream', () => {
  const appWithTranslate = (translate: () => Promise<never>) =>
    buildApp({
      config,
      ...ledgerDependencies(),
      adapters: { ...resolveAdapters(config), translate },
    });

  it('answers 502 upstream_unavailable without upstream text and never settles', async () => {
    const failing = await appWithTranslate(async () => {
      throw new UpstreamError('aws-translate', { cause: new Error('ThrottlingException') });
    });

    const response = await payAndCall(failing, '/svc/translate', TRANSLATE_INPUT);

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'upstream_unavailable' });
    expect(facilitatorCalls).not.toContain('POST /settle');
    await failing.close();
  });

  it('answers 500 for an unexpected failure and never settles', async () => {
    const broken = await appWithTranslate(async () => {
      throw new Error('bug');
    });

    const response = await payAndCall(broken, '/svc/translate', TRANSLATE_INPUT);

    expect(response.statusCode).toBe(500);
    expect(facilitatorCalls).not.toContain('POST /settle');
    await broken.close();
  });
});

describe('config', () => {
  it('defaults to the public x402.org facilitator', () => {
    expect(loadConfig(ENVIRONMENT).FACILITATOR_URL).toBe('https://x402.org/facilitator');
  });

  it.each(Object.keys(RECIPIENT_ENVIRONMENT))('refuses to boot without a valid %s', (name) => {
    expect(() => loadConfig({ ...ENVIRONMENT, [name]: 'not-a-solana-address' })).toThrow(name);
    expect(() => loadConfig({ ...ENVIRONMENT, [name]: undefined })).toThrow(name);
  });

  it('treats blank upstream credentials as absent', () => {
    const loaded = loadConfig({ ...ENVIRONMENT, AZURE_VISION_KEY: '', AWS_REGION: '' });

    expect(loaded.AZURE_VISION_KEY).toBeUndefined();
    expect(loaded.AWS_REGION).toBeUndefined();
  });

  it('refuses an Azure endpoint that is not a URL', () => {
    expect(() => loadConfig({ ...ENVIRONMENT, AZURE_VISION_ENDPOINT: 'vision' })).toThrow(
      /AZURE_VISION_ENDPOINT/,
    );
  });

  it('refuses to boot without a postgres connection string', () => {
    expect(() => loadConfig(RECIPIENT_ENVIRONMENT)).toThrow(/DATABASE_URL/);
    expect(() =>
      loadConfig({ ...RECIPIENT_ENVIRONMENT, DATABASE_URL: 'mysql://lab@localhost/lab' }),
    ).toThrow(/DATABASE_URL/);
  });
});
