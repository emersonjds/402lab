import { fireEvent, screen } from '@testing-library/react-native';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';

import type { Allowance } from '@/entities/allowance';
import { AgentsScreen } from '@/screens/agents';
import { mockFetch, permission, renderWithSession, storePairing } from '@/shared/testing';
import { allowance } from '@/shared/testing/fixtures';

import { configureNotifications, notifyPausedFromPhone, watchCaps } from '..';

const agent = (id: string, spentToday: bigint, agentName = 'research-bot'): Allowance => ({
  id,
  agentName,
  sessionAddress: '7xKpQm2b9fQ2',
  status: 'active',
  perCallCap: 20_000n,
  dailyCap: 1_000_000n,
  spentToday,
  createdAt: '2026-10-10T12:00:00.000Z',
});

const CAP_COPY = 'research-bot hit its daily cap ($1). Further calls are refused.';

const bodies = () =>
  jest.mocked(scheduleNotificationAsync).mock.calls.map(([request]) => request.content.body);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cap alerts', () => {
  it('notifies once when an agent reaches its daily cap', () => {
    watchCaps([agent('cap-1', 999_999n)]);
    watchCaps([agent('cap-1', 1_000_000n)]);
    watchCaps([agent('cap-1', 1_000_000n)]);
    watchCaps([agent('cap-1', 1_200_000n)]);

    expect(bodies()).toEqual([CAP_COPY]);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: null }),
    );
  });

  it('notifies again after the cap resets on a new day', () => {
    watchCaps([agent('cap-2', 1_000_000n)]);
    watchCaps([agent('cap-2', 0n)]);
    watchCaps([agent('cap-2', 1_000_000n)]);

    expect(bodies()).toEqual([CAP_COPY, CAP_COPY]);
  });

  it('tracks each agent on its own', () => {
    watchCaps([agent('cap-3', 1_000_000n), agent('cap-4', 1_000_000n, 'scraper')]);

    expect(bodies()).toEqual([
      CAP_COPY,
      'scraper hit its daily cap ($1). Further calls are refused.',
    ]);
  });

  it('tells the phone an agent was paused from it', () => {
    notifyPausedFromPhone('research-bot');

    expect(bodies()).toEqual(['research-bot paused from your phone.']);
  });

  it('shows alerts while the app is open', () => {
    configureNotifications();

    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});

describe('alerts permission', () => {
  beforeEach(async () => {
    await storePairing();
    mockFetch([{ path: '/allowances', body: { allowances: [allowance()] } }]);
  });

  it('explains the alert before asking for notifications', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValueOnce(permission(false));
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce(permission(true));
    await renderWithSession(<AgentsScreen />);

    expect(await screen.findByText('Get an alert when an agent hits its daily cap.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Turn on alerts' }));

    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Get an alert when an agent hits its daily cap.')).toBeNull();
  });

  it('stays quiet when alerts were refused for good', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValueOnce(permission(false, false));
    await renderWithSession(<AgentsScreen />);
    await screen.findByText('research-bot');

    expect(screen.queryByText('Get an alert when an agent hits its daily cap.')).toBeNull();
  });

  it('alerts from the agents list when an agent is already capped', async () => {
    mockFetch([
      {
        path: '/allowances',
        body: { allowances: [allowance({ id: 'cap-5', spentToday: '1000000' })] },
      },
    ]);
    await renderWithSession(<AgentsScreen />);
    await screen.findByText('research-bot');

    expect(bodies()).toEqual([CAP_COPY]);
  });
});
