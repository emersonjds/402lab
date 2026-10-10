import { describe, expect, it } from 'vitest';

import {
  aggregatePayouts,
  assertValidSplitRules,
  chunkPayouts,
  computeSplit,
  type SplitRule,
} from '../src/split.js';

const rules = [
  { recipient: 'PROV', role: 'provider', bps: 8500 },
  { recipient: 'INTG', role: 'integrator', bps: 500 },
  { recipient: 'PLAT', role: 'platform', bps: 1000 },
] as const satisfies readonly SplitRule[];

describe('split', () => {
  it('splits exact amounts', () => {
    expect(computeSplit(10_000n, rules)).toEqual([
      { recipient: 'PROV', role: 'provider', amount: 8_500n },
      { recipient: 'INTG', role: 'integrator', amount: 500n },
      { recipient: 'PLAT', role: 'platform', amount: 1_000n },
    ]);
  });

  it('gives rounding remainder to platform', () => {
    const lines = computeSplit(7n, rules);
    expect(lines.find((line) => line.role === 'provider')?.amount).toBe(5n);
    expect(lines.find((line) => line.role === 'integrator')?.amount).toBe(0n);
    expect(lines.find((line) => line.role === 'platform')?.amount).toBe(2n);
    expect(lines.reduce((sum, line) => sum + line.amount, 0n)).toBe(7n);
  });

  it('never loses or creates money for any amount', () => {
    for (const amount of [0n, 1n, 3n, 999n, 1_000_001n, 123_456_789n]) {
      expect(computeSplit(amount, rules).reduce((sum, line) => sum + line.amount, 0n)).toBe(amount);
    }
  });

  it('rejects negative amounts and invalid rules before splitting', () => {
    expect(() => computeSplit(-1n, rules)).toThrow();
    expect(() =>
      computeSplit(10_000n, [{ recipient: 'A', role: 'provider', bps: 10000 }]),
    ).toThrow();
  });

  it('rejects rules not summing 10000 or without exactly one platform', () => {
    expect(() => {
      assertValidSplitRules([{ recipient: 'A', role: 'platform', bps: 9999 }]);
    }).toThrow();
    expect(() => {
      assertValidSplitRules([{ recipient: 'A', role: 'provider', bps: 10000 }]);
    }).toThrow();
    expect(() => {
      assertValidSplitRules([...rules, { recipient: 'B', role: 'platform', bps: 0 }]);
    }).toThrow();
    expect(() => {
      assertValidSplitRules([{ recipient: 'A', role: 'platform', bps: 10000.5 }]);
    }).toThrow();
  });

  it('rejects negative bps even when the total is 10000', () => {
    expect(() => {
      assertValidSplitRules([
        { recipient: 'A', role: 'provider', bps: -1 },
        { recipient: 'B', role: 'platform', bps: 10001 },
      ]);
    }).toThrow();
  });

  it('accepts the default 85/5/10 rules', () => {
    expect(() => {
      assertValidSplitRules(rules);
    }).not.toThrow();
  });

  it('aggregates by recipient excluding platform', () => {
    const lines = [...computeSplit(10_000n, rules), ...computeSplit(20_000n, rules)];
    expect(aggregatePayouts(lines)).toEqual([
      { recipient: 'INTG', role: 'integrator', amount: 1_500n },
      { recipient: 'PROV', role: 'provider', amount: 25_500n },
    ]);
  });

  it('keeps the same recipient apart per role', () => {
    expect(
      aggregatePayouts([
        { recipient: 'SAME', role: 'provider', amount: 3n },
        { recipient: 'SAME', role: 'integrator', amount: 2n },
        { recipient: 'SAME', role: 'provider', amount: 4n },
      ]),
    ).toEqual([
      { recipient: 'SAME', role: 'provider', amount: 7n },
      { recipient: 'SAME', role: 'integrator', amount: 2n },
    ]);
  });

  it('drops zero-amount payouts after aggregation', () => {
    expect(aggregatePayouts(computeSplit(7n, rules)).map((line) => line.recipient)).toEqual([
      'PROV',
    ]);
  });

  it('chunks payouts in groups of 8', () => {
    const many = Array.from({ length: 17 }, (_, index) => ({
      recipient: `R${String(index)}`,
      role: 'provider' as const,
      amount: 1n,
    }));
    expect(chunkPayouts(many).map((chunk) => chunk.length)).toEqual([8, 8, 1]);
    expect(chunkPayouts(many, 10).map((chunk) => chunk.length)).toEqual([10, 7]);
    expect(chunkPayouts([])).toEqual([]);
  });
});
