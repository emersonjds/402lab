import type { Database } from '../../shared/db/pool.js';
import { waitlist } from '../../shared/db/schema.js';

/** Idempotent: a repeated e-mail is a no-op, so the answer never reveals who signed up. */
export const joinWaitlist = async (db: Database, email: string): Promise<void> => {
  await db.insert(waitlist).values({ email }).onConflictDoNothing();
};
