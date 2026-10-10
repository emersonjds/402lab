import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, font, size, spacing, radius, touch } = theme;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { flex: 1, paddingHorizontal: spacing.md },
  title: { color: colors.text, fontFamily: font.heading, fontSize: size.title },
  body: { color: colors.text, fontFamily: font.body, fontSize: size.body, lineHeight: 22 },
  muted: { color: colors.muted, fontFamily: font.body, fontSize: size.caption, lineHeight: 18 },
  mono: {
    color: colors.text,
    fontFamily: font.mono,
    fontSize: size.body,
    fontVariant: ['tabular-nums'],
  },
  button: {
    minHeight: 48,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonLarge: { minHeight: 56 },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: font.bodyStrong, fontSize: size.body, color: colors.onAccent },
  primary: { backgroundColor: colors.lime },
  warning: { backgroundColor: colors.amber },
  ghost: { borderWidth: 1, borderColor: colors.border },
  ghostText: { color: colors.text },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: colors.amber, fontFamily: font.mono, fontSize: 11, letterSpacing: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touch,
    marginBottom: spacing.md,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
  },
  pillText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1 },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
});
