'use client';

import { liveEventSchema, type LiveEvent } from '@402lab/shared';
import { useEffect, useRef } from 'react';

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Subscribes to the caller's SSE stream at `/api/events` and calls `onEvent`
 * for every parsed `LiveEvent`. Reconnects with exponential backoff (capped
 * at 30s, reset on a successful open) so a dropped connection or a server
 * restart recovers on its own.
 */
export const useLiveEvents = (onEvent: (event: LiveEvent) => void): void => {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let closed = false;
    let source: EventSource | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      source = new EventSource('/api/events');

      source.onopen = () => {
        attempt = 0;
      };

      source.onmessage = (message) => {
        try {
          const parsed = liveEventSchema.safeParse(JSON.parse(String(message.data)));
          if (parsed.success) handlerRef.current(parsed.data);
        } catch {
          // Malformed frame: drop it, the stream keeps going.
        }
      };

      source.onerror = () => {
        source?.close();
        if (closed) return;

        const delay = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, []);
};
