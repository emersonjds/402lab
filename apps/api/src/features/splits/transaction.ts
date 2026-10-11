import type { PayoutLine } from '@402lab/shared';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  address,
  type Address,
  appendTransactionMessageInstructions,
  type Blockhash,
  createTransactionMessage,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

const USDC_DECIMALS = 6;

export type LatestBlockhash = { blockhash: Blockhash; lastValidBlockHeight: bigint };

export type SplitTransactionInput = {
  treasury: KeyPairSigner;
  payouts: readonly PayoutLine[];
  mint: Address;
  latestBlockhash: LatestBlockhash;
};

const associatedTokenAccount = async (owner: Address, mint: Address): Promise<Address> => {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  return ata;
};

/** The treasury pays fees and the rent of every recipient ATA it has to create. */
export const buildSplitTransaction = async ({
  treasury,
  payouts,
  mint,
  latestBlockhash,
}: SplitTransactionInput) => {
  const source = await associatedTokenAccount(treasury.address, mint);
  const instructionPairs = await Promise.all(
    payouts.map(async ({ recipient, amount }): Promise<Instruction[]> => {
      const owner = address(recipient);

      return [
        await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: treasury, owner, mint }),
        getTransferCheckedInstruction({
          source,
          mint,
          destination: await associatedTokenAccount(owner, mint),
          authority: treasury,
          amount,
          decimals: USDC_DECIMALS,
        }),
      ];
    }),
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (message) => setTransactionMessageFeePayerSigner(treasury, message),
      (message) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      (message) => appendTransactionMessageInstructions(instructionPairs.flat(), message),
    ),
  );

  return { signedTransaction, signature: getSignatureFromTransaction(signedTransaction) };
};
