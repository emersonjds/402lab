import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parsePairingCode, useSession } from '@/entities/session';
import { Body } from '@/shared/ui';

import { styles } from './styles';

const INVALID_CODE = "That's not a 402Lab code. Try again.";

export const ScanScreen = () => {
  const { pair } = useSession();
  const [invalid, setInvalid] = useState(false);
  const paired = useRef(false);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (paired.current) {
      return;
    }

    const pairing = parsePairingCode(data);

    if (!pairing) {
      setInvalid(true);
      return;
    }

    paired.current = true;
    await pair(pairing);
    router.replace('/agents');
  };

  return (
    <View style={styles.container}>
      <CameraView
        testID="qr-camera"
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(result) => void onScanned(result)}
      />
      <SafeAreaView style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={() => {
            router.back();
          }}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.frame} />
        <View style={styles.bottom}>
          {invalid ? (
            <View style={styles.toast} accessibilityLiveRegion="assertive">
              <Body>{INVALID_CODE}</Body>
            </View>
          ) : (
            <Body style={styles.hint}>Point at the QR on your dashboard</Body>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};
