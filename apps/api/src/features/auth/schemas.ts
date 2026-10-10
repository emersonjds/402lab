import { z } from 'zod';

import { solanaAddressSchema } from '../../shared/schemas.js';

export const nonceQuerySchema = z.object({ address: solanaAddressSchema });

export const nonceResponseSchema = z
  .object({
    nonce: z.string(),
    /** The exact text the wallet must sign. */
    message: z.string(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'SiwsNonce' });

export const verifyBodySchema = z
  .object({
    address: solanaAddressSchema,
    /** Ed25519 signature of `message`, base58 or base64. */
    signature: z.string().min(1).max(200),
    message: z.string().max(500),
  })
  .meta({ id: 'SiwsVerify' });

export const signedInSchema = z.object({ address: z.string() }).meta({ id: 'SignedIn' });

export const pairingSchema = z
  .object({ token: z.string(), expiresAt: z.iso.datetime() })
  .meta({ id: 'MobilePairing' });
