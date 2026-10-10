import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AppError } from '../errors.js';
import { type Session, verifySession } from './tokens.js';

export const SESSION_COOKIE = 'session';

const BEARER_PREFIX = 'Bearer ';

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

/** Hooks every route registered after it, so a new route is born authenticated. */
export const protectRoutesByDefault = (app: FastifyInstance, secret: string): void => {
  // eslint-disable-next-line @typescript-eslint/require-await -- Fastify only awaits an async hook's rejection
  const authenticate = async (request: FastifyRequest): Promise<void> => {
    const token = tokenOf(request);
    const session = token === undefined ? undefined : verifySession(token, secret);
    if (!session) throw AppError.unauthorized();

    request.caller = session;
  };

  app.addHook('onRoute', (route) => {
    if (route.config?.public === true) return;

    route.onRequest = [authenticate, ...[route.onRequest ?? []].flat()];
  });
};

export const callerOf = (request: FastifyRequest): Session => {
  if (!request.caller) throw AppError.unauthorized();

  return request.caller;
};
