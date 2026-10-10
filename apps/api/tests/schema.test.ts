import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { allowances, payments } from '../src/shared/db/schema.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

let testDatabase: TestDatabase;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
});

afterAll(async () => {
  await testDatabase.drop();
});

const newAllowance = (sessionAddress: string) => ({
  ownerAddress: 'owner-address',
  agentName: 'research-agent',
  sessionAddress,
  perCallCap: 5_000n,
  dailyCap: 50_000n,
});

describe('database constraints', () => {
  it('refuses a payment of zero', async () => {
    await expect(
      testDatabase.database.insert(payments).values({
        serviceId: 'ocr',
        payerAddress: 'payer-address',
        amount: 0n,
        txSignature: 'zero-amount-signature',
      }),
    ).rejects.toMatchObject({
      cause: { code: CHECK_VIOLATION, constraint: 'payments_amount_is_positive' },
    });
  });

  it('refuses an allowance status outside active and paused', async () => {
    await expect(
      testDatabase.database.execute(sql`
        insert into allowances (owner_address, agent_name, session_address, per_call_cap, daily_cap, status)
        values ('owner-address', 'research-agent', 'status-session', 5000, 50000, 'deleted')
      `),
    ).rejects.toMatchObject({
      cause: { code: CHECK_VIOLATION, constraint: 'allowances_status_is_known' },
    });
  });

  it('refuses a second allowance for the same session wallet', async () => {
    await testDatabase.database.insert(allowances).values(newAllowance('shared-session'));

    await expect(
      testDatabase.database.insert(allowances).values(newAllowance('shared-session')),
    ).rejects.toMatchObject({
      cause: { code: UNIQUE_VIOLATION, constraint: 'allowances_session_address_unique' },
    });
  });
});
