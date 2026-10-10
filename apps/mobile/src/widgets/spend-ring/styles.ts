import { StyleSheet } from 'react-native';

import { theme } from '@/shared/config/theme';

export const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  svg: { position: 'absolute' },
  amount: { fontSize: theme.size.display },
});
