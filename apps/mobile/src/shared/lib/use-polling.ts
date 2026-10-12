import { useIsFocused } from 'expo-router';

export const POLL_INTERVAL_MS = 3_000;

// Spread into `useQuery`: polls every interval while the screen is focused; a blurred screen
// unsubscribes, which stops its timer. Background pauses via `focusManager` (see app layout).
export const useLivePolling = () => ({
  refetchInterval: POLL_INTERVAL_MS,
  subscribed: useIsFocused(),
});
