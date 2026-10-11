import type { z } from 'zod';

const API_BASE = '/api';

export const API_ERROR_MESSAGES = {
  network: "Can't reach 402Lab. Check your connection and try again.",
  invalid: 'Some details look wrong. Check them and try again.',
  unauthorized: 'Your session ended. Connect your wallet again.',
  notFound: "We couldn't find that.",
  rateLimited: 'Too many attempts. Wait a minute and try again.',
  server: 'Something went wrong on our side. Try again in a moment.',
  unexpected: 'Unexpected response from 402Lab. Try again in a moment.',
} as const;

export type ApiErrorKind = keyof typeof API_ERROR_MESSAGES;

/** Carries only fixed copy: the server, facilitator or RPC text never reaches the UI. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
  ) {
    super(API_ERROR_MESSAGES[kind]);
    this.name = 'ApiError';
  }
}

const kindOfStatus = (status: number): ApiErrorKind => {
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401) return 'unauthorized';
  if (status === 403 || status === 404) return 'notFound';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'unexpected';
};

export interface ApiRequestOptions<Schema extends z.ZodType> {
  schema: Schema;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

const parseJson = (text: string): unknown => {
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('unexpected', null);
  }
};

export const apiRequest = async <Schema extends z.ZodType>(
  path: string,
  { schema, method = 'GET', body, signal }: ApiRequestOptions<Schema>,
): Promise<z.infer<Schema>> => {
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (signal) init.signal = signal;
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError('network', null);
  }

  if (!response.ok) throw new ApiError(kindOfStatus(response.status), response.status);

  const parsed = schema.safeParse(parseJson(await response.text()));
  if (!parsed.success) throw new ApiError('unexpected', response.status);

  return parsed.data;
};
