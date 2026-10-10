'use client';

import type { UiWalletAccount } from '@wallet-standard/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useSiwsSignIn } from '@/shared/auth/siws';

interface SignInStepProps {
  account: UiWalletAccount;
  onSignedIn: (address: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

const shortAddress = (address: string): string => `${address.slice(0, 4)}…${address.slice(-4)}`;

/** Hooks need a stable account at mount, so this only renders once one is picked. */
export const SignInStep = ({ account, onSignedIn, onError, onCancel }: SignInStepProps) => {
  const signIn = useSiwsSignIn(account);
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    setSigning(true);
    try {
      const address = await signIn();
      onSignedIn(address);
    } catch {
      onError("We couldn't verify that signature. Try again.");
      setSigning(false);
    }
  };

  return (
    <div className="grid gap-4">
      <p className="font-mono text-sm text-muted">
        Signing in as <span className="text-text">{shortAddress(account.address)}</span>
      </p>
      <Button onClick={() => void handleSign()} disabled={signing}>
        {signing ? 'Waiting for signature…' : 'Sign message'}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={signing}>
        Use a different wallet
      </Button>
    </div>
  );
};
