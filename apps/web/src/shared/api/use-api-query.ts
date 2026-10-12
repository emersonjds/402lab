'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';

import { apiRequest, ApiError } from './client';

export type ApiQueryState<Data> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Data };

export type ApiQueryResult<Data> = ApiQueryState<Data> & { refetch: () => void };

/**
 * Cached GET of `path`, parsed with `schema`. Pass `null` as `path` to skip the request
 * (e.g. while a dependency loads). A 401 redirects to `/app` from the QueryClient, so here it
 * just stays loading.
 */
export const useApiQuery = <Schema extends z.ZodType>(
  path: string | null,
  schema: Schema,
): ApiQueryResult<z.infer<Schema>> => {
  const query = useQuery({
    queryKey: ['api', path],
    queryFn:
      path === null
        ? skipToken
        : ({ signal }): Promise<z.infer<Schema>> => apiRequest(path, { schema, signal }),
  });
  const refetch = () => {
    void query.refetch();
  };

  if (query.status === 'success') return { status: 'ready', data: query.data, refetch };
  if (query.status === 'error' && !(query.error instanceof ApiError && query.error.kind === 'unauthorized')) {
    return {
      status: 'error',
      message: query.error instanceof ApiError ? query.error.message : 'Something went wrong.',
      refetch,
    };
  }
  return { status: 'loading', refetch };
};
