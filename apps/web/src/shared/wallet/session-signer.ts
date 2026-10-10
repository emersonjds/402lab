'use client';

import { createKeyPairSignerFromPrivateKeyBytes, type KeyPairSigner } from '@solana/kit';

const STORAGE_KEY = '402lab.demo-hot-wallet.seed';
const SEED_BYTES = 32;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

/**
 * The browser's "demo hot wallet": a session keypair generated once and kept in
 * localStorage, never extractable from Solana's CryptoKeyPair. It is what the
 * playground pays with and what the allowance wizard offers as a default session
 * address — never a human's funds, always labelled "demo hot wallet" in the UI.
 */
export const loadOrCreateSessionSigner = async (): Promise<KeyPairSigner> => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const seed = stored ? fromBase64(stored) : crypto.getRandomValues(new Uint8Array(SEED_BYTES));
  if (!stored) localStorage.setItem(STORAGE_KEY, toBase64(seed));

  return createKeyPairSignerFromPrivateKeyBytes(seed);
};
