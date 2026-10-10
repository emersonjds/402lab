import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const SESSION_LIFETIME_SECONDS = { web: 7 * 24 * 60 * 60, mobile: 30 * 24 * 60 * 60 };

const sessionClaimsSchema = z.object({
  sub: z.string(),
  scope: z.enum(['web', 'mobile']),
});

export type SessionScope = z.infer<typeof sessionClaimsSchema>['scope'];
export type Session = { address: string; scope: SessionScope };

export const signSession = (address: string, scope: SessionScope, secret: string): string =>
  jwt.sign({ sub: address, scope }, secret, {
    algorithm: 'HS256',
    expiresIn: SESSION_LIFETIME_SECONDS[scope],
  });

export const verifySession = (token: string, secret: string): Session | undefined => {
  try {
    const claims = sessionClaimsSchema.safeParse(
      jwt.verify(token, secret, { algorithms: ['HS256'] }),
    );

    return claims.success ? { address: claims.data.sub, scope: claims.data.scope } : undefined;
  } catch {
    return undefined;
  }
};
