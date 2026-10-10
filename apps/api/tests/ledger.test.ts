import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findAllowanceBySession } from '../src/features/allowances/repository.js';
import { recordPayment, spentToday } from '../src/features/ledger/repository.js';
import { allowances } from '../src/shared/db/schema.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let testDatabase: TestDatabase;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
});

afterAll(async () => {
  await testDatabase.drop();
});

const createAllowance = async (sessionAddress: string) => {
  const [allowance] = await testDatabase.database
    .insert(allowances)
    .values({
      ownerAddress: 'owner-address',
      agentName: 'research-agent',
      sessionAddress,
      perCallCap: 5_000n,
      dailyCap: 50_000n,
    })
    .returning();

  return allowance!;
};

const payment = (overrides: {
  txSignature: string;
  allowanceId: string | null;
  amount: bigint;
  settledAt: Date;
}) => ({
  serviceId: 'translate' as const,
  payerAddress: 'payer-address',
  ...overrides,
});

describe('ledger repository', () => {
  it('records a settled payment', async () => {
    const allowance = await createAllowance('record-session');
    const settledAt = new Date('2026-10-10T12:00:00.000Z');

    const recorded = await recordPayment(
      testDatabase.database,
      payment({
        txSignature: 'record-signature',
        allowanceId: allowance.id,
        amount: 2_000n,
        settledAt,
      }),
    );

    expect(recorded).toMatchObject({
      serviceId: 'translate',
      payerAddress: 'payer-address',
      allowanceId: allowance.id,
      amount: 2_000n,
      txSignature: 'record-signature',
      settledAt,
      splitBatchId: null,
    });
  });

  it('answers "duplicate" for a signature already recorded and keeps one row', async () => {
    const allowance = await createAllowance('duplicate-session');
    const settledAt = new Date('2026-10-10T12:00:00.000Z');
    const input = payment({
      txSignature: 'duplicate-signature',
      allowanceId: allowance.id,
      amount: 2_000n,
      settledAt,
    });

    await recordPayment(testDatabase.database, input);

    await expect(recordPayment(testDatabase.database, input)).resolves.toBe('duplicate');
    await expect(spentToday(testDatabase.database, allowance.id, settledAt)).resolves.toBe(2_000n);
  });

  it('sums only what the allowance spent since midnight UTC', async () => {
    const allowance = await createAllowance('spent-session');
    const otherAllowance = await createAllowance('other-spent-session');
    const record = (txSignature: string, allowanceId: string, amount: bigint, settledAt: string) =>
      recordPayment(
        testDatabase.database,
        payment({ txSignature, allowanceId, amount, settledAt: new Date(settledAt) }),
      );

    await record('yesterday-signature', allowance.id, 7_000n, '2026-10-09T23:59:59.999Z');
    await record('midnight-signature', allowance.id, 2_000n, '2026-10-10T00:00:00.000Z');
    await record('morning-signature', allowance.id, 5_000n, '2026-10-10T09:30:00.000Z');
    await record(
      'other-allowance-signature',
      otherAllowance.id,
      10_000n,
      '2026-10-10T09:30:00.000Z',
    );

    await expect(
      spentToday(testDatabase.database, allowance.id, new Date('2026-10-10T18:00:00.000Z')),
    ).resolves.toBe(7_000n);
  });

  it('spends nothing on a day without payments', async () => {
    const allowance = await createAllowance('idle-session');

    await expect(
      spentToday(testDatabase.database, allowance.id, new Date('2026-10-10T18:00:00.000Z')),
    ).resolves.toBe(0n);
  });

  it('finds an allowance by its session wallet and nothing for an unknown wallet', async () => {
    const allowance = await createAllowance('lookup-session');

    await expect(findAllowanceBySession(testDatabase.database, 'lookup-session')).resolves.toEqual(
      allowance,
    );
    await expect(
      findAllowanceBySession(testDatabase.database, 'unknown-session'),
    ).resolves.toBeUndefined();
  });
});
