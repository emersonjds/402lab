import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { Database } from '../db/pool.js';
import { AppError } from '../errors.js';
import { findSessionsValidAfter } from './revocation.js';
import { type Session, verifySession } from './tokens.js';

export const SESSION_COOKIE = 'session';

const BEARER_PREFIX = 'Bearer ';

/** What a mobile pairing token may call (`METHOD url`), with the body fields it may send. */
const MOBILE_ROUTES: Partial<Record<string, readonly string[]>> = {
  'GET /allowances': [],
  'GET /allowances/:id': [],
  'GET /allowances/:id/payments': [],
  'PATCH /allowances/:id': ['status'],
};

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Opts a route out of authentication; every other route requires a session. */
    public?: boolean;
  }

  interface FastifyRequest {
    caller?: Session;
  }
}

/** Web sends the httpOnly cookie, mobile the paired Bearer token. */
const tokenOf = (request: FastifyRequest): string | undefined => {
  const header = request.headers.authorization;

  return header?.startsWith(BEARER_PREFIX)
    ? header.slice(BEARER_PREFIX.length)
    : request.cookies[SESSION_COOKIE];
};

const bodyFieldsOf = (body: unknown): string[] =>
  typeof body === 'object' && body !== null ? Object.keys(body) : [];

/** Hooks every route registered after it, so a new route is born authenticated. */
export const protectRoutesByDefault = (
  app: FastifyInstance,
  secret: string,
  db: Database,
): void => {
  const authenticate = async (request: FastifyRequest): Promise<void> => {
    const token = tokenOf(request);
    const session = token === undefined ? undefined : verifySession(token, secret);
    if (!session) throw AppError.unauthorized();

    const validAfter = await findSessionsValidAfter(db, session.address);
    if (validAfter && session.issuedAt * 1000 < validAfter.getTime()) {
      throw AppError.unauthorized();
    }

    request.caller = session;
  };

  app.addHook('onRoute', (route) => {
    if (route.config?.public === true) return;

    const mobileFields =
      typeof route.method === 'string' ? MOBILE_ROUTES[`${route.method} ${route.url}`] : undefined;

    // eslint-disable-next-line @typescript-eslint/require-await -- Fastify only awaits an async hook's rejection
    const enforceScope = async (request: FastifyRequest): Promise<void> => {
      if (callerOf(request).scope === 'web') return;

      const allowed =
        mobileFields !== undefined &&
        bodyFieldsOf(request.body).every((field) => mobileFields.includes(field));
      if (!allowed) throw new AppError(403, 'web_session_required');
    };

    route.onRequest = [authenticate, ...[route.onRequest ?? []].flat()];
    route.preValidation = [enforceScope, ...[route.preValidation ?? []].flat()];
  });
};

/** The session `protectRoutesByDefault` attached to this request; throws 401 on a public route
 * handler that calls it anyway, since there is no session to return. */
export const callerOf = (request: FastifyRequest): Session => {
  if (!request.caller) throw AppError.unauthorized();

  return request.caller;
};
