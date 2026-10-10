import { isAddress } from '@solana/kit';
import { z } from 'zod';

const solanaAddress = z.string().refine(isAddress, 'must be a base58 Solana address');

/** A key left blank in `.env` means the upstream is off and the service runs in demo mode. */
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FACILITATOR_URL: z.url().default('https://x402.org/facilitator'),
  TREASURY_ADDRESS: solanaAddress,
  PROVIDER_OCR_ADDRESS: solanaAddress,
  PROVIDER_TRANSLATE_ADDRESS: solanaAddress,
  PROVIDER_SUMMARIZE_ADDRESS: solanaAddress,
  INTEGRATOR_ADDRESS: solanaAddress,
  AZURE_VISION_ENDPOINT: optional(z.url()),
  AZURE_VISION_KEY: optional(z.string()),
  AWS_REGION: optional(z.string()),
  AWS_ACCESS_KEY_ID: optional(z.string()),
  ANTHROPIC_API_KEY: optional(z.string()),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  SOLANA_RPC_URL: z.url().default('https://api.devnet.solana.com'),
  /** solana-keygen JSON array of 64 bytes; parsed by `loadTreasurySigner`, never logged. */
  TREASURY_SECRET_KEY: optional(z.string()),
  SPLIT_WORKER_ENABLED: z.stringbool().default(true),
  RECONCILIATION_ENABLED: z.stringbool().default(true),
});

export type Config = z.infer<typeof configSchema>;

/** Fails at boot rather than at the first request that needs the missing value. */
export const loadConfig = (environment: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = configSchema.safeParse(environment);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');

    throw new Error(`The environment is not usable:\n  ${problems}`);
  }

  return parsed.data;
};
