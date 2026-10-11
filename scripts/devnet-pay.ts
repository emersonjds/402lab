import { readFile } from 'node:fs/promises';

import { createKeyPairSignerFromBytes } from '@solana/kit';
import { decodePaymentResponseHeader } from '@x402/core/http';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { z } from 'zod';

const apiUrl = process.env['API_URL'] ?? 'http://localhost:8080';
const keypairPath = process.env['PAYER_KEYPAIR_PATH'] ?? 'scripts/.wallets/payer.keypair.json';
const path = process.argv[2] ?? '/svc/echo';

const secretKey = z
  .array(z.number().int().min(0).max(255))
  .length(64)
  .parse(JSON.parse(await readFile(keypairPath, 'utf8')));
const signer = await createKeyPairSignerFromBytes(Uint8Array.from(secretKey));

const client = new x402Client().register('solana:*', new ExactSvmScheme(signer));
const payingFetch = wrapFetchWithPayment(fetch, client);

console.log(`payer ${signer.address} -> GET ${apiUrl}${path}`);

const response = await payingFetch(`${apiUrl}${path}`);
const paymentResponse = response.headers.get('payment-response');

console.log('status', response.status);
console.log('body', await response.text());
console.log(
  'payment-response',
  paymentResponse === null ? null : decodePaymentResponseHeader(paymentResponse),
);
