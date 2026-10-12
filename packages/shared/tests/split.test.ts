import { describe, expect, it } from 'vitest';

import {
  aggregatePayouts,
  assertValidSplitRules,
  chunkPayouts,
  computeSplit,
  MAX_TRANSFERS_PER_TRANSACTION,
  type PayoutLine,
  type SplitRule,
} from '../src/split.js';

const RULES: SplitRule[] = [
  { recipient: 'provider-a', role: 'provider', bps: 8_500 },
  { recipient: 'integrator', role: 'integrator', bps: 500 },
  { recipient: 'treasury', role: 'platform', bps: 1_000 },
];

const amountOf = (lines: PayoutLine[], role: PayoutLine['role']) =>
  lines.find((line) => line.role === role)?.amount;

describe('computeSplit', () => {
  it('floors provider and integrator shares and gives the remainder to the platform', () => {
    const lines = computeSplit(999n, RULES);

    expect(amountOf(lines, 'provider')).toBe(849n);
    expect(amountOf(lines, 'integrator')).toBe(49n);
    expect(amountOf(lines, 'platform')).toBe(101n);
  });

  it('splits a round price exactly', () => {
    const lines = computeSplit(10_000n, RULES);

    expect(lines.map(({ amount }) => amount)).toEqual([8_500n, 500n, 1_000n]);
  });

  it('conserves value: the lines always add up to the amount', () => {
    for (let amount = 0n; amount < 200_000n; amount += 97n) {
      const lines = computeSplit(amount, RULES);
      const total = lines.reduce((sum, line) => sum + line.amount, 0n);

      expect(total).toBe(amount);
      expect(lines.every((line) => line.amount >= 0n)).toBe(true);
    }
  });

  it('refuses a negative amount', () => {
    expect(() => computeSplit(-1n, RULES)).toThrow(/non-negative/);
  });
});

describe('assertValidSplitRules', () => {
  it('refuses rules whose bps do not sum 10000', () => {
    expect(() => {
      assertValidSplitRules([{ recipient: 't', role: 'platform', bps: 9_999 }]);
    }).toThrow(/sum 10000/);
  });

  it('refuses fractional or negative bps', () => {
    expect(() => {
      assertValidSplitRules([
        { recipient: 'p', role: 'provider', bps: 10_000.5 },
        { recipient: 't', role: 'platform', bps: -0.5 },
      ]);
    }).toThrow(/non-negative integers/);
  });

  it('requires exactly one platform rule', () => {
    expect(() => {
      assertValidSplitRules([{ recipient: 'p', role: 'provider', bps: 10_000 }]);
    }).toThrow(/one platform/);
    expect(() => {
      assertValidSplitRules([
        { recipient: 'a', role: 'platform', bps: 5_000 },
        { recipient: 'b', role: 'platform', bps: 5_000 },
      ]);
    }).toThrow(/one platform/);
  });
});

describe('aggregatePayouts and chunkPayouts', () => {
  it('sums lines per role and recipient, drops platform and zero lines, sorts by recipient', () => {
    const lines: PayoutLine[] = [
      { recipient: 'b', role: 'provider', amount: 10n },
      { recipient: 'a', role: 'integrator', amount: 1n },
      { recipient: 'b', role: 'provider', amount: 5n },
      { recipient: 'treasury', role: 'platform', amount: 99n },
      { recipient: 'c', role: 'provider', amount: 0n },
    ];

    expect(aggregatePayouts(lines)).toEqual([
      { recipient: 'a', role: 'integrator', amount: 1n },
      { recipient: 'b', role: 'provider', amount: 15n },
    ]);
  });

  it('chunks payouts into transactions of at most 8 transfers', () => {
    const lines = Array.from({ length: 19 }, (_, index) => ({
      recipient: `r${String(index)}`,
      role: 'provider' as const,
      amount: 1n,
    }));
    const chunks = chunkPayouts(lines);

    expect(MAX_TRANSFERS_PER_TRANSACTION).toBe(8);
    expect(chunks.map((chunk) => chunk.length)).toEqual([8, 8, 3]);
    expect(chunks.flat()).toEqual(lines);
    expect(chunkPayouts([])).toEqual([]);
  });
});
