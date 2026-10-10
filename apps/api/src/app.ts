import Fastify, { type FastifyInstance } from 'fastify';

import { paidServiceRoutes } from './features/paid-services/routes.js';
import type { Config } from './shared/config/index.js';

export interface AppDependencies {
  config: Config;
}

export const buildApp = async ({ config }: AppDependencies): Promise<FastifyInstance> => {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  await app.register(paidServiceRoutes, {
    facilitatorUrl: config.FACILITATOR_URL,
    treasuryAddress: config.TREASURY_ADDRESS,
  });

  return app;
};
