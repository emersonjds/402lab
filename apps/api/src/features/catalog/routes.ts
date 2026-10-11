import type { Service, ServiceId } from '@402lab/shared';
import type { FastifyPluginCallback } from 'fastify';

import { serviceListResponseSchema, type ServiceListResponse, type ServiceMode } from './schemas.js';

export interface CatalogOptions {
  catalog: Service[];
  modes: Record<ServiceId, ServiceMode>;
}

/** Public: the price list every client (web, mobile, MCP) reads before calling `/svc/:id`. */
export const catalogRoutes: FastifyPluginCallback<CatalogOptions> = (
  app,
  { catalog, modes },
  done,
) => {
  const listing: ServiceListResponse = {
    services: catalog.map(({ id, name, description, upstream, provider, price }) => ({
      id,
      name,
      description,
      upstream,
      provider,
      price: price.toString(),
      mode: modes[id],
    })),
  };

  app.get(
    '/services',
    {
      config: { public: true },
      schema: {
        tags: ['catalog'],
        summary: 'Paid services on offer, with price and whether each runs live or in demo mode',
        response: { 200: serviceListResponseSchema },
      },
    },
    () => listing,
  );

  done();
};
