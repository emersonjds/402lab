import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, spacing, radius } = theme;

export const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  qrFrame: {
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  qrMark: { color: colors.lime, fontSize: 40 },
  center: { textAlign: 'center' },
  lead: { color: colors.muted },
  footer: { paddingBottom: spacing.md },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.raised,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
});
