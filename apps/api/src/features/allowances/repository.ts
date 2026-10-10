import { eq } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { allowances, type AllowanceRow } from '../../shared/db/schema.js';

export const findAllowanceBySession = async (
  db: Database,
  sessionAddress: string,
): Promise<AllowanceRow | undefined> => {
  const [allowance] = await db
    .select()
    .from(allowances)
    .where(eq(allowances.sessionAddress, sessionAddress));

  return allowance;
};
