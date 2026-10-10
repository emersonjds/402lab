import { atomicStringSchema } from '@402lab/shared';
import { z } from 'zod';

export const splitBatchListingSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'confirmed', 'failed']),
  txSignature: z.string(),
  explorerUrl: z.url(),
  createdAt: z.iso.datetime(),
  payouts: z.array(
    z.object({
      recipient: z.string(),
      role: z.enum(['provider', 'integrator', 'platform']),
      amount: atomicStringSchema,
    }),
  ),
});

export const splitBatchListResponseSchema = z.object({ batches: z.array(splitBatchListingSchema) });

export type SplitBatchListResponse = z.infer<typeof splitBatchListResponseSchema>;
