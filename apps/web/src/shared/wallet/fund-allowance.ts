'use client';

import { USDC_DEVNET_MINT, type AtomicAmount } from '@402lab/shared';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  address,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  type Address,
  type TransactionSendingSigner,
} from '@solana/kit';

import { solanaRpc } from './rpc';

const USDC_DECIMALS = 6;
const mint = address(USDC_DEVNET_MINT);

const associatedTokenAccount = async (owner: Address): Promise<Address> => {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  return ata;
};

export type FundSessionInput = {
  /** The human's wallet, obtained from `useWalletAccountTransactionSendingSigner`. */
  humanSigner: TransactionSendingSigner;
  sessionAddress: string;
  amount: AtomicAmount;
};

/**
 * Builds and sends a devnet USDC TransferChecked from the human's wallet to the
 * agent's session wallet, creating the session's associated token account first
 * if it does not exist yet. Returns the base58 transaction signature for a
 * Solscan link.
 */
export const fundSessionWallet = async ({
  humanSigner,
  sessionAddress,
  amount,
}: FundSessionInput): Promise<string> => {
  const owner = address(sessionAddress);
  const [{ value: latestBlockhash }, createSessionAta, source, destination] = await Promise.all([
    solanaRpc.getLatestBlockhash().send(),
    getCreateAssociatedTokenIdempotentInstructionAsync({ payer: humanSigner, owner, mint }),
    associatedTokenAccount(humanSigner.address),
    associatedTokenAccount(owner),
  ]);

  const transferChecked = getTransferCheckedInstruction({
    source,
    mint,
    destination,
    authority: humanSigner,
    amount,
    decimals: USDC_DECIMALS,
  });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (draft) => setTransactionMessageFeePayerSigner(humanSigner, draft),
    (draft) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, draft),
    (draft) => appendTransactionMessageInstructions([createSessionAta, transferChecked], draft),
  );

  const signature = await signAndSendTransactionMessageWithSigners(message);

  return getBase58Decoder().decode(signature);
};
