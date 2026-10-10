import { USDC_DEVNET_MINT } from '@402lab/shared';
import {
  findAssociatedTokenPda,
  parseTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  address,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  blockhash,
  decompileTransactionMessage,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
  type Transaction,
} from '@solana/kit';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { OnrampChain } from '../src/features/demo-onramp/routes.js';
import { loadConfig } from '../src/shared/config/index.js';
import { allowances } from '../src/shared/db/schema.js';
import { buildTestApp, testConfig, webSession } from './support/app.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { RECIPIENT_ENVIRONMENT } from './support/environment.js';
import { solanaKeypair, type SolanaKeypair } from './support/keypair.js';

const OWNER_A = 'owner-a-address';
const OWNER_B = 'owner-b-address';
const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

const sentTransactions: Transaction[] = [];
let rpcFails = false;

const fakeChain: OnrampChain = {
  latestBlockhash: async () => ({
    blockhash: blockhash('EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'),
    lastValidBlockHeight: 100n,
  }),
  send: async (transaction) => {
    if (rpcFails) throw new Error('Transaction simulation failed: insufficient funds 0xdeadbeef');
    sentTransactions.push(transaction);
  },
};

let testDatabase: TestDatabase;
let app: FastifyInstance;
let treasury: SolanaKeypair;

const devnetConfig = (overrides: Record<string, string> = {}) =>
  testConfig({
    TREASURY_ADDRESS: treasury.address,
    TREASURY_SECRET_KEY: treasury.secretKeyJson,
    SOLANA_RPC_URL: DEVNET_RPC_URL,
    ...overrides,
  });

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  treasury = solanaKeypair();
  app = await buildTestApp(testDatabase, { config: devnetConfig(), solanaChain: fakeChain });
});

afterAll(async () => {
  await app.close();
  await testDatabase.drop();
});

beforeEach(() => {
  sentTransactions.length = 0;
  rpcFails = false;
});

const sessionOf = async (owner: string) => {
  const sessionAddress = (await generateKeyPairSigner()).address;
  await testDatabase.database.insert(allowances).values({
    ownerAddress: owner,
    agentName: 'agent',
    sessionAddress,
    perCallCap: 5_000n,
    dailyCap: 50_000n,
  });

  return sessionAddress;
};

const ataOf = async (owner: string) => {
  const [ata] = await findAssociatedTokenPda({
    owner: address(owner),
    mint: address(USDC_DEVNET_MINT),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return ata;
};

const simulate = (target: FastifyInstance, owner: string, payload: object) =>
  target.inject({ method: 'POST', url: '/onramp/simulate', headers: webSession(owner), payload });

describe('POST /onramp/simulate', () => {
  it("sends devnet USDC from the treasury to the owner's session wallet", async () => {
    const sessionAddress = await sessionOf(OWNER_A);

    const response = await simulate(app, OWNER_A, { sessionAddress, amount: '5000000' });

    expect(response.statusCode).toBe(200);
    expect(sentTransactions).toHaveLength(1);
    const transaction = sentTransactions[0]!;
    expect(response.json()).toEqual({ signature: getSignatureFromTransaction(transaction) });

    const instructions = decompileTransactionMessage(
      getCompiledTransactionMessageDecoder().decode(transaction.messageBytes),
    ).instructions;
    expect(instructions).toHaveLength(2);
    const transfer = instructions[1]!;
    assertIsInstructionWithAccounts(transfer);
    assertIsInstructionWithData(transfer);
    const parsed = parseTransferCheckedInstruction(transfer);
    expect(parsed.accounts.source.address).toBe(await ataOf(treasury.address));
    expect(parsed.accounts.destination.address).toBe(await ataOf(sessionAddress));
    expect(parsed.accounts.authority.address).toBe(treasury.address);
    expect(parsed.data).toMatchObject({ amount: 5_000_000n, decimals: 6 });
  });

  it('refuses an amount above US$5, of zero or not atomic', async () => {
    const sessionAddress = await sessionOf(OWNER_A);

    const responses = await Promise.all(
      ['5000001', '0', '1.5'].map((amount) => simulate(app, OWNER_A, { sessionAddress, amount })),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400, 400]);
    expect(sentTransactions).toEqual([]);
  });

  it("answers 404 for another owner's session wallet or a wallet without allowance", async () => {
    const sessionOfA = await sessionOf(OWNER_A);
    const unknown = (await generateKeyPairSigner()).address;

    const asB = await simulate(app, OWNER_B, { sessionAddress: sessionOfA, amount: '1000000' });
    const missing = await simulate(app, OWNER_A, { sessionAddress: unknown, amount: '1000000' });

    expect(asB.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(sentTransactions).toEqual([]);
  });

  it('answers a fixed 502 when the RPC refuses, never its text', async () => {
    const sessionAddress = await sessionOf(OWNER_A);
    rpcFails = true;

    const response = await simulate(app, OWNER_A, { sessionAddress, amount: '1000000' });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'onramp_unavailable' });
  });

  it('does not exist outside devnet or without the treasury key', async () => {
    const mainnet = await buildTestApp(testDatabase, {
      config: devnetConfig({ SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com' }),
      solanaChain: fakeChain,
    });
    const keyless = await buildTestApp(testDatabase, {
      config: testConfig({ SOLANA_RPC_URL: DEVNET_RPC_URL }),
    });
    const sessionAddress = await sessionOf(OWNER_A);

    const payload = { sessionAddress, amount: '1000000' };
    expect((await simulate(mainnet, OWNER_A, payload)).statusCode).toBe(404);
    expect((await simulate(keyless, OWNER_A, payload)).statusCode).toBe(404);
    await mainnet.close();
    await keyless.close();
  });

  it('builds its own devnet chain client when none is injected', async () => {
    const live = await buildTestApp(testDatabase, { config: devnetConfig() });
    const sessionAddress = await sessionOf(OWNER_A);

    const response = await simulate(live, OWNER_A, { sessionAddress, amount: '9000000' });

    expect(response.statusCode).toBe(400);
    await live.close();
  });

  it('refuses to boot with a treasury key that does not match TREASURY_ADDRESS', async () => {
    const other = solanaKeypair();

    await expect(
      buildTestApp(testDatabase, {
        config: devnetConfig({ TREASURY_SECRET_KEY: other.secretKeyJson }),
      }),
    ).rejects.toThrow('TREASURY_SECRET_KEY does not belong to TREASURY_ADDRESS');
  });
});

describe('session config', () => {
  it('requires a JWT secret of at least 32 characters', () => {
    expect(() =>
      loadConfig({
        ...RECIPIENT_ENVIRONMENT,
        DATABASE_URL: 'postgres://lab:lab@localhost:5432/lab402',
        JWT_SECRET: 'short',
      }),
    ).toThrow('JWT_SECRET');
  });
});
