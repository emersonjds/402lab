import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import { callerOf } from '../../shared/auth/authenticate.js';
import { errorSchema } from '../../shared/errors.js';
import type { EventsBus } from '../../shared/events-bus.js';

const HEARTBEAT_INTERVAL_MS = 15_000;

export interface EventOptions {
  bus: EventsBus;
}

export const eventRoutes: FastifyPluginCallbackZod<EventOptions> = (app, { bus }, done) => {
  app.get(
    '/events',
    {
      schema: {
        tags: ['events'],
        summary: "Server-sent stream of the caller's live events (one JSON LiveEvent per `data:`)",
        security: [{ cookie: [] }, { bearer: [] }],
        response: { 401: errorSchema },
      },
    },
    (request, reply) => {
      const ownerAddress = callerOf(request).address;
      const stream = reply.raw;

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

      stream.once('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  done();
};
