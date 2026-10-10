'use client';

import { MOCK_OWNER_ADDRESS } from '@402lab/mocks';
import { SOLANA_DEVNET } from '@402lab/shared';
import { getBase58Encoder } from '@solana/kit';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

const ICON = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#B6F23A"/><text x="16" y="22" font-size="16" text-anchor="middle" font-family="monospace" fill="#0B0D10">M</text></svg>',
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
    name: '402Lab Demo Wallet (mock)',
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
