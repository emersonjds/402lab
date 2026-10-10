import type { AtomicAmount, ServiceId } from '@402lab/shared';
import { and, eq, gte, sql } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import { payments, type PaymentRow } from '../../shared/db/schema.js';

export type RecordPaymentInput = {
  serviceId: ServiceId;
  payerAddress: string;
  allowanceId: string | null;
  amount: AtomicAmount;
  txSignature: string;
  settledAt: Date;
};

/** The unique `tx_signature` makes a replayed settlement a no-op. */
export const recordPayment = async (
  db: Database,
  input: RecordPaymentInput,
): Promise<PaymentRow | 'duplicate'> => {
  const [payment] = await db
    .insert(payments)
    .values(input)
    .onConflictDoNothing({ target: payments.txSignature })
    .returning();

  return payment ?? 'duplicate';
};

const startOfUtcDay = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const spentToday = async (
  db: Database,
  allowanceId: string,
  now: Date,
): Promise<AtomicAmount> => {
  const [spent] = await db
    .select({ total: sql`coalesce(sum(${payments.amount}), 0)`.mapWith(BigInt) })
    .from(payments)
    .where(and(eq(payments.allowanceId, allowanceId), gte(payments.settledAt, startOfUtcDay(now))));

  return spent?.total ?? 0n;
};
