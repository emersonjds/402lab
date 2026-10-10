import { SOLANA_DEVNET } from '@402lab/shared';
import { FacilitatorResponseError, HTTPFacilitatorClient } from '@x402/core/server';
import { SettleError, VerifyError } from '@x402/core/types';
import { x402ResourceServer } from '@x402/fastify';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { FastifyBaseLogger } from 'fastify';

type FacilitatorLogger = Pick<FastifyBaseLogger, 'error'>;

/**
 * @x402/fastify answers a facilitator failure with the facilitator's own text; payers get a fixed
 * reason instead. Verify and settle refusals are protocol answers and pass through.
 */
class OpaqueFacilitatorClient extends HTTPFacilitatorClient {
  constructor(
    url: string,
    private readonly logger: FacilitatorLogger,
  ) {
    super({ url });
  }

  private async hideFailure<T>(operation: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof VerifyError || error instanceof SettleError) throw error;
      this.logger.error({ err: error, operation }, 'facilitator_unavailable');
      throw new FacilitatorResponseError('facilitator_unavailable');
    }
  }

  override verify(...args: Parameters<HTTPFacilitatorClient['verify']>) {
    return this.hideFailure('verify', () => super.verify(...args));
  }

  override settle(...args: Parameters<HTTPFacilitatorClient['settle']>) {
    return this.hideFailure('settle', () => super.settle(...args));
  }

  override getSupported() {
    return this.hideFailure('supported', () => super.getSupported());
  }
}

export const createResourceServer = (
  facilitatorUrl: string,
  logger: FacilitatorLogger,
): x402ResourceServer =>
  new x402ResourceServer(new OpaqueFacilitatorClient(facilitatorUrl, logger)).register(
    SOLANA_DEVNET,
    new ExactSvmScheme(),
  );
