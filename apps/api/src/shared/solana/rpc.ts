import {
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

const COMMITMENT = 'confirmed';

export const createSolanaChain = (rpcUrl: string): SolanaChain => {
  const rpc = createSolanaRpc(rpcUrl);

  return {
    latestBlockhash: async () =>
      (await rpc.getLatestBlockhash({ commitment: COMMITMENT }).send()).value,
    send: async (transaction) => {
      await rpc
        .sendTransaction(getBase64EncodedWireTransaction(transaction), {
          encoding: 'base64',
          preflightCommitment: COMMITMENT,
        })
        .send();
    },
    // Without the history search a status older than the RPC's recent cache reads as null,
    // which would let reconciliation release a batch that did pay out.
    signatureStatus: async (signature) => {
      const signatures: Signature[] = [toSignature(signature)];
      const {
        value: [status],
      } = await rpc.getSignatureStatuses(signatures, { searchTransactionHistory: true }).send();

      if (!status || status.confirmationStatus === 'processed') return 'unknown';
      return status.err ? 'failed' : 'confirmed';
    },
    blockHeight: () => rpc.getBlockHeight({ commitment: COMMITMENT }).send(),
  };
};
