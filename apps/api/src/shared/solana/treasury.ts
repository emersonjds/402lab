import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import { z } from 'zod';

const secretKeySchema = z.array(z.number().int().min(0).max(255)).length(64);

const parseSecretKey = (secretKeyJson: string): Uint8Array | undefined => {
  try {
    const parsed = secretKeySchema.safeParse(JSON.parse(secretKeyJson));
    return parsed.success ? Uint8Array.from(parsed.data) : undefined;
  } catch {
    return undefined;
  }
};

/** Errors carry a fixed message: `JSON.parse` would echo part of the key into the logs. */
export const loadTreasurySigner = async (
  secretKeyJson: string,
  treasuryAddress: string,
): Promise<KeyPairSigner> => {
  const bytes = parseSecretKey(secretKeyJson);
  if (!bytes) throw new Error('TREASURY_SECRET_KEY must be a JSON array of 64 bytes');

  const signer = await createKeyPairSignerFromBytes(bytes);
  if (signer.address !== treasuryAddress) {
    throw new Error('TREASURY_SECRET_KEY does not belong to TREASURY_ADDRESS');
  }

  return signer;
};
