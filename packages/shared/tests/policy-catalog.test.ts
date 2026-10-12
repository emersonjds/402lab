import { describe, expect, it } from 'vitest';

import { buildCatalog, serviceIdSchema, serviceSchema } from '../src/catalog.js';
import { liveEventSchema } from '../src/events.js';
import { explorerTxUrl } from '../src/network.js';
import { type AllowancePolicy, evaluateAllowancePolicy } from '../src/policy.js';
import { cardCostEquivalent } from '../src/savings.js';
import { assertValidSplitRules, computeSplit } from '../src/split.js';

const ACTIVE: AllowancePolicy = { status: 'active', perCallCap: 5_000n, dailyCap: 20_000n };

describe('evaluateAllowancePolicy', () => {
  it('allows a call under both caps', () => {
    expect(evaluateAllowancePolicy(ACTIVE, 5_000n, 15_000n)).toEqual({ allowed: true });
  });

  it('refuses everything while paused, before checking caps', () => {
    expect(evaluateAllowancePolicy({ ...ACTIVE, status: 'paused' }, 1n, 0n)).toEqual({
      allowed: false,
      reason: 'allowance_paused',
    });
  });

  it('refuses a price above the per-call cap', () => {
    expect(evaluateAllowancePolicy(ACTIVE, 5_001n, 0n)).toEqual({
      allowed: false,
      reason: 'per_call_cap_exceeded',
    });
  });

  it('refuses a call that would push today past the daily cap, allows landing on it', () => {
    expect(evaluateAllowancePolicy(ACTIVE, 5_000n, 15_001n)).toEqual({
      allowed: false,
      reason: 'daily_cap_exceeded',
    });
    expect(evaluateAllowancePolicy(ACTIVE, 5_000n, 15_000n).allowed).toBe(true);
  });
});

describe('catalog', () => {
  const catalog = buildCatalog({
    provider: {
      ocr: 'provider-ocr',
      translate: 'provider-translate',
      summarize: 'provider-summarize',
      vision: 'provider-vision',
      chat: 'provider-chat',
      embed: 'provider-embed',
      image: 'provider-image',
      speech: 'provider-speech',
      transcribe: 'provider-transcribe',
      bedrock: 'provider-bedrock',
    },
    integrator: 'integrator',
    platform: 'treasury',
  });

  it('lists every service id exactly once', () => {
    expect(catalog.map(({ id }) => id).sort()).toEqual([...serviceIdSchema.options].sort());
  });

  it('gives every service valid split rules: bps sum 10000 with one platform', () => {
    for (const service of catalog) {
      expect(service.splits.reduce((sum, { bps }) => sum + bps, 0)).toBe(10_000);
      expect(() => {
        assertValidSplitRules(service.splits);
      }).not.toThrow();
      expect(service.splits.find(({ role }) => role === 'provider')?.recipient).toBe(
        `provider-${service.id}`,
      );
    }
  });

  it('prices every service positively and splits each price without losing value', () => {
    for (const service of catalog) {
      expect(service.price > 0n).toBe(true);
      const total = computeSplit(service.price, service.splits).reduce(
        (sum, { amount }) => sum + amount,
        0n,
      );
      expect(total).toBe(service.price);
    }
  });

  it('parses a service from the wire with its price as bigint', () => {
    const parsed = serviceSchema.parse({
      ...catalog[0],
      price: '5000',
    });

    expect(parsed.price).toBe(5_000n);
  });
});

describe('events, network and savings', () => {
  it('accepts a settled payment event with an atomic string amount and refuses a number', () => {
    const event = {
      type: 'payment.settled',
      paymentId: 'p',
      serviceId: 'ocr',
      allowanceId: null,
      amount: '5000',
      txSignature: 'sig',
      settledAt: '2026-10-12T00:00:00.000Z',
    };

    expect(liveEventSchema.safeParse(event).success).toBe(true);
    expect(liveEventSchema.safeParse({ ...event, amount: 5000 }).success).toBe(false);
  });

  it('links a devnet transaction on solscan', () => {
    expect(explorerTxUrl('abc')).toBe('https://solscan.io/tx/abc?cluster=devnet');
  });

  it('prices the card equivalent of a $0.005 call with fixed fee and IOF', () => {
    // (5000 + 145 + 300000) * 1.035 = 315825.075 -> floor
    expect(cardCostEquivalent(5_000n)).toBe(315_825n);
  });
});
