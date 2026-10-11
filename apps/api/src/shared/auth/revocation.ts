import { eq } from 'drizzle-orm';

import type { Database } from '../db/pool.js';
import { ownerSessions } from '../db/schema.js';

/** The cutoff below which an owner's tokens are revoked, or `undefined` if none ever were. */
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

/** Signs the owner out everywhere by raising the cutoff; any token issued before `validAfter`,
 * including the one the caller is using right now, fails its next verification. */
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
