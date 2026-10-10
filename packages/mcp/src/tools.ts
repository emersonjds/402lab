import {
  atomicStringSchema,
  explorerTxUrl,
  formatUsd,
  parseAtomic,
  serviceIdSchema,
  USDC_DEVNET_MINT,
  type AtomicAmount,
  type ServiceId,
} from '@402lab/shared';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { z } from 'zod';

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type Tools = {
  listServices: () => Promise<string>;
  callService: (serviceId: ServiceId, input: Record<string, string>) => Promise<string>;
  getAllowance: () => Promise<string>;
};

type AllowanceSource = { apiUrl: string; sessionAddress: string; plainFetch: Fetch };

export const DEFAULT_PER_CALL_CAP: AtomicAmount = 20_000n;

const servicesSchema = z.object({
  services: z.array(
    z.object({
      id: serviceIdSchema,
      name: z.string(),
      description: z.string(),
      price: atomicStringSchema,
      mode: z.enum(['live', 'demo']),
    }),
  ),
});

const allowanceSchema = z.object({
  status: z.string(),
  perCallCap: atomicStringSchema,
  dailyCap: atomicStringSchema,
  spentToday: atomicStringSchema,
});

const serviceResponseSchema = z.object({ mode: z.string(), result: z.unknown() });

const tokenAccountsSchema = z.object({
  result: z.object({
    value: z.array(
      z.object({
        account: z.object({
          data: z.object({
            parsed: z.object({
              info: z.object({ tokenAmount: z.object({ amount: atomicStringSchema }) }),
            }),
          }),
        }),
      }),
    ),
  }),
});

const fetchAllowance = async ({ apiUrl, sessionAddress, plainFetch }: AllowanceSource) => {
  const response = await plainFetch(`${apiUrl}/allowances/by-session/${sessionAddress}`);

  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`allowance lookup failed with HTTP ${String(response.status)}`);
  }

  return allowanceSchema.parse(await response.json());
};

export const readPerCallCap = async (source: AllowanceSource): Promise<AtomicAmount> => {
  try {
    const allowance = await fetchAllowance(source);
    return allowance ? parseAtomic(allowance.perCallCap) : DEFAULT_PER_CALL_CAP;
  } catch {
    // ponytail: api down at boot still caps the client; the server enforces the real policy.
    return DEFAULT_PER_CALL_CAP;
  }
};

export const createTools = (dependencies: {
  apiUrl: string;
  rpcUrl: string;
  sessionAddress: string;
  payingFetch: Fetch;
  plainFetch: Fetch;
}): Tools => {
  const { apiUrl, rpcUrl, sessionAddress, payingFetch, plainFetch } = dependencies;

  const fetchServices = async () => {
    const response = await plainFetch(`${apiUrl}/services`);
    return servicesSchema.parse(await response.json()).services;
  };

  const fetchUsdcBalance = async (): Promise<AtomicAmount> => {
    const response = await plainFetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [sessionAddress, { mint: USDC_DEVNET_MINT }, { encoding: 'jsonParsed' }],
      }),
    });
    const { result } = tokenAccountsSchema.parse(await response.json());

    return result.value.reduce(
      (total, { account }) => total + parseAtomic(account.data.parsed.info.tokenAmount.amount),
      0n,
    );
  };

  const listServices = async () =>
    (await fetchServices())
      .map(
        (service) =>
          `${service.id} — ${service.name}: ${service.description} ${formatUsd(parseAtomic(service.price))} per call (${service.mode})`,
      )
      .join('\n');

  const describePaid = async (serviceId: ServiceId, header: string) => {
    const settlement = decodePaymentResponseHeader(header);
    const price =
      settlement.amount ??
      (await fetchServices()).find((service) => service.id === serviceId)?.price;

    return [
      `paid: ${price === undefined ? 'unknown' : formatUsd(parseAtomic(price))}`,
      `explorer: ${explorerTxUrl(settlement.transaction)}`,
    ];
  };

  const callService = async (serviceId: ServiceId, input: Record<string, string>) => {
    let response: Response;
    try {
      response = await payingFetch(`${apiUrl}/svc/${serviceId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch (error) {
      const message = String(error);
      return /filtered out by policies|spendControls/.test(message)
        ? 'Payment refused: per_call_cap_exceeded'
        : `Payment failed: ${message}`;
    }

    if (response.status === 402) {
      const header = response.headers.get('payment-required');
      const reason = header === null ? undefined : decodePaymentRequiredHeader(header).error;
      return `Payment refused: ${reason ?? 'payment_required'}`;
    }
    if (response.status === 400) {
      const { issues } = z.object({ issues: z.unknown() }).parse(await response.json());
      return `Invalid input. You were not charged. Issues: ${JSON.stringify(issues)}`;
    }
    if (response.status === 502) {
      return 'Service unavailable: the upstream provider failed. You were not charged.';
    }
    if (!response.ok) {
      return `Unexpected response: HTTP ${String(response.status)}`;
    }

    const { mode, result } = serviceResponseSchema.parse(await response.json());
    const header = response.headers.get('payment-response');

    return [
      typeof result === 'string' ? result : JSON.stringify(result),
      `mode: ${mode}`,
      ...(header === null ? [] : await describePaid(serviceId, header)),
    ].join('\n');
  };

  const getAllowance = async () => {
    const [allowance, balance] = await Promise.all([
      fetchAllowance({ apiUrl, sessionAddress, plainFetch }),
      fetchUsdcBalance(),
    ]);
    const allowanceLines = allowance
      ? [
          `allowance: ${allowance.status}`,
          `per-call cap: ${formatUsd(parseAtomic(allowance.perCallCap))}`,
          `daily cap: ${formatUsd(parseAtomic(allowance.dailyCap))}`,
          `spent today: ${formatUsd(parseAtomic(allowance.spentToday))}`,
        ]
      : [`allowance: none yet (default per-call cap ${formatUsd(DEFAULT_PER_CALL_CAP)})`];

    return [
      `session wallet: ${sessionAddress}`,
      ...allowanceLines,
      `wallet balance: ${formatUsd(balance)} USDC`,
    ].join('\n');
  };

  return { listServices, callService, getAllowance };
};
