import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { mockFetch, renderWithSession, storePairing } from '@/shared/testing';
import { allowance } from '@/shared/testing/fixtures';

import { AgentDetailScreen } from '..';

const PAUSED_COPY = 'Agent paused. Payments will be refused.';

const routes = (status: string, patch: { status?: number; hold?: Promise<void> } = {}) => [
  {
    method: 'PATCH',
    path: '/allowances/a1',
    body: allowance({ status: status === 'active' ? 'paused' : 'active' }),
    ...patch,
  },
  { path: '/allowances/a1/payments', body: { payments: [] } },
  { path: '/allowances', body: { allowances: [allowance({ status })] } },
];

const patchCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'a1' });
  await storePairing();
});

describe('pause and resume', () => {
  it('shows the agent as paused before the server answers', async () => {
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = mockFetch(routes('active', { hold }));
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Pause agent' }));

    expect(screen.getByText(PAUSED_COPY)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(patchCalls(fetchMock)).toEqual([
      [
        'https://api.402lab.test/allowances/a1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'paused' }) }),
      ],
    ]);

    await act(async () => {
      release();
      await hold;
    });

    expect(screen.getByText(PAUSED_COPY)).toBeTruthy();
  });

  it('rolls back and shows fixed copy when pausing fails', async () => {
    mockFetch(routes('active', { status: 500 }));
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Pause agent' }));

    expect(await screen.findByText("Couldn't pause the agent. Try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause agent' })).toBeTruthy();
    expect(screen.queryByText(PAUSED_COPY)).toBeNull();
  });

  it('resumes a paused agent', async () => {
    const fetchMock = mockFetch(routes('paused'));
    await renderWithSession(<AgentDetailScreen />);

    expect(await screen.findByText(PAUSED_COPY)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(await screen.findByRole('button', { name: 'Pause agent' })).toBeTruthy();
    expect(patchCalls(fetchMock)[0]?.[1]?.body).toBe(JSON.stringify({ status: 'active' }));
  });

  it('rolls back a failed resume with its own copy', async () => {
    mockFetch(routes('paused', { status: 503 }));
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Resume' }));

    expect(await screen.findByText("Couldn't resume the agent. Try again.")).toBeTruthy();
    expect(screen.getByText(PAUSED_COPY)).toBeTruthy();
  });

  it('goes back to pairing when the token is no longer valid', async () => {
    mockFetch(routes('active', { status: 401 }));
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Pause agent' }));

    expect(await screen.findByText('redirect:/')).toBeTruthy();
  });

  it('goes back to the agents list', async () => {
    mockFetch(routes('active'));
    await renderWithSession(<AgentDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Back to your agents' }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('retries right away from the offline state', async () => {
    mockFetch([]);
    await renderWithSession(<AgentDetailScreen />);
    await screen.findByText("Can't reach 402Lab. Retrying…");

    mockFetch(routes('active'));
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: 'Pause agent' })).toBeTruthy();
  });
});
