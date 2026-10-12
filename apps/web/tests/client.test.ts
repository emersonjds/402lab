import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { API_ERROR_MESSAGES, apiRequest, ApiError } from '@/shared/api/client';
import { allowanceListSchema } from '@/shared/api/schemas';

import { API, mockSignIn, mockSignOut, server } from './server';

const kindOf = async (promise: Promise<unknown>): Promise<string> => {
  const caught: unknown = await promise.catch((error: unknown) => error);
  if (!(caught instanceof ApiError)) throw new Error(`expected ApiError, got ${String(caught)}`);
  return caught.kind;
};

describe('apiRequest', () => {
  beforeEach(mockSignIn);
  afterEach(mockSignOut);

  it('parses a mock API response with its schema', async () => {
    const result = await apiRequest('/allowances', { schema: allowanceListSchema });

    expect(result.allowances).toHaveLength(6);
    expect(result.allowances[0]?.perCallCap).toMatch(/^\d+$/);
  });

  it('turns a schema mismatch into an unexpected error with fixed copy', async () => {
    const promise = apiRequest('/allowances', { schema: z.object({ nope: z.string() }) });

    await expect(promise).rejects.toThrow(API_ERROR_MESSAGES.unexpected);
  });

  it('turns a non-JSON body into an unexpected error', async () => {
    server.use(http.get(`${API}/services`, () => new HttpResponse('<html>oops</html>')));

    expect(await kindOf(apiRequest('/services', { schema: z.unknown() }))).toBe('unexpected');
  });

  it('reads an empty body as null', async () => {
    expect(await apiRequest('/auth/logout', { method: 'POST', schema: z.null() })).toBeNull();
  });

  it('maps 401 to unauthorized once the session ends', async () => {
    await mockSignOut();

    expect(await kindOf(apiRequest('/allowances', { schema: allowanceListSchema }))).toBe(
      'unauthorized',
    );
  });

  it('maps 404 to notFound and keeps the server text out of the message', async () => {
    const caught = await apiRequest('/allowances/missing', { schema: z.unknown() }).catch(
      (error: unknown) => error,
    );

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      kind: 'notFound',
      status: 404,
      message: API_ERROR_MESSAGES.notFound,
    });
  });

  it.each([
    [400, 'invalid'],
    [429, 'rateLimited'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unexpected'],
  ])('maps status %i to %s', async (status, kind) => {
    server.use(http.get(`${API}/services`, () => HttpResponse.json({ error: 'leak' }, { status })));

    expect(await kindOf(apiRequest('/services', { schema: z.unknown() }))).toBe(kind);
  });

  it('maps a network failure to network', async () => {
    server.use(http.get(`${API}/services`, () => HttpResponse.error()));

    expect(await kindOf(apiRequest('/services', { schema: z.unknown() }))).toBe('network');
  });

  it('sends a JSON body on writes', async () => {
    const created = await apiRequest('/allowances', {
      method: 'POST',
      body: { agentName: 'tester', sessionAddress: 'Sess1', perCallCap: '1000', dailyCap: '5000' },
      schema: z.object({ agentName: z.string(), status: z.string() }),
    });

    expect(created).toEqual({ agentName: 'tester', status: 'active' });
  });

  it('aborts a request that hangs past 10 seconds', async () => {
    vi.useFakeTimers();
    // Node's AbortSignal.timeout runs on internal timers fake timers can't reach; route it
    // through the faked global setTimeout so the 10 s budget elapses instantly.
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(new DOMException('timed out', 'TimeoutError'));
      }, ms);
      return controller.signal;
    });
    try {
      server.use(http.get(`${API}/services`, async () => delay('infinite')));
      const pending = kindOf(apiRequest('/services', { schema: z.unknown() }));

      await vi.advanceTimersByTimeAsync(9_999);
      let settled = false;
      void pending.then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBe('network');
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally {
      timeout.mockRestore();
      vi.useRealTimers();
    }
  });

  it('honours a caller abort signal', async () => {
    server.use(http.get(`${API}/services`, async () => delay('infinite')));
    const controller = new AbortController();
    const pending = kindOf(
      apiRequest('/services', { schema: z.unknown(), signal: controller.signal }),
    );

    controller.abort();

    expect(await pending).toBe('network');
  });
});
