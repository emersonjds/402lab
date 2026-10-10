import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, font, size, spacing, radius, touch } = theme;

export const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.raised,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  provider: { color: colors.muted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  signature: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  signatureText: { flex: 1, fontSize: size.caption },
  copy: {
    minWidth: touch,
    minHeight: touch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: { color: colors.text, fontFamily: font.bodyStrong, fontSize: size.body },
  link: { minHeight: touch, justifyContent: 'center' },
  linkText: { color: colors.cyan, fontFamily: font.bodyStrong, fontSize: size.body },
});
