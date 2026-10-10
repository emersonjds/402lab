import { serviceIdSchema } from '@402lab/shared';
import { z } from 'zod';

const atomicAmountString = z.string().regex(/^\d+$/);

export const allowanceSchema = z.object({
  id: z.string(),
  agentName: z.string(),
  sessionAddress: z.string(),
  status: z.enum(['active', 'paused']),
  perCallCap: atomicAmountString,
  dailyCap: atomicAmountString,
  spentToday: atomicAmountString,
  createdAt: z.string(),
});

export type Allowance = z.infer<typeof allowanceSchema>;

export const allowanceListSchema = z.object({ allowances: z.array(allowanceSchema) });

export const paymentSchema = z.object({
  id: z.string(),
  serviceId: serviceIdSchema,
  amount: atomicAmountString,
  txSignature: z.string(),
  settledAt: z.string(),
  upstreamStatus: z.string().nullable(),
});

export type Payment = z.infer<typeof paymentSchema>;

export const paymentListSchema = z.object({ payments: z.array(paymentSchema) });

const payoutSchema = z.object({
  recipient: z.string(),
  role: z.enum(['provider', 'integrator', 'platform']),
  amount: atomicAmountString,
});

export type Payout = z.infer<typeof payoutSchema>;

export const statementSchema = z.object({
  month: z.string(),
  totals: z.object({
    amount: atomicAmountString,
    cardEquivalent: atomicAmountString,
    byService: z.array(z.object({ serviceId: serviceIdSchema, count: z.number(), amount: atomicAmountString })),
    byProvider: z.array(payoutSchema),
  }),
  payments: z.array(paymentSchema),
});

export type Statement = z.infer<typeof statementSchema>;

export const splitBatchSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'confirmed', 'failed']),
  txSignature: z.string(),
  explorerUrl: z.string(),
  createdAt: z.string(),
  payouts: z.array(payoutSchema),
});

export type SplitBatch = z.infer<typeof splitBatchSchema>;

export const splitBatchListSchema = z.object({ batches: z.array(splitBatchSchema) });

export const mobilePairingSchema = z.object({ token: z.string(), expiresAt: z.string() });

export const onrampTransferSchema = z.object({ signature: z.string() });

export const catalogServiceSchema = z.object({
  id: serviceIdSchema,
  name: z.string(),
  description: z.string(),
  upstream: z.string(),
  price: atomicAmountString,
  mode: z.enum(['live', 'demo']),
});

export type CatalogService = z.infer<typeof catalogServiceSchema>;

export const catalogServiceListSchema = z.object({ services: z.array(catalogServiceSchema) });
