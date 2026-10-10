import Fastify, { type FastifyInstance } from 'fastify';

import { paidServiceRoutes } from './features/paid-services/routes.js';
import type { Config } from './shared/config/index.js';
import type { Database } from './shared/db/pool.js';
import type { EventsBus } from './shared/events-bus.js';

export interface AppDependencies {
  config: Config;
  database: Database;
  bus: EventsBus;
  now: () => Date;
}

export const buildApp = async ({
  config,
  database,
  bus,
  now,
}: AppDependencies): Promise<FastifyInstance> => {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  await app.register(paidServiceRoutes, {
    facilitatorUrl: config.FACILITATOR_URL,
    treasuryAddress: config.TREASURY_ADDRESS,
    ledger: { db: database, bus, now },
  });

  return app;
};
