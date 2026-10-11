import type { ServerResponse } from 'node:http';

import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import { callerOf } from '../../shared/auth/authenticate.js';
import { AppError, errorSchema } from '../../shared/errors.js';
import type { EventsBus } from '../../shared/events-bus.js';

const HEARTBEAT_INTERVAL_MS = 15_000;
const STREAMS_PER_OWNER = 3;
/** setTimeout fires at once past 2^31-1 ms (~24.8 days). */
const MAX_TIMER_MS = 2 ** 31 - 1;

export interface EventOptions {
  bus: EventsBus;
}

/** `GET /events`: a `text/event-stream` of the caller's own `LiveEvent`s, hijacked past
 * Fastify's reply pipeline (no response schema past 2xx, since the body is never one JSON
 * document). Each `data:` line is one JSON-encoded `LiveEvent` from `@402lab/shared/events`:
 * `payment.settled`, `split.confirmed`, `split.failed`, `allowance.cap_reached` or
 * `allowance.updated`, plus a `: heartbeat` comment every 15s to keep the connection alive. */
export const eventRoutes: FastifyPluginCallbackZod<EventOptions> = (app, { bus }, done) => {
  const openStreams = new Map<string, Set<ServerResponse>>();

  // Fastify's own onClose waits for open connections: streams end before it.
  app.addHook('preClose', (closed) => {
    openStreams.forEach((streams) => {
      streams.forEach((stream) => stream.end());
    });
    closed();
  });

  /** Web or mobile. Caps streams per owner rather than per connection, so one owner cannot
   * starve the process by opening the feed from many tabs or devices at once. */
  app.get(
    '/events',
    {
      schema: {
        tags: ['events'],
        summary:
          "Server-sent stream of the caller's live events (one JSON LiveEvent per `data:`); at most 3 per owner, closed when the session expires",
        security: [{ cookie: [] }, { bearer: [] }],
        response: { 401: errorSchema, 403: errorSchema, 429: errorSchema },
      },
    },
    (request, reply) => {
      const { address: ownerAddress, expiresAt } = callerOf(request);
      const streams = openStreams.get(ownerAddress) ?? new Set<ServerResponse>();
      if (streams.size >= STREAMS_PER_OWNER) throw new AppError(429, 'too_many_streams');

      const stream = reply.raw;
      streams.add(stream);
      openStreams.set(ownerAddress, streams);

      reply.hijack();
      stream.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      stream.write(': connected\n\n');

      const unsubscribe = bus.subscribe(ownerAddress, (event) => {
        stream.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => {
        stream.write(': heartbeat\n\n');
      }, HEARTBEAT_INTERVAL_MS);
      const sessionEnd = setTimeout(
        () => {
          stream.end();
        },
        Math.min(MAX_TIMER_MS, Math.max(0, expiresAt * 1000 - Date.now())),
      );

      stream.once('close', () => {
        clearInterval(heartbeat);
        clearTimeout(sessionEnd);
        unsubscribe();
        streams.delete(stream);
        if (streams.size === 0) openStreams.delete(ownerAddress);
      });
    },
  );

  done();
};
