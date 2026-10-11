import {
  aggregatePayouts,
  buildCatalog,
  cardCostEquivalent,
  computeSplit,
  explorerTxUrl,
  type AllowanceStatus,
  type AtomicAmount,
  type CatalogRecipients,
  type PayoutLine,
  type Service,
  type ServiceId,
} from '@402lab/shared';

// Devnet-shaped addresses generated once with @solana/kit's generateKeyPairSigner so every
// fixture looks like a real base58 pubkey; fixed so the demo is stable across reloads.
export const MOCK_OWNER_ADDRESS = 'B3JxWXeCp8uShrZq16TNYicXfKRSCUuzepXua9DLntei';

const SESSION_RESEARCH = 'EozYLZQJGLb1AyCKcS7ug1N6ZKqjJzYCnujRa5Us9EbB';
const SESSION_SUPPORT = 'LHZiLnGWy3Ug3YiY397R9jomyVcavaJkTzKHT866T8a';
const SESSION_PIPELINE = 'GfWrc1PLTpJHCDWB7ns8ihc2SuqyCTZcEGNqLUPD6qnB';
const SESSION_VOICE = '5uhWZNLZdWJ56GZxuMUNHJCV5nKtdHvM3iWei1hWcXwH';
const SESSION_IMAGE = 'EzmLk6HPh5RdPJjUwkdFyvjn6y74zrTsixYZ4FF76a8R';
const SESSION_CRAWLER = '4EgfxYLWX2hizK5kh1cLjC2aNFj3opdMGZQcw5aMGQhD';

const RECIPIENTS: CatalogRecipients = {
  provider: {
    ocr: 'CV7pPVbNJsci5qXjqrKNtNMvQNpPdkqwwSTQBLjob3Uq',
    translate: '6jn9QWcRtUDEX1KohozUKfL3BdRNKxbWPzsTydwHcs8W',
    summarize: '3FT8tf9eLVNkBcPW38nRGkizBX6AtQnsFKuaFrSxvQ4w',
    vision: 'EYadXrnH8nFe2XZ49TbonytrH1Yo8DVAKASSjeTrAYX3',
    chat: '93DtTQe1DFqYEhU2aVWh9DE8mXQkszMj1eamUuY8D2P4',
    embed: '7qHxfw8zVnLYTtm1uMZymcFZuh6dfXhCSYU1ACiYsDpa',
    image: 'F3YyqvPiJ1CZc8LDUysvDdGNZeSHhGqojKFJDkSTF5XR',
    speech: 'B13Hrpcca3FF6sFartdfGuT8HdgNPgkGHgYgZu6bJUCQ',
    transcribe: 'HVgu2yEMRtkNXxEda3VNYrXQuCrwKanvAD3tgPosRKiu',
    bedrock: 'CPz65Z2ir8ZWwo5wf5UpaqjPnTQDtD1pL1xTqAiHPh7d',
  },
  integrator: 'Dutci9wGxa2wxKUKpwQn5ddjUND22gevVE8L8qpLzNpB',
  platform: 'J3XFpUyaN28HLuoRJy4i1Y9XaMzWGGkvWoHcxu4acors',
};

export const MOCK_SERVICES: Service[] = buildCatalog(RECIPIENTS);
export const MOCK_SERVICE_IDS: ServiceId[] = MOCK_SERVICES.map((service) => service.id);

export const serviceOf = (id: ServiceId): Service => {
  const service = MOCK_SERVICES.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`fixture: unknown service "${id}"`);
  return service;
};

const fixedId = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Deterministic PRNG (mulberry32) so the whole 24h traffic story — hourly spread, agent/service
// picks, signatures — is reproducible across reloads and machines.
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rng = createRng(402_014);

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const SIGNATURE_LENGTH = 88;

/** A real ed25519 Solana signature base58-encodes to 86-88 characters (64 bytes); sample
 * signatures here match that length instead of the shorter 32-byte pubkey shape. A plain loop
 * over `draw()` runs ~5x faster than `Array.from` + callback at the tens-of-thousands of calls a
 * stage-scale day needs (measured, see commit). */
const signatureOf = (draw: () => number): string => {
  let signature = '';
  for (let i = 0; i < SIGNATURE_LENGTH; i += 1) {
    signature += BASE58_ALPHABET.charAt(Math.floor(draw() * BASE58_ALPHABET.length));
  }
  return signature;
};

const nextSignature = (): string => signatureOf(rng);

const pickWeighted = <Item extends { weight: number }>(items: readonly Item[]): Item => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  // Floating point edge case: fall back to the last item rather than throwing.
  return items[items.length - 1] as Item;
};

/** Splits `total` across `weights` proportionally, rounding with largest-remainder so the parts
 * always sum back to `total` exactly. */
const allocateByWeight = (weights: readonly number[], total: number): number[] => {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (weight / weightSum) * total);
  const base = raw.map(Math.floor);
  const remainder = total - base.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remainder; i += 1) {
    const entry = byFraction[i];
    if (entry) base[entry.index] = (base[entry.index] ?? 0) + 1;
  }

  return base;
};

export type MockAllowance = {
  id: string;
  agentName: string;
  sessionAddress: string;
  status: AllowanceStatus;
  perCallCap: AtomicAmount;
  dailyCap: AtomicAmount;
  createdAt: string;
};

type AgentProfile = MockAllowance & {
  /** Services this agent calls, used only to generate realistic traffic. */
  services: ServiceId[];
  /** Relative traffic volume vs. the other agents. */
  weight: number;
  /** Stops getting picked for new activity after this many hours-ago (paused mid-day). */
  activeSinceHoursAgo: number;
};

const HOURS_IN_WINDOW = 24;

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: fixedId(1),
    agentName: 'research-bot',
    sessionAddress: SESSION_RESEARCH,
    status: 'active',
    perCallCap: 20_000n,
    dailyCap: 70_000_000n,
    createdAt: '2026-09-20T12:00:00.000Z',
    services: ['summarize', 'chat', 'embed', 'vision'],
    weight: 26,
    activeSinceHoursAgo: HOURS_IN_WINDOW,
  },
  {
    id: fixedId(2),
    agentName: 'support-copilot',
    sessionAddress: SESSION_SUPPORT,
    status: 'active',
    perCallCap: 15_000n,
    dailyCap: 65_000_000n,
    createdAt: '2026-09-23T09:00:00.000Z',
    services: ['chat', 'translate', 'summarize'],
    weight: 22,
    activeSinceHoursAgo: HOURS_IN_WINDOW,
  },
  {
    id: fixedId(3),
    agentName: 'data-pipeline',
    sessionAddress: SESSION_PIPELINE,
    status: 'active',
    perCallCap: 25_000n,
    dailyCap: 50_000_000n,
    createdAt: '2026-09-18T07:30:00.000Z',
    services: ['ocr', 'translate', 'embed', 'bedrock'],
    weight: 22,
    activeSinceHoursAgo: HOURS_IN_WINDOW,
  },
  {
    id: fixedId(4),
    agentName: 'voice-agent',
    sessionAddress: SESSION_VOICE,
    status: 'active',
    perCallCap: 12_000n,
    dailyCap: 45_000_000n,
    createdAt: '2026-09-28T15:00:00.000Z',
    services: ['speech', 'transcribe'],
    weight: 16,
    activeSinceHoursAgo: HOURS_IN_WINDOW,
  },
  {
    id: fixedId(5),
    agentName: 'image-studio',
    sessionAddress: SESSION_IMAGE,
    status: 'active',
    // dailyCap is tightened below, once its 24h spend is known, so it sits close to its cap.
    perCallCap: 30_000n,
    dailyCap: 0n,
    createdAt: '2026-10-01T10:00:00.000Z',
    services: ['image', 'vision'],
    weight: 14,
    activeSinceHoursAgo: HOURS_IN_WINDOW,
  },
  {
    id: fixedId(6),
    agentName: 'crawler-bot',
    sessionAddress: SESSION_CRAWLER,
    status: 'paused',
    perCallCap: 10_000n,
    dailyCap: 20_000_000n,
    createdAt: '2026-09-25T09:30:00.000Z',
    services: ['ocr', 'translate'],
    weight: 10,
    // Paused about ten hours ago: its own payments stop there, every other agent keeps going.
    activeSinceHoursAgo: 10,
  },
];

export const allowances: MockAllowance[] = AGENT_PROFILES.map(
  ({ id, agentName, sessionAddress, status, perCallCap, dailyCap, createdAt }) => ({
    id,
    agentName,
    sessionAddress,
    status,
    perCallCap,
    dailyCap,
    createdAt,
  }),
);

export const allowanceOf = (id: string): MockAllowance | undefined =>
  allowances.find((allowance) => allowance.id === id);

export type MockPayment = {
  id: string;
  allowanceId: string;
  serviceId: ServiceId;
  amount: AtomicAmount;
  txSignature: string;
  settledAt: string;
  upstreamStatus: string | null;
};

const bootTime = Date.now();

// A realistic business-hours traffic shape: quiet overnight, ramping through the morning, a
// midday/afternoon peak, tapering into the evening. Index 0 = 24h ago, index 23 = the last hour.
const HOUR_WEIGHTS = [
  2, 1, 1, 1, 1, 2, 4, 7, 10, 13, 15, 16, 15, 14, 16, 17, 15, 13, 11, 9, 7, 5, 4, 3,
];
const TOTAL_PAYMENTS_24H = 40000;
const hourlyPaymentCounts = allocateByWeight(HOUR_WEIGHTS, TOTAL_PAYMENTS_24H);

const generateHistoricalPayments = (): MockPayment[] => {
  const generated: { allowanceId: string; serviceId: ServiceId; amount: AtomicAmount; settledAt: string }[] =
    [];

  for (let hourIndex = 0; hourIndex < HOURS_IN_WINDOW; hourIndex += 1) {
    const hoursBeforeNow = HOURS_IN_WINDOW - hourIndex;
    const candidates = AGENT_PROFILES.filter((agent) => agent.activeSinceHoursAgo >= hoursBeforeNow);

    for (let i = 0; i < (hourlyPaymentCounts[hourIndex] ?? 0); i += 1) {
      const agent = pickWeighted(candidates.length > 0 ? candidates : AGENT_PROFILES);
      const serviceId = agent.services[Math.floor(rng() * agent.services.length)] ?? agent.services[0];
      if (!serviceId) continue;

      const minutesIntoHour = rng() * 60;
      const ageMs = (hoursBeforeNow - 1) * 3_600_000 + (60 - minutesIntoHour) * 60_000;

      generated.push({
        allowanceId: agent.id,
        serviceId,
        amount: serviceOf(serviceId).price,
        settledAt: new Date(bootTime - ageMs).toISOString(),
      });
    }
  }

  generated.sort((a, b) => a.settledAt.localeCompare(b.settledAt));

  return generated.map((payment, index) => ({ ...payment, id: fixedId(101 + index), txSignature: nextSignature(), upstreamStatus: '200' }));
};

export const payments: MockPayment[] = generateHistoricalPayments();

// Tighten image-studio's daily cap to ~94% utilization from its own generated traffic, so the
// dashboard shows one agent genuinely close to its ceiling.
const imageStudioAllowance = allowances.find((allowance) => allowance.agentName === 'image-studio');
if (imageStudioAllowance) {
  const spent = payments
    .filter((payment) => payment.allowanceId === imageStudioAllowance.id)
    .reduce((sum, payment) => sum + payment.amount, 0n);
  imageStudioAllowance.dailyCap = (spent * 106n) / 100n;
}

let nextPaymentSeq = 100 + payments.length;

/** Appended by the `/events` SSE handler so the live feed and payment history stay coherent. */
export const recordPayment = (payment: Omit<MockPayment, 'id'>): MockPayment => {
  nextPaymentSeq += 1;
  const stored = { ...payment, id: fixedId(nextPaymentSeq) };
  payments.push(stored);
  return stored;
};

export const LIVE_FEED_INTERVAL_MS = 4_000;

let lastLiveFeedAt = Date.now();

/**
 * Settles one random payment on a random active allowance, no more often than
 * `LIVE_FEED_INTERVAL_MS`. Shared by the SSE handler (web) and the REST handlers (mobile
 * polling), so the feed evolves the same way no matter how a client observes it.
 */
export const maybeAdvanceLiveFeed = (): MockPayment | null => {
  const now = Date.now();
  if (now - lastLiveFeedAt < LIVE_FEED_INTERVAL_MS) return null;

  const active = AGENT_PROFILES.filter((agent) => agent.status === 'active');
  const agent = active[Math.floor(Math.random() * active.length)];
  if (!agent) return null;

  lastLiveFeedAt = now;
  const serviceId = agent.services[Math.floor(Math.random() * agent.services.length)] ?? 'ocr';
  const service = serviceOf(serviceId);

  return recordPayment({
    allowanceId: agent.id,
    serviceId,
    amount: service.price,
    txSignature: `MockLive${Math.random().toString(36).slice(2)}`,
    settledAt: new Date().toISOString(),
    upstreamStatus: '200',
  });
};

export const spentToday = (allowanceId: string): AtomicAmount => {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  return payments
    .filter((payment) => payment.allowanceId === allowanceId)
    .filter((payment) => new Date(payment.settledAt) >= startOfUtcDay)
    .reduce((sum, payment) => sum + payment.amount, 0n);
};

export type MockSplitBatch = {
  id: string;
  status: 'pending' | 'confirmed' | 'failed';
  txSignature: string;
  createdAt: string;
  payouts: PayoutLine[];
};

/** Same cadence as the real split worker (`apps/api/src/features/splits/worker.ts`'s
 * `SPLIT_ROUND_INTERVAL_MS`): one batch per 30s tick, grouping whatever settled since the last
 * one. Exported so the web client can derive "payment → payout" latency from the same window. */
export const SPLIT_WINDOW_MS = 30_000;

const windowKeyOf = (isoDate: string): number => Math.floor(new Date(isoDate).getTime() / SPLIT_WINDOW_MS);

/** A batch's signature is seeded by its window key alone, not the shared `rng()` stream, so it
 * stays identical across repeated `/splits` requests instead of drifting on every refetch. */
const signatureForWindow = (windowKey: number): string => signatureOf(createRng(900_001 + windowKey));

/** Builds the `limit` most recent non-empty 30s settlement batches on demand — the same shape
 * (and totals) a full day of eager generation would produce, since each batch only depends on
 * payments inside its own time window. Walking `payments` from the newest entry backward instead
 * of generating all ~2,880 windows a day holds keeps a 40k-payment day cheap to serve.
 * ponytail: O(payments scanned until `limit` windows close), not O(all payments); fine while
 * `/splits` only ever asks for 50. */
export const recentSplitBatches = (limit: number): MockSplitBatch[] => {
  const batches: MockSplitBatch[] = [];
  let currentKey: number | null = null;
  let currentSlice: MockPayment[] = [];

  const closeWindow = () => {
    if (currentKey === null || currentSlice.length === 0) return;

    const payoutLines = currentSlice.flatMap((payment) =>
      computeSplit(payment.amount, serviceOf(payment.serviceId).splits),
    );

    batches.push({
      id: `split-${String(currentKey)}`,
      status: 'confirmed',
      txSignature: signatureForWindow(currentKey),
      createdAt: new Date((currentKey + 1) * SPLIT_WINDOW_MS).toISOString(),
      payouts: aggregatePayouts(payoutLines),
    });
  };

  for (let index = payments.length - 1; index >= 0; index -= 1) {
    const payment = payments[index];
    if (!payment) continue;
    const key = windowKeyOf(payment.settledAt);

    if (key !== currentKey) {
      closeWindow();
      if (batches.length >= limit) break;
      currentKey = key;
      currentSlice = [];
    }
    currentSlice.push(payment);
  }
  // The oldest in-progress window only reaches here once every payment in it has been scanned
  // (there is nothing older left), so closing it now is still a complete window, not a partial one.
  if (batches.length < limit) closeWindow();

  const [newest] = batches;
  if (newest) newest.status = 'pending';

  return batches.reverse();
};

export const statementTotalsOf = (
  allowanceId: string,
  month: string,
): { amount: AtomicAmount; cardEquivalent: AtomicAmount; monthPayments: MockPayment[] } => {
  const monthPayments = payments.filter(
    (payment) => payment.allowanceId === allowanceId && payment.settledAt.startsWith(month),
  );
  const amount = monthPayments.reduce((sum, payment) => sum + payment.amount, 0n);

  return { amount, cardEquivalent: cardCostEquivalent(amount), monthPayments };
};

export { explorerTxUrl };

let signedIn = false;
let pairingToken: string | null = null;

export const authState = {
  isSignedIn: (): boolean => signedIn,
  signIn: (): void => {
    signedIn = true;
  },
  signOut: (): void => {
    signedIn = false;
    pairingToken = null;
  },
  pair: (token: string): void => {
    pairingToken = token;
  },
  pairingToken: (): string | null => pairingToken,
};
