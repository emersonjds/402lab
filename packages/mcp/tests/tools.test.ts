import { SOLANA_DEVNET, USDC_DEVNET_MINT } from '@402lab/shared';
import { generateKeyPairSigner } from '@solana/kit';
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import { describe, expect, it, vi } from 'vitest';

import { createPayingFetch } from '../src/paying-fetch.js';
import { createTools, readPerCallCap, type Fetch } from '../src/tools.js';

const API_URL = 'http://api.test';
const RPC_URL = 'http://rpc.test';
const SESSION = '3Vp5E3DjqXhDJT3QuUGDhE4e6bnHxLgpnQY33oKtyUKQ';
const SIGNATURE = '5j7sFakeSignature';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const paymentRequired = (amount: string, error?: string) =>
  encodePaymentRequiredHeader({
    x402Version: 2,
    ...(error === undefined ? {} : { error }),
    resource: { url: `${API_URL}/svc/translate`, description: 'translate', mimeType: '' },
    accepts: [
      {
        scheme: 'exact',
        network: SOLANA_DEVNET,
        asset: USDC_DEVNET_MINT,
        amount,
        payTo: '5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj',
        maxTimeoutSeconds: 300,
        extra: { feePayer: 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5' },
      },
    ],
  });

const paymentResponse = (amount?: string) =>
  encodePaymentResponseHeader({
    success: true,
    transaction: SIGNATURE,
    network: SOLANA_DEVNET,
    ...(amount === undefined ? {} : { amount }),
  });

const SERVICES = {
  services: [
    {
      id: 'ocr',
      name: 'OCR',
      description: 'Extract text from an image.',
      upstream: 'azure-ocr',
      price: '5000',
      mode: 'demo',
    },
    {
      id: 'translate',
      name: 'Translate',
      description: 'Translate text between languages.',
      upstream: 'aws-translate',
      price: '2000',
      mode: 'live',
    },
    {
      id: 'summarize',
      name: 'Summarize',
      description: 'Summarize a long text.',
      upstream: 'anthropic-summary',
      price: '10000',
      mode: 'demo',
    },
  ],
};

const routes =
  (table: Record<string, () => Response>): Fetch =>
  async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    const handler = table[url];
    if (!handler) {
      throw new Error(`unexpected fetch ${url}`);
    }
    return handler();
  };

const tools = (overrides: { payingFetch?: Fetch; plainFetch?: Fetch }) =>
  createTools({
    apiUrl: API_URL,
    rpcUrl: RPC_URL,
    sessionAddress: SESSION,
    payingFetch: overrides.payingFetch ?? routes({}),
    plainFetch: overrides.plainFetch ?? routes({}),
  });

describe('createPayingFetch', () => {
  it('never pays a requirement above the per-call cap', async () => {
    const fetchSpy = vi.fn<Fetch>(async () =>
      json({}, 402, { 'PAYMENT-REQUIRED': paymentRequired('30000') }),
    );
    const payingFetch = createPayingFetch(await generateKeyPairSigner(), 20_000n, fetchSpy);

    await expect(payingFetch(`${API_URL}/svc/translate`, { method: 'POST' })).rejects.toThrow(
      /filtered out by policies/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('listServices', () => {
  it('lists every service with its formatted price and mode', async () => {
    const text = await tools({
      plainFetch: routes({ [`${API_URL}/services`]: () => json(SERVICES) }),
    }).listServices();

    expect(text).toContain('ocr — OCR: Extract text from an image. $0.005 per call (demo)');
    expect(text).toContain(
      'translate — Translate: Translate text between languages. $0.002 per call (live)',
    );
    expect(text).toContain('summarize — Summarize: Summarize a long text. $0.01 per call (demo)');
  });
});

describe('callService', () => {
  it('posts the input and returns the result with the amount paid and the explorer link', async () => {
    const payingFetch = vi.fn<Fetch>(async () =>
      json({ mode: 'live', result: 'Olá mundo' }, 200, {
        'PAYMENT-RESPONSE': paymentResponse('2000'),
      }),
    );

    const text = await tools({ payingFetch }).callService('translate', {
      text: 'Hello world',
      targetLanguage: 'pt',
    });

    expect(text).toBe(
      [
        'Olá mundo',
        'mode: live',
        'paid: $0.002',
        `explorer: https://solscan.io/tx/${SIGNATURE}?cluster=devnet`,
      ].join('\n'),
    );
    const [url, init] = payingFetch.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/svc/translate`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ text: 'Hello world', targetLanguage: 'pt' }));
  });

  it('takes the price from the catalog when the settlement omits the amount', async () => {
    const text = await tools({
      payingFetch: async () =>
        json({ mode: 'demo', result: { text: 'scanned' } }, 200, {
          'PAYMENT-RESPONSE': paymentResponse(),
        }),
      plainFetch: routes({ [`${API_URL}/services`]: () => json(SERVICES) }),
    }).callService('ocr', { imageUrl: 'https://example.com/a.png' });

    expect(text).toContain('{"text":"scanned"}');
    expect(text).toContain('paid: $0.005');
  });

  it('reports a policy refusal without throwing', async () => {
    const text = await tools({
      payingFetch: async () =>
        json({}, 402, { 'PAYMENT-REQUIRED': paymentRequired('2000', 'allowance_paused') }),
    }).callService('translate', { text: 'hi', targetLanguage: 'pt' });

    expect(text).toBe('Payment refused: allowance_paused');
  });

  it('reports the client cap as a refusal', async () => {
    const text = await tools({
      payingFetch: async () => {
        throw new Error(
          'Failed to create payment payload: All payment requirements were filtered out by policies for x402 version: 2',
        );
      },
    }).callService('summarize', { text: 'long' });

    expect(text).toBe('Payment refused: per_call_cap_exceeded');
  });

  it('reports an upstream failure as not charged', async () => {
    const text = await tools({
      payingFetch: async () => json({ error: 'upstream_unavailable' }, 502),
    }).callService('summarize', { text: 'long' });

    expect(text).toBe('Service unavailable: the upstream provider failed. You were not charged.');
  });

  it('reports invalid input with the issues and no charge', async () => {
    const issues = [{ path: ['imageUrl'], message: 'Invalid URL' }];
    const text = await tools({
      payingFetch: async () => json({ error: 'invalid_input', issues }, 400),
    }).callService('ocr', { imageUrl: 'nope' });

    expect(text).toBe(`Invalid input. You were not charged. Issues: ${JSON.stringify(issues)}`);
  });

  it('reports a bare 402, a transport failure and an unexpected status as fixed texts', async () => {
    const call = (payingFetch: Fetch) =>
      tools({ payingFetch }).callService('summarize', { text: 'long' });

    expect(await call(async () => json({}, 402))).toBe('Payment refused: payment_required');
    expect(
      await call(async () => {
        throw new TypeError('fetch failed');
      }),
    ).toBe('Payment failed: TypeError: fetch failed');
    expect(await call(async () => json({}, 500))).toBe('Unexpected response: HTTP 500');
  });

  it('returns the result alone when the response carries no settlement', async () => {
    const text = await tools({
      payingFetch: async () => json({ mode: 'demo', result: 'short' }),
    }).callService('summarize', { text: 'long' });

    expect(text).toBe('short\nmode: demo');
  });
});

describe('getAllowance', () => {
  const balance = (amount: string) =>
    json({
      jsonrpc: '2.0',
      id: 1,
      result: {
        value: [{ account: { data: { parsed: { info: { tokenAmount: { amount } } } } } }],
      },
    });

  it('reports the allowance and the wallet USDC balance', async () => {
    const text = await tools({
      plainFetch: routes({
        [`${API_URL}/allowances/by-session/${SESSION}`]: () =>
          json({ status: 'active', perCallCap: '10000', dailyCap: '1000000', spentToday: '7000' }),
        [RPC_URL]: () => balance('1500000'),
      }),
    }).getAllowance();

    expect(text).toBe(
      [
        `session wallet: ${SESSION}`,
        'allowance: active',
        'per-call cap: $0.01',
        'daily cap: $1',
        'spent today: $0.007',
        'wallet balance: $1.5 USDC',
      ].join('\n'),
    );
  });

  it('falls back to the default per-call cap when the session has no allowance', async () => {
    const text = await tools({
      plainFetch: routes({
        [`${API_URL}/allowances/by-session/${SESSION}`]: () => json({ error: 'not_found' }, 404),
        [RPC_URL]: () => json({ jsonrpc: '2.0', id: 1, result: { value: [] } }),
      }),
    }).getAllowance();

    expect(text).toBe(
      [
        `session wallet: ${SESSION}`,
        'allowance: none yet (default per-call cap $0.02)',
        'wallet balance: $0 USDC',
      ].join('\n'),
    );
  });
});

describe('readPerCallCap', () => {
  const read = (plainFetch: Fetch) =>
    readPerCallCap({ apiUrl: API_URL, sessionAddress: SESSION, plainFetch });

  it('uses the allowance per-call cap', async () => {
    const cap = await read(async () =>
      json({ status: 'active', perCallCap: '15000', dailyCap: '100000', spentToday: '0' }),
    );

    expect(cap).toBe(15_000n);
  });

  it('defaults to $0.02 without an allowance or when the api is down', async () => {
    expect(await read(async () => json({}, 404))).toBe(20_000n);
    expect(await read(async () => json({}, 500))).toBe(20_000n);
    expect(
      await read(async () => {
        throw new TypeError('fetch failed');
      }),
    ).toBe(20_000n);
  });
});
