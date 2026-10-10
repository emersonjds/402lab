import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  getAddressEncoder,
  type KeyPairSigner,
} from '@solana/kit';
import { z } from 'zod';

export type SessionWallet = { signer: KeyPairSigner; address: string; created: boolean };

const keypairBytesSchema = z.array(z.number().int().min(0).max(255)).length(64);

const readKeypair = async (file: string): Promise<number[] | undefined> => {
  try {
    return keypairBytesSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

export const loadOrCreateSessionWallet = async (directory: string): Promise<SessionWallet> => {
  const file = join(directory, 'session.json');
  const existing = await readKeypair(file);

  if (existing) {
    const signer = await createKeyPairSignerFromBytes(Uint8Array.from(existing));
    return { signer, address: signer.address, created: false };
  }

  const privateKey = randomBytes(32);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey);
  // solana-keygen layout: 32-byte private key followed by the 32-byte public key.
  const keypair = [...privateKey, ...getAddressEncoder().encode(signer.address)];

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(keypair), { mode: 0o600, flag: 'wx' });

  return { signer, address: signer.address, created: true };
};
