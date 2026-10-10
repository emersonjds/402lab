import type { AtomicAmount } from './money.js';

export type AllowanceStatus = 'active' | 'paused';

export type AllowancePolicy = {
  status: AllowanceStatus;
  perCallCap: AtomicAmount;
  dailyCap: AtomicAmount;
};

export type PolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'allowance_paused' | 'per_call_cap_exceeded' | 'daily_cap_exceeded';
    };

export const evaluateAllowancePolicy = (
  policy: AllowancePolicy,
  price: AtomicAmount,
  spentToday: AtomicAmount,
): PolicyDecision => {
  if (policy.status === 'paused') {
    return { allowed: false, reason: 'allowance_paused' };
  }

  if (price > policy.perCallCap) {
    return { allowed: false, reason: 'per_call_cap_exceeded' };
  }

  if (spentToday + price > policy.dailyCap) {
    return { allowed: false, reason: 'daily_cap_exceeded' };
  }

  return { allowed: true };
};
