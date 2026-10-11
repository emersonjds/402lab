import type { ServiceId } from '@402lab/shared';
import { z } from 'zod';

import type { ServiceInput } from './adapters/types.js';

export const serviceInputSchemas: { [Id in ServiceId]: z.ZodType<ServiceInput[Id]> } = {
  ocr: z.object({ imageUrl: z.url({ protocol: /^https?$/ }) }),
  translate: z.object({
    text: z.string().min(1).max(5_000),
    targetLanguage: z.string().min(2).max(5),
  }),
  summarize: z.object({ text: z.string().min(1).max(20_000) }),
};

export const serviceOutputSchema = z
  .object({ mode: z.enum(['live', 'demo']), result: z.string() })
  .meta({ id: 'ServiceOutput' });

/** `issues` mirrors `z.flattenError().fieldErrors`: one array of messages per invalid field. */
export const invalidInputSchema = z
  .object({ error: z.literal('invalid_input'), issues: z.record(z.string(), z.array(z.string())) })
  .meta({ id: 'InvalidServiceInput' });
