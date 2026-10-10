'use client';

import { handlers } from '@402lab/mocks';
import { setupWorker } from 'msw/browser';

import { registerMockWallet } from './mock-wallet';

let started: Promise<void> | null = null;

/** Starts the MSW service worker once per page load; safe to call from more than one mount. */
export const startMockWorker = (): Promise<void> => {
  started ??= setupWorker(...handlers)
    .start({ onUnhandledFrame: 'bypass' })
    .then(() => {
      registerMockWallet();
    });

  return started;
};
