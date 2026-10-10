import type { Service } from '@402lab/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import { callerOf } from '../../shared/auth/authenticate.js';
import type { Database } from '../../shared/db/pool.js';
import { AppError, errorSchema } from '../../shared/errors.js';
import type { EventsBus } from '../../shared/events-bus.js';
import {
  type AllowanceWithSpend,
  createAllowance,
  findOwnedAllowance,
  findSessionAllowance,
  listAllowances,
  listPaymentsAfter,
  listPaymentsBetween,
  updateAllowance,
} from './repository.js';
import {
  allowanceIdParamsSchema,
  allowanceListSchema,
  allowanceSchema,
  createAllowanceBodySchema,
  paymentListSchema,
  paymentsQuerySchema,
  sessionAllowanceSchema,
  sessionParamsSchema,
  statementQuerySchema,
  statementSchema,
  updateAllowanceBodySchema,
} from './schemas.js';
import { buildStatement, monthRange, toPaymentView } from './statement.js';

export interface AllowanceOptions {
  db: Database;
  bus: EventsBus;
  now: () => Date;
  catalog: Service[];
}

const toView = (allowance: AllowanceWithSpend) => ({
  id: allowance.id,
  agentName: allowance.agentName,
  sessionAddress: allowance.sessionAddress,
  status: allowance.status,
  perCallCap: allowance.perCallCap.toString(),
  dailyCap: allowance.dailyCap.toString(),
  spentToday: allowance.spentToday.toString(),
  createdAt: allowance.createdAt.toISOString(),
});

const SECURITY = [{ cookie: [] }, { bearer: [] }];

/** Allowances, their spend and their payment history. Every route but
 * `/allowances/by-session/:address` requires the owner's own session. */
export const allowanceRoutes: FastifyPluginCallbackZod<AllowanceOptions> = (
  app,
  { db, bus, now, catalog },
  done,
) => {
  /** 404 for an allowance id that exists but belongs to another owner: ownership is the WHERE
   * clause in `findOwnedAllowance`, never a check made after the row is already fetched. */
  const ownedAllowance = async (ownerAddress: string, id: string) => {
    const allowance = await findOwnedAllowance(db, { ownerAddress, id, now: now() });
    if (!allowance) throw AppError.notFound();

    return allowance;
  };

  /** Web or mobile. One allowance per session wallet; a second attempt answers 409. */
  app.post(
    '/allowances',
    {
      schema: {
        tags: ['allowances'],
        summary: 'Give an agent session wallet an allowance',
        security: SECURITY,
        body: createAllowanceBodySchema,
        response: {
          201: allowanceSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const created = await createAllowance(db, {
        ...request.body,
        ownerAddress: callerOf(request).address,
      });
      if (created === 'duplicate') throw new AppError(409, 'session_already_has_allowance');

      return reply.code(201).send(toView({ ...created, spentToday: 0n }));
    },
  );

  /** Web or mobile. */
  app.get(
    '/allowances',
    {
      schema: {
        tags: ['allowances'],
        summary: "The caller's allowances with today's spend",
        security: SECURITY,
        response: { 200: allowanceListSchema, 401: errorSchema },
      },
    },
    async (request) => ({
      allowances: (
        await listAllowances(db, { ownerAddress: callerOf(request).address, now: now() })
      ).map(toView),
    }),
  );

  /** Web or mobile. */
  app.get(
    '/allowances/:id',
    {
      schema: {
        tags: ['allowances'],
        summary: 'One allowance of the caller',
        security: SECURITY,
        params: allowanceIdParamsSchema,
        response: { 200: allowanceSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (request) => toView(await ownedAllowance(callerOf(request).address, request.params.id)),
  );

  /** Web freely; mobile only to flip `status` (see `MOBILE_ROUTES` in `shared/auth/authenticate.ts`).
   * A per-call cap above the daily cap answers 400 instead of writing the row. */
  app.patch(
    '/allowances/:id',
    {
      schema: {
        tags: ['allowances'],
        summary: 'Pause, resume or change the caps; publishes allowance.updated',
        security: SECURITY,
        params: allowanceIdParamsSchema,
        body: updateAllowanceBodySchema,
        response: {
          200: allowanceSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const ownerAddress = callerOf(request).address;
      const updated = await updateAllowance(db, {
        ownerAddress,
        id: request.params.id,
        changes: request.body,
      });
      if (!updated) throw AppError.notFound();
      if (updated === 'caps_inverted') throw new AppError(400, 'invalid_input');

      bus.publish(ownerAddress, {
        type: 'allowance.updated',
        allowanceId: updated.id,
        status: updated.status,
        perCallCap: updated.perCallCap.toString(),
        dailyCap: updated.dailyCap.toString(),
      });

      return toView(await ownedAllowance(ownerAddress, updated.id));
    },
  );

  /** Public: the MCP payer calls this with no session, by session wallet address, to learn the
   * caps it must stay under before it ever signs a payment. */
  app.get(
    '/allowances/by-session/:address',
    {
      config: { public: true },
      schema: {
        tags: ['allowances'],
        summary: 'Public policy of a session wallet, read by the MCP payer',
        params: sessionParamsSchema,
        response: { 200: sessionAllowanceSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request) => {
      const allowance = await findSessionAllowance(db, {
        sessionAddress: request.params.address,
        now: now(),
      });
      if (!allowance) throw AppError.notFound();

      const { status, perCallCap, dailyCap, spentToday } = toView(allowance);
      return { status, perCallCap, dailyCap, spentToday };
    },
  );

  /** Web or mobile; mobile polls this to render new payments without a live stream. */
  app.get(
    '/allowances/:id/payments',
    {
      schema: {
        tags: ['allowances'],
        summary: 'Mobile polling: up to 50 payments after the `after` cursor, oldest first',
        security: SECURITY,
        params: allowanceIdParamsSchema,
        querystring: paymentsQuerySchema,
        response: {
          200: paymentListSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const allowance = await ownedAllowance(callerOf(request).address, request.params.id);
      const payments = await listPaymentsAfter(db, {
        allowanceId: allowance.id,
        after: request.query.after,
      });

      return { payments: payments.map(toPaymentView) };
    },
  );

  /** Web or mobile. */
  app.get(
    '/allowances/:id/statement',
    {
      schema: {
        tags: ['allowances'],
        summary: 'Monthly statement (UTC) with split by recipient and card-cost comparison',
        security: SECURITY,
        params: allowanceIdParamsSchema,
        querystring: statementQuerySchema,
        response: {
          200: statementSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const allowance = await ownedAllowance(callerOf(request).address, request.params.id);
      const { month } = request.query;
      const payments = await listPaymentsBetween(db, {
        allowanceId: allowance.id,
        ...monthRange(month),
      });

      return buildStatement(month, payments, catalog);
    },
  );

  done();
};
