import { useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, View } from 'react-native';

import { useSession } from '@/entities/session';
import { DEMO_PAIRING, MOCKING_ENABLED } from '@/shared/mocks/is-enabled';
import { Body, Button, DevnetBadge, Mono, Muted, Screen, Title } from '@/shared/ui';
import { LogoMark } from '@/shared/ui/logo-mark';

import { styles } from './styles';

const BULLETS = [
  'Read-only observer mode',
  'Zero private keys stored locally',
  'One-tap emergency pause control',
];

export const PairScreen = () => {
  const { state, pair } = useSession();
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

  const enterDemo = async () => {
    await pair(DEMO_PAIRING);
    router.replace('/agents');
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
      <View style={styles.topBar}>
        <View>
          <View style={styles.brandRow}>
            <LogoMark size={20} />
            <Mono style={styles.brand}>402Lab</Mono>
          </View>
          <Muted style={styles.observer}>OBSERVER MODE</Muted>
        </View>
        <DevnetBadge />
      </View>
      <View style={styles.hero}>
        <View style={styles.qrFrame}>
          <LogoMark size={96} />
        </View>
        <Title style={styles.center}>Pair with your dashboard</Title>
        <Body style={[styles.center, styles.lead]}>
          Open 402Lab on your computer → Allowance → Pair your phone.
        </Body>
        <View style={styles.bullets}>
          {BULLETS.map((bullet) => (
            <Muted key={bullet} style={styles.bullet}>{`•  ${bullet}`}</Muted>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Button title="Scan QR code" large onPress={startScan} />
        {MOCKING_ENABLED && (
          <Button title="Explore the app" variant="ghost" onPress={() => void enterDemo()} />
        )}
        <Muted style={styles.footCaption}>Solana Devnet · HTTP 402</Muted>
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
