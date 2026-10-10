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

export interface AppDependencies {
  config: Config;
  adapters?: ServiceAdapters;
  database: Database;
  bus: EventsBus;
  now: () => Date;
  /** Devnet chain for the demo on-ramp; tests inject a fake. */
  solanaChain?: OnrampChain;
}

export const catalogFromConfig = (config: Config): Service[] =>
  buildCatalog({
    provider: {
      ocr: config.PROVIDER_OCR_ADDRESS,
      translate: config.PROVIDER_TRANSLATE_ADDRESS,
      summarize: config.PROVIDER_SUMMARIZE_ADDRESS,
    },
    integrator: config.INTEGRATOR_ADDRESS,
    platform: config.TREASURY_ADDRESS,
  });

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
      info: { title: '402Lab API', version: '0.1.0' },
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
