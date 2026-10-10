import { and, eq, gt, lte } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { authNonces } from '../../shared/db/schema.js';

export const storeNonce = async (
  db: Database,
  nonce: { nonce: string; address: string; expiresAt: Date },
  now: Date,
): Promise<void> => {
  await db.delete(authNonces).where(lte(authNonces.expiresAt, now));
  await db.insert(authNonces).values(nonce);
};

/** One DELETE … RETURNING: two concurrent sign-ins with the same nonce cannot both win. */
export const consumeNonce = async (
  db: Database,
  { nonce, address, now }: { nonce: string; address: string; now: Date },
): Promise<boolean> => {
  const consumed = await db
    .delete(authNonces)
    .where(
      and(
        eq(authNonces.nonce, nonce),
        eq(authNonces.address, address),
        gt(authNonces.expiresAt, now),
      ),
    )
    .returning({ nonce: authNonces.nonce });

  return consumed.length === 1;
};
