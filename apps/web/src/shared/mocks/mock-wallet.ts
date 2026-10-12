'use client';

import { MOCK_OWNER_ADDRESS } from '@402lab/mocks';
import { SOLANA_DEVNET } from '@402lab/shared';
import { getBase58Encoder } from '@solana/kit';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

const ICON = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="f"><path d="M27 13V27L15.5 47.5A4 4 0 0 0 19 53.5H45A4 4 0 0 0 48.5 47.5L37 27V13Z"/></clipPath></defs><rect x="1" y="1" width="62" height="62" rx="14" fill="#14171C" stroke="#262B33" stroke-width="2"/><g clip-path="url(#f)"><path d="M0 39Q8 36 16 39T32 39T48 39T64 39V64H0Z" fill="#B6F23A"/></g><circle cx="34" cy="31" r="2.2" fill="#B6F23A"/><path d="M27 13V27L15.5 47.5A4 4 0 0 0 19 53.5H45A4 4 0 0 0 48.5 47.5L37 27V13" fill="none" stroke="#E8EAED" stroke-width="3.5" stroke-linejoin="round"/><path d="M23 12.5H41" stroke="#E8EAED" stroke-width="3.5" stroke-linecap="round"/></svg>',
)}` as const;

const account: WalletAccount = {
  address: MOCK_OWNER_ADDRESS,
  publicKey: getBase58Encoder().encode(MOCK_OWNER_ADDRESS),
  chains: [SOLANA_DEVNET],
  features: ['solana:signMessage'],
};

const randomSignature = (): Uint8Array => crypto.getRandomValues(new Uint8Array(64));

/**
 * Registers a Wallet Standard provider so the connect flow works in a browser with no real
 * Phantom/Solflare extension installed (CI, a fresh devnet checkout). Signs with random bytes —
 * mock mode's `/api/auth/verify` accepts any signature, so nothing ever checks them.
 */
export const registerMockWallet = (): void => {
  const wallet: Wallet = {
    version: '1.0.0',
    name: '402Lab Wallet',
    icon: ICON,
    chains: [SOLANA_DEVNET],
    accounts: [account],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: () => Promise.resolve({ accounts: [account] }),
      },
      'standard:events': {
        version: '1.0.0',
        on: () => () => {},
      },
      'solana:signMessage': {
        version: '1.0.0',
        signMessage: (...inputs: readonly { message: Uint8Array }[]) =>
          Promise.resolve(
            inputs.map((input) => ({ signedMessage: input.message, signature: randomSignature() })),
          ),
      },
    },
  };

  getWallets().register(wallet);
};
