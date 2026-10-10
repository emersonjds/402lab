import { randomBytes } from 'node:crypto';

import { address } from '@solana/kit';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { callerOf, SESSION_COOKIE } from '../../shared/auth/authenticate.js';
import { revokeSessionsIssuedBefore } from '../../shared/auth/revocation.js';
import { SESSION_LIFETIME_SECONDS, signSession } from '../../shared/auth/tokens.js';
import type { Database } from '../../shared/db/pool.js';
import { AppError, errorSchema } from '../../shared/errors.js';
import { consumeNonce, storeNonce } from './repository.js';
import {
  nonceQuerySchema,
  nonceResponseSchema,
  pairingSchema,
  signedInSchema,
  verifyBodySchema,
} from './schemas.js';
import { isSignedBy, nonceOf, siwsMessage } from './siws.js';

const NONCE_LIFETIME_MS = 5 * 60 * 1000;
const NONCE_BYTES = 16;
const NONCES_PER_MINUTE = 30;
const VERIFIES_PER_MINUTE = 10;

export interface AuthOptions {
  db: Database;
  now: () => Date;
  jwtSecret: string;
  secureCookie: boolean;
}

/** Sign-In With Solana (web) plus mobile pairing: the only routes a signed-out caller may hit. */
export const authRoutes: FastifyPluginCallbackZod<AuthOptions> = (
  app,
  { db, now, jwtSecret, secureCookie },
  done,
) => {
  /** Public. One nonce per sign-in attempt; expired nonces are swept lazily on the next call. */
  app.get(
    '/auth/nonce',
    {
      config: { public: true, rateLimit: { max: NONCES_PER_MINUTE, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Start a Sign-In With Solana: the message the wallet must sign',
        querystring: nonceQuerySchema,
        response: { 200: nonceResponseSchema, 400: errorSchema },
      },
    },
    async (request) => {
      const nonce = randomBytes(NONCE_BYTES).toString('hex');
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + NONCE_LIFETIME_MS);

      await storeNonce(db, { nonce, address: request.query.address, expiresAt }, issuedAt);

      return {
        nonce,
        message: siwsMessage(request.query.address, nonce),
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  /** Public. Consuming the nonce is the only replay guard; a signature over a stale or
   * already-used nonce is rejected before the wallet signature is even checked. */
  app.post(
    '/auth/verify',
    {
      config: { public: true, rateLimit: { max: VERIFIES_PER_MINUTE, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Finish a Sign-In With Solana; sets the httpOnly `session` cookie',
        body: verifyBodySchema,
        response: { 200: signedInSchema, 400: errorSchema, 401: errorSchema, 429: errorSchema },
      },
    },
    async (request, reply) => {
      const { message, signature } = request.body;
      const owner = address(request.body.address);
      const nonce = nonceOf(message, owner);

      if (nonce === undefined || !(await isSignedBy(owner, message, signature))) {
        throw AppError.unauthorized();
      }

      if (!(await consumeNonce(db, { nonce, address: owner, now: now() }))) {
        throw AppError.unauthorized();
      }

      reply.setCookie(SESSION_COOKIE, signSession(owner, 'web', jwtSecret), {
        httpOnly: true,
        secure: secureCookie,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_LIFETIME_SECONDS.web,
      });

      return { address: owner };
    },
  );

  /** Web session only: pairs a phone by minting it a long-lived mobile Bearer token. */
  app.post(
    '/auth/pair',
    {
      schema: {
        tags: ['auth'],
        summary: 'Issue a 30-day Bearer token for the mobile app (shown as a QR code)',
        response: { 200: pairingSchema, 401: errorSchema, 403: errorSchema },
      },
    },
    (request) => {
      const caller = callerOf(request);
      const expiresAt = new Date(now().getTime() + SESSION_LIFETIME_SECONDS.mobile * 1000);

      return {
        token: signSession(caller.address, 'mobile', jwtSecret),
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  /** Web or mobile. Clears this browser's cookie only; other sessions are untouched. */
  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Clear the session cookie of this browser',
        response: { 204: z.null(), 401: errorSchema, 403: errorSchema },
      },
    },
    (_request, reply) => {
      void reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send(null);
    },
  );

  /** Web or mobile. Stamps `valid_after` so every token issued before this call, including the
   * caller's own, fails verification on its next use. */
  app.post(
    '/auth/revoke-devices',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign out every browser and paired phone of the owner, this one included',
        response: { 204: z.null(), 401: errorSchema, 403: errorSchema },
      },
    },
    async (request, reply) => {
      // jsonwebtoken stamps `iat` with the wall clock, not the injected one.
      await revokeSessionsIssuedBefore(db, callerOf(request).address, new Date());

      return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send(null);
    },
  );

  done();
};
