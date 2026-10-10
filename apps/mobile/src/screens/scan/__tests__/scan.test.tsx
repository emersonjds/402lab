import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { getItemAsync } from 'expo-secure-store';

import { PAIRING, renderWithSession } from '@/shared/testing';

import { ScanScreen } from '..';

const scan = async (data: string) => {
  await fireEvent(await screen.findByTestId('qr-camera'), 'barcodeScanned', { data });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scan screen', () => {
  it('saves the mobile token and opens the agents list after a valid code', async () => {
    await renderWithSession(<ScanScreen />);

    await scan(JSON.stringify(PAIRING));

    expect(JSON.parse((await getItemAsync('402lab.pairing')) ?? 'null')).toEqual(PAIRING);
    expect(router.replace).toHaveBeenCalledWith('/agents');
  });

  it.each([
    ['plain text', 'hello'],
    ['json without token', JSON.stringify({ api: PAIRING.api })],
    ['a non http api', JSON.stringify({ api: 'ftp://x', token: 't' })],
  ])('rejects %s with fixed copy and keeps scanning', async (_label, data) => {
    await renderWithSession(<ScanScreen />);

    await scan(data);

    expect(screen.getByText("That's not a 402Lab code. Try again.")).toBeTruthy();
    expect(await getItemAsync('402lab.pairing')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();

    await scan(JSON.stringify(PAIRING));

    expect(router.replace).toHaveBeenCalledWith('/agents');
  });

  it('pairs once even when the camera reports the same code twice', async () => {
    await renderWithSession(<ScanScreen />);

    await scan(JSON.stringify(PAIRING));
    await scan(JSON.stringify(PAIRING));

    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('closes back to the welcome screen', async () => {
    await renderWithSession(<ScanScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Close scanner' }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
