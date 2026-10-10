import { fireEvent, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { permission, renderWithSession, storePairing } from '@/shared/testing';

import { PairScreen } from '..';

const requestPermission = jest.fn();

const givenCamera = (current: ReturnType<typeof permission> | null) => {
  jest.mocked(useCameraPermissions).mockReturnValue([current, requestPermission, jest.fn()]);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pair screen', () => {
  it('sends a paired phone straight to the agents list', async () => {
    givenCamera(null);
    await storePairing();

    await renderWithSession(<PairScreen />);

    expect(await screen.findByText('redirect:/agents')).toBeTruthy();
  });

  it('explains the camera before asking for it, then opens the scanner', async () => {
    givenCamera(permission(false));
    requestPermission.mockResolvedValue(permission(true));
    await renderWithSession(<PairScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Scan QR code' }));

    expect(screen.getByText('We use the camera only to scan the pairing code.')).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/scan');
  });

  it('opens the scanner directly when the camera is already allowed', async () => {
    givenCamera(permission(true));
    await renderWithSession(<PairScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Scan QR code' }));

    expect(router.push).toHaveBeenCalledWith('/scan');
  });

  it('points to Settings when the camera was blocked for good', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    givenCamera(permission(false, false));
    await renderWithSession(<PairScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Scan QR code' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.getByText('Camera access is off. Turn it on in Settings to pair.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps the user on the priming sheet when the camera is refused', async () => {
    givenCamera(permission(false));
    requestPermission.mockResolvedValue(permission(false, false));
    await renderWithSession(<PairScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Scan QR code' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('Camera access is off. Turn it on in Settings to pair.')).toBeTruthy();
  });
});
