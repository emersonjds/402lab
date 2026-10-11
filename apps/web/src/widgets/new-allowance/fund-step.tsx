'use client';

import { SOLANA_DEVNET, usdToAtomic } from '@402lab/shared';
import { useWalletAccountTransactionSendingSigner } from '@solana/react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SolscanLink } from '@/components/ui/solscan-link';
import { ApiError, apiRequest } from '@/shared/api/client';
import { onrampTransferSchema, type Allowance } from '@/shared/api/schemas';
import { MOCKING_ENABLED } from '@/shared/mocks/is-enabled';
import { fundSessionWallet } from '@/shared/wallet/fund-allowance';
import { useSolanaWallets } from '@/shared/wallet/solana-wallets';
import { WalletOption } from '@/shared/wallet/wallet-option';

interface FundStepProps {
  allowance: Allowance;
}

const randomMockSignature = (): string =>
  `MockFund${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

interface PayWithWalletButtonProps {
  account: UiWalletAccount;
  amountUsd: string;
  sessionAddress: string;
  onSuccess: (signature: string) => void;
  onError: (message: string) => void;
}

/** Hooks need a stable account at mount, so this only renders once one is picked. */
const PayWithWalletButton = ({
  account,
  amountUsd,
  sessionAddress,
  onSuccess,
  onError,
}: PayWithWalletButtonProps) => {
  const signer = useWalletAccountTransactionSendingSigner(account, SOLANA_DEVNET);
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const signature = await fundSessionWallet({
        humanSigner: signer,
        sessionAddress,
        amount: usdToAtomic(amountUsd),
      });
      onSuccess(signature);
    } catch {
      onError("The transfer didn't go through. Try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Button onClick={() => void handlePay()} disabled={paying} className="w-full">
      {paying ? 'Waiting for wallet…' : `Pay ${amountUsd} USDC with wallet`}
    </Button>
  );
};

export const FundStep = ({ allowance }: FundStepProps) => {
  const router = useRouter();
  const wallets = useSolanaWallets();
  const [amountUsd, setAmountUsd] = useState('5.00');
  const [account, setAccount] = useState<UiWalletAccount | null>(null);
  const [pixPending, setPixPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const handlePixSimulate = async () => {
    setPixPending(true);
    setError(null);
    try {
      const result = await apiRequest('/onramp/simulate', {
        method: 'POST',
        body: {
          sessionAddress: allowance.sessionAddress,
          amount: usdToAtomic(amountUsd).toString(),
        },
        schema: onrampTransferSchema,
      });
      setSignature(result.signature);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
    } finally {
      setPixPending(false);
    }
  };

  if (signature) {
    return (
      <div className="grid gap-5 text-center">
        <Alert variant="success" title="Agent funded">
          {allowance.agentName} is ready to pay for calls on devnet.
        </Alert>
        <SolscanLink signature={signature} />
        <Button onClick={() => { router.push(`/app/allowances/${allowance.id}`); }}>Go to agent</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Alert variant="info" title={`${allowance.agentName} created`}>
        Fund its session wallet to start paying for calls.
      </Alert>

      <div>
        <Label htmlFor="fundAmount">Amount to deposit (USD)</Label>
        <Input
          id="fundAmount"
          inputMode="decimal"
          value={amountUsd}
          onChange={(event) => { setAmountUsd(event.target.value); }}
        />
      </div>

      {error && (
        <Alert variant="error" title="Funding failed">
          {error}
        </Alert>
      )}

      <div className="grid gap-3 rounded-xl border border-line p-4">
        <p className="font-medium text-text">Pay with wallet (USDC)</p>
        <p className="text-xs text-muted">
          Instant, zero app fee. Sends from your connected wallet on devnet.
        </p>
        {MOCKING_ENABLED ? (
          <Button onClick={() => { setSignature(randomMockSignature()); }}>
            Pay {amountUsd} USDC with wallet
          </Button>
        ) : account ? (
          <PayWithWalletButton
            account={account}
            amountUsd={amountUsd}
            sessionAddress={allowance.sessionAddress}
            onSuccess={setSignature}
            onError={setError}
          />
        ) : wallets.length === 0 ? (
          <p className="text-sm text-muted">No Solana wallet detected in this browser.</p>
        ) : (
          <div className="grid gap-2">
            {wallets.map((wallet) => (
              <WalletOption key={wallet.name} wallet={wallet} onConnected={setAccount} onError={setError} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border border-line p-4">
        <p className="font-medium text-text">Pix (simulated — devnet)</p>
        <p className="text-xs text-muted">
          Demo on-ramp via the Brazilian Central Bank protocol, settled in USDC on devnet.
        </p>
        <Button variant="secondary" onClick={() => void handlePixSimulate()} disabled={pixPending}>
          {pixPending ? 'Processing…' : `Deposit ${amountUsd} via Pix (simulated)`}
        </Button>
      </div>
    </div>
  );
};
