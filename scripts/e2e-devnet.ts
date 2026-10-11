import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { explorerTxUrl, type ServiceId } from '@402lab/shared';
import { createKeyPairSignerFromBytes, createSignableMessage, getBase58Decoder } from '@solana/kit';
import { decodePaymentResponseHeader } from '@x402/core/http';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { z } from 'zod';

const apiUrl = process.env['API_URL'] ?? 'http://localhost:8080';
const payerKeypairPath = process.env['PAYER_KEYPAIR_PATH'] ?? 'scripts/.wallets/payer.keypair.json';
const ownerKeypairPath = process.env['OWNER_KEYPAIR_PATH'];
const ocrImageUrl =
  process.env['OCR_IMAGE_URL'] ??
  'https://raw.githubusercontent.com/tesseract-ocr/tessdoc/main/images/eurotext.png';
const transcribeAudioUrl =
  process.env['TRANSCRIBE_AUDIO_URL'] ??
  'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg';

const SPLIT_TIMEOUT_MS = 120_000;
const SPLIT_POLL_MS = 5_000;

const inputs: Record<ServiceId, Record<string, string>> = {
  ocr: { imageUrl: ocrImageUrl },
  translate: { text: 'Olá! Este agente pagou esta tradução com USDC.', targetLanguage: 'en' },
  summarize: {
    text: 'An AI agent received an allowance from its owner, paid three APIs per call in USDC on Solana through HTTP 402, and every provider was paid its share by an automatic split thirty seconds later.',
  },
  vision: { imageUrl: ocrImageUrl },
  chat: { prompt: 'In one sentence, what is HTTP 402?' },
  embed: { text: 'An AI agent paying for its own API calls, one call at a time.' },
  image: { prompt: 'A pocket wallet made of circuitry, paying for itself' },
  speech: { text: 'Your agent just settled a payment on Solana devnet.' },
  transcribe: { audioUrl: transcribeAudioUrl },
  bedrock: { prompt: 'In one sentence, what is a settlement split?' },
};

const servicesSchema = z.object({
  services: z.array(z.object({ id: z.string(), price: z.string(), mode: z.string() })),
});
const splitsSchema = z.object({
  batches: z.array(z.object({ id: z.string(), status: z.string(), explorerUrl: z.string() })),
});
const nonceSchema = z.object({ message: z.string() });

const loadSigner = async (path: string) => {
  const secretKey = z
    .array(z.number().int().min(0).max(255))
    .length(64)
    .parse(JSON.parse(await readFile(path, 'utf8')));

  return createKeyPairSignerFromBytes(Uint8Array.from(secretKey));
};

const results: { step: string; ok: boolean; detail: string }[] = [];
const report = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${step}: ${detail}`);
};

/** Sign-In With Solana with the owner keypair; returns the `session` cookie pair. */
const signIn = async (): Promise<string> => {
  if (ownerKeypairPath === undefined) {
    throw new Error('GET /splits needs a session: set OWNER_KEYPAIR_PATH');
  }

  const owner = await loadSigner(ownerKeypairPath);
  const nonceResponse = await fetch(`${apiUrl}/auth/nonce?address=${owner.address}`);
  if (!nonceResponse.ok) throw new Error(`GET /auth/nonce: HTTP ${String(nonceResponse.status)}`);

  const { message } = nonceSchema.parse(await nonceResponse.json());
  const [signatures] = await owner.signMessages([createSignableMessage(message)]);
  const signature = signatures?.[owner.address];
  if (signature === undefined) throw new Error('the owner keypair did not sign the message');
  const verifyResponse = await fetch(`${apiUrl}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address: owner.address,
      signature: getBase58Decoder().decode(signature),
      message,
    }),
  });
  if (!verifyResponse.ok) {
    throw new Error(`POST /auth/verify: HTTP ${String(verifyResponse.status)}`);
  }

  const cookie = verifyResponse.headers
    .getSetCookie()
    .map((header) => header.split(';')[0] ?? '')
    .find((pair) => pair.startsWith('session='));
  if (cookie === undefined) throw new Error('POST /auth/verify did not set the session cookie');

  console.log(`signed in as owner ${owner.address}`);
  return cookie;
};

let sessionCookie: string | undefined;

const listSplits = async () => {
  const get = () =>
    fetch(`${apiUrl}/splits`, sessionCookie ? { headers: { cookie: sessionCookie } } : {});

  let response = await get();
  if (response.status === 401 && sessionCookie === undefined) {
    sessionCookie = await signIn();
    response = await get();
  }
  if (!response.ok) throw new Error(`GET /splits: HTTP ${String(response.status)}`);

  return splitsSchema.parse(await response.json()).batches;
};

const listServices = async () => {
  const response = await fetch(`${apiUrl}/services`);
  if (!response.ok) throw new Error(`GET /services: HTTP ${String(response.status)}`);

  const { services } = servicesSchema.parse(await response.json());
  report(
    'GET /services',
    true,
    services.map(({ id, price, mode }) => `${id} ${price} (${mode})`).join(', '),
  );
};

const payAll = async () => {
  const payer = await loadSigner(payerKeypairPath);
  const client = new x402Client().register('solana:*', new ExactSvmScheme(payer));
  const payingFetch = wrapFetchWithPayment(fetch, client);
  console.log(`payer ${payer.address}`);

  for (const [serviceId, input] of Object.entries(inputs)) {
    const step = `POST /svc/${serviceId}`;
    try {
      const response = await payingFetch(`${apiUrl}/svc/${serviceId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const header = response.headers.get('payment-response');

      if (!response.ok || header === null) {
        report(step, false, `HTTP ${String(response.status)} ${await response.text()}`);
        continue;
      }

      const { transaction } = decodePaymentResponseHeader(header);
      report(step, true, `${transaction} ${explorerTxUrl(transaction)}`);
    } catch (error) {
      report(step, false, String(error));
    }
  }
};

const waitForSplit = async (before: Set<string>) => {
  const deadline = Date.now() + SPLIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const batch = (await listSplits()).find(
      ({ id, status }) => status === 'confirmed' && !before.has(id),
    );
    if (batch) {
      report('split.confirmed', true, batch.explorerUrl);
      return;
    }
    await sleep(SPLIT_POLL_MS);
  }

  report(
    'split.confirmed',
    false,
    `no new confirmed batch in ${String(SPLIT_TIMEOUT_MS / 1000)} s (is TREASURY_SECRET_KEY set on the API?)`,
  );
};

console.log(`402Lab devnet e2e against ${apiUrl}`);

try {
  await listServices();
  const before = new Set((await listSplits()).map(({ id }) => id));
  await payAll();
  await waitForSplit(before);
} catch (error) {
  report('e2e', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter(({ ok }) => !ok);
console.log(
  `\nsummary: ${String(results.length - failed.length)} ok, ${String(failed.length)} failed`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
