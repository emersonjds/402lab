import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

export const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  paused: { color: theme.colors.amber, textAlign: 'center' },
  failure: { color: theme.colors.danger, textAlign: 'center' },
});
