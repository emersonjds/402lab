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
const SESSION_CRAWLER = '4EgfxYLWX2hizK5kh1cLjC2aNFj3opdMGZQcw5aMGQhD';

const RECIPIENTS: CatalogRecipients = {
  provider: {
    ocr: 'CV7pPVbNJsci5qXjqrKNtNMvQNpPdkqwwSTQBLjob3Uq',
    translate: '6jn9QWcRtUDEX1KohozUKfL3BdRNKxbWPzsTydwHcs8W',
    summarize: '3FT8tf9eLVNkBcPW38nRGkizBX6AtQnsFKuaFrSxvQ4w',
  },
  integrator: 'Dutci9wGxa2wxKUKpwQn5ddjUND22gevVE8L8qpLzNpB',
  platform: 'J3XFpUyaN28HLuoRJy4i1Y9XaMzWGGkvWoHcxu4acors',
};

export const MOCK_SERVICES: Service[] = buildCatalog(RECIPIENTS);

export const serviceOf = (id: ServiceId): Service => {
  const service = MOCK_SERVICES.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`fixture: unknown service "${id}"`);
  return service;
};

const fixedId = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export type MockAllowance = {
  id: string;
  agentName: string;
  sessionAddress: string;
  status: AllowanceStatus;
  perCallCap: AtomicAmount;
  dailyCap: AtomicAmount;
  createdAt: string;
};

export const allowances: MockAllowance[] = [
  {
    id: fixedId(1),
    agentName: 'research-bot',
    sessionAddress: SESSION_RESEARCH,
    status: 'active',
    perCallCap: 20_000n,
    dailyCap: 1_000_000n,
    createdAt: '2026-09-20T12:00:00.000Z',
  },
  {
    id: fixedId(2),
    agentName: 'crawler-bot',
    sessionAddress: SESSION_CRAWLER,
    status: 'paused',
    perCallCap: 10_000n,
    dailyCap: 300_000n,
    createdAt: '2026-09-25T09:30:00.000Z',
  },
];

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
const hoursAgo = (hours: number): string => new Date(bootTime - hours * 3_600_000).toISOString();

export const payments: MockPayment[] = [
  {
    id: fixedId(101),
    allowanceId: fixedId(1),
    serviceId: 'summarize',
    amount: 10_000n,
    txSignature: 'Cr23rdyAk6LkDoa1oeX85yL9thVrKb48pUhFaWLTftm9',
    settledAt: hoursAgo(0.2),
    upstreamStatus: '200',
  },
  {
    id: fixedId(102),
    allowanceId: fixedId(1),
    serviceId: 'translate',
    amount: 2_000n,
    txSignature: 'EdQiB3Tye448E9HokBYDt5Z54FJ9JkHNo7wnigowE1uj',
    settledAt: hoursAgo(1.3),
    upstreamStatus: '200',
  },
  {
    id: fixedId(103),
    allowanceId: fixedId(1),
    serviceId: 'ocr',
    amount: 5_000n,
    txSignature: 'FKbZnb6RKbSF8SDu67v5X2aQiRnnKbFVkUDU8tpuLWik',
    settledAt: hoursAgo(4),
    upstreamStatus: '200',
  },
  {
    id: fixedId(104),
    allowanceId: fixedId(1),
    serviceId: 'summarize',
    amount: 10_000n,
    txSignature: '5n8kqHfXbQ8rXvFZtkNkkLej88gXcskt5WNyiqtpn1xb',
    settledAt: hoursAgo(20),
    upstreamStatus: '200',
  },
  {
    id: fixedId(105),
    allowanceId: fixedId(2),
    serviceId: 'ocr',
    amount: 5_000n,
    txSignature: '9ccjbeyqhYRK6WprrmwfgP6sUVoGguAxVaFSU1kGEjXr',
    settledAt: hoursAgo(30),
    upstreamStatus: '200',
  },
  {
    id: fixedId(106),
    allowanceId: fixedId(2),
    serviceId: 'translate',
    amount: 2_000n,
    txSignature: '4V61CvrifFksNk6aaWFqzts5bsuHzpa6qthDc68PfwBu',
    settledAt: hoursAgo(50),
    upstreamStatus: '200',
  },
];

let nextPaymentSeq = 200;

/** Appended by the `/events` SSE handler so the live feed and payment history stay coherent. */
export const recordPayment = (payment: Omit<MockPayment, 'id'>): MockPayment => {
  nextPaymentSeq += 1;
  const stored = { ...payment, id: fixedId(nextPaymentSeq) };
  payments.push(stored);
  return stored;
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

const summarizePayouts = computeSplit(10_000n, serviceOf('summarize').splits);
const ocrPayouts = computeSplit(5_000n, serviceOf('ocr').splits);

export const splitBatches: MockSplitBatch[] = [
  {
    id: fixedId(201),
    status: 'confirmed',
    txSignature: 'CfoAQDa4tt2i6ndbfNKDFtTHwJQmmHuEfb54TnefwR5w',
    createdAt: hoursAgo(0.1),
    payouts: aggregatePayouts([...summarizePayouts, ...ocrPayouts]),
  },
];

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
