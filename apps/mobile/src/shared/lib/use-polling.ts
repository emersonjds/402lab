import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export const POLL_INTERVAL_MS = 3_000;

// Runs `task` now and every interval while the screen is focused; blur or unmount clears it.
export const usePolling = (task: () => Promise<unknown>, intervalMs = POLL_INTERVAL_MS): void => {
  useFocusEffect(
    useCallback(() => {
      void task();
      const timer = setInterval(() => {
        void task();
      }, intervalMs);

      return () => {
        clearInterval(timer);
      };
    }, [task, intervalMs]),
  );
};
