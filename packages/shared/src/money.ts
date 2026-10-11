import { z } from 'zod';

export type AtomicAmount = bigint;

export const USDC_DECIMALS = 6;

const ATOMIC_PER_USD = 10n ** BigInt(USDC_DECIMALS);
const ATOMIC_PATTERN = /^\d+$/;
export const atomicStringSchema = z.string().regex(ATOMIC_PATTERN);

const USD_PATTERN = new RegExp(`^\\$?(\\d+)(?:\\.(\\d{1,${String(USDC_DECIMALS)}}))?$`);

export const parseAtomic = (value: string): AtomicAmount => {
  if (!ATOMIC_PATTERN.test(value)) {
    throw new Error(`Not a non-negative integer amount: "${value}"`);
  }

  return BigInt(value);
};

export const usdToAtomic = (usd: string): AtomicAmount => {
  const match = USD_PATTERN.exec(usd);

  if (!match) {
    throw new Error(`Not a USD amount with up to ${String(USDC_DECIMALS)} decimals: "${usd}"`);
  }

  const [, whole = '0', fraction = ''] = match;

  return BigInt(whole) * ATOMIC_PER_USD + BigInt(fraction.padEnd(USDC_DECIMALS, '0'));
};

export const formatUsd = (amount: AtomicAmount): string => {
  const whole = amount / ATOMIC_PER_USD;
  const fraction = (amount % ATOMIC_PER_USD)
    .toString()
    .padStart(USDC_DECIMALS, '0')
    .replace(/0+$/, '');

  return fraction === '' ? `$${whole.toString()}` : `$${whole.toString()}.${fraction}`;
};
