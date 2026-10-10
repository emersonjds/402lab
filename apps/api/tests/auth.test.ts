import {
  createSignableMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  type KeyPairSigner,
} from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, mobileSession, NOW, testConfig, webSession } from './support/app.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let testDatabase: TestDatabase;
let app: FastifyInstance;
let clock: Date;
let wallet: KeyPairSigner;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  app = await buildTestApp(testDatabase, { now: () => clock });
  wallet = await generateKeyPairSigner();
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
});

beforeEach(() => {
  clock = NOW;
});

const requestNonce = async (address: string) => {
  const response = await app.inject({ method: 'GET', url: `/auth/nonce?address=${address}` });
  expect(response.statusCode).toBe(200);

  return response.json<{ nonce: string; message: string; expiresAt: string }>();
};

const sign = async (signer: KeyPairSigner, message: string): Promise<Uint8Array> => {
  const [signatures] = await signer.signMessages([createSignableMessage(message)]);

  return signatures![signer.address]!;
};

const base58 = (bytes: Uint8Array): string => getBase58Decoder().decode(bytes);

const verify = (payload: { address: string; signature: string; message: string }) =>
  app.inject({ method: 'POST', url: '/auth/verify', payload });

describe('sign-in with solana', () => {
  it('issues a nonce with the exact message to sign, valid for 5 minutes', async () => {
    const { nonce, message, expiresAt } = await requestNonce(wallet.address);

    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(message).toBe(`402Lab login\nAddress: ${wallet.address}\nNonce: ${nonce}`);
    expect(expiresAt).toBe('2026-10-10T15:05:00.000Z');
  });

  it('refuses a nonce for something that is not a Solana address', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/nonce?address=not-an-address' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_input' });
  });

  it('signs in with a valid signature and sets an httpOnly, lax, secure session cookie', async () => {
    const { message } = await requestNonce(wallet.address);

    const response = await verify({
      address: wallet.address,
      message,
      signature: base58(await sign(wallet, message)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ address: wallet.address });
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/^session=[^;]+;/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain(`Max-Age=${String(7 * 24 * 60 * 60)}`);

    const session = setCookie.split(';')[0]!;
    const protectedRoute = await app.inject({
      method: 'GET',
      url: '/splits',
      headers: { cookie: session },
    });
    expect(protectedRoute.statusCode).toBe(200);
  });

  it('accepts a base64 signature too', async () => {
    const { message } = await requestNonce(wallet.address);

    const response = await verify({
      address: wallet.address,
      message,
      signature: Buffer.from(await sign(wallet, message)).toString('base64'),
    });

    expect(response.statusCode).toBe(200);
  });

  it('refuses a signature made by another wallet', async () => {
    const intruder = await generateKeyPairSigner();
    const { message } = await requestNonce(wallet.address);

    const response = await verify({
      address: wallet.address,
      message,
      signature: base58(await sign(intruder, message)),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('refuses a nonce used twice', async () => {
    const { message } = await requestNonce(wallet.address);
    const signature = base58(await sign(wallet, message));

    expect((await verify({ address: wallet.address, message, signature })).statusCode).toBe(200);
    expect((await verify({ address: wallet.address, message, signature })).statusCode).toBe(401);
  });

  it('refuses an expired nonce', async () => {
    const { message } = await requestNonce(wallet.address);
    const signature = base58(await sign(wallet, message));
    clock = new Date(NOW.getTime() + 5 * 60 * 1000);

    expect((await verify({ address: wallet.address, message, signature })).statusCode).toBe(401);
  });

  it('refuses a nonce issued to another address', async () => {
    const other = await generateKeyPairSigner();
    const { nonce } = await requestNonce(other.address);
    const message = `402Lab login\nAddress: ${wallet.address}\nNonce: ${nonce}`;

    const response = await verify({
      address: wallet.address,
      message,
      signature: base58(await sign(wallet, message)),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a message that is not the exact login text', async () => {
    const { nonce } = await requestNonce(wallet.address);
    const message = `402Lab login\nAddress: ${wallet.address}\nNonce: ${nonce}\nExtra: yes`;

    const response = await verify({
      address: wallet.address,
      message,
      signature: base58(await sign(wallet, message)),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a signature that is neither 64 bytes of base58 nor of base64', async () => {
    const { message } = await requestNonce(wallet.address);

    const response = await verify({ address: wallet.address, message, signature: 'abc' });

    expect(response.statusCode).toBe(401);
  });

  it('leaves the cookie without Secure only in development', async () => {
    const developmentApp = await buildTestApp(testDatabase, {
      config: testConfig({ NODE_ENV: 'development' }),
      now: () => clock,
    });
    const nonce = await developmentApp.inject({
      method: 'GET',
      url: `/auth/nonce?address=${wallet.address}`,
    });
    const { message } = nonce.json<{ message: string }>();

    const response = await developmentApp.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { address: wallet.address, message, signature: base58(await sign(wallet, message)) },
    });

    expect(response.statusCode).toBe(200);
    expect(String(response.headers['set-cookie'])).not.toContain('Secure');
    await developmentApp.close();
  });
});

describe('protected routes', () => {
  it('answer 401 without a session or with a forged token', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/splits' });
    const forged = await app.inject({
      method: 'GET',
      url: '/splits',
      headers: { authorization: 'Bearer not.a.token' },
    });

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: 'unauthorized' });
    expect(forged.statusCode).toBe(401);
  });

  it('keeps the catalog public and puts the split history behind a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/services' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/splits' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/splits', headers: webSession(wallet.address) }))
        .statusCode,
    ).toBe(200);
  });

  it('answers a malformed JSON body with a fixed 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      headers: { 'content-type': 'application/json' },
      payload: '{"address":',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'bad_request' });
  });
});

describe('mobile pairing', () => {
  it('turns a web session into a 30-day Bearer token that reaches protected routes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/pair',
      headers: webSession(wallet.address),
    });

    expect(response.statusCode).toBe(200);
    const { token, expiresAt } = response.json<{ token: string; expiresAt: string }>();
    expect(expiresAt).toBe('2026-11-09T15:00:00.000Z');

    const protectedRoute = await app.inject({
      method: 'GET',
      url: '/splits',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(protectedRoute.statusCode).toBe(200);
  });

  it('refuses to pair from a mobile token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/pair',
      headers: mobileSession(wallet.address),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'web_session_required' });
  });

  it('refuses to pair without a session', async () => {
    expect((await app.inject({ method: 'POST', url: '/auth/pair' })).statusCode).toBe(401);
  });
});
