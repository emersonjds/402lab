import { formatUsd, parseAtomic, type AtomicAmount } from '@402lab/shared';

interface MoneyProps {
  /** Atomic USDC: a bigint, or the integer string the API sends. */
  amount: AtomicAmount | string;
  className?: string;
}

export const Money = ({ amount, className = '' }: MoneyProps) => (
  <span className={`font-mono tabular-nums ${className}`}>
    {formatUsd(typeof amount === 'string' ? parseAtomic(amount) : amount)}
  </span>
);
