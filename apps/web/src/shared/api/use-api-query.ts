'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

import { apiRequest, ApiError } from './client';

export type ApiQueryState<Data> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Data };

export type ApiQueryResult<Data> = ApiQueryState<Data> & { refetch: () => void };

type Settled<Data> =
  | { key: string; status: 'error'; message: string }
  | { key: string; status: 'ready'; data: Data };

/**
 * Fetches `path` on mount and whenever it changes, parsing the response with
 * `schema`. A 401 sends the caller back to `/app` to reconnect, per the
 * contract that every route's unauthorized response means "sign in again".
 * Pass `null` as `path` to skip the request (e.g. while a dependency loads).
 */
export const useApiQuery = <Schema extends z.ZodType>(
  path: string | null,
  schema: Schema,
): ApiQueryResult<z.infer<Schema>> => {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<z.infer<Schema>> | null>(null);
  const key = `${path ?? ''}:${String(tick)}`;

  useEffect(() => {
    if (path === null) return undefined;

    const controller = new AbortController();

    apiRequest(path, { schema, signal: controller.signal })
      .then((data) => {
        setSettled({ key, status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.kind === 'unauthorized') {
          router.replace('/app');
          return;
        }

        setSettled({
          key,
          status: 'error',
          message: error instanceof ApiError ? error.message : 'Something went wrong.',
        });
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already encodes path and tick
  }, [path, key, router]);

  const refetch = () => {
    setTick((value) => value + 1);
  };

  if (settled === null || settled.key !== key) return { status: 'loading', refetch };

  return { ...settled, refetch };
};
