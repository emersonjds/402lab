'use client';

import type { UiWalletAccount } from '@wallet-standard/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Wordmark } from '@/components/ui/wordmark';
import { useSession } from '@/shared/auth/session-context';
import { useSolanaWallets } from '@/shared/wallet/solana-wallets';

import { SignInStep } from './sign-in-step';
import { WalletOption } from './wallet-option';

const NoWalletsFound = () => (
  <Alert variant="info" title="No Solana wallet detected">
    Install one of these browser extensions, then reload this page.
    <ul className="mt-3 grid gap-1">
      <li>
        <a
          href="https://phantom.app/download"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-light-400 underline-offset-4 hover:underline"
        >
          Install Phantom ↗
        </a>
      </li>
      <li>
        <a
          href="https://solflare.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-light-400 underline-offset-4 hover:underline"
        >
          Install Solflare ↗
        </a>
      </li>
    </ul>
  </Alert>
);

export const ConnectWallet = () => {
  const wallets = useSolanaWallets();
  const [account, setAccount] = useState<UiWalletAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { signIn } = useSession();

  const handleSignedIn = (address: string) => {
    signIn(address);
    router.push('/app');
  };

  return (
    <div className="flex min-h-dvh">
      <div className="flex w-full flex-col justify-center px-6 py-16 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex min-h-11 items-center text-sm text-muted hover:text-text"
          >
            ← Back to 402Lab
          </Link>
          <h1 className="font-display text-title-sm font-bold tracking-tight text-text">
            Connect wallet
          </h1>
          <p className="mt-2 text-sm text-muted">
            We&apos;ll ask you to sign a message. No transaction, no fee.
          </p>

          <div className="mt-8 grid gap-3">
            {account ? (
              <SignInStep
                account={account}
                onSignedIn={handleSignedIn}
                onError={setError}
                onCancel={() => {
                  setAccount(null);
                }}
              />
            ) : wallets.length === 0 ? (
              <NoWalletsFound />
            ) : (
              wallets.map((wallet) => (
                <WalletOption
                  key={wallet.name}
                  wallet={wallet}
                  onConnected={setAccount}
                  onError={setError}
                />
              ))
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-error-400">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="relative hidden w-1/2 items-center justify-center bg-gray-900 lg:flex">
        <div aria-hidden="true" className="bg-ledger-grid absolute inset-0 opacity-60" />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted">
            Pocket money for AI agents. Devnet sandbox — no seed phrase leaves your wallet.
          </p>
        </div>
      </div>
    </div>
  );
};
