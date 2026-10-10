import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import { setStringAsync } from 'expo-clipboard';
import { scheduleNotificationAsync } from 'expo-notifications';
import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { mockFetch, renderWithSession, storePairing } from '@/shared/testing';
import { allowance, payment } from '@/shared/testing/fixtures';

import { AgentDetailScreen } from '..';

const POLL_MS = 3_000;

const tick = async (ms = POLL_MS) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const paymentCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls
    .map(([url]) => (typeof url === 'string' ? url : ''))
    .filter((url) => url.includes('/payments'));

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-10T12:00:12.000Z') });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a1' });
  await storePairing();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('agent detail feed', () => {
  it('shows today spend against the cap and the latest payments, newest first', async () => {
    mockFetch([
      {
        path: '/allowances/a1/payments',
        body: {
          payments: [payment('p1'), payment('p2', { serviceId: 'translate', amount: '2000' })],
        },
      },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);

    await renderWithSession(<AgentDetailScreen />);

    expect(await screen.findByText('$0.017')).toBeTruthy();
    expect(screen.getByText('of $1 today')).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /ago/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName('Translate, $0.002, 12s ago');
    expect(rows[1]).toHaveAccessibleName('OCR, $0.005, 12s ago');
  });

  it('polls every 3 s after the last id and never duplicates a payment', async () => {
    const fetchMock = mockFetch([
      { path: '/allowances/a1/payments', body: { payments: [payment('p1')] } },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await renderWithSession(<AgentDetailScreen />);
    await screen.findByText('OCR');

    const pollMock = mockFetch([
      {
        path: '/allowances/a1/payments',
        body: {
          payments: [payment('p1'), payment('p3', { serviceId: 'summarize', amount: '10000' })],
        },
      },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await tick();

    expect(await screen.findByText('Summarize')).toBeTruthy();
    expect(screen.getAllByText('OCR')).toHaveLength(1);
    expect(paymentCalls(fetchMock)[0]).toBe('https://api.402lab.test/allowances/a1/payments');
    expect(paymentCalls(pollMock)).toEqual([
      'https://api.402lab.test/allowances/a1/payments?after=p1',
    ]);
  });

  it('alerts once when the agent reaches its daily cap while being watched', async () => {
    const capped = [
      { path: '/allowances/a1/payments', body: { payments: [] } },
      { path: '/allowances', body: { allowances: [allowance({ spentToday: '1000000' })] } },
    ];
    mockFetch([
      { path: '/allowances/a1/payments', body: { payments: [] } },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await renderWithSession(<AgentDetailScreen />);
    await screen.findByText('$0.017');

    mockFetch(capped);
    await tick();
    await tick();

    expect(await screen.findByText('$1')).toBeTruthy();
    expect(
      jest.mocked(scheduleNotificationAsync).mock.calls.map(([request]) => request.content.body),
    ).toEqual(['research-bot hit its daily cap ($1). Further calls are refused.']);
  });

  it('stops polling when the screen goes away', async () => {
    const fetchMock = mockFetch([
      { path: '/allowances/a1/payments', body: { payments: [] } },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    const view = await renderWithSession(<AgentDetailScreen />);
    await screen.findByText('$0.017');
    await tick();
    const callsBeforeLeaving = fetchMock.mock.calls.length;

    await view.unmount();
    await tick(POLL_MS * 5);

    expect(callsBeforeLeaving).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeLeaving);
  });

  it('shows fixed copy while offline and keeps retrying on its own', async () => {
    mockFetch([]);
    await renderWithSession(<AgentDetailScreen />);

    expect(await screen.findByText("Can't reach 402Lab. Retrying…")).toBeTruthy();

    mockFetch([
      { path: '/allowances/a1/payments', body: { payments: [payment('p1')] } },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await tick();

    expect(await screen.findByText('OCR')).toBeTruthy();
    expect(screen.queryByText("Can't reach 402Lab. Retrying…")).toBeNull();
  });

  it('refreshes right away on pull to refresh', async () => {
    const fetchMock = mockFetch([
      { path: '/allowances/a1/payments', body: { payments: [] } },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await renderWithSession(<AgentDetailScreen />);
    await screen.findByText('$0.017');
    const calls = fetchMock.mock.calls.length;

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .pullToRefresh(screen.getByTestId('payment-feed'));

    expect(fetchMock.mock.calls.length).toBe(calls + 2);
  });

  it('opens the payment sheet with savings, split and on-chain proof', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockFetch([
      {
        path: '/allowances/a1/payments',
        body: { payments: [payment('p1', { txSignature: '5JtSig' })] },
      },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'OCR, $0.005, 12s ago' }));

    expect(screen.getByText('Azure AI Vision')).toBeTruthy();
    expect(screen.getByText('$0.315825')).toBeTruthy();
    expect(screen.getByText('$0.00425')).toBeTruthy();
    expect(screen.getByText('$0.00025')).toBeTruthy();
    expect(screen.getByText('$0.0005')).toBeTruthy();
    expect(screen.getByText('5JtSig')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Copy signature' }));
    expect(setStringAsync).toHaveBeenCalledWith('5JtSig');
    expect(screen.getByText('Copied')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'View on Solscan ↗' }));
    expect(openUrl).toHaveBeenCalledWith('https://solscan.io/tx/5JtSig?cluster=devnet');

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Azure AI Vision')).toBeNull();
  });

  it('shows an unknown service by its id', async () => {
    mockFetch([
      {
        path: '/allowances/a1/payments',
        body: { payments: [payment('p1', { serviceId: 'weather' })] },
      },
      { path: '/allowances', body: { allowances: [allowance()] } },
    ]);
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'weather, $0.005, 12s ago' }));

    expect(screen.getAllByText('weather').length).toBeGreaterThan(0);
  });
});
