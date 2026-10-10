export const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;

export const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' as const;

export const explorerTxUrl = (signature: string): string =>
  `https://solscan.io/tx/${signature}?cluster=devnet`;
