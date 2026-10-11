import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, spacing, radius, touch } = theme;

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  back: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 36 },
  title: { flex: 1 },
  hero: { alignItems: 'stretch', gap: spacing.md, paddingVertical: spacing.md },
  caption: { textAlign: 'center', fontSize: 11, letterSpacing: 1 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  statItem: { alignItems: 'center', gap: spacing.xs },
  feedLabel: { fontSize: 11, letterSpacing: 1, marginTop: spacing.sm },
  list: { gap: spacing.xs, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  rowBody: { flex: 1 },
});
