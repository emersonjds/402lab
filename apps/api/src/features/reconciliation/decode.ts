import { z } from 'zod';

export type TreasuryDeposit = { payer: string; amount: bigint; blockTime: bigint | null };

const transferCheckedSchema = z.object({
  parsed: z.object({
    type: z.literal('transferChecked'),
    info: z.object({
      mint: z.string(),
      destination: z.string(),
      authority: z.string(),
      tokenAmount: z.object({ amount: z.string().regex(/^\d+$/) }),
    }),
  }),
});

/** Kit upcasts `blockTime` to bigint; instructions stay loose since most are not token transfers. */
const parsedTransactionSchema = z.object({
  blockTime: z.bigint().nullable(),
  meta: z
    .object({
      innerInstructions: z.array(z.object({ instructions: z.array(z.unknown()) })).nullish(),
    })
    .nullable(),
  transaction: z.object({ message: z.object({ instructions: z.array(z.unknown()) }) }),
});

/** The USDC `transferChecked` into the treasury token account, top level or inner. Throws when
 * the RPC answer is not a parsed transaction (null included), so the round retries it. */
export const decodeTreasuryDeposit = (
  transaction: unknown,
  treasuryAccount: string,
  mint: string,
): TreasuryDeposit | undefined => {
  const { blockTime, meta, transaction: body } = parsedTransactionSchema.parse(transaction);
  const instructions = [
    ...body.message.instructions,
    ...(meta?.innerInstructions ?? []).flatMap((inner) => inner.instructions),
  ];

  // ponytail: first matching transfer wins; an x402 payment carries exactly one.
  for (const instruction of instructions) {
    const transfer = transferCheckedSchema.safeParse(instruction);
    if (!transfer.success) continue;

    const { info } = transfer.data.parsed;
    if (info.mint !== mint || info.destination !== treasuryAccount) continue;

    return { payer: info.authority, amount: BigInt(info.tokenAmount.amount), blockTime };
  }

  return undefined;
};
