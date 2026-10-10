import { isAddress } from '@solana/kit';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FACILITATOR_URL: z.url().default('https://x402.org/facilitator'),
  TREASURY_ADDRESS: z.string().refine(isAddress, 'must be a base58 Solana address'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
