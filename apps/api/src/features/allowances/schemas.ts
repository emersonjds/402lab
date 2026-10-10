import { atomicStringSchema, serviceIdSchema } from '@402lab/shared';
import { z } from 'zod';

import { solanaAddressSchema } from '../../shared/schemas.js';

/** Up to 18 digits keeps every cap inside Postgres `bigint`. */
const positiveAtomicSchema = atomicStringSchema
  .max(18)
  .meta({ example: '5000' })
  .transform((value) => BigInt(value))
  .pipe(z.bigint().positive());

const allowanceStatusSchema = z.enum(['active', 'paused']);

export const allowanceIdParamsSchema = z.object({ id: z.uuid() });

export const sessionParamsSchema = z.object({ address: solanaAddressSchema });

export const createAllowanceBodySchema = z
  .object({
    agentName: z.string().trim().min(1).max(64),
    sessionAddress: solanaAddressSchema,
    perCallCap: positiveAtomicSchema,
    dailyCap: positiveAtomicSchema,
  })
  .refine(({ perCallCap, dailyCap }) => perCallCap <= dailyCap, {
    message: 'perCallCap must not exceed dailyCap',
  })
  .meta({ id: 'NewAllowance' });

export const updateAllowanceBodySchema = z
  .object({
    status: allowanceStatusSchema.optional(),
    perCallCap: positiveAtomicSchema.optional(),
    dailyCap: positiveAtomicSchema.optional(),
  })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'change at least one field',
  })
  .meta({ id: 'AllowanceChanges' });

export const allowanceSchema = z
  .object({
    id: z.uuid(),
    agentName: z.string(),
    sessionAddress: z.string(),
    status: allowanceStatusSchema,
    perCallCap: atomicStringSchema,
    dailyCap: atomicStringSchema,
    spentToday: atomicStringSchema,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Allowance' });

export const allowanceListSchema = z
  .object({ allowances: z.array(allowanceSchema) })
  .meta({ id: 'AllowanceList' });

export const sessionAllowanceSchema = allowanceSchema
  .pick({ status: true, perCallCap: true, dailyCap: true, spentToday: true })
  .meta({ id: 'SessionAllowance' });

export const paymentSchema = z
  .object({
    id: z.uuid(),
    serviceId: serviceIdSchema,
    amount: atomicStringSchema,
    txSignature: z.string(),
    settledAt: z.iso.datetime(),
    /** `failed` when the upstream did not deliver; null while nothing was recorded. */
    upstreamStatus: z.string().nullable(),
  })
  .meta({ id: 'Payment' });

export const paymentsQuerySchema = z.object({ after: z.uuid().optional() });

export const paymentListSchema = z
  .object({ payments: z.array(paymentSchema) })
  .meta({ id: 'PaymentList' });

export const statementQuerySchema = z.object({
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM, year 2000-2099'),
});

export const statementSchema = z
  .object({
    month: z.string(),
    totals: z.object({
      amount: atomicStringSchema,
      /** What the same payments would cost by card: 2.9% + US$0.30 each, plus 3.5% IOF. */
      cardEquivalent: atomicStringSchema,
      byService: z.array(
        z.object({
          serviceId: serviceIdSchema,
          count: z.number().int(),
          amount: atomicStringSchema,
        }),
      ),
      /** Every recipient of the split, platform included, so the lines add up to `amount`. */
      byProvider: z.array(
        z.object({
          recipient: z.string(),
          role: z.enum(['provider', 'integrator', 'platform']),
          amount: atomicStringSchema,
        }),
      ),
    }),
    payments: z.array(paymentSchema),
  })
  .meta({ id: 'Statement' });

export type Statement = z.infer<typeof statementSchema>;
export type PaymentView = z.infer<typeof paymentSchema>;
