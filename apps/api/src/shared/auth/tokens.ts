import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const SESSION_LIFETIME_SECONDS = { web: 7 * 24 * 60 * 60, mobile: 30 * 24 * 60 * 60 };

const sessionClaimsSchema = z.object({
  sub: z.string(),
  scope: z.enum(['web', 'mobile']),
  iat: z.number(),
  exp: z.number(),
});

export type SessionScope = z.infer<typeof sessionClaimsSchema>['scope'];
/** `issuedAt` and `expiresAt` in Unix seconds, as the JWT carries them. */
export type Session = {
  address: string;
  scope: SessionScope;
  issuedAt: number;
  expiresAt: number;
};

/** Issues a session JWT; `scope` fixes how long it lives and, via `MOBILE_ROUTES`, what it may call. */
export const signSession = (address: string, scope: SessionScope, secret: string): string =>
  jwt.sign({ sub: address, scope }, secret, {
    algorithm: 'HS256',
    expiresIn: SESSION_LIFETIME_SECONDS[scope],
  });

/** `undefined` on any bad, expired or wrongly-signed token; never throws. */
export const verifySession = (token: string, secret: string): Session | undefined => {
  try {
    const claims = sessionClaimsSchema.safeParse(
      jwt.verify(token, secret, { algorithms: ['HS256'] }),
    );

    return claims.success
      ? {
          address: claims.data.sub,
          scope: claims.data.scope,
          issuedAt: claims.data.iat,
          expiresAt: claims.data.exp,
        }
      : undefined;
  } catch {
    return undefined;
  }
};
