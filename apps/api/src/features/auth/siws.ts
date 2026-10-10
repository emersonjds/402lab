import {
  type Address,
  getBase58Encoder,
  getPublicKeyFromAddress,
  signatureBytes,
  verifySignature,
} from '@solana/kit';

const SIGNATURE_LENGTH = 64;

export const siwsMessage = (address: string, nonce: string): string =>
  `402Lab login\nAddress: ${address}\nNonce: ${nonce}`;

export const nonceOf = (message: string, address: string): string | undefined => {
  const nonce = /\nNonce: ([0-9a-f]+)$/.exec(message)?.[1];

  return nonce !== undefined && message === siwsMessage(address, nonce) ? nonce : undefined;
};

/** Wallets hand back raw bytes; clients send them base58 (Solana's convention) or base64. */
const decodeSignature = (encoded: string): Uint8Array | undefined => {
  try {
    const bytes = getBase58Encoder().encode(encoded);
    if (bytes.length === SIGNATURE_LENGTH) return new Uint8Array(bytes);
  } catch {
    // not base58: try base64
  }

  const bytes = Buffer.from(encoded, 'base64');

  return bytes.length === SIGNATURE_LENGTH ? new Uint8Array(bytes) : undefined;
};

export const isSignedBy = async (
  address: Address,
  message: string,
  encodedSignature: string,
): Promise<boolean> => {
  const signature = decodeSignature(encodedSignature);
  if (!signature) return false;

  return verifySignature(
    await getPublicKeyFromAddress(address),
    signatureBytes(signature),
    new TextEncoder().encode(message),
  );
};
