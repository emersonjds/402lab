import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, spacing, radius } = theme;

export const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  brand: { color: colors.text, fontSize: 18 },
  observer: { color: colors.lime, fontSize: 11, letterSpacing: 1, marginTop: 2 },
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
  bullets: { gap: spacing.xs, marginTop: spacing.sm, alignSelf: 'stretch' },
  bullet: { color: colors.amber },
  footer: { paddingBottom: spacing.md, gap: spacing.sm },
  footCaption: { textAlign: 'center', fontSize: 11, letterSpacing: 1, marginTop: spacing.xs },
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
