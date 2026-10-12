'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { FlaskLoader } from '@/components/ui/flask-loader';

import { MOCKING_ENABLED } from './is-enabled';

/**
 * Gates the first render on the MSW worker being active so no page ever fetches before the
 * mocks are in place. A no-op passthrough when `NEXT_PUBLIC_API_MOCKING` isn't "enabled".
 */
export const MockBoundary = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(!MOCKING_ENABLED);

  useEffect(() => {
    if (!MOCKING_ENABLED) return;

    void import('./browser')
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return <FlaskLoader />;
  }

  return children;
};
