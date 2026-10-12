import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hydratePairing, usePairingStore } from '@/entities/session';
import { configureNotifications } from '@/features/cap-alerts';
import { UnauthorizedError } from '@/shared/api/client';
import { theme } from '@/shared/config/theme';
import { MOCKING_ENABLED } from '@/shared/mocks/is-enabled';

configureNotifications();

// A 401 anywhere means the pairing was revoked: forget it and every cached answer.
const forgetPairingOn401 = (error: Error): void => {
  if (!(error instanceof UnauthorizedError)) return;
  void usePairingStore
    .getState()
    .unpair()
    .then(() => {
      queryClient.clear();
    });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: forgetPairingOn401 }),
  mutationCache: new MutationCache({ onError: forgetPairingOn401 }),
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => !(error instanceof UnauthorizedError) && failureCount < 1,
    },
  },
});

const RootLayout = () => {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  const [mocksReady, setMocksReady] = useState(!MOCKING_ENABLED);

  useEffect(() => {
    void hydratePairing();
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

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
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </QueryClientProvider>
  );
};

export { RootLayout as default };
