import type { AtomicAmount } from './money.js';

// Stripe standard card pricing and IOF rate since 2025-07-17; sources in docs/research/02.
export const CARD_PERCENT_BPS = 290n;
export const CARD_FIXED_FEE = 300_000n;
export const IOF_BPS = 350n;

const TOTAL_BPS = 10_000n;

export const cardCostEquivalent = (amount: AtomicAmount): AtomicAmount =>
  ((amount + (amount * CARD_PERCENT_BPS) / TOTAL_BPS + CARD_FIXED_FEE) * (TOTAL_BPS + IOF_BPS)) /
  TOTAL_BPS;
