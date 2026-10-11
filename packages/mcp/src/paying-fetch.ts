import { parseAtomic, type AtomicAmount } from '@402lab/shared';
import type { KeyPairSigner } from '@solana/kit';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';

import type { Fetch } from './tools.js';

export const createPayingFetch = (
  signer: KeyPairSigner,
  perCallCap: AtomicAmount,
  baseFetch: Fetch = fetch,
): Fetch => {
  const client = new x402Client()
    .register('solana:*', new ExactSvmScheme(signer))
    .registerPolicy((_version, requirements) =>
      requirements.filter((requirement) => parseAtomic(requirement.amount) <= perCallCap),
    );

  return wrapFetchWithPayment(baseFetch, client);
};
