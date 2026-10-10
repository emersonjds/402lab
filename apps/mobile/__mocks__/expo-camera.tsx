import type { ComponentProps } from 'react';
import { View } from 'react-native';

export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};

// Renders a plain View so tests fire `barcodeScanned` on it by testID.
export const CameraView = (props: ComponentProps<typeof View>) => <View {...props} />;

export const useCameraPermissions = jest.fn();
