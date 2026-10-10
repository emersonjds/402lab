import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

export const styles = StyleSheet.create({
  prompt: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
});
