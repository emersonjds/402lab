import { z } from 'zod';

import { serviceIdSchema } from './catalog.js';
import { atomicStringSchema } from './money.js';

export const liveEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('payment.settled'),
    paymentId: z.string(),
    serviceId: serviceIdSchema,
    allowanceId: z.string().nullable(),
    amount: atomicStringSchema,
    txSignature: z.string(),
    settledAt: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('split.confirmed'),
    batchId: z.string(),
    txSignature: z.string(),
  }),
  z.object({
    type: z.literal('split.failed'),
    batchId: z.string(),
    txSignature: z.string().nullable(),
  }),
  z.object({
    type: z.literal('allowance.cap_reached'),
    allowanceId: z.string(),
    price: atomicStringSchema,
    spentToday: atomicStringSchema,
    dailyCap: atomicStringSchema,
  }),
  z.object({
    type: z.literal('allowance.updated'),
    allowanceId: z.string(),
    status: z.enum(['active', 'paused']),
    perCallCap: atomicStringSchema,
    dailyCap: atomicStringSchema,
  }),
]);

export type LiveEvent = z.infer<typeof liveEventSchema>;
