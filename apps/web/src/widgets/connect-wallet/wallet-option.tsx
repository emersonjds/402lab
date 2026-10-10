'use client';

import { useConnect } from '@wallet-standard/react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { useState } from 'react';

interface WalletOptionProps {
  wallet: UiWallet;
  onConnected: (account: UiWalletAccount) => void;
  onError: (message: string) => void;
}

/** One row in the wallet list. Connects on click, hands the first account back up. */
export const WalletOption = ({ wallet, onConnected, onError }: WalletOptionProps) => {
  const [isConnecting, connect] = useConnect(wallet);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const accounts = wallet.accounts.length > 0 ? wallet.accounts : await connect();
      const account = accounts[0];
      if (account) onConnected(account);
      else onError("We couldn't get an account from that wallet. Try again.");
    } catch {
      onError('Connection was cancelled or failed. Try again.');
    } finally {
      setPending(false);
    }
  };

  const busy = isConnecting || pending;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-raised px-4 text-left transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are opaque data: URIs from the Wallet Standard registry */}
      <img src={wallet.icon} alt="" aria-hidden="true" className="size-8 rounded-[6px]" />
      <span className="font-medium text-text">{wallet.name}</span>
      {busy && <span className="ml-auto font-mono text-xs text-muted">Connecting…</span>}
    </button>
  );
};
