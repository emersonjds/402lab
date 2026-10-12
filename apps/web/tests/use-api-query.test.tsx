import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_ERROR_MESSAGES } from '@/shared/api/client';
import { allowanceListSchema } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';

import {
  API,
  countRequests,
  mockSignIn,
  mockSignOut,
  renderWithProviders,
  routerReplace,
  server,
} from './server';

const Allowances = ({ path = '/allowances' }: { path?: string | null }) => {
  const query = useApiQuery(path, allowanceListSchema);

  return (
    <div>
      <p>status: {query.status}</p>
      {query.status === 'ready' && <p>agents: {query.data.allowances.length}</p>}
      {query.status === 'error' && <p role="alert">{query.message}</p>}
      <button type="button" onClick={query.refetch}>
        refetch
      </button>
    </div>
  );
};

describe('useApiQuery', () => {
  beforeEach(mockSignIn);
  afterEach(mockSignOut);

  it('goes from loading to ready with the parsed data', async () => {
    renderWithProviders(<Allowances />);

    expect(screen.getByText('status: loading')).toBeTruthy();
    expect(await screen.findByText('agents: 6')).toBeTruthy();
    expect(screen.getByText('status: ready')).toBeTruthy();
  });

  it('shows the fixed copy when the API fails', async () => {
    server.use(
      http.get(`${API}/allowances`, () =>
        HttpResponse.json({ error: 'db down: secret' }, { status: 500 }),
      ),
    );
    renderWithProviders(<Allowances />);

    expect((await screen.findByRole('alert', {}, { timeout: 5_000 })).textContent).toBe(
      API_ERROR_MESSAGES.server,
    );
    expect(screen.queryByText(/secret/)).toBeNull();
  });

  it('skips the request while the path is null', async () => {
    const requests = countRequests(/\/api\//);
    renderWithProviders(<Allowances path={null} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('status: loading')).toBeTruthy();
    expect(requests()).toBe(0);
  });

  it('shares one request between two components reading the same path', async () => {
    const requests = countRequests(/^\/api\/allowances$/);
    renderWithProviders(
      <>
        <Allowances />
        <Allowances />
      </>,
    );

    expect(await screen.findAllByText('agents: 6')).toHaveLength(2);
    expect(requests()).toBe(1);
  });

  it('refetches on demand', async () => {
    const requests = countRequests(/^\/api\/allowances$/);
    renderWithProviders(<Allowances />);
    await screen.findByText('agents: 6');

    await userEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(requests()).toBe(2);
    });
    expect(screen.getByText('agents: 6')).toBeTruthy();
  });

  it('redirects to /app exactly once on 401 and keeps loading instead of showing an error', async () => {
    await mockSignOut();
    const requests = countRequests(/^\/api\/allowances$/);
    renderWithProviders(
      <>
        <Allowances />
        <Allowances />
      </>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/app');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(requests()).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('status: loading')).toHaveLength(2);
  });
});
