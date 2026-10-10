'use client';

import { decodePaymentResponseHeader } from '@x402/core/http';

const PAYMENT_RESPONSE_HEADER = 'payment-response';

/** Reads the settlement signature 402Lab attaches to every paid response. */
export const settlementSignatureOf = (response: Response): string | null => {
  const header = response.headers.get(PAYMENT_RESPONSE_HEADER);
  if (!header) return null;

  try {
    return decodePaymentResponseHeader(header).transaction;
  } catch {
    return null;
  }
};
