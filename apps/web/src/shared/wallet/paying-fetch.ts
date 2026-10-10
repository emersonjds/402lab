'use client';

import type { KeyPairSigner } from '@solana/kit';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';

/**
 * Wraps `fetch` so a 402 response is paid automatically with the given
 * signer (the browser's demo hot wallet) and the request retried. Mirrors
 * `packages/mcp/src/paying-fetch.ts`; the server-side allowance policy is
 * the real cap enforcement, so no client-side per-call filter is applied here.
 */
export const createBrowserPayingFetch = (signer: KeyPairSigner): typeof fetch => {
  const client = new x402Client().register('solana:*', new ExactSvmScheme(signer));

  return wrapFetchWithPayment(fetch, client);
};
