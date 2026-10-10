import { describe, expect, it } from 'vitest';

import { formatUsd, parseAtomic, usdToAtomic } from '../src/money.js';

describe('money', () => {
  it('parses atomic integer strings', () => {
    expect(parseAtomic('5000')).toBe(5000n);
    expect(parseAtomic('0')).toBe(0n);
  });

  it('rejects non-integer, negative and empty atomic strings', () => {
    expect(() => parseAtomic('1.5')).toThrow();
    expect(() => parseAtomic('-1')).toThrow();
    expect(() => parseAtomic('')).toThrow();
  });

  it('converts usd strings to atomic units', () => {
    expect(usdToAtomic('$0.005')).toBe(5000n);
    expect(usdToAtomic('0.01')).toBe(10000n);
    expect(usdToAtomic('$1')).toBe(1_000_000n);
  });

  it('rejects usd with more than 6 decimals', () => {
    expect(() => usdToAtomic('0.0000001')).toThrow();
  });

  it('formats atomic units as usd without trailing zeros', () => {
    expect(formatUsd(5000n)).toBe('$0.005');
    expect(formatUsd(1_000_000n)).toBe('$1');
    expect(formatUsd(1_234_500n)).toBe('$1.2345');
  });
});
