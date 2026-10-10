import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const allowances = pgTable(
  'allowances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerAddress: text('owner_address').notNull(),
    agentName: text('agent_name').notNull(),
    sessionAddress: text('session_address').notNull().unique(),
    perCallCap: bigint('per_call_cap', { mode: 'bigint' }).notNull(),
    dailyCap: bigint('daily_cap', { mode: 'bigint' }).notNull(),
    status: text('status', { enum: ['active', 'paused'] })
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('allowances_status_is_known', sql`${table.status} in ('active', 'paused')`),
    check('allowances_per_call_cap_is_positive', sql`${table.perCallCap} > 0`),
    check('allowances_daily_cap_is_positive', sql`${table.dailyCap} > 0`),
  ],
);

export const splitBatches = pgTable(
  'split_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    txSignature: text('tx_signature').unique(),
    status: text('status', { enum: ['pending', 'confirmed', 'failed'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastValidBlockHeight: bigint('last_valid_block_height', { mode: 'bigint' }),
  },
  (table) => [
    check(
      'split_batches_status_is_known',
      sql`${table.status} in ('pending', 'confirmed', 'failed')`,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: text('service_id').notNull(),
    payerAddress: text('payer_address').notNull(),
    allowanceId: uuid('allowance_id').references(() => allowances.id, { onDelete: 'restrict' }),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    txSignature: text('tx_signature').notNull().unique(),
    upstreamStatus: text('upstream_status'),
    settledAt: timestamp('settled_at', { withTimezone: true }).notNull().defaultNow(),
    splitBatchId: uuid('split_batch_id').references(() => splitBatches.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check('payments_amount_is_positive', sql`${table.amount} > 0`),
    index('payments_allowance_id_settled_at_idx').on(table.allowanceId, table.settledAt),
    index('payments_unbatched_idx')
      .on(table.splitBatchId)
      .where(sql`${table.splitBatchId} is null`),
  ],
);

export const payouts = pgTable(
  'payouts',
  {
    batchId: uuid('batch_id')
      .notNull()
      .references(() => splitBatches.id, { onDelete: 'restrict' }),
    recipient: text('recipient').notNull(),
    role: text('role', { enum: ['provider', 'integrator', 'platform'] }).notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.batchId, table.recipient, table.role] }),
    check('payouts_role_is_known', sql`${table.role} in ('provider', 'integrator', 'platform')`),
    check('payouts_amount_is_positive', sql`${table.amount} > 0`),
  ],
);

export const waitlist = pgTable('waitlist', {
  email: text('email').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authNonces = pgTable('auth_nonces', {
  nonce: text('nonce').primaryKey(),
  address: text('address').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type AllowanceRow = typeof allowances.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
