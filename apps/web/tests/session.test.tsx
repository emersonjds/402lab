import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSession, useSessionStore } from '@/shared/auth/session-context';

import { API, countRequests, renderWithProviders, server } from './server';

const KEY = '402lab.session.address';

const Who = () => {
  const session = useSession();

  return (
    <div>
      <p>address: {session.address ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          session.signIn('Owner111');
        }}
      >
        sign in
      </button>
      <button type="button" onClick={() => void session.signOut()}>
        sign out
      </button>
    </div>
  );
};

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.setState({ address: null });
    localStorage.clear();
  });

  it('signs in and persists only the address under its key', async () => {
    renderWithProviders(<Who />);

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));

    expect(screen.getByText('address: Owner111')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({
      state: { address: 'Owner111' },
      version: 0,
    });
  });

  it('signs out locally and tells the API once', async () => {
    const logouts = countRequests(/^\/api\/auth\/logout$/);
    renderWithProviders(<Who />);
    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    expect(screen.getByText('address: none')).toBeTruthy();
    await waitFor(() => {
      expect(logouts()).toBe(1);
    });
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({
      state: { address: null },
      version: 0,
    });
  });

  it('still signs out when the logout call fails', async () => {
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    useSessionStore.setState({ address: 'Owner111' });

    await act(() => useSessionStore.getState().signOut());

    expect(useSessionStore.getState().address).toBeNull();
  });

  it('rehydrates the stored address after mount', async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { address: 'Stored222' }, version: 0 }));
    renderWithProviders(<Who />);

    expect(await screen.findByText('address: Stored222')).toBeTruthy();
  });

  it('survives a corrupt stored value without crashing', async () => {
    localStorage.setItem(KEY, '{not json');
    renderWithProviders(<Who />);

    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.getByText('address: none')).toBeTruthy();
  });
});
