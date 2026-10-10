import { buildCatalog } from '@402lab/shared';
import Fastify, { type FastifyInstance } from 'fastify';

import { catalogRoutes } from './features/catalog/routes.js';
import { resolveAdapters, resolveModes } from './features/paid-services/adapters/index.js';
import type { ServiceAdapters } from './features/paid-services/adapters/types.js';
import { paidServiceRoutes } from './features/paid-services/routes.js';
import type { Config } from './shared/config/index.js';
import type { Database } from './shared/db/pool.js';
import type { EventsBus } from './shared/events-bus.js';

export interface AppDependencies {
  config: Config;
  adapters?: ServiceAdapters;
  database: Database;
  bus: EventsBus;
  now: () => Date;
}

export const buildApp = async ({
  config,
  adapters = resolveAdapters(config),
  database,
  bus,
  now,
}: AppDependencies): Promise<FastifyInstance> => {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });
  const catalog = buildCatalog({
    provider: {
      ocr: config.PROVIDER_OCR_ADDRESS,
      translate: config.PROVIDER_TRANSLATE_ADDRESS,
      summarize: config.PROVIDER_SUMMARIZE_ADDRESS,
    },
    integrator: config.INTEGRATOR_ADDRESS,
    platform: config.TREASURY_ADDRESS,
  });

  await app.register(catalogRoutes, { catalog, modes: resolveModes(config) });
  await app.register(paidServiceRoutes, {
    facilitatorUrl: config.FACILITATOR_URL,
    treasuryAddress: config.TREASURY_ADDRESS,
    catalog,
    adapters,
    ledger: { db: database, bus, now },
  });

  return app;
};
