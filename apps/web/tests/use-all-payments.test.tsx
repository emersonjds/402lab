import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAllPayments } from '@/shared/api/use-all-payments';

import { API, countRequests, mockSignIn, mockSignOut, renderWithProviders, server } from './server';

const allowance = (id: string, agentName: string) => ({
  id,
  agentName,
  sessionAddress: `Sess-${id}`,
  status: 'active',
  perCallCap: '1000',
  dailyCap: '1000000',
  spentToday: '0',
  createdAt: '2026-10-01T00:00:00.000Z',
});

/** `count` payments for one allowance, oldest first, one minute apart from `startMinute`. */
const history = (prefix: string, count: number, startMinute: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index).padStart(4, '0')}`,
    serviceId: 'ocr',
    amount: '1000',
    txSignature: `sig-${prefix}-${String(index)}`,
    settledAt: new Date(Date.UTC(2026, 9, 12, 0, startMinute + index * 2)).toISOString(),
    upstreamStatus: '200',
  }));

/** Two allowances: `alpha` spans three pages (50 + 50 + 20), `beta` fits in one. Same paging
 * contract as the mock API: oldest first, 50 per page, `after` = last id of the previous page. */
const useTwoAllowances = () => {
  const pages: Record<string, ReturnType<typeof history>> = {
    a: history('a', 120, 0),
    b: history('b', 3, 1),
  };
  server.use(
    http.get(`${API}/allowances`, () =>
      HttpResponse.json({ allowances: [allowance('a', 'alpha'), allowance('b', 'beta')] }),
    ),
    http.get(`${API}/allowances/:id/payments`, ({ params, request }) => {
      const scoped = pages[String(params.id)] ?? [];
      const after = new URL(request.url).searchParams.get('after');
      const start = after ? scoped.findIndex((payment) => payment.id === after) + 1 : 0;
      return HttpResponse.json({ payments: scoped.slice(start, start + 50) });
    }),
  );
};

const Probe = () => {
  const query = useAllPayments();
  const [renders, setRenders] = useState(0);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setRenders((count) => count + 1);
        }}
      >
        render {renders}
      </button>
      <p>status: {query.status}</p>
      {query.status === 'error' && <p role="alert">{query.message}</p>}
      {query.status === 'ready' && (
        <>
          <p>total: {query.payments.length}</p>
          <p>
            first: {query.payments[0]?.id} {query.payments[0]?.agentName}
          </p>
          <p>last: {query.payments.at(-1)?.id}</p>
          <p>
            sorted:{' '}
            {String(
              query.payments.every(
                (payment, index, all) =>
                  index === 0 || (all[index - 1]?.settledAt ?? '') >= payment.settledAt,
              ),
            )}
          </p>
          <p>beta: {query.payments.filter((payment) => payment.allowanceId === 'b').length}</p>
        </>
      )}
    </div>
  );
};

describe('useAllPayments', () => {
  beforeEach(mockSignIn);
  afterEach(mockSignOut);

  it('pages through the after cursor and merges every allowance newest first', async () => {
    useTwoAllowances();
    const pageRequests = countRequests(/\/payments$/);
    renderWithProviders(<Probe />);

    expect(await screen.findByText('total: 123')).toBeTruthy();
    expect(screen.getByText('first: a-0119 alpha')).toBeTruthy();
    expect(screen.getByText('last: a-0000')).toBeTruthy();
    expect(screen.getByText('sorted: true')).toBeTruthy();
    expect(screen.getByText('beta: 3')).toBeTruthy();
    // alpha: 3 pages (50, 50, 20); beta: 1 short page.
    expect(pageRequests()).toBe(4);
  });

  it('stops paging on an empty page even when the last full page lands on 50', async () => {
    server.use(
      http.get(`${API}/allowances`, () =>
        HttpResponse.json({ allowances: [allowance('a', 'alpha')] }),
      ),
      http.get(`${API}/allowances/:id/payments`, ({ request }) => {
        const after = new URL(request.url).searchParams.get('after');
        return HttpResponse.json({ payments: after ? [] : history('a', 50, 0) });
      }),
    );
    const pageRequests = countRequests(/\/payments$/);
    renderWithProviders(<Probe />);

    expect(await screen.findByText('total: 50')).toBeTruthy();
    expect(pageRequests()).toBe(2);
  });

  it('keeps the request count flat across re-renders once loaded', async () => {
    useTwoAllowances();
    const requests = countRequests(/^\/api\//);
    const view = renderWithProviders(<Probe />);
    await screen.findByText('total: 123');
    const afterLoad = requests();

    for (let index = 1; index <= 5; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: /render/ }));
      view.rerender(<Probe />);
    }
    await screen.findByText('render 5');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(afterLoad).toBe(5);
    expect(requests()).toBe(afterLoad);
    expect(screen.getByText('total: 123')).toBeTruthy();
  });

  it('reports the allowances error with its fixed copy', async () => {
    server.use(
      http.get(`${API}/allowances`, () => HttpResponse.json({ error: 'x' }, { status: 404 })),
    );
    renderWithProviders(<Probe />);

    expect((await screen.findByRole('alert')).textContent).toBe("We couldn't find that.");
  });

  it('reports a failed payment page with fixed copy', async () => {
    useTwoAllowances();
    server.use(
      http.get(`${API}/allowances/b/payments`, () =>
        HttpResponse.json({ error: 'rpc: boom' }, { status: 404 }),
      ),
    );
    renderWithProviders(<Probe />);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong loading payments.',
    );
  });

  it('loads the full mock history from the shared handlers', async () => {
    renderWithProviders(<Probe />);

    await waitFor(
      () => {
        expect(screen.getByText(/^total: \d+$/)).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    expect(Number(screen.getByText(/^total: /).textContent.slice(7))).toBeGreaterThanOrEqual(
      40_000,
    );
    expect(screen.getByText('sorted: true')).toBeTruthy();
  });
});
