import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { z } from 'zod';

/** Clients branch on `error`; no route answers with upstream, RPC or database text. */
export const errorSchema = z.object({ error: z.string() }).meta({ id: 'Error' });

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'AppError';
  }

  static unauthorized = (): AppError => new AppError(401, 'unauthorized');
  static notFound = (): AppError => new AppError(404, 'not_found');
}

/** Fastify stamps `statusCode` on faults it raises before a route runs (bad JSON, payload too large). */
const clientFaultStatusOf = (error: unknown): number | undefined => {
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined;

  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
};

/** The one place a thrown error becomes an HTTP response: an `AppError` keeps its status and
 * code, a Zod validation failure becomes 400, any other client-fault status becomes a fixed
 * `bad_request`, and everything else is logged and answered as a bare 500. */
export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: 'not_found' }));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({ error: error.code });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({ error: 'invalid_input' });
    }

    const clientFaultStatus = clientFaultStatusOf(error);
    if (clientFaultStatus !== undefined) {
      return reply.status(clientFaultStatus).send({ error: 'bad_request' });
    }

    request.log.error({ err: error }, 'unhandled failure');
    return reply.status(500).send({ error: 'internal_error' });
  });
};
