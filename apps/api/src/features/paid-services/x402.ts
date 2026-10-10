import { SOLANA_DEVNET } from '@402lab/shared';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { x402ResourceServer } from '@x402/fastify';
import { ExactSvmScheme } from '@x402/svm/exact/server';

export const createResourceServer = (facilitatorUrl: string): x402ResourceServer =>
  new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl })).register(
    SOLANA_DEVNET,
    new ExactSvmScheme(),
  );
