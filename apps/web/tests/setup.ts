import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { routerReplace, server } from './server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn(), refresh: vi.fn() }),
}));

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  routerReplace.mockClear();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});
