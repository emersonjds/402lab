'use client';

import { parseAtomic, USDC_DEVNET_MINT, type AtomicAmount } from '@402lab/shared';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { address } from '@solana/kit';
import { useEffect, useState } from 'react';

import { solanaRpc } from './rpc';

/** 0n when the session has no USDC ATA yet (never funded), not an error. */
export const fetchSessionUsdcBalance = async (sessionAddress: string): Promise<AtomicAmount> => {
  try {
    const [ata] = await findAssociatedTokenPda({
      owner: address(sessionAddress),
      mint: address(USDC_DEVNET_MINT),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const { value } = await solanaRpc.getTokenAccountBalance(ata).send();

    return parseAtomic(value.amount);
  } catch {
    return 0n;
  }
};

/** Re-reads the balance whenever `sessionAddress` or `refreshKey` changes. */
export const useSessionUsdcBalance = (
  sessionAddress: string,
  refreshKey: unknown = null,
): AtomicAmount | null => {
  const key = `${sessionAddress}:${String(refreshKey)}`;
  const [settled, setSettled] = useState<{ key: string; balance: AtomicAmount } | null>(null);

  useEffect(() => {
    let active = true;

    void fetchSessionUsdcBalance(sessionAddress).then((value) => {
      if (active) setSettled({ key, balance: value });
    });

    return () => {
      active = false;
    };
  }, [key, sessionAddress]);

  return settled?.key === key ? settled.balance : null;
};
