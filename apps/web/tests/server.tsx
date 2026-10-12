import { restHandlers } from '@402lab/mocks';
import { render } from '@testing-library/react';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import { QueryProvider } from '@/shared/api/query-provider';

export const API = 'http://localhost:3000/api';

export const server = setupServer(...restHandlers);

export const routerReplace = vi.fn();

/** Signs the mock API's cookie session in or out, the way `/auth/verify` and `/auth/logout` do. */
export const mockSignIn = async (): Promise<void> => {
  await fetch(`${API}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: 'OwnerAddress' }),
  });
};

export const mockSignOut = async (): Promise<void> => {
  await fetch(`${API}/auth/logout`, { method: 'POST' });
};

/** Counts every request msw sees, optionally only those whose path matches. */
export const countRequests = (match: RegExp = /./): (() => number) => {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (match.test(new URL(request.url).pathname)) count += 1;
  });
  return () => count;
};

/** Renders with the production QueryProvider: a fresh QueryClient per call, real defaults. */
export const renderWithProviders = (ui: ReactNode) => render(ui, { wrapper: QueryProvider });
