import { USDC_DEVNET_MINT, type PayoutLine } from '@402lab/shared';
import {
  findAssociatedTokenPda,
  parseCreateAssociatedTokenIdempotentInstruction,
  parseTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  address,
  type Address,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  blockhash,
  decompileTransactionMessage,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
  isTransactionWithinSizeLimit,
  type KeyPairSigner,
  type Transaction,
} from '@solana/kit';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildSplitTransaction } from '../src/features/splits/transaction.js';
import { RECIPIENT_ENVIRONMENT } from './support/environment.js';

const mint = address(USDC_DEVNET_MINT);
const latestBlockhash = {
  blockhash: blockhash('EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'),
  lastValidBlockHeight: 300n,
};
const providerAddress = RECIPIENT_ENVIRONMENT.PROVIDER_OCR_ADDRESS;
const integratorAddress = RECIPIENT_ENVIRONMENT.INTEGRATOR_ADDRESS;

let treasury: KeyPairSigner;

beforeAll(async () => {
  treasury = await generateKeyPairSigner();
});

const ataOf = async (owner: string): Promise<Address> => {
  const [ata] = await findAssociatedTokenPda({
    owner: address(owner),
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return ata;
};

const decodeInstructions = (transaction: Transaction) =>
  decompileTransactionMessage(
    getCompiledTransactionMessageDecoder().decode(transaction.messageBytes),
  ).instructions;

describe('buildSplitTransaction', () => {
  it('creates the recipient ATA then transfers its amount with 6 decimals, per recipient', async () => {
    const payouts: PayoutLine[] = [
      { recipient: providerAddress, role: 'provider', amount: 4_250n },
      { recipient: integratorAddress, role: 'integrator', amount: 250n },
    ];

    const { signedTransaction, signature } = await buildSplitTransaction({
      treasury,
      payouts,
      mint,
      latestBlockhash,
    });

    expect(signature).toBe(getSignatureFromTransaction(signedTransaction));
    const instructions = decodeInstructions(signedTransaction);
    expect(instructions).toHaveLength(4);

    const treasuryAta = await ataOf(treasury.address);
    for (const [index, payout] of payouts.entries()) {
      const create = instructions[index * 2]!;
      const transfer = instructions[index * 2 + 1]!;
      assertIsInstructionWithAccounts(create);
      assertIsInstructionWithData(create);
      assertIsInstructionWithAccounts(transfer);
      assertIsInstructionWithData(transfer);

      const parsedCreate = parseCreateAssociatedTokenIdempotentInstruction(create);
      expect(parsedCreate.accounts.payer.address).toBe(treasury.address);
      expect(parsedCreate.accounts.owner.address).toBe(payout.recipient);
      expect(parsedCreate.accounts.mint.address).toBe(mint);
      expect(parsedCreate.accounts.ata.address).toBe(await ataOf(payout.recipient));

      const parsedTransfer = parseTransferCheckedInstruction(transfer);
      expect(parsedTransfer.programAddress).toBe(TOKEN_PROGRAM_ADDRESS);
      expect(parsedTransfer.accounts.source.address).toBe(treasuryAta);
      expect(parsedTransfer.accounts.destination.address).toBe(await ataOf(payout.recipient));
      expect(parsedTransfer.accounts.authority.address).toBe(treasury.address);
      expect(parsedTransfer.data.amount).toBe(payout.amount);
      expect(parsedTransfer.data.decimals).toBe(6);
    }
  });

  it('fits 8 recipients in one transaction', async () => {
    const recipients = await Promise.all(
      Array.from({ length: 8 }, async () => (await generateKeyPairSigner()).address),
    );
    const payouts: PayoutLine[] = recipients.map((recipient) => ({
      recipient,
      role: 'provider',
      amount: 1_000n,
    }));

    const { signedTransaction } = await buildSplitTransaction({
      treasury,
      payouts,
      mint,
      latestBlockhash,
    });

    expect(isTransactionWithinSizeLimit(signedTransaction)).toBe(true);
    expect(decodeInstructions(signedTransaction)).toHaveLength(16);
  });
});
