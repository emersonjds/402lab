import { USDC_DEVNET_MINT } from '@402lab/shared';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import {
  type Address,
  address,
  type Blockhash,
  createSolanaRpc,
  getBase64EncodedWireTransaction,
  type Signature,
  signature as toSignature,
  type Transaction,
} from '@solana/kit';

export type SignatureStatus = 'confirmed' | 'failed' | 'unknown';

export type SolanaChain = {
  latestBlockhash: () => Promise<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>;
  send: (transaction: Transaction) => Promise<void>;
  signatureStatus: (signature: string) => Promise<SignatureStatus>;
  blockHeight: () => Promise<bigint>;
};

/** The split worker needs only `SolanaChain`; the demo on-ramp also checks the cluster and the treasury balance. */
export type DevnetChain = SolanaChain & {
  genesisHash: () => Promise<string>;
  /** Atomic devnet USDC held by the wallet's associated token account. */
  usdcBalance: (owner: Address) => Promise<bigint>;
};

const COMMITMENT = 'confirmed';
const RPC_TIMEOUT_MS = 15_000;

/** A call past the timeout rejects, failing the split round instead of hanging it. */
export const createSolanaChain = (rpcUrl: string, timeoutMs = RPC_TIMEOUT_MS): DevnetChain => {
  const rpc = createSolanaRpc(rpcUrl);
  const deadline = () => ({ abortSignal: AbortSignal.timeout(timeoutMs) });

  return {
    latestBlockhash: async () =>
      (await rpc.getLatestBlockhash({ commitment: COMMITMENT }).send(deadline())).value,
    send: async (transaction) => {
      await rpc
        .sendTransaction(getBase64EncodedWireTransaction(transaction), {
          encoding: 'base64',
          preflightCommitment: COMMITMENT,
          skipPreflight: false,
        })
        .send(deadline());
    },
    // Without the history search a status older than the RPC's recent cache reads as null,
    // which would let reconciliation release a batch that did pay out.
    signatureStatus: async (signature) => {
      const signatures: Signature[] = [toSignature(signature)];
      const {
        value: [status],
      } = await rpc
        .getSignatureStatuses(signatures, { searchTransactionHistory: true })
        .send(deadline());

      if (!status || status.confirmationStatus === 'processed') return 'unknown';
      return status.err ? 'failed' : 'confirmed';
    },
    blockHeight: () => rpc.getBlockHeight({ commitment: COMMITMENT }).send(deadline()),
    genesisHash: () => rpc.getGenesisHash().send(deadline()),
    usdcBalance: async (owner) => {
      const [tokenAccount] = await findAssociatedTokenPda({
        owner,
        mint: address(USDC_DEVNET_MINT),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const { value } = await rpc
        .getTokenAccountBalance(tokenAccount, { commitment: COMMITMENT })
        .send(deadline());

      return BigInt(value.amount);
    },
  };
};
