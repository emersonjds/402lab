import { z } from 'zod';

import { atomicStringSchema } from './money.js';

export const serviceIdSchema = z.enum([
  'ocr',
  'translate',
  'summarize',
  'vision',
  'chat',
  'embed',
  'image',
  'speech',
  'transcribe',
  'bedrock',
]);

export const providerIdSchema = z.enum([
  'azure',
  'aws',
  'anthropic',
  'google-cloud',
  'openai',
  'cloudflare',
  'replicate',
  'elevenlabs',
  'deepgram',
]);

export const providerSchema = z.object({ id: providerIdSchema, name: z.string() });

export type Provider = z.output<typeof providerSchema>;
export type ProviderId = Provider['id'];

export const serviceSchema = z.object({
  id: serviceIdSchema,
  name: z.string(),
  description: z.string(),
  upstream: z.enum([
    'azure-ocr',
    'aws-translate',
    'anthropic-summary',
    'google-vertex-vision',
    'openai-chat',
    'cloudflare-workers-ai',
    'replicate-image',
    'elevenlabs-speech',
    'deepgram-transcribe',
    'aws-bedrock',
  ]),
  provider: providerSchema,
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

const AWS: Provider = { id: 'aws', name: 'AWS' };

const SERVICES = [
  {
    id: 'ocr',
    name: 'OCR',
    description: 'Extract text from an image.',
    upstream: 'azure-ocr',
    provider: { id: 'azure', name: 'Azure' },
    price: 5_000n,
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text between languages.',
    upstream: 'aws-translate',
    provider: AWS,
    price: 2_000n,
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize a long text.',
    upstream: 'anthropic-summary',
    provider: { id: 'anthropic', name: 'Anthropic' },
    price: 10_000n,
  },
  {
    id: 'vision',
    name: 'Vision',
    description: 'Describe and tag the contents of an image.',
    upstream: 'google-vertex-vision',
    provider: { id: 'google-cloud', name: 'Google Cloud' },
    price: 3_000n,
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Complete a chat prompt.',
    upstream: 'openai-chat',
    provider: { id: 'openai', name: 'OpenAI' },
    price: 8_000n,
  },
  {
    id: 'embed',
    name: 'Embed',
    description: 'Turn text into a vector embedding.',
    upstream: 'cloudflare-workers-ai',
    provider: { id: 'cloudflare', name: 'Cloudflare' },
    price: 1_000n,
  },
  {
    id: 'image',
    name: 'Image',
    description: 'Generate an image from a prompt.',
    upstream: 'replicate-image',
    provider: { id: 'replicate', name: 'Replicate' },
    price: 12_000n,
  },
  {
    id: 'speech',
    name: 'Speech',
    description: 'Synthesize speech from text.',
    upstream: 'elevenlabs-speech',
    provider: { id: 'elevenlabs', name: 'ElevenLabs' },
    price: 6_000n,
  },
  {
    id: 'transcribe',
    name: 'Transcribe',
    description: 'Transcribe speech from audio.',
    upstream: 'deepgram-transcribe',
    provider: { id: 'deepgram', name: 'Deepgram' },
    price: 4_000n,
  },
  {
    id: 'bedrock',
    name: 'Bedrock',
    description: 'Complete a prompt through a hosted foundation model.',
    upstream: 'aws-bedrock',
    provider: AWS,
    price: 9_000n,
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
