import { generateKeyPairSync, sign } from 'node:crypto';

import { getAddressDecoder } from '@solana/kit';
import { z } from 'zod';

/** A wallet with the solana-keygen 64-byte secret layout and a raw Ed25519 signer. */
export const solanaKeypair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = z
    .object({ d: z.string(), x: z.string() })
    .parse({ ...privateKey.export({ format: 'jwk' }), ...publicKey.export({ format: 'jwk' }) });
  const publicBytes = Buffer.from(jwk.x, 'base64url');

  return {
    secretKeyJson: JSON.stringify([...Buffer.from(jwk.d, 'base64url'), ...publicBytes]),
    address: getAddressDecoder().decode(publicBytes),
    sign: (message: string): Uint8Array =>
      new Uint8Array(sign(null, Buffer.from(message), privateKey)),
  };
};

export type SolanaKeypair = ReturnType<typeof solanaKeypair>;
