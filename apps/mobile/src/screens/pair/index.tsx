import { useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, View } from 'react-native';

import { useSession } from '@/entities/session';
import { Body, Button, DevnetBadge, Mono, Muted, Screen, Title } from '@/shared/ui';

import { styles } from './styles';

export const PairScreen = () => {
  const { state } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [priming, setPriming] = useState(false);
  const [blocked, setBlocked] = useState(false);

  if (state.status === 'loading') {
    return null;
  }

  if (state.status === 'paired') {
    return <Redirect href="/agents" />;
  }

  const startScan = () => {
    if (permission?.granted) {
      router.push('/scan');
      return;
    }

    setPriming(true);
  };

  const allowCamera = async () => {
    if (permission && !permission.canAskAgain) {
      setBlocked(true);
      return;
    }

    const response = await requestPermission();

    if (!response.granted) {
      setBlocked(true);
      return;
    }

    setPriming(false);
    router.push('/scan');
  };

  return (
    <Screen>
      <DevnetBadge />
      <View style={styles.hero}>
        <View style={styles.qrFrame}>
          <Mono style={styles.qrMark}>402</Mono>
        </View>
        <Title style={styles.center}>Pair with your dashboard</Title>
        <Body style={[styles.center, styles.lead]}>
          Open 402Lab on your computer → Allowance → Pair your phone.
        </Body>
      </View>
      <View style={styles.footer}>
        <Button title="Scan QR code" large onPress={startScan} />
      </View>

      <Modal
        visible={priming}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPriming(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Body>We use the camera only to scan the pairing code.</Body>
            {blocked ? (
              <>
                <Muted>Camera access is off. Turn it on in Settings to pair.</Muted>
                <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
              </>
            ) : (
              <Button title="Continue" onPress={() => void allowCamera()} />
            )}
            <Button
              title="Not now"
              variant="ghost"
              onPress={() => {
                setPriming(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};
