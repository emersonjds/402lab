import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { SessionProvider } from '@/entities/session';
import { configureNotifications } from '@/features/cap-alerts';
import { theme } from '@/shared/config/theme';
import { MOCKING_ENABLED } from '@/shared/mocks/is-enabled';

configureNotifications();

const RootLayout = () => {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  const [mocksReady, setMocksReady] = useState(!MOCKING_ENABLED);

  useEffect(() => {
    if (!MOCKING_ENABLED) return;

    void import('@/shared/mocks/start-server')
      .then(({ startMockServer }) => startMockServer())
      .then(() => {
        setMocksReady(true);
      });
  }, []);

  // A font that fails to load falls back to the system face instead of blocking the app; the
  // mock server must be intercepting fetch before any screen fires its first request.
  if ((!loaded && !error) || !mocksReady) {
    return null;
  }

  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </SessionProvider>
  );
};

export { RootLayout as default };
