import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { explorerTxUrl } from '@402lab/shared';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { decodePaymentResponseHeader } from '@x402/core/http';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { z } from 'zod';

// Keeps a few agents paying real services on devnet so the dashboard has live traffic.
// AGENT_KEYPAIRS: comma-separated keypair files; each must back an allowance on the dashboard.
const apiUrl = process.env['API_URL'] ?? 'http://localhost:8080';
const keypairPaths = (process.env['AGENT_KEYPAIRS'] ?? 'scripts/.wallets/payer.keypair.json').split(
  ',',
);
const intervalMs = Number(process.env['INTERVAL_MS'] ?? '8000');
const imageUrl =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg';

const requests: [string, Record<string, string>][] = [
  ['ocr', { imageUrl }],
  ['translate', { text: 'Olá! Este agente pagou esta tradução com USDC.', targetLanguage: 'en' }],
  [
    'summarize',
    { text: 'An AI agent paid three APIs per call in USDC on Solana through HTTP 402.' },
  ],
  ['vision', { imageUrl }],
  ['chat', { prompt: 'In one sentence, what is HTTP 402?' }],
  ['embed', { text: 'An AI agent paying for its own API calls, one call at a time.' }],
  ['speech', { text: 'Your agent just settled a payment on Solana devnet.' }],
  ['bedrock', { prompt: 'In one sentence, what is a settlement split?' }],
];

const loadSigner = async (path: string) =>
  createKeyPairSignerFromBytes(
    Uint8Array.from(
      z
        .array(z.number().int().min(0).max(255))
        .length(64)
        .parse(JSON.parse(await readFile(path, 'utf8'))),
    ),
  );

const agents = await Promise.all(
  keypairPaths.map(async (path) => {
    const signer = await loadSigner(path.trim());
    const client = new x402Client().register('solana:*', new ExactSvmScheme(signer));
    return { address: signer.address, pay: wrapFetchWithPayment(fetch, client) };
  }),
);

console.log(`agent traffic against ${apiUrl}: ${agents.map(({ address }) => address).join(', ')}`);

for (let tick = 0; ; tick += 1) {
  const agent = agents[tick % agents.length];
  const request = requests[Math.floor(Math.random() * requests.length)];
  if (agent === undefined || request === undefined) break;
  const [serviceId, input] = request;

  try {
    const response = await agent.pay(`${apiUrl}/svc/${serviceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const header = response.headers.get('payment-response');
    const outcome =
      response.ok && header !== null
        ? explorerTxUrl(decodePaymentResponseHeader(header).transaction)
        : `HTTP ${String(response.status)}`;
    console.log(`${agent.address.slice(0, 4)} ${serviceId} ${outcome}`);
  } catch (error) {
    console.log(`${agent.address.slice(0, 4)} ${serviceId} failed: ${String(error)}`);
  }

  await sleep(intervalMs);
}
