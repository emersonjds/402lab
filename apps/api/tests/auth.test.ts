import { generateKeyPairSigner, getBase58Encoder } from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildTestApp, createAllowance, signIn, signMessage } from './helpers.js';

const nonceSchema = z.object({
  nonce: z.string(),
  message: z.string(),
  expiresAt: z.iso.datetime(),
});

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

const startSignIn = async () => {
  const signer = await generateKeyPairSigner();
  const nonce = await app.inject({ method: 'GET', url: `/auth/nonce?address=${signer.address}` });
  const { message } = nonceSchema.parse(nonce.json());
  return { signer, message, signature: await signMessage(signer, message) };
};

const verify = (payload: { address: string; message: string; signature: string }) =>
  app.inject({ method: 'POST', url: '/auth/verify', payload });

describe('Sign-In With Solana', () => {
  it('issues a nonce message bound to the address', async () => {
    const signer = await generateKeyPairSigner();

    const response = await app.inject({
      method: 'GET',
      url: `/auth/nonce?address=${signer.address}`,
    });

    expect(response.statusCode).toBe(200);
    const { nonce, message } = nonceSchema.parse(response.json());
    expect(message).toBe(`402Lab login\nAddress: ${signer.address}\nNonce: ${nonce}`);
  });

  it('refuses a nonce for something that is not a Solana address', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/nonce?address=not-a-wallet' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_input' });
  });

  it('signs in with a real ed25519 signature and sets an httpOnly session cookie', async () => {
    const { signer, message, signature } = await startSignIn();

    const response = await verify({ address: signer.address, message, signature });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ address: signer.address });
    const cookie = response.cookies.find(({ name }) => name === 'session');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });

    const allowances = await app.inject({
      method: 'GET',
      url: '/allowances',
      headers: { cookie: `session=${cookie!.value}` },
    });
    expect(allowances.statusCode).toBe(200);
  });

  it('accepts a base64 signature as well as base58', async () => {
    const { signer, message, signature } = await startSignIn();
    const base64 = Buffer.from(getBase58Encoder().encode(signature)).toString('base64');

    expect((await verify({ address: signer.address, message, signature: base64 })).statusCode).toBe(
      200,
    );
  });

  it('rejects a replay of a nonce already used', async () => {
    const attempt = await startSignIn();
    const payload = { address: attempt.signer.address, ...attempt };

    expect((await verify(payload)).statusCode).toBe(200);
    const replay = await verify(payload);

    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toEqual({ error: 'unauthorized' });
    expect(replay.cookies).toHaveLength(0);
  });

  it('rejects a signature made by another key', async () => {
    const { signer, message } = await startSignIn();
    const impostor = await generateKeyPairSigner();

    const response = await verify({
      address: signer.address,
      message,
      signature: await signMessage(impostor, message),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a message whose address differs from the signer, and a garbage signature', async () => {
    const { signer, message, signature } = await startSignIn();
    const other = await generateKeyPairSigner();

    expect((await verify({ address: other.address, message, signature })).statusCode).toBe(401);
    expect((await verify({ address: signer.address, message, signature: 'xyz' })).statusCode).toBe(
      401,
    );
  });
});

describe('authentication by default', () => {
  it.each([
    ['GET', '/allowances'],
    ['POST', '/allowances'],
    ['GET', '/allowances/7b1b0c6e-5b0a-4a3e-9a4f-2d7f1e0f4c11'],
    ['PATCH', '/allowances/7b1b0c6e-5b0a-4a3e-9a4f-2d7f1e0f4c11'],
    ['GET', '/allowances/7b1b0c6e-5b0a-4a3e-9a4f-2d7f1e0f4c11/payments'],
    ['POST', '/auth/pair'],
    ['POST', '/auth/revoke-devices'],
    ['GET', '/splits'],
  ] as const)('%s %s answers 401 without a session', async (method, url) => {
    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized' });
  });

  it('answers 401 for a forged session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/allowances',
      headers: { cookie: 'session=eyJhbGciOiJIUzI1NiJ9.e30.forged' },
    });

    expect(response.statusCode).toBe(401);
  });

  it("answers 404, not 403, for another owner's allowance on every route", async () => {
    const alice = await signIn(app);
    const bob = await signIn(app);
    const { id } = await createAllowance(app, alice.headers);

    for (const request of [
      { method: 'GET', url: `/allowances/${id}` },
      { method: 'GET', url: `/allowances/${id}/payments` },
      { method: 'GET', url: `/allowances/${id}/statement?month=2026-10` },
      { method: 'PATCH', url: `/allowances/${id}`, payload: { status: 'paused' } },
    ] as const) {
      const response = await app.inject({ ...request, headers: bob.headers });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'not_found' });
    }

    const own = await app.inject({
      method: 'GET',
      url: `/allowances/${id}`,
      headers: alice.headers,
    });
    expect(own.json()).toMatchObject({ id, status: 'active' });
  });

  it('pairs a phone whose bearer token may read but not create allowances', async () => {
    const owner = await signIn(app);
    const paired = await app.inject({ method: 'POST', url: '/auth/pair', headers: owner.headers });
    const { token } = z.object({ token: z.string() }).parse(paired.json());
    const bearer = { authorization: `Bearer ${token}` };

    expect(
      (await app.inject({ method: 'GET', url: '/allowances', headers: bearer })).statusCode,
    ).toBe(200);
    const create = await app.inject({
      method: 'POST',
      url: '/allowances',
      headers: bearer,
      payload: {
        agentName: 'x',
        sessionAddress: owner.signer.address,
        perCallCap: '1',
        dailyCap: '1',
      },
    });
    expect(create.statusCode).toBe(403);
    expect(create.json()).toEqual({ error: 'web_session_required' });
  });

  it('revokes every session of the owner, the current one included', async () => {
    const owner = await signIn(app);

    const revoked = await app.inject({
      method: 'POST',
      url: '/auth/revoke-devices',
      headers: owner.headers,
    });
    expect(revoked.statusCode).toBe(204);

    // `iat` is whole seconds, so it falls before a revocation stamped in milliseconds.
    const after = await app.inject({ method: 'GET', url: '/allowances', headers: owner.headers });
    expect(after.statusCode).toBe(401);
  });
});
