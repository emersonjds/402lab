import { describe, expect, it } from 'vitest';

import { cardCostEquivalent } from '../src/savings.js';

describe('savings', () => {
  it('computes card plus IOF cost for a one-cent call', () => {
    // (10000 + 290 + 300000) * 1.035 = 321150.15 -> 321150
    expect(cardCostEquivalent(10_000n)).toBe(321_150n);
  });

  it('charges the fixed fee plus IOF on a zero amount', () => {
    // 300000 * 1.035 = 310500
    expect(cardCostEquivalent(0n)).toBe(310_500n);
  });
});
