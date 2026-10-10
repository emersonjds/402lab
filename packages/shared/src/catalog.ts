import { z } from 'zod';

import { atomicStringSchema } from './money.js';

export const serviceIdSchema = z.enum(['ocr', 'translate', 'summarize']);

export const serviceSchema = z.object({
  id: serviceIdSchema,
  name: z.string(),
  description: z.string(),
  upstream: z.enum(['azure-ocr', 'aws-translate', 'anthropic-summary']),
  price: atomicStringSchema.transform((value) => BigInt(value)),
  splits: z.array(
    z.object({
      recipient: z.string(),
      role: z.enum(['provider', 'integrator', 'platform']),
      bps: z.number().int().nonnegative(),
    }),
  ),
});

export type Service = z.output<typeof serviceSchema>;
export type ServiceId = Service['id'];
export type Upstream = Service['upstream'];

export type CatalogRecipients = {
  provider: Record<ServiceId, string>;
  integrator: string;
  platform: string;
};

const SERVICES = [
  {
    id: 'ocr',
    name: 'OCR',
    description: 'Extract text from an image.',
    upstream: 'azure-ocr',
    price: 5_000n,
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text between languages.',
    upstream: 'aws-translate',
    price: 2_000n,
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize a long text.',
    upstream: 'anthropic-summary',
    price: 10_000n,
  },
] satisfies Omit<Service, 'splits'>[];

export const buildCatalog = (recipients: CatalogRecipients): Service[] =>
  SERVICES.map((service) => ({
    ...service,
    splits: [
      { recipient: recipients.provider[service.id], role: 'provider', bps: 8_500 },
      { recipient: recipients.integrator, role: 'integrator', bps: 500 },
      { recipient: recipients.platform, role: 'platform', bps: 1_000 },
    ],
  }));
