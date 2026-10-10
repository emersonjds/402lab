import { eq, inArray } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { payments, reconciliationCursor, splitBatches } from '../../shared/db/schema.js';

/** Newest treasury signature already reconciled for `account`, or `undefined` on a first run. */
export const readCursor = async (db: Database, account: string): Promise<string | undefined> => {
  const [cursor] = await db
    .select({ lastSignature: reconciliationCursor.lastSignature })
    .from(reconciliationCursor)
    .where(eq(reconciliationCursor.account, account));

  return cursor?.lastSignature;
};

/** Advances the cursor one signature at a time, so a crash mid-round resumes at the signature
 * that was being processed rather than skipping it. */
export const saveCursor = async (
  db: Database,
  account: string,
  lastSignature: string,
): Promise<void> => {
  await db
    .insert(reconciliationCursor)
    .values({ account, lastSignature })
    .onConflictDoUpdate({
      target: reconciliationCursor.account,
      set: { lastSignature, updatedAt: new Date() },
    });
};

/** Signatures already in the ledger or sent by the split worker need no chain lookup. */
export const findKnownSignatures = async (
  db: Database,
  signatures: readonly string[],
): Promise<Set<string>> => {
  if (signatures.length === 0) return new Set();

  const list = [...signatures];
  const [paid, split] = await Promise.all([
    db
      .select({ txSignature: payments.txSignature })
      .from(payments)
      .where(inArray(payments.txSignature, list)),
    db
      .select({ txSignature: splitBatches.txSignature })
      .from(splitBatches)
      .where(inArray(splitBatches.txSignature, list)),
  ]);

  return new Set([...paid, ...split].map(({ txSignature }) => txSignature));
};
