export const allowance = (overrides: Record<string, string> = {}) => ({
  id: 'a1',
  agentName: 'research-bot',
  sessionAddress: '7xKpQm2b9fQ2',
  status: 'active',
  perCallCap: '20000',
  dailyCap: '1000000',
  spentToday: '17000',
  createdAt: '2026-10-10T12:00:00.000Z',
  ...overrides,
});

export const payment = (id: string, overrides: Record<string, string> = {}) => ({
  id,
  serviceId: 'ocr',
  amount: '5000',
  txSignature: `sig-${id}`,
  settledAt: '2026-10-10T12:00:00.000Z',
  ...overrides,
});
