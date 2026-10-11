import { formatUsd } from '@402lab/shared';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { capReached, type Allowance } from '@/entities/allowance';
import { Body, Button } from '@/shared/ui';

import { styles } from './styles';

export const configureNotifications = (): void => {
  setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
};

const notify = (body: string): void => {
  // Local only (works in Expo Go); a refused permission just drops the alert.
  scheduleNotificationAsync({ content: { title: '402Lab', body }, trigger: null }).catch(() => {});
};

// Allowance ids already alerted for the current cap event, shared by every screen that polls.
const capped = new Set<string>();

export const watchCaps = (allowances: Allowance[]): void => {
  for (const allowance of allowances) {
    if (!capReached(allowance)) {
      capped.delete(allowance.id);
      continue;
    }

    if (capped.has(allowance.id)) {
      continue;
    }

    capped.add(allowance.id);
    notify(
      `${allowance.agentName} hit its daily cap (${formatUsd(allowance.dailyCap)}). Further calls are refused.`,
    );
  }
};

export const notifyPausedFromPhone = (agentName: string): void => {
  notify(`${agentName} paused from your phone.`);
};

export const AlertsPrompt = () => {
  const [askable, setAskable] = useState(false);

  useEffect(() => {
    void getPermissionsAsync().then((current) => {
      setAskable(!current.granted && current.canAskAgain);
    });
  }, []);

  if (!askable) {
    return null;
  }

  const turnOn = async () => {
    await requestPermissionsAsync();
    setAskable(false);
  };

  return (
    <View style={styles.prompt}>
      <Body>Get an alert when an agent hits its daily cap.</Body>
      <Button title="Turn on alerts" variant="ghost" onPress={() => void turnOn()} />
    </View>
  );
};
