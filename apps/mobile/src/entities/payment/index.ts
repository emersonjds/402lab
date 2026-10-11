import { atomicStringSchema, buildCatalog, parseAtomic, type Service } from '@402lab/shared';
import { z } from 'zod';

import { request, type Connection } from '@/shared/api/client';

const paymentSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  amount: atomicStringSchema.transform(parseAtomic),
  txSignature: z.string(),
  settledAt: z.string(),
});

export type Payment = z.output<typeof paymentSchema>;

const pageSchema = z.object({ payments: z.array(paymentSchema) });

// Oldest first, at most 50 per page, strictly after `after` when given.
export const listPayments = async (
  connection: Connection,
  allowanceId: string,
  after: string | undefined,
): Promise<Payment[]> => {
  const query = after === undefined ? '' : `?after=${encodeURIComponent(after)}`;
  const path = `/allowances/${encodeURIComponent(allowanceId)}/payments${query}`;
  return (await request(connection, path, pageSchema)).payments;
};

export const mergeNewestFirst = (current: Payment[], page: Payment[]): Payment[] => {
  const known = new Set(current.map((payment) => payment.id));
  const fresh = page.filter((payment) => !known.has(payment.id)).reverse();
  return fresh.length === 0 ? current : [...fresh, ...current];
};

// Names, providers and split rules are the same for everyone; recipients are not needed here.
const CATALOG = buildCatalog({
  provider: { ocr: '', translate: '', summarize: '' },
  integrator: '',
  platform: '',
});

export const PROVIDER_NAMES: Record<Service['upstream'], string> = {
  'azure-ocr': 'Azure AI Vision',
  'aws-translate': 'AWS Translate',
  'anthropic-summary': 'Anthropic',
};

export const findService = (serviceId: string): Service | undefined =>
  CATALOG.find((service) => service.id === serviceId);

export const serviceName = (serviceId: string): string => findService(serviceId)?.name ?? serviceId;
