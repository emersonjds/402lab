import { readFileSync } from 'node:fs';

import { buildCatalog, type Service } from '@402lab/shared';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import { allowanceRoutes } from './features/allowances/routes.js';
import { authRoutes } from './features/auth/routes.js';
import { catalogRoutes } from './features/catalog/routes.js';
import {
  isDevnetGenesis,
  isDevnetRpc,
  type OnrampChain,
  onrampRoutes,
} from './features/demo-onramp/routes.js';
import { eventRoutes } from './features/events/routes.js';
import { resolveAdapters, resolveModes } from './features/paid-services/adapters/index.js';
import type { ServiceAdapters } from './features/paid-services/adapters/types.js';
import { paidServiceRoutes } from './features/paid-services/routes.js';
import { splitRoutes } from './features/splits/routes.js';
import { waitlistRoutes } from './features/waitlist/routes.js';
import { protectRoutesByDefault } from './shared/auth/authenticate.js';
import type { Config } from './shared/config/index.js';
import type { Database } from './shared/db/pool.js';
import { AppError, registerErrorHandler } from './shared/errors.js';
import type { EventsBus } from './shared/events-bus.js';
import { createSolanaChain } from './shared/solana/rpc.js';
import { loadTreasurySigner } from './shared/solana/treasury.js';

const packageJsonSchema = z.object({ version: z.string() });

/** Read once at import time rather than per-request; keeps the OpenAPI document's version in
 * lockstep with `package.json` without an extra build step. */
const API_VERSION = packageJsonSchema.parse(
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')),
).version;

export interface AppDependencies {
  config: Config;
  adapters?: ServiceAdapters;
  database: Database;
  bus: EventsBus;
  now: () => Date;
  /** Devnet chain for the demo on-ramp; tests inject a fake. */
  solanaChain?: OnrampChain;
}

/** Generated once with `@solana/kit`'s `generateKeyPairSigner`, fixed so the demo is stable
 * across restarts. Used only when the matching `PROVIDER_<ID>_ADDRESS` env is unset. */
const DEMO_PROVIDER_ADDRESSES = {
  vision: '2vdHv8Unyv49JuL2JfeS2ehJBwtcjck4RF3bRNjiAksv',
  chat: 'HLTdiMuHqPsgGvUoog9fxdqK5TVeQBvT9N6eLRzGBzSo',
  embed: '9MeP2DYBMWWyT7B3DdLMdXBicEPW3vHSd5CsJwAgQH6C',
  image: 'DuQB6CsDwbMgbP2DXPRLUfNFt1MqqXSNEzsp6aamQXa4',
  speech: 'HHWF44yCNw8k9HNBuwQHFjAkjNT1C9D6A8DwfCygW44M',
  transcribe: 'C1DNmPtqJKkWKFESnHmm99JQ1gXAuvhKW7xByXhoY2fR',
  bedrock: '8QiBpAEC3TqcwZKxoV5tpBetTRqfSjKFPMymHJKt5Dpp',
} as const;

/** The service catalog with recipients resolved from env; rebuilt from `Config` wherever
 * `buildApp` is not in scope (the split worker, the reconciliation job, `split-once.ts`). */
export const catalogFromConfig = (config: Config): Service[] =>
  buildCatalog({
    provider: {
      ocr: config.PROVIDER_OCR_ADDRESS,
      translate: config.PROVIDER_TRANSLATE_ADDRESS,
      summarize: config.PROVIDER_SUMMARIZE_ADDRESS,
      vision: config.PROVIDER_VISION_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.vision,
      chat: config.PROVIDER_CHAT_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.chat,
      embed: config.PROVIDER_EMBED_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.embed,
      image: config.PROVIDER_IMAGE_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.image,
      speech: config.PROVIDER_SPEECH_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.speech,
      transcribe: config.PROVIDER_TRANSCRIBE_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.transcribe,
      bedrock: config.PROVIDER_BEDROCK_ADDRESS ?? DEMO_PROVIDER_ADDRESSES.bedrock,
    },
    integrator: config.INTEGRATOR_ADDRESS,
    platform: config.TREASURY_ADDRESS,
  });

/** Assembles the Fastify instance: plugins, every route slice, and — only on a devnet RPC with
 * a treasury key configured and confirmed by its genesis hash — the demo on-ramp. Starts no
 * background worker; `server.ts` starts the split worker and the reconciliation job itself. */
export const buildApp = async ({
  config,
  adapters = resolveAdapters(config),
  database,
  bus,
  now,
  solanaChain,
}: AppDependencies): Promise<FastifyInstance> => {
  const app = Fastify({
    trustProxy: (_address, hop) => hop < config.TRUST_PROXY_HOPS,
    logger: {
      level: config.LOG_LEVEL,
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
    },
  });
  const catalog = catalogFromConfig(config);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => new AppError(429, 'too_many_requests'),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: '402Lab API',
        version: API_VERSION,
        description:
          'Consumption account for AI agents: an owner sets an allowance (per-call and daily ' +
          'caps) and the agent pays per API call in USDC on Solana via HTTP 402 (x402), with ' +
          'automatic settlement splits to providers and a monthly statement.',
      },
      servers: [{ url: 'http://localhost:8080' }],
      components: {
        securitySchemes: {
          cookie: { type: 'apiKey', in: 'cookie', name: 'session' },
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  protectRoutesByDefault(app, config.JWT_SECRET, database);

  await app.register(catalogRoutes, { catalog, modes: resolveModes(config) });
  await app.register(paidServiceRoutes, {
    facilitatorUrl: config.FACILITATOR_URL,
    treasuryAddress: config.TREASURY_ADDRESS,
    catalog,
    adapters,
    ledger: { db: database, bus, now },
  });
  await app.register(splitRoutes, { db: database });
  await app.register(authRoutes, {
    db: database,
    now,
    jwtSecret: config.JWT_SECRET,
    secureCookie: config.NODE_ENV !== 'development',
  });
  await app.register(allowanceRoutes, { db: database, bus, now, catalog });
  await app.register(eventRoutes, { bus });
  await app.register(waitlistRoutes, { db: database });

  if (isDevnetRpc(config.SOLANA_RPC_URL) && config.TREASURY_SECRET_KEY) {
    const treasury = await loadTreasurySigner(config.TREASURY_SECRET_KEY, config.TREASURY_ADDRESS);
    const chain = solanaChain ?? createSolanaChain(config.SOLANA_RPC_URL);
    const genesisHash = await chain.genesisHash().catch(() => undefined);

    if (genesisHash !== undefined && isDevnetGenesis(genesisHash)) {
      await app.register(onrampRoutes, { db: database, chain, treasury, catalog, now });
    } else {
      app.log.warn('demo on-ramp off: SOLANA_RPC_URL did not answer with the devnet genesis hash');
    }
  }

  return app;
};
