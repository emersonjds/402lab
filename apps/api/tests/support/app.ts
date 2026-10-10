import type { FastifyInstance } from 'fastify';

import { type AppDependencies, buildApp } from '../../src/app.js';
import { signSession } from '../../src/shared/auth/tokens.js';
import { type Config, loadConfig } from '../../src/shared/config/index.js';
import { createEventsBus } from '../../src/shared/events-bus.js';
import { ADMIN_DATABASE_URL, type TestDatabase } from './database.js';
import { RECIPIENT_ENVIRONMENT, SESSION_ENVIRONMENT } from './environment.js';

export const NOW = new Date('2026-10-10T15:00:00.000Z');

export const testConfig = (overrides: Record<string, string> = {}): Config =>
  loadConfig({
    ...RECIPIENT_ENVIRONMENT,
    ...SESSION_ENVIRONMENT,
    DATABASE_URL: ADMIN_DATABASE_URL,
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    ...overrides,
  });

export const buildTestApp = (
  testDatabase: TestDatabase,
  dependencies: Partial<AppDependencies> = {},
): Promise<FastifyInstance> =>
  buildApp({
    config: testConfig(),
    database: testDatabase.database,
    bus: createEventsBus(),
    now: () => NOW,
    ...dependencies,
  });

export const webSession = (address: string): { cookie: string } => ({
  cookie: `session=${signSession(address, 'web', SESSION_ENVIRONMENT.JWT_SECRET)}`,
});

export const mobileSession = (address: string): { authorization: string } => ({
  authorization: `Bearer ${signSession(address, 'mobile', SESSION_ENVIRONMENT.JWT_SECRET)}`,
});
