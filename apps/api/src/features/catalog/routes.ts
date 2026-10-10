import type { Service, ServiceId } from '@402lab/shared';
import type { FastifyPluginCallback } from 'fastify';

import type { ServiceListResponse, ServiceMode } from './schemas.js';

export interface CatalogOptions {
  catalog: Service[];
  modes: Record<ServiceId, ServiceMode>;
}

export const catalogRoutes: FastifyPluginCallback<CatalogOptions> = (
  app,
  { catalog, modes },
  done,
) => {
  const listing: ServiceListResponse = {
    services: catalog.map(({ id, name, description, upstream, price }) => ({
      id,
      name,
      description,
      upstream,
      price: price.toString(),
      mode: modes[id],
    })),
  };

  app.get('/services', () => listing);

  done();
};
