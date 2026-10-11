import { createSolanaRpc } from '@solana/kit';

const DEFAULT_DEVNET_RPC_URL = 'https://api.devnet.solana.com';

/** Devnet by default; override with `NEXT_PUBLIC_SOLANA_RPC_URL` for a custom RPC. */
export const solanaRpc = createSolanaRpc(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? DEFAULT_DEVNET_RPC_URL,
);
