import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Database } from '../../shared/db/pool.js';
import { errorSchema } from '../../shared/errors.js';
import { joinWaitlist } from './repository.js';

const SIGN_UPS_PER_MINUTE = 5;

const joinBodySchema = z
  .object({ email: z.email().max(254).toLowerCase() })
  .meta({ id: 'WaitlistSignUp' });

export interface WaitlistOptions {
  db: Database;
}

export const waitlistRoutes: FastifyPluginCallbackZod<WaitlistOptions> = (app, { db }, done) => {
  app.post(
    '/waitlist',
    {
      config: { public: true, rateLimit: { max: SIGN_UPS_PER_MINUTE, timeWindow: '1 minute' } },
      schema: {
        tags: ['waitlist'],
        summary: 'Join the waitlist; answers 201 whether or not the e-mail was already there',
        body: joinBodySchema,
        response: { 201: z.null(), 400: errorSchema, 429: errorSchema },
      },
    },
    async (request, reply) => {
      await joinWaitlist(db, request.body.email);

      return reply.code(201).send(null);
    },
  );

  done();
};
