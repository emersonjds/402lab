import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { pool, resetFacilitator, server, truncateAll, upstream } from './helpers.js';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

beforeEach(async () => {
  await truncateAll();
  resetFacilitator();
  upstream.azureStatus = 200;
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(async () => {
  server.close();
  await pool.end();
});
