'use client';

import { SOLANA_DEVNET } from '@402lab/shared';
import type { UiWallet } from '@wallet-standard/react';
import { useWallets } from '@wallet-standard/react';
import { useMemo } from 'react';

const SOLANA_CHAIN_PREFIX = 'solana:';

/** Every registered wallet that speaks any Solana chain, devnet first. */
export const useSolanaWallets = (): readonly UiWallet[] => {
  const wallets = useWallets();

  return useMemo(
    () =>
      wallets
        .filter((wallet) => wallet.chains.some((chain) => chain.startsWith(SOLANA_CHAIN_PREFIX)))
        .sort((a, b) => Number(b.chains.includes(SOLANA_DEVNET)) - Number(a.chains.includes(SOLANA_DEVNET))),
    [wallets],
  );
};
