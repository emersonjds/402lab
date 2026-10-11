import type { ReactNode } from 'react';
import { Pressable, Text, View, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/shared/config/theme';
import { MOCKING_ENABLED } from '@/shared/mocks/is-enabled';

import { styles } from './styles';

export const Screen = ({ children }: { children: ReactNode }) => (
  <SafeAreaView style={styles.screen}>
    <View style={styles.padded}>{children}</View>
  </SafeAreaView>
);

export const Title = (props: TextProps) => (
  <Text accessibilityRole="header" {...props} style={[styles.title, props.style]} />
);
export const Body = (props: TextProps) => <Text {...props} style={[styles.body, props.style]} />;
export const Muted = (props: TextProps) => <Text {...props} style={[styles.muted, props.style]} />;
export const Mono = (props: TextProps) => <Text {...props} style={[styles.mono, props.style]} />;

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'warning' | 'ghost';
  large?: boolean;
  disabled?: boolean;
};

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  large = false,
  disabled = false,
}: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      styles[variant],
      large && styles.buttonLarge,
      pressed && styles.buttonPressed,
      disabled && styles.buttonDisabled,
    ]}
  >
    <Text style={[styles.buttonText, variant === 'ghost' && styles.ghostText]}>{title}</Text>
  </Pressable>
);

export const DevnetBadge = () => (
  <View style={styles.badgeRow}>
    {MOCKING_ENABLED && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>DEMO DATA</Text>
      </View>
    )}
    <View style={styles.badge}>
      <Text style={styles.badgeText}>DEVNET</Text>
    </View>
  </View>
);

export const Header = ({ title }: { title: string }) => (
  <View style={styles.header}>
    <Title>{title}</Title>
    <DevnetBadge />
  </View>
);

export const StatusPill = ({ status }: { status: 'active' | 'paused' }) => {
  const color = status === 'active' ? theme.colors.lime : theme.colors.amber;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>
        {status === 'active' ? '● ACTIVE' : '❚❚ PAUSED'}
      </Text>
    </View>
  );
};

export const OFFLINE_COPY = "Can't reach 402Lab. Retrying…";

export const OfflineState = ({ onRetry }: { onRetry: () => void }) => (
  <View style={styles.errorState} accessibilityLiveRegion="polite">
    <Body>{OFFLINE_COPY}</Body>
    <Button title="Retry" variant="ghost" onPress={onRetry} />
  </View>
);
