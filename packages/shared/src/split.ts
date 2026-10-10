import type { AtomicAmount } from './money.js';

export type SplitRole = 'provider' | 'integrator' | 'platform';

export type SplitRule = { recipient: string; role: SplitRole; bps: number };

export type PayoutLine = { recipient: string; role: SplitRole; amount: AtomicAmount };

export const MAX_TRANSFERS_PER_TRANSACTION = 8;

const TOTAL_BPS = 10_000;

export const assertValidSplitRules = (rules: readonly SplitRule[]): void => {
  if (rules.some((rule) => !Number.isInteger(rule.bps) || rule.bps < 0)) {
    throw new Error('Split bps must be non-negative integers');
  }

  if (rules.reduce((sum, rule) => sum + rule.bps, 0) !== TOTAL_BPS) {
    throw new Error(`Split bps must sum ${String(TOTAL_BPS)}`);
  }

  if (rules.filter((rule) => rule.role === 'platform').length !== 1) {
    throw new Error('Split must have exactly one platform rule');
  }
};

export const computeSplit = (amount: AtomicAmount, rules: readonly SplitRule[]): PayoutLine[] => {
  if (amount < 0n) {
    throw new Error('Split amount must be non-negative');
  }

  assertValidSplitRules(rules);

  const lines = rules.map(({ recipient, role, bps }) => ({
    recipient,
    role,
    amount: role === 'platform' ? 0n : (amount * BigInt(bps)) / BigInt(TOTAL_BPS),
  }));
  const remainder = amount - lines.reduce((sum, line) => sum + line.amount, 0n);

  return lines.map((line) => (line.role === 'platform' ? { ...line, amount: remainder } : line));
};

export const aggregatePayouts = (lines: readonly PayoutLine[]): PayoutLine[] => {
  const totals = new Map<string, PayoutLine>();

  for (const line of lines) {
    if (line.role === 'platform') {
      continue;
    }

    const key = `${line.role}:${line.recipient}`;
    const previous = totals.get(key)?.amount ?? 0n;
    totals.set(key, { ...line, amount: previous + line.amount });
  }

  return [...totals.values()]
    .filter((line) => line.amount > 0n)
    .sort(
      (left, right) =>
        Number(left.recipient > right.recipient) - Number(left.recipient < right.recipient),
    );
};

export const chunkPayouts = (
  lines: readonly PayoutLine[],
  size = MAX_TRANSFERS_PER_TRANSACTION,
): PayoutLine[][] =>
  Array.from({ length: Math.ceil(lines.length / size) }, (_, index) =>
    lines.slice(index * size, (index + 1) * size),
  );
