'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useSessionStore } from '@/shared/auth/session-context';

import { ApiError } from './client';

const isFinal = (error: Error): boolean =>
  error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'notFound');

/** One QueryClient per browser tab. Every route's 401 means "sign in again", so the redirect
 * lives here once instead of in each hook. */
export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.kind === 'unauthorized') router.replace('/app');
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => !isFinal(error) && failureCount < 1,
          },
        },
      }),
  );

  useEffect(() => {
    void useSessionStore.persist.rehydrate();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
