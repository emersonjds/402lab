import { describe, expect, it } from 'vitest';

import { evaluateAllowancePolicy } from '../src/policy.js';

const policy = { status: 'active', perCallCap: 20_000n, dailyCap: 1_000_000n } as const;

describe('allowance policy', () => {
  it('allows within caps', () => {
    expect(evaluateAllowancePolicy(policy, 10_000n, 0n)).toEqual({ allowed: true });
  });

  it('denies when paused before checking caps', () => {
    expect(evaluateAllowancePolicy({ ...policy, status: 'paused' }, 10_000n, 0n)).toEqual({
      allowed: false,
      reason: 'allowance_paused',
    });
  });

  it('denies price above per-call cap', () => {
    expect(evaluateAllowancePolicy(policy, 20_001n, 0n)).toEqual({
      allowed: false,
      reason: 'per_call_cap_exceeded',
    });
  });

  it('checks per-call cap before daily cap', () => {
    expect(evaluateAllowancePolicy(policy, 20_001n, 1_000_000n)).toEqual({
      allowed: false,
      reason: 'per_call_cap_exceeded',
    });
  });

  it('allows price equal to per-call cap', () => {
    expect(evaluateAllowancePolicy(policy, 20_000n, 0n)).toEqual({ allowed: true });
  });

  it("denies when today's spend plus price exceeds daily cap", () => {
    expect(evaluateAllowancePolicy(policy, 10_000n, 990_001n)).toEqual({
      allowed: false,
      reason: 'daily_cap_exceeded',
    });
  });

  it('allows reaching daily cap exactly', () => {
    expect(evaluateAllowancePolicy(policy, 10_000n, 990_000n)).toEqual({ allowed: true });
  });
});
