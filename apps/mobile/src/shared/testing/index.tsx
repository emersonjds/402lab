import { render } from '@testing-library/react-native';
import { PermissionStatus, type PermissionResponse } from 'expo-camera';
import { setItemAsync } from 'expo-secure-store';
import type { ReactElement } from 'react';

import { SessionProvider } from '@/entities/session';

export const PAIRING = { api: 'https://api.402lab.test', token: 'mobile-jwt' };

export const storePairing = (): Promise<void> =>
  setItemAsync('402lab.pairing', JSON.stringify(PAIRING));

export const renderWithSession = (ui: ReactElement) =>
  render(<SessionProvider>{ui}</SessionProvider>);

export const permission = (granted: boolean, canAskAgain = true): PermissionResponse => ({
  granted,
  canAskAgain,
  expires: 'never',
  status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
});

type Route = { method?: string; path: string; status?: number; body?: unknown };

// Fake HTTP boundary: each call answers with the first route matching method + path prefix.
export const mockFetch = (routes: Route[]) => {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    const route = routes.find(
      (candidate) =>
        (candidate.method ?? 'GET') === method && url.startsWith(`${PAIRING.api}${candidate.path}`),
    );

    if (!route) {
      return Promise.reject(new TypeError('Network request failed'));
    }

    return Promise.resolve(
      new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 }),
    );
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
};
