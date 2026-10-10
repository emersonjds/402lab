import { describe, expect, it } from 'vitest';

import { liveEventSchema } from '../src/events.js';

const validEvents = [
  {
    type: 'payment.settled',
    paymentId: 'pay_1',
    serviceId: 'ocr',
    allowanceId: null,
    amount: '5000',
    txSignature: '5sig',
    settledAt: '2026-10-10T12:00:00Z',
  },
  { type: 'split.confirmed', batchId: 'batch_1', txSignature: '5sig' },
  { type: 'split.failed', batchId: 'batch_1', txSignature: null },
  {
    type: 'allowance.cap_reached',
    allowanceId: 'allow_1',
    price: '10000',
    spentToday: '990001',
    dailyCap: '1000000',
  },
  {
    type: 'allowance.updated',
    allowanceId: 'allow_1',
    status: 'paused',
    perCallCap: '20000',
    dailyCap: '1000000',
  },
];

describe('live events', () => {
  it('parses every event type', () => {
    expect(validEvents.map((event) => liveEventSchema.parse(event).type)).toEqual([
      'payment.settled',
      'split.confirmed',
      'split.failed',
      'allowance.cap_reached',
      'allowance.updated',
    ]);
  });

  it('rejects unknown types and non-integer money', () => {
    expect(liveEventSchema.safeParse({ type: 'payment.refunded' }).success).toBe(false);
    expect(liveEventSchema.safeParse({ ...validEvents[0], amount: '0.005' }).success).toBe(false);
    expect(liveEventSchema.safeParse({ ...validEvents[0], amount: 5000 }).success).toBe(false);
  });
});
