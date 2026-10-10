// React Native has no URL/TextEncoder globals; msw needs both to parse request URLs and bodies.
import 'react-native-url-polyfill/auto';
import 'fast-text-encoding';

// `@402lab/mocks` registers one `sse()` handler for the web dashboard's live feed. Building that
// handler needs `EventTarget`/`EventSource` to exist at import time — Hermes has neither — even
// though the phone polls REST instead and never opens the connection.
if (typeof globalThis.EventTarget === 'undefined') {
  Object.assign(globalThis, {
    EventTarget: class NoopEventTarget {
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return true;
      }
    },
  });
}
function NoopEventSource(): void {}
if (typeof globalThis.EventSource === 'undefined') {
  Object.assign(globalThis, { EventSource: NoopEventSource });
}

import { handlers } from '@402lab/mocks';
import { getResponse } from 'msw';

let started = false;

/**
 * Resolves every `fetch` against the shared `@402lab/mocks` handlers, falling back to the real
 * network for anything unmatched. msw 3 dropped the `msw/native` entrypoint and its remaining
 * `setupServer` (`msw/node`) needs Node's `http`/`async_hooks` modules that don't exist in React
 * Native, so this calls msw's lower-level `getResponse` directly — the same handler-matching
 * logic `setupServer`/`setupWorker` use internally, documented and exported from `msw` itself.
 */
export const startMockServer = (): Promise<void> => {
  if (started) return Promise.resolve();
  started = true;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const mocked = await getResponse(handlers, request);
    return mocked ?? originalFetch(input, init);
  };

  return Promise.resolve();
};
