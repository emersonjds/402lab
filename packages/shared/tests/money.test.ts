import { describe, expect, it } from 'vitest';

import { atomicStringSchema, formatUsd, parseAtomic, usdToAtomic } from '../src/money.js';

describe('money', () => {
  it('parses an integer string into atomic bigint USDC', () => {
    expect(parseAtomic('0')).toBe(0n);
    expect(parseAtomic('5000')).toBe(5_000n);
    expect(parseAtomic('9007199254740993')).toBe(9_007_199_254_740_993n);
  });

  it.each(['', '-1', '1.5', '1e6', ' 1', '0x10', 'abc'])(
    'refuses "%s" as an atomic amount',
    (value) => {
      expect(() => parseAtomic(value)).toThrow(/non-negative integer/);
      expect(atomicStringSchema.safeParse(value).success).toBe(false);
    },
  );

  it('converts USD with up to 6 decimals to atomic units', () => {
    expect(usdToAtomic('$0.005')).toBe(5_000n);
    expect(usdToAtomic('1')).toBe(1_000_000n);
    expect(usdToAtomic('12.345678')).toBe(12_345_678n);
    expect(usdToAtomic('$0.000001')).toBe(1n);
  });

  it.each(['1.2345678', '-1', '$', 'one', '1.'])('refuses "%s" as a USD amount', (value) => {
    expect(() => usdToAtomic(value)).toThrow(/USD amount/);
  });

  it('formats atomic units as USD without trailing zeros', () => {
    expect(formatUsd(5_000n)).toBe('$0.005');
    expect(formatUsd(1_000_000n)).toBe('$1');
    expect(formatUsd(0n)).toBe('$0');
    expect(formatUsd(12_345_678n)).toBe('$12.345678');
  });

  it('round-trips format and parse for many amounts', () => {
    for (let amount = 0n; amount < 3_000_000n; amount += 7_919n) {
      expect(usdToAtomic(formatUsd(amount))).toBe(amount);
    }
  });
});
