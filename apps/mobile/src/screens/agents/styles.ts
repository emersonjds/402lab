import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, font, spacing, radius } = theme;

export const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryItem: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.lg },
  summaryLabel: { fontSize: 11, letterSpacing: 1 },
  summaryValue: { fontFamily: font.mono, fontSize: 18, color: colors.text, marginTop: spacing.xs },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 88,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { fontFamily: font.bodyStrong },
  empty: { textAlign: 'center', marginTop: spacing.xl },
});
