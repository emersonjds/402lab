import {
  parseAtomic,
  SOLANA_DEVNET,
  type AtomicAmount,
  type PayoutLine,
  type Service,
  type ServiceId,
} from '@402lab/shared';
import { encodePaymentResponseHeader } from '@x402/core/http';
import { http, HttpResponse } from 'msw';

import {
  allowanceOf,
  allowances,
  authState,
  explorerTxUrl,
  maybeAdvanceLiveFeed,
  MOCK_SERVICE_IDS,
  MOCK_SERVICES,
  payments,
  recentSplitBatches,
  serviceOf,
  spentToday,
  statementTotalsOf,
  type MockAllowance,
  type MockPayment,
} from './fixtures.js';

const LISTED_BATCHES = 50;

const atomicToApi = (amount: AtomicAmount): string => amount.toString();

const errorResponse = (status: number, error: string) => HttpResponse.json({ error }, { status });

const unauthorized = () => errorResponse(401, 'unauthorized');

// The web mock session is cookie-based (authState); the mobile app authenticates with a
// pairing Bearer token instead, so any token on the request is accepted in mock mode too.
const isAuthorized = (request: Request): boolean =>
  authState.isSignedIn() || request.headers.get('authorization') !== null;

const toApiAllowance = (allowance: MockAllowance) => ({
  id: allowance.id,
  agentName: allowance.agentName,
  sessionAddress: allowance.sessionAddress,
  status: allowance.status,
  perCallCap: atomicToApi(allowance.perCallCap),
  dailyCap: atomicToApi(allowance.dailyCap),
  spentToday: atomicToApi(spentToday(allowance.id)),
  createdAt: allowance.createdAt,
});

const toApiPayment = (payment: MockPayment) => ({
  id: payment.id,
  serviceId: payment.serviceId,
  amount: atomicToApi(payment.amount),
  txSignature: payment.txSignature,
  settledAt: payment.settledAt,
  upstreamStatus: payment.upstreamStatus,
});

const toApiPayout = (payout: PayoutLine) => ({
  recipient: payout.recipient,
  role: payout.role,
  amount: atomicToApi(payout.amount),
});

const toApiService = (service: Service) => ({
  id: service.id,
  name: service.name,
  description: service.description,
  upstream: service.upstream,
  price: atomicToApi(service.price),
  mode: 'demo' as const,
});

const isAtomicAmount = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

const mockPaymentResponseHeader = (payerAddress: string, amount: AtomicAmount): string =>
  encodePaymentResponseHeader({
    success: true,
    transaction: `MockSig${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    network: SOLANA_DEVNET,
    payer: payerAddress,
    amount: atomicToApi(amount),
  });

const serviceOutput = (id: ServiceId): string => {
  switch (id) {
    case 'ocr':
      return 'MOCKED RECEIPT — TOTAL $42.10 — THANK YOU';
    case 'translate':
      return '[mock] Translated: "Obrigado pela compra."';
    case 'summarize':
      return '[mock] Summary: the document describes a three-step onboarding flow.';
    case 'vision':
      return '[mock] A golden retriever sitting on grass.';
    case 'chat':
      return '[mock] Here is a concise answer to your prompt.';
    case 'embed':
      return '[mock] [0.013, -0.084, 0.251, …] (1536d)';
    case 'image':
      return 'https://demo.402lab.dev/image/sample.png';
    case 'speech':
      return 'https://demo.402lab.dev/speech/sample.mp3';
    case 'transcribe':
      return '[mock] This is a demo transcription.';
    case 'bedrock':
      return '[mock] Demo completion from a hosted foundation model.';
  }
};

const paidServiceHandler = (id: ServiceId) =>
  http.post(`*/api/svc/${id}`, () => {
    const service = serviceOf(id);
    const payer = allowances[0]?.sessionAddress ?? 'mock-session';

    return HttpResponse.json(
      { mode: 'demo' as const, result: serviceOutput(id) },
      { headers: { 'payment-response': mockPaymentResponseHeader(payer, service.price) } },
    );
  });

/** Every REST route of the API contract — safe on any runtime (browser, Node, Hermes). */
export const restHandlers = [
  // --- auth ---
  http.get('*/api/auth/nonce', () => {
    const nonce = Math.random().toString(36).slice(2);

    return HttpResponse.json({
      nonce,
      message: `402Lab wants you to sign in.\nNonce: ${nonce}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
  }),

  // Mock mode trusts any signature (DESIGN.md "em mock o login SIWS aceita qualquer assinatura").
  http.post('*/api/auth/verify', async ({ request }) => {
    const body = (await request.json()) as { address?: unknown };
    if (typeof body.address !== 'string' || body.address === '') {
      return errorResponse(400, 'invalid_input');
    }

    authState.signIn();

    return HttpResponse.json({ address: body.address });
  }),

  http.post('*/api/auth/logout', () => {
    authState.signOut();

    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/auth/pair', () => {
    if (!authState.isSignedIn()) return unauthorized();

    const token = `mock-pair-${Math.random().toString(36).slice(2)}`;
    authState.pair(token);

    return HttpResponse.json({
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    });
  }),

  http.post('*/api/auth/revoke-devices', () => {
    if (!authState.isSignedIn()) return unauthorized();

    authState.signOut();

    return new HttpResponse(null, { status: 204 });
  }),

  // --- catalog ---
  http.get('*/api/services', () =>
    HttpResponse.json({ services: MOCK_SERVICES.map(toApiService) }),
  ),

  // --- allowances ---
  http.get('*/api/allowances', ({ request }) => {
    if (!isAuthorized(request)) return unauthorized();

    maybeAdvanceLiveFeed();

    return HttpResponse.json({ allowances: allowances.map(toApiAllowance) });
  }),

  http.post('*/api/allowances', async ({ request }) => {
    if (!authState.isSignedIn()) return unauthorized();

    const body = (await request.json()) as {
      agentName?: unknown;
      sessionAddress?: unknown;
      perCallCap?: unknown;
      dailyCap?: unknown;
    };

    if (
      typeof body.agentName !== 'string' ||
      body.agentName.length === 0 ||
      typeof body.sessionAddress !== 'string' ||
      body.sessionAddress.length === 0 ||
      !isAtomicAmount(body.perCallCap) ||
      !isAtomicAmount(body.dailyCap)
    ) {
      return errorResponse(400, 'invalid_input');
    }

    const perCallCap = parseAtomic(body.perCallCap);
    const dailyCap = parseAtomic(body.dailyCap);
    if (perCallCap > dailyCap) return errorResponse(400, 'per_call_cap_exceeds_daily_cap');

    const created: MockAllowance = {
      id: crypto.randomUUID(),
      agentName: body.agentName,
      sessionAddress: body.sessionAddress,
      status: 'active',
      perCallCap,
      dailyCap,
      createdAt: new Date().toISOString(),
    };
    allowances.push(created);

    return HttpResponse.json(toApiAllowance(created), { status: 201 });
  }),

  http.get('*/api/allowances/by-session/:address', ({ params }) => {
    const found = allowances.find((allowance) => allowance.sessionAddress === params.address);
    if (!found) return errorResponse(404, 'not_found');

    return HttpResponse.json({
      status: found.status,
      perCallCap: atomicToApi(found.perCallCap),
      dailyCap: atomicToApi(found.dailyCap),
      spentToday: atomicToApi(spentToday(found.id)),
    });
  }),

  http.get('*/api/allowances/:id/payments', ({ params, request }) => {
    if (!isAuthorized(request)) return unauthorized();

    const allowance = allowanceOf(String(params.id));
    if (!allowance) return errorResponse(404, 'not_found');

    maybeAdvanceLiveFeed();

    const after = new URL(request.url).searchParams.get('after');
    const scoped = payments
      .filter((payment) => payment.allowanceId === allowance.id)
      .sort((a, b) => a.settledAt.localeCompare(b.settledAt));
    const afterIndex = after ? scoped.findIndex((payment) => payment.id === after) : -1;
    const page = scoped.slice(afterIndex + 1, afterIndex + 1 + 50);

    return HttpResponse.json({ payments: page.map(toApiPayment) });
  }),

  http.get('*/api/allowances/:id/statement', ({ params, request }) => {
    if (!authState.isSignedIn()) return unauthorized();

    const allowance = allowanceOf(String(params.id));
    if (!allowance) return errorResponse(404, 'not_found');

    const month = new URL(request.url).searchParams.get('month');
    if (!month || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      return errorResponse(400, 'invalid_input');
    }

    const { amount, cardEquivalent, monthPayments } = statementTotalsOf(allowance.id, month);
    const byService = MOCK_SERVICE_IDS
      .map((serviceId) => {
        const forService = monthPayments.filter((payment) => payment.serviceId === serviceId);

        return {
          serviceId,
          count: forService.length,
          amount: atomicToApi(forService.reduce((sum, payment) => sum + payment.amount, 0n)),
        };
      })
      .filter((row) => row.count > 0);

    const byProviderMap = new Map<string, PayoutLine>();
    for (const payment of monthPayments) {
      for (const payout of serviceOf(payment.serviceId).splits) {
        if (payout.role === 'platform') continue;
        const share = (payment.amount * BigInt(payout.bps)) / 10_000n;
        const key = `${payout.role}:${payout.recipient}`;
        const previous = byProviderMap.get(key)?.amount ?? 0n;
        byProviderMap.set(key, { recipient: payout.recipient, role: payout.role, amount: previous + share });
      }
    }

    return HttpResponse.json({
      month,
      totals: {
        amount: atomicToApi(amount),
        cardEquivalent: atomicToApi(cardEquivalent),
        byService,
        byProvider: [...byProviderMap.values()].map(toApiPayout),
      },
      payments: monthPayments.map(toApiPayment),
    });
  }),

  http.get('*/api/allowances/:id', ({ params }) => {
    if (!authState.isSignedIn()) return unauthorized();

    const allowance = allowanceOf(String(params.id));
    if (!allowance) return errorResponse(404, 'not_found');

    return HttpResponse.json(toApiAllowance(allowance));
  }),

  http.patch('*/api/allowances/:id', async ({ params, request }) => {
    if (!isAuthorized(request)) return unauthorized();

    const allowance = allowanceOf(String(params.id));
    if (!allowance) return errorResponse(404, 'not_found');

    const body = (await request.json()) as {
      status?: unknown;
      perCallCap?: unknown;
      dailyCap?: unknown;
    };

    const nextPerCallCap =
      body.perCallCap !== undefined && isAtomicAmount(body.perCallCap)
        ? parseAtomic(body.perCallCap)
        : allowance.perCallCap;
    const nextDailyCap =
      body.dailyCap !== undefined && isAtomicAmount(body.dailyCap)
        ? parseAtomic(body.dailyCap)
        : allowance.dailyCap;

    if (nextPerCallCap > nextDailyCap) return errorResponse(400, 'per_call_cap_exceeds_daily_cap');
    if (body.status !== undefined && body.status !== 'active' && body.status !== 'paused') {
      return errorResponse(400, 'invalid_input');
    }

    allowance.perCallCap = nextPerCallCap;
    allowance.dailyCap = nextDailyCap;
    if (body.status === 'active' || body.status === 'paused') allowance.status = body.status;

    return HttpResponse.json(toApiAllowance(allowance));
  }),

  // --- splits ---
  http.get('*/api/splits', () => {
    if (!authState.isSignedIn()) return unauthorized();

    return HttpResponse.json({
      batches: recentSplitBatches(LISTED_BATCHES)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((batch) => ({
          id: batch.id,
          status: batch.status,
          txSignature: batch.txSignature,
          explorerUrl: explorerTxUrl(batch.txSignature),
          createdAt: batch.createdAt,
          payouts: batch.payouts.map(toApiPayout),
        })),
    });
  }),

  // --- onramp ---
  http.post('*/api/onramp/simulate', async ({ request }) => {
    if (!authState.isSignedIn()) return unauthorized();

    const body = (await request.json()) as { sessionAddress?: unknown; amount?: unknown };
    if (typeof body.sessionAddress !== 'string' || !isAtomicAmount(body.amount)) {
      return errorResponse(400, 'invalid_input');
    }

    return HttpResponse.json({
      signature: `MockOnramp${Math.random().toString(36).slice(2)}`,
    });
  }),

  // --- waitlist ---
  http.post('*/api/waitlist', async ({ request }) => {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return errorResponse(400, 'invalid_input');
    }

    return new HttpResponse(null, { status: 201 });
  }),

  // --- paid services (the playground never sees a real 402 in mock mode) ---
  ...MOCK_SERVICE_IDS.map(paidServiceHandler),
];
