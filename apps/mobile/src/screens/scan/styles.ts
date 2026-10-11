import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

const { colors, spacing, radius, touch } = theme;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFill },
  overlay: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  close: {
    width: touch,
    height: touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeText: { color: colors.text, fontSize: 20 },
  frame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.lime,
  },
  bottom: { minHeight: 72, justifyContent: 'center' },
  hint: { textAlign: 'center' },
  toast: {
    backgroundColor: colors.raised,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
  },
});
