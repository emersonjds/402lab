import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { API_ERROR_MESSAGES, ApiError, apiRequest } from './client';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const stubFetch = (response: Response | Error) => {
  const fetchMock = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const catchApiError = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
};

describe('apiRequest', () => {
  it('calls the same-origin proxy and returns the parsed body', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { id: 'a1', spent: '5000' }));

    const result = await apiRequest('/allowances/a1', {
      schema: z.object({ id: z.string(), spent: z.string() }),
    });

    expect(result).toEqual({ id: 'a1', spent: '5000' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/allowances/a1',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('sends a JSON body and accepts an empty 201', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 201 }));

    await expect(
      apiRequest('/waitlist', { method: 'POST', body: { email: 'a@b.co' }, schema: z.null() }),
    ).resolves.toBeNull();

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"email":"a@b.co"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('turns a server error into fixed copy and never exposes the server body', async () => {
    stubFetch(jsonResponse(500, { error: 'relation "users" does not exist' }));

    const error = await catchApiError(apiRequest('/allowances', { schema: z.array(z.string()) }));

    expect(error.kind).toBe('server');
    expect(error.status).toBe(500);
    expect(error.message).toBe(API_ERROR_MESSAGES.server);
    expect(error.message).not.toContain('relation');
  });

  it.each([
    [400, 'invalid'],
    [401, 'unauthorized'],
    [404, 'notFound'],
    [429, 'rateLimited'],
    [418, 'unexpected'],
  ] as const)('maps status %i to %s', async (status, kind) => {
    stubFetch(jsonResponse(status, { error: 'leaky detail' }));

    const error = await catchApiError(apiRequest('/x', { schema: z.null() }));

    expect(error.kind).toBe(kind);
    expect(error.message).toBe(API_ERROR_MESSAGES[kind]);
  });

  it('reports a network failure with fixed copy', async () => {
    stubFetch(new TypeError('getaddrinfo ENOTFOUND api.internal'));

    const error = await catchApiError(apiRequest('/x', { schema: z.null() }));

    expect(error.kind).toBe('network');
    expect(error.status).toBeNull();
    expect(error.message).toBe(API_ERROR_MESSAGES.network);
  });

  it('rejects a body that does not match the schema', async () => {
    stubFetch(jsonResponse(200, { id: 42 }));

    const error = await catchApiError(apiRequest('/x', { schema: z.object({ id: z.string() }) }));

    expect(error.kind).toBe('unexpected');
  });

  it('rejects a body that is not JSON', async () => {
    stubFetch(new Response('<html>bad gateway</html>', { status: 200 }));

    const error = await catchApiError(apiRequest('/x', { schema: z.null() }));

    expect(error.kind).toBe('unexpected');
    expect(error.message).not.toContain('gateway');
  });
});
