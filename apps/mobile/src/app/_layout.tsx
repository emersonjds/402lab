import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '@/entities/session';
import { theme } from '@/shared/config/theme';

const RootLayout = () => {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  // A font that fails to load falls back to the system face instead of blocking the app.
  if (!loaded && !error) {
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
