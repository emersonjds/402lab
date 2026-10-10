import { eq } from 'drizzle-orm';

import type { Database } from '../db/pool.js';
import { ownerSessions } from '../db/schema.js';

export const findSessionsValidAfter = async (
  db: Database,
  ownerAddress: string,
): Promise<Date | undefined> => {
  const [row] = await db
    .select({ validAfter: ownerSessions.validAfter })
    .from(ownerSessions)
    .where(eq(ownerSessions.ownerAddress, ownerAddress));

  return row?.validAfter;
};

export const revokeSessionsIssuedBefore = async (
  db: Database,
  ownerAddress: string,
  validAfter: Date,
): Promise<void> => {
  await db
    .insert(ownerSessions)
    .values({ ownerAddress, validAfter })
    .onConflictDoUpdate({ target: ownerSessions.ownerAddress, set: { validAfter } });
};
