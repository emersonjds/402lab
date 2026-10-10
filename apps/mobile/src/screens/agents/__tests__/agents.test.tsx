import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { getItemAsync } from 'expo-secure-store';

import { mockFetch, renderWithSession, storePairing } from '@/shared/testing';
import { allowance } from '@/shared/testing/fixtures';

import { AgentsScreen } from '..';

beforeEach(async () => {
  jest.clearAllMocks();
  await storePairing();
});

describe('agents list', () => {
  it('shows what each agent spent today and opens its detail', async () => {
    const fetchMock = mockFetch([
      {
        path: '/allowances',
        body: {
          allowances: [
            allowance({ spentToday: '420000' }),
            allowance({ id: 'a2', agentName: 'scraper', status: 'paused' }),
          ],
        },
      },
    ]);

    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText('research-bot')).toBeTruthy();
    expect(screen.getByText('Spent today $0.42 of $1')).toBeTruthy();
    expect(screen.getByText('❚❚ PAUSED')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('https://api.402lab.test/allowances', {
      method: 'GET',
      headers: { Authorization: 'Bearer mobile-jwt', 'Content-Type': 'application/json' },
    });

    await fireEvent.press(screen.getByRole('button', { name: /research-bot/ }));

    expect(router.push).toHaveBeenCalledWith('/agents/a1');
  });

  it('tells the user how to add an agent when there is none', async () => {
    mockFetch([{ path: '/allowances', body: { allowances: [] } }]);

    await renderWithSession(<AgentsScreen />);

    expect(
      await screen.findByText('No agents yet. Create an allowance on your dashboard.'),
    ).toBeTruthy();
  });

  it('shows fixed copy when offline and recovers on retry', async () => {
    const fetchMock = mockFetch([]);
    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText("Can't reach 402Lab. Retrying…")).toBeTruthy();

    mockFetch([{ path: '/allowances', body: { allowances: [allowance()] } }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('research-bot')).toBeTruthy();
    expect(screen.queryByText("Can't reach 402Lab. Retrying…")).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('never shows the server text when the api answers with an error', async () => {
    mockFetch([{ path: '/allowances', status: 500, body: { message: 'db exploded' } }]);

    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText("Can't reach 402Lab. Retrying…")).toBeTruthy();
    expect(screen.queryByText(/db exploded/)).toBeNull();
  });

  it('treats a malformed payload as unreachable', async () => {
    mockFetch([{ path: '/allowances', body: { allowances: [{ id: 'a1' }] } }]);

    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText("Can't reach 402Lab. Retrying…")).toBeTruthy();
  });

  it('forgets the token and goes back to pairing on 401', async () => {
    mockFetch([{ path: '/allowances', status: 401 }]);

    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText('redirect:/')).toBeTruthy();
    expect(await getItemAsync('402lab.pairing')).toBeNull();
  });

  it('reloads on pull to refresh', async () => {
    const fetchMock = mockFetch([{ path: '/allowances', body: { allowances: [allowance()] } }]);
    await renderWithSession(<AgentsScreen />);
    await screen.findByText('research-bot');
    const calls = fetchMock.mock.calls.length;

    await userEvent.setup().pullToRefresh(screen.getByTestId('agents-list'));

    expect(fetchMock.mock.calls.length).toBe(calls + 1);
  });
});
