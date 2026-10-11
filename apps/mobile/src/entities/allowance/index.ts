import { atomicStringSchema, parseAtomic } from '@402lab/shared';
import { z } from 'zod';

import { request, type Connection } from '@/shared/api/client';

const atomic = atomicStringSchema.transform(parseAtomic);

const allowanceSchema = z.object({
  id: z.string(),
  agentName: z.string(),
  sessionAddress: z.string(),
  status: z.enum(['active', 'paused']),
  perCallCap: atomic,
  dailyCap: atomic,
  spentToday: atomic,
  createdAt: z.string(),
});

export type Allowance = z.output<typeof allowanceSchema>;
export type AllowanceStatus = Allowance['status'];

const listSchema = z.object({ allowances: z.array(allowanceSchema) });

export const listAllowances = async (connection: Connection): Promise<Allowance[]> =>
  (await request(connection, '/allowances', listSchema)).allowances;

export const setAllowanceStatus = (
  connection: Connection,
  id: string,
  status: AllowanceStatus,
): Promise<Allowance> =>
  request(connection, `/allowances/${encodeURIComponent(id)}`, allowanceSchema, {
    method: 'PATCH',
    body: { status },
  });

export const capReached = (allowance: Allowance): boolean =>
  allowance.spentToday >= allowance.dailyCap;

export const spentPercent = (allowance: Allowance): number => {
  if (allowance.dailyCap === 0n) return 100;
  const ratio = (allowance.spentToday * 100n) / allowance.dailyCap;
  return ratio > 100n ? 100 : Number(ratio);
};
