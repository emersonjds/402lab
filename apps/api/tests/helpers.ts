import { type ServiceId, SOLANA_DEVNET } from '@402lab/shared';
import {
  createSignableMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  type KeyPairSigner,
} from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod';

import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/shared/config/index.js';
import { createDatabase, createPool } from '../src/shared/db/pool.js';
import { createEventsBus } from '../src/shared/events-bus.js';

export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgres://lab:lab@localhost:5432/lab402_test';

const FACILITATOR_URL = 'https://facilitator.test';
const AZURE_URL = 'https://azure.test';
export const RPC_URL = 'https://rpc.test';
export const FEE_PAYER = 'AdhhL9qrQHQfHrvxhcpVmZoKbRQoBFgjpRVkG4aymRYx';

export const config = loadConfig({
  TREASURY_ADDRESS: 'xHRnupmtokryHHFn6iZCeJx3Bgv7oy8wB8mjhESuwWh',
  PROVIDER_OCR_ADDRESS: 'B1y7zhWxh2fQJtu6NeDYtjDLRStZ8xgFvEkMEbB6A9P9',
  PROVIDER_TRANSLATE_ADDRESS: 'DNiqRNuXuvCqQeVZu1xZhiPKY31zo6B9YV2zh6DdFP2L',
  PROVIDER_SUMMARIZE_ADDRESS: '6X3nAPE4AF6FE77AbBwanRoEg2VhARw9Bko6KA4wgoN8',
  INTEGRATOR_ADDRESS: '9hsuhtQsUmYjo47wbvuwU24pFrSzTHpEhFvTUDKiELvN',
  DATABASE_URL: TEST_DATABASE_URL,
  FACILITATOR_URL,
  SOLANA_RPC_URL: RPC_URL,
  AZURE_VISION_ENDPOINT: AZURE_URL,
  AZURE_VISION_KEY: 'test-azure-key',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
});

export const pool = createPool(TEST_DATABASE_URL);
export const db = createDatabase(pool);

export const truncateAll = async (): Promise<void> => {
  await pool.query(
    'truncate payouts, payments, split_batches, allowances, auth_nonces, owner_sessions, ' +
      'onramps, reconciliation_cursor, waitlist',
  );
};

/** What the fake facilitator saw and how it answers; reset before every test. */
export const facilitator = {
  calls: [] as ('supported' | 'verify' | 'settle')[],
  payer: FEE_PAYER as string,
  settleSucceeds: true,
  settled: 0,
};

export const resetFacilitator = (): void => {
  facilitator.calls = [];
  facilitator.payer = FEE_PAYER;
  facilitator.settleSucceeds = true;
  facilitator.settled = 0;
};

export const upstream = { azureStatus: 200 };

export const server = setupServer(
  http.get(`${FACILITATOR_URL}/supported`, () => {
    facilitator.calls.push('supported');
    return HttpResponse.json({
      kinds: [
        { x402Version: 2, scheme: 'exact', network: SOLANA_DEVNET, extra: { feePayer: FEE_PAYER } },
      ],
      extensions: [],
      signers: {},
    });
  }),
  http.post(`${FACILITATOR_URL}/verify`, () => {
    facilitator.calls.push('verify');
    return HttpResponse.json({ isValid: true, payer: facilitator.payer });
  }),
  http.post(`${FACILITATOR_URL}/settle`, () => {
    facilitator.calls.push('settle');
    if (!facilitator.settleSucceeds) {
      return HttpResponse.json({
        success: false,
        errorReason: 'insufficient_funds',
        errorMessage: 'facilitator internal text that must not leak',
        transaction: '',
        network: SOLANA_DEVNET,
      });
    }
    facilitator.settled += 1;
    return HttpResponse.json({
      success: true,
      payer: facilitator.payer,
      transaction: `settled-tx-${String(facilitator.settled)}`,
      network: SOLANA_DEVNET,
    });
  }),
  http.post(`${AZURE_URL}/computervision/imageanalysis:analyze`, () =>
    upstream.azureStatus === 200
      ? HttpResponse.json({ readResult: { blocks: [{ lines: [{ text: 'TOTAL $7.00' }] }] } })
      : HttpResponse.json({ error: 'azure exploded' }, { status: upstream.azureStatus }),
  ),
);

export const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = await buildApp({
    config,
    database: db,
    bus: createEventsBus(),
    now: () => new Date(),
  });
  await app.ready();
  return app;
};

const nonceSchema = z.object({ message: z.string() });

export const signMessage = async (signer: KeyPairSigner, message: string): Promise<string> => {
  const [signatures] = await signer.signMessages([createSignableMessage(message)]);
  const signature = signatures?.[signer.address];
  if (!signature) throw new Error('wallet did not sign');

  return getBase58Decoder().decode(signature);
};

/** Full Sign-In With Solana with a real ed25519 key; answers the cookie header to send. */
export const signIn = async (app: FastifyInstance, owner?: KeyPairSigner) => {
  const signer = owner ?? (await generateKeyPairSigner());
  const nonce = await app.inject({ method: 'GET', url: `/auth/nonce?address=${signer.address}` });
  const { message } = nonceSchema.parse(nonce.json());
  const verified = await app.inject({
    method: 'POST',
    url: '/auth/verify',
    payload: { address: signer.address, message, signature: await signMessage(signer, message) },
  });
  const session = verified.cookies.find(({ name }) => name === 'session');
  if (!session) throw new Error(`sign-in failed: ${String(verified.statusCode)}`);

  return { signer, headers: { cookie: `session=${session.value}` } };
};

export const allowanceViewSchema = z.object({
  id: z.uuid(),
  sessionAddress: z.string(),
  status: z.enum(['active', 'paused']),
  perCallCap: z.string(),
  dailyCap: z.string(),
  spentToday: z.string(),
});

export const createAllowance = async (
  app: FastifyInstance,
  headers: { cookie: string },
  caps: { perCallCap: string; dailyCap: string } = { perCallCap: '5000', dailyCap: '20000' },
) => {
  const session = await generateKeyPairSigner();
  const created = await app.inject({
    method: 'POST',
    url: '/allowances',
    headers,
    payload: { agentName: 'test agent', sessionAddress: session.address, ...caps },
  });
  if (created.statusCode !== 201) throw new Error(`allowance not created: ${created.body}`);

  return allowanceViewSchema.parse(created.json());
};

export const decodeHeader = (value: unknown): unknown => {
  if (typeof value !== 'string') throw new Error('header missing');
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
};

export const paymentRequiredSchema = z.object({
  x402Version: z.number(),
  resource: z.unknown(),
  accepts: z
    .array(
      z.looseObject({
        scheme: z.string(),
        network: z.string(),
        asset: z.string(),
        amount: z.string(),
        payTo: z.string(),
      }),
    )
    .length(1),
});

/** The 402 challenge, then the same call retried with a signed payment for what it asked. */
export const pay = async (app: FastifyInstance, serviceId: ServiceId, payload: object) => {
  const url = `/svc/${serviceId}`;
  const challenge = await app.inject({ method: 'POST', url, payload });
  const required = paymentRequiredSchema.parse(decodeHeader(challenge.headers['payment-required']));
  const payment = {
    x402Version: required.x402Version,
    resource: required.resource,
    accepted: required.accepts[0],
    payload: { transaction: Buffer.from('signed by the session wallet').toString('base64') },
  };

  return app.inject({
    method: 'POST',
    url,
    payload,
    headers: { 'payment-signature': Buffer.from(JSON.stringify(payment)).toString('base64') },
  });
};
