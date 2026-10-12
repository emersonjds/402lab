import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/shared/api/client';
import { allowanceListSchema, type Allowance } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { StatusHeader } from '@/widgets/allowance-detail/status-header';
import { OverviewView } from '@/widgets/overview/overview-view';
import { PaymentsTable } from '@/widgets/payments/payments-table';

import { API, countRequests, mockSignIn, mockSignOut, renderWithProviders, server } from './server';

vi.mock('next/dynamic', () => ({ default: () => () => null }));

/** jsdom has no EventSource; the overview's live feed only needs one that opens and stays quiet. */
class SilentEventSource {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

const firstActiveAllowance = async (): Promise<Allowance> => {
  const { allowances } = await apiRequest('/allowances', { schema: allowanceListSchema });
  const active = allowances.find((allowance) => allowance.status === 'active');
  if (!active) throw new Error('mock has no active allowance');
  return active;
};

const AgentsStatus = () => {
  const query = useApiQuery('/allowances', allowanceListSchema);
  return <p>list: {query.status}</p>;
};

const Detail = ({ initial }: { initial: Allowance }) => {
  const [allowance, setAllowance] = useState(initial);
  return (
    <>
      <AgentsStatus />
      <StatusHeader allowance={allowance} onUpdate={setAllowance} />
    </>
  );
};

describe('widgets against the mock API', () => {
  beforeEach(mockSignIn);
  afterEach(mockSignOut);

  it('payments table renders 100 rows, then Show more adds 100', async () => {
    const view = renderWithProviders(<PaymentsTable />);

    expect(
      await screen.findByText(/Showing the latest 100 of \d+ payments\./, {}, { timeout: 15_000 }),
    ).toBeTruthy();
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(100);

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(200);
    expect(screen.getByText(/Showing the latest 200 of \d+ payments\./)).toBeTruthy();
  });

  it('pause flips the badge to PAUSED before the API answers, then refreshes the allowances list', async () => {
    const allowance = await firstActiveAllowance();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Returning nothing falls through to the shared mock handler once the gate opens.
    server.use(
      http.patch(`${API}/allowances/:id`, async () => {
        await gate;
      }),
    );
    const listRequests = countRequests(/^\/api\/allowances$/);
    renderWithProviders(<Detail initial={allowance} />);
    await screen.findByText('list: ready');
    expect(listRequests()).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'Pause agent' }));

    expect(screen.getByText('PAUSED')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume agent' })).toHaveProperty('disabled', true);

    release();
    await waitFor(() => {
      expect(listRequests()).toBe(2);
    });
    expect(screen.getByRole('button', { name: 'Resume agent' })).toHaveProperty('disabled', false);
    expect((await firstActiveAllowance()).id).not.toBe(allowance.id);

    await userEvent.click(screen.getByRole('button', { name: 'Resume agent' }));
    expect(await screen.findByText('ACTIVE')).toBeTruthy();
  });

  it('pause rolls back and shows fixed copy when the API refuses', async () => {
    const allowance = await firstActiveAllowance();
    server.use(
      http.patch(`${API}/allowances/:id`, () =>
        HttpResponse.json({ error: 'rpc: down' }, { status: 503 }),
      ),
    );
    renderWithProviders(<Detail initial={allowance} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pause agent' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong on our side. Try again in a moment.',
    );
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('overview renders from the mock API without errors', async () => {
    vi.stubGlobal('EventSource', SilentEventSource);
    const consoleError = vi.spyOn(console, 'error');
    try {
      renderWithProviders(<OverviewView />);

      expect(await screen.findByText('Protocol overview')).toBeTruthy();
      await waitFor(
        () => {
          expect(screen.getByText('Active agent allowances')).toBeTruthy();
          expect(screen.getAllByText('research-bot').length).toBeGreaterThan(0);
        },
        { timeout: 15_000 },
      );
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(screen.queryByText("Couldn't load overview data")).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
