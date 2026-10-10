'use client';

import { getBase58Decoder } from '@solana/kit';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSignMessage } from '@solana/react';
import { useCallback } from 'react';
import { z } from 'zod';

import { apiRequest } from '@/shared/api/client';

const nonceResponseSchema = z.object({
  nonce: z.string(),
  message: z.string(),
  expiresAt: z.string(),
});

const signedInSchema = z.object({ address: z.string() });

/**
 * Sign-In With Solana: fetches a single-use nonce, signs the exact message
 * bytes with the wallet's `signMessage` feature, then verifies it server-side.
 * On success the API sets the httpOnly session cookie; this returns the
 * signed-in address so the caller can update local UI state.
 */
export const useSiwsSignIn = (account: UiWalletAccount): (() => Promise<string>) => {
  const signMessage = useSignMessage(account);

  return useCallback(async () => {
    const { message } = await apiRequest(`/auth/nonce?address=${account.address}`, {
      schema: nonceResponseSchema,
    });

    const { signature } = await signMessage({ message: new TextEncoder().encode(message) });
    const signatureBase58 = getBase58Decoder().decode(signature);

    const signedIn = await apiRequest('/auth/verify', {
      method: 'POST',
      body: { address: account.address, signature: signatureBase58, message },
      schema: signedInSchema,
    });

    return signedIn.address;
  }, [account, signMessage]);
};
