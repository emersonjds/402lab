import type { AtomicAmount } from '@402lab/shared';
import { and, asc, eq, gte, lt, type SQL, sql } from 'drizzle-orm';

import type { Database } from '../../shared/db/pool.js';
import {
  allowances,
  type AllowanceRow,
  payments,
  type PaymentRow,
} from '../../shared/db/schema.js';

/** The allowance that backs a session wallet, if any. Used by the ledger hooks and the
 * public `by-session` route to look up policy without the owner's identity. */
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

export type NewAllowance = Pick<
  AllowanceRow,
  'ownerAddress' | 'agentName' | 'sessionAddress' | 'perCallCap' | 'dailyCap'
>;

/** Answers `'duplicate'` when the session wallet already backs an allowance. */
export const createAllowance = async (
  db: Database,
  input: NewAllowance,
): Promise<AllowanceRow | 'duplicate'> => {
  const [allowance] = await db
    .insert(allowances)
    .values(input)
    .onConflictDoNothing({ target: allowances.sessionAddress })
    .returning();

  return allowance ?? 'duplicate';
};

export type AllowanceWithSpend = AllowanceRow & { spentToday: AtomicAmount };

const startOfUtcDay = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const selectWithSpend = (db: Database, now: Date, where: SQL | undefined) =>
  db
    .select({
      allowance: allowances,
      spentToday: sql`coalesce(sum(${payments.amount}), 0)`.mapWith(BigInt),
    })
    .from(allowances)
    .leftJoin(
      payments,
      and(eq(payments.allowanceId, allowances.id), gte(payments.settledAt, startOfUtcDay(now))),
    )
    .where(where)
    .groupBy(allowances.id)
    .orderBy(asc(allowances.createdAt), asc(allowances.id))
    .then((rows) => rows.map((row) => ({ ...row.allowance, spentToday: row.spentToday })));

/** Every allowance owned by this caller, each with today's UTC spend. */
export const listAllowances = (
  db: Database,
  { ownerAddress, now }: { ownerAddress: string; now: Date },
): Promise<AllowanceWithSpend[]> =>
  selectWithSpend(db, now, eq(allowances.ownerAddress, ownerAddress));

/** Ownership lives in the WHERE clause: another owner's allowance is simply not found. */
export const findOwnedAllowance = async (
  db: Database,
  { ownerAddress, id, now }: { ownerAddress: string; id: string; now: Date },
): Promise<AllowanceWithSpend | undefined> => {
  const [allowance] = await selectWithSpend(
    db,
    now,
    and(eq(allowances.ownerAddress, ownerAddress), eq(allowances.id, id)),
  );

  return allowance;
};

/** Same lookup as `findAllowanceBySession`, with today's spend attached. */
export const findSessionAllowance = async (
  db: Database,
  { sessionAddress, now }: { sessionAddress: string; now: Date },
): Promise<AllowanceWithSpend | undefined> => {
  const [allowance] = await selectWithSpend(db, now, eq(allowances.sessionAddress, sessionAddress));

  return allowance;
};

/** An undefined field is left as it is. */
export type AllowanceChanges = {
  [Field in 'status' | 'perCallCap' | 'dailyCap']?: AllowanceRow[Field] | undefined;
};

/** The cap rule is checked against the row being written, so a concurrent change cannot slip
 * a per-call cap above the daily one. Answers `'caps_inverted'` when the change would. */
export const updateAllowance = async (
  db: Database,
  { ownerAddress, id, changes }: { ownerAddress: string; id: string; changes: AllowanceChanges },
): Promise<AllowanceRow | 'caps_inverted' | undefined> => {
  const isOwned = and(eq(allowances.id, id), eq(allowances.ownerAddress, ownerAddress));
  const perCallCap = changes.perCallCap ?? allowances.perCallCap;
  const dailyCap = changes.dailyCap ?? allowances.dailyCap;

  const [allowance] = await db
    .update(allowances)
    .set(changes)
    .where(and(isOwned, sql`${perCallCap}::bigint <= ${dailyCap}::bigint`))
    .returning();
  if (allowance) return allowance;

  const [existing] = await db.select({ id: allowances.id }).from(allowances).where(isOwned);
  return existing ? 'caps_inverted' : undefined;
};

export const POLLING_PAGE_SIZE = 50;

/** Keyset on (settled_at, id): ascending and never repeats a row already handed out.
 * A cursor that is not a payment of this allowance matches nothing. */
// ponytail: a payment committed late with an earlier settled_at is skipped; add a sequence column if that shows up.
/** One page of an owned allowance's payments for mobile polling, oldest first. */
export const listPaymentsAfter = async (
  db: Database,
  { allowanceId, after }: { allowanceId: string; after: string | undefined },
): Promise<PaymentRow[]> =>
  db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.allowanceId, allowanceId),
        after === undefined
          ? undefined
          : sql`(${payments.settledAt}, ${payments.id}) > (select cursor.settled_at, cursor.id from payments cursor where cursor.id = ${after} and cursor.allowance_id = ${allowanceId})`,
      ),
    )
    .orderBy(asc(payments.settledAt), asc(payments.id))
    .limit(POLLING_PAGE_SIZE);

/** An owned allowance's payments in `[from, to)`, for the monthly statement. */
export const listPaymentsBetween = async (
  db: Database,
  { allowanceId, from, to }: { allowanceId: string; from: Date; to: Date },
): Promise<PaymentRow[]> =>
  db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.allowanceId, allowanceId),
        gte(payments.settledAt, from),
        lt(payments.settledAt, to),
      ),
    )
    .orderBy(asc(payments.settledAt), asc(payments.id));
